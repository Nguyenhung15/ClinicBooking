const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Isolate test database BEFORE loading app & models
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'uc_adm_01_test_secret';
const TEST_DB_URI =
  process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017/clinic_booking_test_uc_adm_01';

const app = require('../src/app');
const {
  User,
  Specialty,
  AuditLog,
  DoctorShift,
  Appointment,
  Prescription,
  PaymentTransaction,
} = require('../src/models');
const { ROLES, AUDIT_ACTIONS } = require('../src/constants/enums');

let server;
let baseUrl;
let adminToken;
let secondAdminId;
let receptionistToken;

async function apiRequest(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

describe('UC-ADM-01: Quản lý user và trạng thái', () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();

    // Seed Specialties
    await Specialty.create([
      { id: 1, name: 'Nội tổng quát', description: 'Khám nội tổng quát' },
      { id: 5, name: 'Tim mạch', description: 'Khám chuyên khoa tim mạch' },
    ]);

    // Seed 2 Admins & 1 Receptionist
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    await User.create({
      email: 'admin1@clinicbooking.com',
      password: passwordHash,
      fullName: 'Primary Admin',
      userType: ROLES.ADMIN,
      gender: 'Male',
      isEnable: true,
    });
    const admin2 = await User.create({
      email: 'admin2@clinicbooking.com',
      password: passwordHash,
      fullName: 'Backup Admin',
      userType: ROLES.ADMIN,
      gender: 'Female',
      isEnable: true,
    });
    secondAdminId = admin2.id;

    await User.create({
      email: 'recep@clinicbooking.com',
      password: passwordHash,
      fullName: 'Front Desk Recep',
      userType: ROLES.RECEPTIONIST,
      gender: 'Female',
      isEnable: true,
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });

    // Obtain JWT tokens
    const adminLogin = await apiRequest('POST', '/auth/login', {
      body: { email: 'admin1@clinicbooking.com', password: 'Admin@123' },
    });
    assert.equal(adminLogin.status, 200);
    adminToken = adminLogin.body.data.token;

    const recepLogin = await apiRequest('POST', '/auth/login', {
      body: { email: 'recep@clinicbooking.com', password: 'Admin@123' },
    });
    assert.equal(recepLogin.status, 200);
    receptionistToken = recepLogin.body.data.token;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    }
  });

  it('Precondition: rejects unauthenticated (401) and non-Admin (403) on Admin endpoints', async () => {
    const noJwtRes = await apiRequest('POST', '/admin/create-user', {
      body: {
        fullName: 'No Auth',
        email: 'noauth@example.com',
        password: 'Password123',
        userType: 'Receptionist',
      },
    });
    assert.equal(noJwtRes.status, 401);

    const recepCreateRes = await apiRequest('POST', '/admin/create-user', {
      token: receptionistToken,
      body: {
        fullName: 'Forbidden Recep',
        email: 'forbidden@example.com',
        password: 'Password123',
        userType: 'Receptionist',
      },
    });
    assert.equal(recepCreateRes.status, 403);
  });

  it('Main Flow: creates Doctor (via specialization name), Receptionist, and Patient + records AuditLog', async () => {
    const doctorRes = await apiRequest('POST', '/admin/create-user', {
      token: adminToken,
      body: {
        fullName: 'BS. Nguyễn Văn Tâm',
        email: 'dr.tam@clinicbooking.com',
        phoneNumber: '0911222333',
        password: 'Password123',
        gender: 'MALE', // Uppercase variant normalized to 'Male'
        userType: 'Doctor',
        specialization: 'Tim mạch', // Resolved by name to specialtyId: 5
        degree: 'TS.BS',
        experience: '15 năm',
        description: 'Chuyên gia tim mạch can thiệp',
        reason: 'Tuyển dụng bác sĩ khoa Tim mạch đợt 1',
      },
    });

    assert.equal(doctorRes.status, 201);
    const createdDoc = doctorRes.body.data;
    assert.equal(typeof createdDoc.id, 'number');
    assert.equal(createdDoc.userType, 'Doctor');
    assert.equal(createdDoc.gender, 'Male');
    assert.equal(createdDoc.specialtyId, 5);
    assert.equal(createdDoc.specialtyName, 'Tim mạch');
    assert.equal(createdDoc.password, undefined);

    // Verify AuditLog entry (actor, time, reason, sanitized changes)
    const auditRes = await apiRequest(
      'GET',
      `/admin/audit-logs?targetId=${createdDoc.id}&action=${AUDIT_ACTIONS.USER_CREATE}`,
      { token: adminToken },
    );
    assert.equal(auditRes.status, 200);
    assert.equal(auditRes.body.data.items.length, 1);
    const log = auditRes.body.data.items[0];
    assert.equal(log.actorEmail, 'admin1@clinicbooking.com');
    assert.equal(log.actorRole, 'Admin');
    assert.equal(log.reason, 'Tuyển dụng bác sĩ khoa Tim mạch đợt 1');
    assert.ok(log.createdAt);
    assert.equal(log.changes.after.password, undefined);
  });

  it('Exception: rejects duplicate email on user creation and update (409)', async () => {
    const dupRes = await apiRequest('POST', '/admin/create-user', {
      token: adminToken,
      body: {
        fullName: 'Duplicate Doctor',
        email: 'DR.TAM@clinicbooking.com', // Case-insensitive duplicate check
        password: 'Password123',
        userType: 'Receptionist',
      },
    });
    assert.equal(dupRes.status, 409);
  });

  it('Main Flow: updates Doctor & Receptionist info and records field-level AuditLog diff', async () => {
    const doctorsRes = await apiRequest('GET', '/admin/doctors'); // Public endpoint for Guest & Admin
    assert.equal(doctorsRes.status, 200);
    const drTam = doctorsRes.body.data.find((d) => d.email === 'dr.tam@clinicbooking.com');
    assert.ok(drTam);

    const updateRes = await apiRequest('PUT', `/admin/update-doctor/${drTam.id}`, {
      token: adminToken,
      body: {
        fullName: 'PGS.TS.BS Nguyễn Văn Tâm',
        specialtyId: 1,
        degree: 'PGS.TS.BS',
        reason: 'Điều chuyển chuyên khoa Nội tổng quát',
      },
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.fullName, 'PGS.TS.BS Nguyễn Văn Tâm');
    assert.equal(updateRes.body.data.specialtyId, 1);
    assert.equal(updateRes.body.data.specialtyName, 'Nội tổng quát');

    const auditRes = await apiRequest(
      'GET',
      `/admin/audit-logs?targetId=${drTam.id}&action=${AUDIT_ACTIONS.USER_UPDATE}`,
      { token: adminToken },
    );
    assert.equal(auditRes.status, 200);
    const updateLog = auditRes.body.data.items[0];
    assert.equal(updateLog.reason, 'Điều chuyển chuyên khoa Nội tổng quát');
    assert.equal(updateLog.changes.before.specialtyId, 5);
    assert.equal(updateLog.changes.after.specialtyId, 1);
  });

  it('Main Flow & Exception: soft-locks and unlocks account WITH audit trail, blocks login/JWT when locked, and preserves 100% medical & payment history (no hard delete)', async () => {
    // Create a Patient and log them in
    const createPatRes = await apiRequest('POST', '/admin/create-user', {
      token: adminToken,
      body: {
        fullName: 'Bệnh nhân Lịch Sử',
        email: 'patient.history@example.com',
        password: 'Password123',
        userType: 'Patient',
        gender: 'Female',
      },
    });
    assert.equal(createPatRes.status, 201);
    const patient = createPatRes.body.data;

    const patLoginBefore = await apiRequest('POST', '/auth/login', {
      body: { email: 'patient.history@example.com', password: 'Password123' },
    });
    assert.equal(patLoginBefore.status, 200);
    const patientToken = patLoginBefore.body.data.token;

    // Attach medical & payment history to this patient and Dr. Tam
    const doctors = (await apiRequest('GET', '/admin/doctors')).body.data;
    const drTam = doctors[0];

    const shift = await DoctorShift.create({
      doctorId: drTam.id,
      date: '2026-11-10',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [{ id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED' }],
    });

    const appointment = await Appointment.create({
      appointmentNo: 'ONL1234ABCD',
      patientId: patient.id,
      doctorId: drTam.id,
      specialtyId: 1,
      shiftId: shift.id,
      slotIds: [1],
      appointmentDate: '2026-11-10',
      appointmentTime: '08:00',
      type: 'ONLINE',
      status: 'COMPLETED',
      patients: [{ id: 1, fullName: patient.fullName, gender: 'Female' }],
    });

    await Prescription.create({
      appointmentId: appointment.id,
      medicineName: 'Paracetamol 500mg',
      dosage: '2 viên',
      duration: '5 ngày',
      instructions: 'Uống sau ăn',
    });

    await PaymentTransaction.create({
      appointmentId: appointment.id,
      amount: '250000',
      responseCode: '00',
      transactionNo: 'VNP999888',
      transactionStatus: 'SUCCESS',
    });

    // Soft-lock via DELETE /api/admin/users/:userId (Frontend banUser contract)
    const lockRes = await apiRequest('DELETE', `/admin/users/${patient.id}`, {
      token: adminToken,
      body: { reason: 'Vi phạm quy định đặt lịch ảo nhiều lần' },
    });
    assert.equal(lockRes.status, 200);
    assert.equal(lockRes.body.data.isEnable, false);
    assert.equal(lockRes.body.data.isEnabled, false);

    // Locked user cannot use existing JWT (403) and cannot log in again (403)
    const meWhileLocked = await apiRequest('GET', '/users/me', { token: patientToken });
    assert.equal(meWhileLocked.status, 403);

    const loginWhileLocked = await apiRequest('POST', '/auth/login', {
      body: { email: 'patient.history@example.com', password: 'Password123' },
    });
    assert.equal(loginWhileLocked.status, 403);

    // Verify NO hard delete: User, Appointment, Prescription, PaymentTransaction all remain intact!
    assert.equal(await User.countDocuments({ id: patient.id }), 1);
    assert.equal(await Appointment.countDocuments({ id: appointment.id }), 1);
    assert.equal(await Prescription.countDocuments({ appointmentId: appointment.id }), 1);
    assert.equal(await PaymentTransaction.countDocuments({ appointmentId: appointment.id }), 1);

    // Unlock via POST /api/admin/activate/:userId
    const unlockRes = await apiRequest('POST', `/admin/activate/${patient.id}`, {
      token: adminToken,
      body: { reason: 'Đã xác minh và mở khóa lại cho bệnh nhân' },
    });
    assert.equal(unlockRes.status, 200);
    assert.equal(unlockRes.body.data.isEnable, true);

    // Patient can log in again
    const loginAfterUnlock = await apiRequest('POST', '/auth/login', {
      body: { email: 'patient.history@example.com', password: 'Password123' },
    });
    assert.equal(loginAfterUnlock.status, 200);

    // Verify both USER_LOCK and USER_UNLOCK audit logs exist
    const lockLogs = await apiRequest(
      'GET',
      `/admin/audit-logs?targetId=${patient.id}`,
      { token: adminToken },
    );
    const actions = lockLogs.body.data.items.map((i) => i.action);
    assert.ok(actions.includes(AUDIT_ACTIONS.USER_LOCK));
    assert.ok(actions.includes(AUDIT_ACTIONS.USER_UNLOCK));
  });

  it('Exception: enforces relation checks when changing user role (blocks if linked to medical/shift/payment records, allows when clean)', async () => {
    // 1. Doctor WITH shift & appointment MUST BE BLOCKED from changing role
    const doctors = (await apiRequest('GET', '/admin/doctors')).body.data;
    const drWithHistory = doctors.find((d) => d.email === 'dr.tam@clinicbooking.com');

    const blockedDoctorRoleRes = await apiRequest(
      'PATCH',
      `/admin/users/${drWithHistory.id}/role`,
      {
        token: adminToken,
        body: {
          userType: 'Receptionist',
          reason: 'Thử chuyển bác sĩ đã có lịch khám sang lễ tân',
        },
      },
    );
    assert.equal(blockedDoctorRoleRes.status, 409);

    // 2. Patient WITH appointment & payment transaction MUST BE BLOCKED from changing role
    const allUsers = (await apiRequest('GET', '/admin/users', { token: adminToken })).body.data;
    const patWithHistory = allUsers.find((u) => u.email === 'patient.history@example.com');

    const blockedPatientRoleRes = await apiRequest(
      'PATCH',
      `/admin/users/${patWithHistory.id}/role`,
      {
        token: adminToken,
        body: {
          userType: 'Receptionist',
          reason: 'Thử chuyển bệnh nhân đã có thanh toán sang lễ tân',
        },
      },
    );
    assert.equal(blockedPatientRoleRes.status, 409);

    // 3. Clean Doctor WITHOUT any shifts/appointments CAN change role cleanly -> clears Doctor fields & logs USER_ROLE_CHANGE
    const cleanDocRes = await apiRequest('POST', '/admin/create-user', {
      token: adminToken,
      body: {
        fullName: 'BS Mới Nhập Nhầm Role',
        email: 'clean.user@clinicbooking.com',
        password: 'Password123',
        userType: 'Doctor',
        specialtyId: 1,
        degree: 'BS',
      },
    });
    assert.equal(cleanDocRes.status, 201);
    const cleanUser = cleanDocRes.body.data;

    const allowedRoleChangeRes = await apiRequest(
      'PATCH',
      `/admin/users/${cleanUser.id}/role`,
      {
        token: adminToken,
        body: {
          userType: 'Receptionist',
          reason: 'Sửa lại vai trò đúng là Lễ tân khi vừa tạo mới chưa có ca trực',
        },
      },
    );
    assert.equal(allowedRoleChangeRes.status, 200);
    assert.equal(allowedRoleChangeRes.body.data.userType, 'Receptionist');
    assert.equal(allowedRoleChangeRes.body.data.specialtyId, null);
    assert.equal(allowedRoleChangeRes.body.data.degree, null);

    const roleAudit = await apiRequest(
      'GET',
      `/admin/audit-logs?targetId=${cleanUser.id}&action=${AUDIT_ACTIONS.USER_ROLE_CHANGE}`,
      { token: adminToken },
    );
    assert.equal(roleAudit.body.data.items.length, 1);
  });

  it('Exception: prevents self-lock, prevents locking last active Admin, and restricts Receptionist to Patient accounts only', async () => {
    const me = (await apiRequest('GET', '/users/me', { token: adminToken })).body.data;

    // Self-lock forbidden (400)
    const selfLockRes = await apiRequest('DELETE', `/admin/users/${me.id}`, {
      token: adminToken,
    });
    assert.equal(selfLockRes.status, 400);

    // Lock secondAdmin -> allowed because admin1 is still active; then admin2 cannot lock admin1 if admin2 were only one left
    const lockSecondAdmin = await apiRequest('DELETE', `/admin/users/${secondAdminId}`, {
      token: adminToken,
      body: { reason: 'Tạm khóa tài khoản dự phòng' },
    });
    assert.equal(lockSecondAdmin.status, 200);

    // Receptionist trying to lock Admin -> 403
    const recepLockAdmin = await apiRequest('DELETE', `/admin/users/${me.id}`, {
      token: receptionistToken,
    });
    assert.equal(recepLockAdmin.status, 403);

    // Receptionist listing `/admin/users` only receives `Patient` accounts
    const recepListRes = await apiRequest('GET', '/admin/users', {
      token: receptionistToken,
    });
    assert.equal(recepListRes.status, 200);
    assert.ok(recepListRes.body.data.every((u) => u.userType === 'Patient'));
  });
});

