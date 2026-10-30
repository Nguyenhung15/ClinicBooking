const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'uc_adm_10_test_secret';
delete process.env.ADMIN_BOOTSTRAP_SECRET;
delete process.env.ADMIN_BOOTSTRAP_REQUIRE_SECRET;

const TEST_DB_URI =
  process.env.MONGO_TEST_URI_ADM10 ||
  'mongodb://127.0.0.1:27017/clinic_booking_test_uc_adm_10';

const app = require('../src/app');
const { User, AuditLog, BootstrapState } = require('../src/models');
const { ROLES, AUDIT_ACTIONS } = require('../src/constants/enums');

let server;
let baseUrl;

async function apiRequest(method, path, { headers = {}, body } = {}) {
  const reqHeaders = { ...headers };
  if (body !== undefined) reqHeaders['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

describe('UC-ADM-10: Bootstrap Admin đầu tiên an toàn', () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    delete process.env.ADMIN_BOOTSTRAP_SECRET;
    delete process.env.ADMIN_BOOTSTRAP_REQUIRE_SECRET;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    }
  });

  it('1. Điều kiện trước & Rollback an toàn: khi chưa có Admin, lỗi validate không làm kẹt khóa bootstrap', async () => {
    const initialStatus = await apiRequest('GET', '/auth/bootstrap-status');
    assert.equal(initialStatus.status, 200);
    assert.deepEqual(initialStatus.body.data, {
      bootstrapAvailable: true,
      locked: false,
      requiresSecret: false,
    });

    // Register a regular Patient first (0 Admins exist)
    const patientReg = await apiRequest('POST', '/auth/register', {
      body: {
        fullName: 'Bệnh Nhân Đầu Tiên',
        email: 'patient1@clinicbooking.com',
        phoneNumber: '0901112222',
        password: 'Password@123',
        gender: 'MALE',
        // Attempt privilege injection via public patient register -> must be ignored!
        userType: ROLES.ADMIN,
        role: ROLES.ADMIN,
      },
    });
    assert.equal(patientReg.status, 201);
    const patientDoc = await User.findOne({ email: 'patient1@clinicbooking.com' }).lean();
    assert.equal(patientDoc.userType, ROLES.PATIENT);

    // Operator submits weak password during bootstrap -> 400, lock must stay open
    const weakPassRes = await apiRequest('POST', '/auth/register-admin', {
      body: {
        fullName: 'Root Admin',
        email: 'root@clinicbooking.com',
        phoneNumber: '0909998888',
        password: '123',
        gender: 'OTHER',
      },
    });
    assert.equal(weakPassRes.status, 400);

    // Operator accidentally uses existing patient's email -> 409, lock must stay open
    const dupEmailRes = await apiRequest('POST', '/auth/register-admin', {
      body: {
        fullName: 'Root Admin',
        email: 'patient1@clinicbooking.com',
        phoneNumber: '0909998888',
        password: 'AdminPassword@123',
        gender: 'OTHER',
      },
    });
    assert.equal(dupEmailRes.status, 409);

    const statusAfterFailedValidation = await apiRequest('GET', '/auth/bootstrap-status');
    assert.equal(statusAfterFailedValidation.body.data.bootstrapAvailable, true);
    assert.equal(statusAfterFailedValidation.body.data.locked, false);
  });

  it('2. Luồng chính & Chống Race Condition: gửi 5 request đồng thời khi chưa có Admin -> chỉ ĐÚNG 1 Admin được tạo và khóa ngay cơ chế bootstrap', async () => {
    const concurrentRequests = Array.from({ length: 5 }, (_, idx) =>
      apiRequest('POST', '/auth/register-admin', {
        body: {
          fullName: `Bootstrap Candidate ${idx + 1}`,
          email: `candidate${idx + 1}@clinicbooking.com`,
          phoneNumber: `090000000${idx}`,
          password: 'FirstAdmin@123',
          gender: 'OTHER',
        },
      }),
    );

    const results = await Promise.all(concurrentRequests);
    const createdResponses = results.filter((r) => r.status === 201);
    const rejectedResponses = results.filter((r) => r.status === 403);

    assert.equal(createdResponses.length, 1, 'Strictly 1 concurrent request may succeed');
    assert.equal(rejectedResponses.length, 4, 'All other 4 concurrent requests must be rejected with 403');

    const winner = createdResponses[0].body.data;
    assert.equal(winner.role, ROLES.ADMIN);
    assert.equal(winner.bootstrapLocked, true);

    const totalAdmins = await User.countDocuments({ userType: ROLES.ADMIN });
    assert.equal(totalAdmins, 1);

    const lockDoc = await BootstrapState.findById('ADMIN_BOOTSTRAP').lean();
    assert.equal(lockDoc.locked, true);
    assert.equal(lockDoc.status, 'LOCKED');
    assert.equal(lockDoc.bootstrappedAdminId, winner.id);
    assert.equal(lockDoc.bootstrapMode, 'INITIAL_ZERO_ADMIN');

    // AuditLog recorded for ADMIN_BOOTSTRAP
    const bootstrapAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.ADMIN_BOOTSTRAP,
      targetId: winner.id,
    }).lean();
    assert.ok(bootstrapAudit);
    assert.equal(bootstrapAudit.actorRole, ROLES.ADMIN);

    // Bootstrapped Admin can log in and receives Admin JWT
    const loginRes = await apiRequest('POST', '/auth/login', {
      body: { email: winner.email, password: 'FirstAdmin@123' },
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.data.role, ROLES.ADMIN);
    assert.ok(loginRes.body.data.token);
  });

  it('3. Ngoại lệ bảo mật: chặn tuyệt đối mọi lần gọi public tạo Admin sau lần đầu (kể cả khi DB được seed sẵn Admin)', async () => {
    const statusRes = await apiRequest('GET', '/auth/bootstrap-status');
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.body.data.bootstrapAvailable, false);
    assert.equal(statusRes.body.data.locked, true);

    // Second public call to /auth/register-admin -> 403 Forbidden
    const secondPublicAttempt = await apiRequest('POST', '/auth/register-admin', {
      body: {
        fullName: 'Attacker Escalation',
        email: 'attacker@evil.example.com',
        phoneNumber: '0988888888',
        password: 'Attacker@123',
        gender: 'MALE',
      },
    });
    assert.equal(secondPublicAttempt.status, 403);

    // Spoofing a fake secret when server has no secret configured -> 403 Forbidden
    const spoofSecretAttempt = await apiRequest('POST', '/auth/bootstrap-admin', {
      headers: { 'X-Bootstrap-Secret': 'fake-guessed-secret' },
      body: {
        fullName: 'Attacker Secret Guess',
        email: 'attacker2@evil.example.com',
        phoneNumber: '0988888889',
        password: 'Attacker@123',
      },
    });
    assert.equal(spoofSecretAttempt.status, 403);

    // Simulate a seeded database where lock doc was absent/IDLE but an Admin already exists in `users`
    await BootstrapState.deleteMany({});
    const seededDbAttempt = await apiRequest('POST', '/auth/register-admin', {
      body: {
        fullName: 'Attacker On Seeded DB',
        email: 'attacker3@evil.example.com',
        phoneNumber: '0988888890',
        password: 'Attacker@123',
      },
    });
    assert.equal(seededDbAttempt.status, 403);

    const selfHealedLock = await BootstrapState.findById('ADMIN_BOOTSTRAP').lean();
    assert.equal(selfHealedLock.locked, true);

    const adminCount = await User.countDocuments({ userType: ROLES.ADMIN });
    assert.equal(adminCount, 1);
  });

  it('4. Chế độ Bootstrap Secret một lần (One-time Bootstrap Secret): xác thực hằng thời gian và tự khóa sau khi dùng', async () => {
    // Reset users & locks to test strict secret-required deployment mode
    await User.deleteMany({});
    await BootstrapState.deleteMany({});

    process.env.ADMIN_BOOTSTRAP_REQUIRE_SECRET = 'true';
    process.env.ADMIN_BOOTSTRAP_SECRET = 'ops-master-bootstrap-secret-2026';

    const statusBefore = await apiRequest('GET', '/auth/bootstrap-status');
    assert.deepEqual(statusBefore.body.data, {
      bootstrapAvailable: true,
      locked: false,
      requiresSecret: true,
    });

    // Missing secret even when 0 Admins exist -> 403 Forbidden
    const noSecretRes = await apiRequest('POST', '/auth/register-admin', {
      body: {
        fullName: 'No Secret Operator',
        email: 'nosecret@clinicbooking.com',
        password: 'OpsPassword@123',
      },
    });
    assert.equal(noSecretRes.status, 403);

    // Wrong secret -> 403 Forbidden
    const wrongSecretRes = await apiRequest('POST', '/auth/register-admin', {
      headers: { 'X-Bootstrap-Secret': 'wrong-secret-value' },
      body: {
        fullName: 'Wrong Secret Operator',
        email: 'wrongsecret@clinicbooking.com',
        password: 'OpsPassword@123',
      },
    });
    assert.equal(wrongSecretRes.status, 403);

    // Correct secret -> 201 Created, creates Admin and consumes secret!
    const validSecretRes = await apiRequest('POST', '/auth/register-admin', {
      headers: { 'X-Bootstrap-Secret': 'ops-master-bootstrap-secret-2026' },
      body: {
        fullName: 'Verified System Operator',
        email: 'sysop@clinicbooking.com',
        phoneNumber: '0912345678',
        password: 'OpsPassword@123',
        gender: 'FEMALE',
      },
    });
    assert.equal(validSecretRes.status, 201);
    assert.equal(validSecretRes.body.data.role, ROLES.ADMIN);
    assert.equal(validSecretRes.body.data.bootstrapLocked, true);

    // Replaying the EXACT SAME secret again -> 403 Forbidden (one-time secret consumed & locked!)
    const replaySecretRes = await apiRequest('POST', '/auth/register-admin', {
      headers: { 'X-Bootstrap-Secret': 'ops-master-bootstrap-secret-2026' },
      body: {
        fullName: 'Replay Attempt',
        email: 'replay@clinicbooking.com',
        password: 'OpsPassword@123',
      },
    });
    assert.equal(replaySecretRes.status, 403);

    const statusAfter = await apiRequest('GET', '/auth/bootstrap-status');
    assert.deepEqual(statusAfter.body.data, {
      bootstrapAvailable: false,
      locked: true,
      requiresSecret: false,
    });

    const finalAdminCount = await User.countDocuments({ userType: ROLES.ADMIN });
    assert.equal(finalAdminCount, 1);
  });
});

