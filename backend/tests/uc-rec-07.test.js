const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'uc_rec_07_test_secret_key';
const TEST_DB_URI =
  process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017/clinic_booking_test_uc_rec_07';

const app = require('../src/app');
const {
  User,
  Event,
  EventRegistration,
  Voucher,
  UserVoucher,
  AuditLog,
} = require('../src/models');
const { ROLES, AUDIT_ACTIONS } = require('../src/constants/enums');
const { signAccessToken } = require('../src/utils/jwt');
const { setClock, createFakeClock, RealClock } = require('../src/services/clock.service');

let server;
let baseUrl;

let receptionist1;
let receptionist1Token;
let receptionist2;
let receptionist2Token;
let admin1;
let admin1Token;
let doctor1;
let doctor1Token;
let patient1;
let patient1Token;
let patient2;
let patient2Token;

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

describe('UC-REC-07: Lễ tân xác nhận người tham dự event', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    await mongoose.connection.dropDatabase();

    // Ensure model indexes are created (especially unique index eventId+userId)
    await EventRegistration.init();

    const passwordHash = await bcrypt.hash('Secret@123', 10);

    // Receptionist 1
    receptionist1 = await User.create({
      id: 201,
      email: 'recep1_rec07@clinic.com',
      password: passwordHash,
      fullName: 'Lễ Tân Nguyễn Thu Trang',
      userType: ROLES.RECEPTIONIST,
      isEnable: true,
    });
    receptionist1Token = signAccessToken({
      userId: receptionist1.id,
      userType: receptionist1.userType,
      email: receptionist1.email,
    });

    // Receptionist 2
    receptionist2 = await User.create({
      id: 202,
      email: 'recep2_rec07@clinic.com',
      password: passwordHash,
      fullName: 'Lễ Tân Vũ Minh Hằng',
      userType: ROLES.RECEPTIONIST,
      isEnable: true,
    });
    receptionist2Token = signAccessToken({
      userId: receptionist2.id,
      userType: receptionist2.userType,
      email: receptionist2.email,
    });

    // Admin
    admin1 = await User.create({
      id: 301,
      email: 'admin1_rec07@clinic.com',
      password: passwordHash,
      fullName: 'Quản Trị Viên Event',
      userType: ROLES.ADMIN,
      isEnable: true,
    });
    admin1Token = signAccessToken({
      userId: admin1.id,
      userType: admin1.userType,
      email: admin1.email,
    });

    // Doctor
    doctor1 = await User.create({
      id: 101,
      email: 'doctor1_rec07@clinic.com',
      password: passwordHash,
      fullName: 'Bác Sĩ Lê Hoàng',
      userType: ROLES.DOCTOR,
      isEnable: true,
    });
    doctor1Token = signAccessToken({
      userId: doctor1.id,
      userType: doctor1.userType,
      email: doctor1.email,
    });

    // Patient 1
    patient1 = await User.create({
      id: 401,
      email: 'patient1_rec07@clinic.com',
      password: passwordHash,
      fullName: 'Bệnh Nhân Trần Nam',
      phoneNumber: '0901234567',
      userType: ROLES.PATIENT,
      isEnable: true,
    });
    patient1Token = signAccessToken({
      userId: patient1.id,
      userType: patient1.userType,
      email: patient1.email,
    });

    // Patient 2
    patient2 = await User.create({
      id: 402,
      email: 'patient2_rec07@clinic.com',
      password: passwordHash,
      fullName: 'Bệnh Nhân Đỗ Lan',
      phoneNumber: '0907654321',
      userType: ROLES.PATIENT,
      isEnable: true,
    });
    patient2Token = signAccessToken({
      userId: patient2.id,
      userType: patient2.userType,
      email: patient2.email,
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    setClock(new RealClock());
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    setClock(createFakeClock(new Date('2026-11-01T08:00:00.000Z')));
  });

  // =========================================================================
  // 1. Xác nhận thành công & Tự động cấp Voucher
  // =========================================================================
  it('1. Lễ tân xác nhận người tham dự thành công (PENDING -> CONFIRMED), lưu confirmedBy/confirmedAt, cấp voucher & ghi audit', async () => {
    // Create voucher
    const voucher = await Voucher.create({
      id: 501,
      code: 'TRIAN20',
      name: 'Voucher Khám Tri Ân 20%',
      discountValue: 20,
      type: 'DISCOUNT',
      enable: true,
      expiryDate: new Date('2026-12-31T23:59:59.000Z'),
    });

    // Create event attached with voucher
    const event = await Event.create({
      id: 1,
      title: 'Hội thảo Sức khỏe Tim mạch Cộng đồng',
      description: 'Khám tầm soát miễn phí và tư vấn dinh dưỡng',
      location: 'Hội trường Tầng 3 Phòng khám ClinicBooking',
      startDate: new Date('2026-11-01T07:00:00.000Z'),
      endDate: new Date('2026-11-01T17:00:00.000Z'),
      isEnabled: true,
      voucherId: voucher.id,
    });

    // Create registration PENDING
    const registration = await EventRegistration.create({
      id: 1001,
      eventId: event.id,
      userId: patient1.id,
      status: 'PENDING',
      registeredAt: new Date('2026-10-25T10:00:00.000Z'),
    });

    // Receptionist confirms attendance
    const res = await apiRequest('POST', `/reception/events/${event.id}/confirm/${patient1.id}`, {
      token: receptionist1Token,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'CONFIRMED');
    assert.equal(res.body.data.userId, patient1.id);
    assert.equal(res.body.data.userFullName, patient1.fullName);
    assert.ok(res.body.data.confirmedAt);
    assert.equal(String(res.body.data.confirmedBy), String(receptionist1.id));

    // Verify DB EventRegistration
    const updatedReg = await EventRegistration.findOne({ eventId: event.id, userId: patient1.id });
    assert.equal(updatedReg.status, 'CONFIRMED');
    assert.equal(String(updatedReg.confirmedBy), String(receptionist1.id));
    assert.ok(updatedReg.confirmedAt);

    // Verify UserVoucher automatically issued
    const userVoucher = await UserVoucher.findOne({
      voucherId: voucher.id,
      userId: patient1.id,
    });
    assert.ok(userVoucher, 'Người tham dự phải nhận được UserVoucher');
    assert.equal(userVoucher.voucherCode, 'TRIAN20');
    assert.equal(userVoucher.used, false);

    // Verify AuditLog
    const audit = await AuditLog.findOne({
      targetType: 'EventRegistration',
      $or: [{ targetId: updatedReg.id }, { targetId: String(updatedReg.id) }],
      action: AUDIT_ACTIONS.CONFIRM_EVENT_ATTENDANCE,
    });
    assert.ok(audit, 'Phải có AuditLog CONFIRM_EVENT_ATTENDANCE');
    assert.equal(String(audit.actorId), String(receptionist1.id));
  });

  // =========================================================================
  // 2. Không có đăng ký -> 404
  // =========================================================================
  it('2. Xác nhận khi không có đăng ký (hoặc sai userId/eventId) trả về 404', async () => {
    // Non-existent user for existing event
    const resUserNotFound = await apiRequest('POST', `/reception/events/1/confirm/99999`, {
      token: receptionist1Token,
    });
    assert.equal(resUserNotFound.status, 404);
    assert.equal(resUserNotFound.body.error?.code, 'REGISTRATION_NOT_FOUND');

    // Non-existent event
    const resEventNotFound = await apiRequest('POST', `/reception/events/99999/confirm/${patient1.id}`, {
      token: receptionist1Token,
    });
    assert.equal(resEventNotFound.status, 404);
    assert.equal(resEventNotFound.body.error?.code, 'EVENT_NOT_FOUND');
  });

  // =========================================================================
  // 3. Đã CONFIRMED -> Idempotent trả HTTP 200 state hiện hành
  // =========================================================================
  it('3. Đã CONFIRMED: gọi lại trả HTTP 200 idempotent kèm state hiện tại và không cấp trùng voucher', async () => {
    const resSecondConfirm = await apiRequest('POST', `/reception/events/1/confirm/${patient1.id}`, {
      token: receptionist2Token,
    });

    assert.equal(resSecondConfirm.status, 200);
    assert.equal(resSecondConfirm.body.success, true);
    assert.equal(resSecondConfirm.body.data.status, 'CONFIRMED');
    assert.equal(resSecondConfirm.body.idempotent, true);

    // Verify user voucher count is exactly 1 (not duplicated)
    const vouchersCount = await UserVoucher.countDocuments({
      voucherId: 501,
      userId: patient1.id,
    });
    assert.equal(vouchersCount, 1, 'Không được cấp trùng voucher khi xác nhận lặp lại');
  });

  // =========================================================================
  // 4. Xử lý song song (Concurrency - 2 lễ tân confirm cùng lúc)
  // =========================================================================
  it('4. Song song: 2 lễ tân xác nhận cùng một người tham dự -> cả 2 nhận HTTP 200 CONFIRMED, DB nhất quán', async () => {
    const event = await Event.create({
      id: 2,
      title: 'Khám Mắt Học Đường',
      startDate: new Date('2026-11-01T07:00:00.000Z'),
      endDate: new Date('2026-11-01T17:00:00.000Z'),
      isEnabled: true,
    });

    await EventRegistration.create({
      id: 1002,
      eventId: event.id,
      userId: patient2.id,
      status: 'PENDING',
      registeredAt: new Date('2026-10-26T09:00:00.000Z'),
    });

    // Run 2 parallel confirm requests
    const [resA, resB] = await Promise.all([
      apiRequest('POST', `/reception/events/${event.id}/confirm/${patient2.id}`, {
        token: receptionist1Token,
      }),
      apiRequest('POST', `/reception/events/${event.id}/confirm/${patient2.id}`, {
        token: receptionist2Token,
      }),
    ]);

    assert.equal(resA.status, 200);
    assert.equal(resB.status, 200);
    assert.equal(resA.body.data.status, 'CONFIRMED');
    assert.equal(resB.body.data.status, 'CONFIRMED');

    // DB state is CONFIRMED
    const regInDb = await EventRegistration.findOne({ eventId: event.id, userId: patient2.id });
    assert.equal(regInDb.status, 'CONFIRMED');
    assert.ok(regInDb.confirmedBy);
  });

  // =========================================================================
  // 5. Sự kiện đã đóng hoặc hết hạn -> 409
  // =========================================================================
  it('5. Sự kiện đã đóng (isEnabled: false) hoặc hết hạn (endDate < now) -> 409', async () => {
    // 5.1 Event closed (isEnabled = false)
    const closedEvent = await Event.create({
      id: 3,
      title: 'Sự kiện Đã Đóng',
      startDate: new Date('2026-11-01T07:00:00.000Z'),
      endDate: new Date('2026-11-01T17:00:00.000Z'),
      isEnabled: false,
    });

    await EventRegistration.create({
      id: 1003,
      eventId: closedEvent.id,
      userId: patient1.id,
      status: 'PENDING',
    });

    const resClosed = await apiRequest('POST', `/reception/events/${closedEvent.id}/confirm/${patient1.id}`, {
      token: receptionist1Token,
    });
    assert.equal(resClosed.status, 409);
    assert.equal(resClosed.body.error?.code, 'EVENT_CLOSED');

    // 5.2 Event expired (endDate in the past)
    const expiredEvent = await Event.create({
      id: 4,
      title: 'Sự kiện Đã Hết Hạn',
      startDate: new Date('2026-10-01T07:00:00.000Z'),
      endDate: new Date('2026-10-02T17:00:00.000Z'), // in the past compared to fake clock 2026-11-01
      isEnabled: true,
    });

    await EventRegistration.create({
      id: 1004,
      eventId: expiredEvent.id,
      userId: patient2.id,
      status: 'PENDING',
    });

    const resExpired = await apiRequest('POST', `/reception/events/${expiredEvent.id}/confirm/${patient2.id}`, {
      token: receptionist1Token,
    });
    assert.equal(resExpired.status, 409);
    assert.equal(resExpired.body.error?.code, 'EVENT_EXPIRED');
  });

  // =========================================================================
  // 6. Role sai -> 403
  // =========================================================================
  it('6. Role sai: Bệnh nhân (Patient) hoặc Bác sĩ (Doctor) gọi endpoint xác nhận bị từ chối 403', async () => {
    // Patient attempts to confirm
    const resPatient = await apiRequest('POST', `/reception/events/1/confirm/${patient1.id}`, {
      token: patient1Token,
    });
    assert.equal(resPatient.status, 403);

    // Doctor attempts to confirm
    const resDoctor = await apiRequest('POST', `/reception/events/1/confirm/${patient1.id}`, {
      token: doctor1Token,
    });
    assert.equal(resDoctor.status, 403);

    // Admin is allowed (ADMIN role check)
    const resAdmin = await apiRequest('POST', `/reception/events/1/confirm/${patient1.id}`, {
      token: admin1Token,
    });
    assert.equal(resAdmin.status, 200);
    assert.equal(resAdmin.body.data.status, 'CONFIRMED');
  });

  // =========================================================================
  // 7. Đảm bảo unique index eventId + userId trên event_registrations
  // =========================================================================
  it('7. Đảm bảo unique index eventId + userId ngăn chặn tạo trùng đăng ký', async () => {
    let duplicateError = null;
    try {
      await EventRegistration.create({
        id: 1099,
        eventId: 1,
        userId: patient1.id, // Already exists for event 1
        status: 'PENDING',
      });
    } catch (err) {
      duplicateError = err;
    }

    assert.ok(duplicateError, 'Phải ném lỗi vi phạm unique index');
    assert.equal(duplicateError.code, 11000);
  });

  // =========================================================================
  // 8. Lấy danh sách sự kiện kèm người đăng ký (GET /reception/events)
  // =========================================================================
  it('8. Lễ tân lấy danh sách sự kiện kèm mảng registrations[] (GET /reception/events)', async () => {
    const res = await apiRequest('GET', '/reception/events', {
      token: receptionist1Token,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);

    const eventItem = res.body.data.find((e) => e.id === 1);
    assert.ok(eventItem);
    assert.ok(Array.isArray(eventItem.registrations));
    assert.ok(eventItem.registrations.length >= 1);
    assert.equal(eventItem.registrations[0].userId, patient1.id);
    assert.equal(eventItem.registrations[0].status, 'CONFIRMED');
    assert.equal(eventItem.voucherCode, 'TRIAN20');
  });
});
