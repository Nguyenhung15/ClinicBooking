const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'uc_rec_03_test_secret_key';
const TEST_DB_URI =
  process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017/clinic_booking_test_uc_rec_03';

const app = require('../src/app');
const {
  User,
  DoctorShift,
  Appointment,
  AuditLog,
  OutboxEvent,
} = require('../src/models');
const { ROLES, APPOINTMENT_STATUSES, AUDIT_ACTIONS } = require('../src/constants/enums');
const { signAccessToken } = require('../src/utils/jwt');
const { setClock, createFakeClock, RealClock } = require('../src/services/clock.service');

let server;
let baseUrl;

let patient1;
let patient1Token;
let doctor1;
let doctor1Token;
let receptionist1;
let receptionist1Token;
let admin1;
let admin1Token;

let activeShift;
let cancelledShift;

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

describe('UC-REC-03: Receptionist/Admin Confirm Appointment (PUT /appointments/confirm/:id)', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    await mongoose.connection.dropDatabase();

    const hashedPassword = await bcrypt.hash('Test@123456', 10);

    // 1. Create Patient
    patient1 = await User.create({
      id: 101,
      fullName: 'Bệnh nhân Test 101',
      email: 'patient101@test.com',
      password: hashedPassword,
      userType: ROLES.PATIENT,
      isEnable: true,
    });
    patient1Token = signAccessToken({
      userId: String(patient1.id),
      sub: String(patient1.id),
      role: patient1.userType,
      email: patient1.email,
    });

    // 2. Create Doctor
    doctor1 = await User.create({
      id: 201,
      fullName: 'Bác sĩ Test 201',
      email: 'doctor201@test.com',
      password: hashedPassword,
      userType: ROLES.DOCTOR,
      isEnable: true,
    });
    doctor1Token = signAccessToken({
      userId: String(doctor1.id),
      sub: String(doctor1.id),
      role: doctor1.userType,
      email: doctor1.email,
    });

    // 3. Create Receptionist
    receptionist1 = await User.create({
      id: 301,
      fullName: 'Lễ tân Test 301',
      email: 'receptionist301@test.com',
      password: hashedPassword,
      userType: ROLES.RECEPTIONIST,
      isEnable: true,
    });
    receptionist1Token = signAccessToken({
      userId: String(receptionist1.id),
      sub: String(receptionist1.id),
      role: receptionist1.userType,
      email: receptionist1.email,
    });

    // 4. Create Admin
    admin1 = await User.create({
      id: 401,
      fullName: 'Quản trị viên Test 401',
      email: 'admin401@test.com',
      password: hashedPassword,
      userType: ROLES.ADMIN,
      isEnable: true,
    });
    admin1Token = signAccessToken({
      userId: String(admin1.id),
      sub: String(admin1.id),
      role: admin1.userType,
      email: admin1.email,
    });

    // 5. Create Shifts (ACTIVE and CANCELLED)
    activeShift = await DoctorShift.create({
      id: 501,
      doctorId: doctor1.id,
      date: '2026-11-05',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [
        { id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:30', status: 'BOOKED' },
      ],
    });

    cancelledShift = await DoctorShift.create({
      id: 502,
      doctorId: doctor1.id,
      date: '2026-11-05',
      shift: 'AFTERNOON',
      startTime: '13:00',
      endTime: '17:00',
      status: 'CANCELLED',
      slots: [
        { id: 2, slotNumber: 1, startTime: '13:00', endTime: '13:30', status: 'BOOKED' },
      ],
    });

    // Start Express server
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
    // Reset fake clock to 2026-11-01 08:00:00 (before appointment date 2026-11-05)
    setClock(createFakeClock('2026-11-01T01:00:00.000Z')); // UTC+7 is 08:00:00
  });

  it('1. Thành công: Lễ tân confirm lịch hẹn PENDING_CONFIRMATION', async () => {
    const appt = await Appointment.create({
      id: 1001,
      appointmentNo: 'APP1001',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '08:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.PENDING_CONFIRMATION,
    });

    const res = await apiRequest('PUT', `/appointments/confirm/${appt.id}`, {
      token: receptionist1Token,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, APPOINTMENT_STATUSES.CONFIRMED);

    // Verify in DB
    const fresh = await Appointment.findOne({ id: appt.id });
    assert.equal(fresh.status, APPOINTMENT_STATUSES.CONFIRMED);
    assert.equal(fresh.confirmedBy, receptionist1.id);
    assert.ok(fresh.confirmedAt instanceof Date);

    // Verify Audit log was created with CONFIRM_APPOINTMENT
    const audit = await AuditLog.findOne({
      targetType: 'Appointment',
      targetId: String(appt.id),
      action: AUDIT_ACTIONS.CONFIRM_APPOINTMENT,
    });
    assert.ok(audit, 'AuditLog record should exist');
    assert.equal(String(audit.actorId), String(receptionist1.id));
    assert.equal(audit.actorRole, ROLES.RECEPTIONIST);

    // Verify Outbox event created for email
    const outbox = await OutboxEvent.findOne({
      'payload.appointmentId': appt.id,
      eventType: 'APPOINTMENT_CONFIRMED',
    });
    assert.ok(outbox, 'Outbox event should exist');
    assert.equal(outbox.channel, 'EMAIL');
    assert.equal(outbox.payload.recipientEmail, patient1.email);
  });

  it('2. Thành công: Admin cũng có quyền confirm lịch hẹn', async () => {
    const appt = await Appointment.create({
      id: 1002,
      appointmentNo: 'APP1002',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '09:00',
      type: 'ONLINE',
      status: APPOINTMENT_STATUSES.PENDING_CONFIRMATION,
    });

    const res = await apiRequest('PUT', `/appointments/confirm/${appt.id}`, {
      token: admin1Token,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, APPOINTMENT_STATUSES.CONFIRMED);

    const fresh = await Appointment.findOne({ id: appt.id });
    assert.equal(fresh.status, APPOINTMENT_STATUSES.CONFIRMED);
    assert.equal(fresh.confirmedBy, admin1.id);
  });

  it('3. Idempotent: Đã CONFIRMED gọi lại trả HTTP 200 và giữ nguyên dữ liệu', async () => {
    const originalConfirmedAt = new Date('2026-11-01T02:00:00.000Z');
    const appt = await Appointment.create({
      id: 1003,
      appointmentNo: 'APP1003',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '08:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      confirmedBy: receptionist1.id,
      confirmedAt: originalConfirmedAt,
    });

    const outboxCountBefore = await OutboxEvent.countDocuments({
      'payload.appointmentId': appt.id,
    });

    const res = await apiRequest('PUT', `/appointments/confirm/${appt.id}`, {
      token: receptionist1Token,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, APPOINTMENT_STATUSES.CONFIRMED);

    const outboxCountAfter = await OutboxEvent.countDocuments({
      'payload.appointmentId': appt.id,
    });
    assert.equal(outboxCountAfter, outboxCountBefore, 'Không được tạo thêm Outbox event khi idempotent');

    const fresh = await Appointment.findOne({ id: appt.id });
    assert.equal(fresh.confirmedAt.getTime(), originalConfirmedAt.getTime());
  });

  it('4. Sai state: Lịch CANCELLED, EXPIRED, COMPLETED, IN_PROGRESS trả về 409 INVALID_STATE', async () => {
    const statuses = [
      APPOINTMENT_STATUSES.CANCELLED,
      APPOINTMENT_STATUSES.EXPIRED,
      APPOINTMENT_STATUSES.COMPLETED,
      APPOINTMENT_STATUSES.IN_PROGRESS,
    ];

    let testId = 1010;
    for (const invalidStatus of statuses) {
      testId += 1;
      const appt = await Appointment.create({
        id: testId,
        appointmentNo: `APP${testId}`,
        patientId: patient1.id,
        doctorId: doctor1.id,
        specialtyId: 1,
        shiftId: activeShift.id,
        slotIds: [1],
        appointmentDate: '2026-11-05',
        appointmentTime: '08:00',
        type: 'OFFLINE',
        status: invalidStatus,
      });

      const res = await apiRequest('PUT', `/appointments/confirm/${appt.id}`, {
        token: receptionist1Token,
      });

      assert.equal(res.status, 409, `Status ${invalidStatus} should return 409`);
      assert.equal(res.body.error.code, 'INVALID_STATE');
    }
  });

  it('5. Appointment không tồn tại trả về 404', async () => {
    const res = await apiRequest('PUT', '/appointments/confirm/999999', {
      token: receptionist1Token,
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'APPOINTMENT_NOT_FOUND');
  });

  it('6. Lịch quá hạn (expired date/time) trả về 409', async () => {
    // Clock at 2026-11-06 08:00:00 (past appointment date 2026-11-05)
    setClock(createFakeClock('2026-11-06T01:00:00.000Z'));

    const appt = await Appointment.create({
      id: 1020,
      appointmentNo: 'APP1020',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '08:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.PENDING_CONFIRMATION,
    });

    const res = await apiRequest('PUT', `/appointments/confirm/${appt.id}`, {
      token: receptionist1Token,
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'APPOINTMENT_EXPIRED');
  });

  it('7. Shift không ACTIVE (ví dụ CANCELLED) trả về 409', async () => {
    const appt = await Appointment.create({
      id: 1030,
      appointmentNo: 'APP1030',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: cancelledShift.id, // Shift status: CANCELLED
      slotIds: [2],
      appointmentDate: '2026-11-05',
      appointmentTime: '13:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.PENDING_CONFIRMATION,
    });

    const res = await apiRequest('PUT', `/appointments/confirm/${appt.id}`, {
      token: receptionist1Token,
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'SHIFT_NOT_ACTIVE');
  });

  it('8. Role sai: Patient hoặc Doctor gọi endpoint trả về 403', async () => {
    const appt = await Appointment.create({
      id: 1040,
      appointmentNo: 'APP1040',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '08:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.PENDING_CONFIRMATION,
    });

    // Patient
    const patientRes = await apiRequest('PUT', `/appointments/confirm/${appt.id}`, {
      token: patient1Token,
    });
    assert.equal(patientRes.status, 403);
    assert.equal(patientRes.body.error.code, 'FORBIDDEN_ROLE');

    // Doctor
    const doctorRes = await apiRequest('PUT', `/appointments/confirm/${appt.id}`, {
      token: doctor1Token,
    });
    assert.equal(doctorRes.status, 403);
    assert.equal(doctorRes.body.error.code, 'FORBIDDEN_ROLE');
  });

  it('9. Không đăng nhập (thiếu token) trả về 401', async () => {
    const res = await apiRequest('PUT', '/appointments/confirm/1001');
    assert.equal(res.status, 401);
  });

  it('10. Race condition: Hai lễ tân confirm cùng lúc, chỉ ghi 1 lần và cả 2 nhận kết quả CONFIRMED', async () => {
    const receptionist2 = await User.create({
      id: 302,
      fullName: 'Lễ tân Test 302',
      email: 'receptionist302@test.com',
      password: await bcrypt.hash('Test@123456', 10),
      userType: ROLES.RECEPTIONIST,
      isEnable: true,
    });
    const receptionist2Token = signAccessToken({
      userId: String(receptionist2.id),
      sub: String(receptionist2.id),
      role: receptionist2.userType,
      email: receptionist2.email,
    });

    const appt = await Appointment.create({
      id: 1050,
      appointmentNo: 'APP1050',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '10:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.PENDING_CONFIRMATION,
    });

    // Send 2 concurrent requests
    const [res1, res2] = await Promise.all([
      apiRequest('PUT', `/appointments/confirm/${appt.id}`, { token: receptionist1Token }),
      apiRequest('PUT', `/appointments/confirm/${appt.id}`, { token: receptionist2Token }),
    ]);

    // Both should receive HTTP 200 with CONFIRMED status
    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
    assert.equal(res1.body.data.status, APPOINTMENT_STATUSES.CONFIRMED);
    assert.equal(res2.body.data.status, APPOINTMENT_STATUSES.CONFIRMED);

    // Verify appointment in DB
    const fresh = await Appointment.findOne({ id: appt.id });
    assert.equal(fresh.status, APPOINTMENT_STATUSES.CONFIRMED);

    // Exactly one Outbox event created
    const outboxEvents = await OutboxEvent.find({
      'payload.appointmentId': appt.id,
      eventType: 'APPOINTMENT_CONFIRMED',
    });
    assert.equal(outboxEvents.length, 1, 'Outbox event must only be created once during race condition');
  });
});
