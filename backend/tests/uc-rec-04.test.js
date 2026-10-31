const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'uc_rec_04_test_secret_key';
const TEST_DB_URI =
  process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017/clinic_booking_test_uc_rec_04';

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

describe('UC-REC-04: Check-in Bệnh nhân (PUT /appointments/checkin/:id)', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    await mongoose.connection.dropDatabase();

    const hashedPassword = await bcrypt.hash('Test@123456', 10);

    // 1. Create Patient with phone number
    patient1 = await User.create({
      id: 101,
      fullName: 'Bệnh nhân Checkin 101',
      email: 'patient_checkin101@test.com',
      phoneNumber: '0901234567',
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
      fullName: 'Bác sĩ Checkin 201',
      email: 'doctor_checkin201@test.com',
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
      fullName: 'Lễ tân Checkin 301',
      email: 'receptionist_checkin301@test.com',
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
      fullName: 'Quản trị viên Checkin 401',
      email: 'admin_checkin401@test.com',
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

    // 5. Create Shift (08:00 - 12:00) on 2026-11-05
    activeShift = await DoctorShift.create({
      id: 501,
      doctorId: doctor1.id,
      date: '2026-11-05',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [
        { id: 1, slotNumber: 1, startTime: '09:00', endTime: '09:30', status: 'BOOKED' },
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
    // Default fake clock to 2026-11-05 08:30:00 (Vietnam GMT+7: 01:30:00 UTC)
    // Slot time is 09:00, early window opens at 08:00 (60 mins early) -> 08:30 is valid!
    setClock(createFakeClock('2026-11-05T01:30:00.000Z'));
  });

  it('1. Đúng luồng: Lễ tân check-in thành công với 4 số cuối SĐT (verifyPhoneLast4)', async () => {
    const appt = await Appointment.create({
      id: 2001,
      appointmentNo: 'CHK2001',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '09:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      patients: [
        { id: 1, fullName: 'Bệnh nhân Checkin 101', phoneNumber: '0901234567' },
      ],
    });

    const res = await apiRequest('PUT', `/appointments/checkin/${appt.id}`, {
      token: receptionist1Token,
      body: { verifyPhoneLast4: '4567' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, APPOINTMENT_STATUSES.CHECKED_IN);
    assert.equal(res.body.data.checkedIn, true);

    // Verify DB
    const fresh = await Appointment.findOne({ id: appt.id });
    assert.equal(fresh.status, APPOINTMENT_STATUSES.CHECKED_IN);
    assert.equal(fresh.checkedIn, true);
    assert.equal(fresh.checkedInBy, receptionist1.id);
    assert.ok(fresh.checkedInAt instanceof Date);

    // Verify Audit log with CHECKIN action
    const audit = await AuditLog.findOne({
      targetType: 'Appointment',
      targetId: String(appt.id),
      action: AUDIT_ACTIONS.CHECKIN,
    });
    assert.ok(audit, 'AuditLog record with CHECKIN should exist');
    assert.equal(String(audit.actorId), String(receptionist1.id));

    // Verify Outbox event DOCTOR_PATIENT_CHECKED_IN
    const outbox = await OutboxEvent.findOne({
      'payload.appointmentId': appt.id,
      eventType: 'DOCTOR_PATIENT_CHECKED_IN',
    });
    assert.ok(outbox, 'Outbox event should exist');
    assert.equal(outbox.payload.doctorId, doctor1.id);
    assert.equal(outbox.payload.verificationMethod, 'PHONE_LAST_4');
  });

  it('2. Đúng luồng: Admin check-in thành công với identityVerified=true', async () => {
    const appt = await Appointment.create({
      id: 2002,
      appointmentNo: 'CHK2002',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '09:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.CONFIRMED,
    });

    const res = await apiRequest('PUT', `/appointments/checkin/${appt.id}`, {
      token: admin1Token,
      body: { identityVerified: true },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, APPOINTMENT_STATUSES.CHECKED_IN);

    const fresh = await Appointment.findOne({ id: appt.id });
    assert.equal(fresh.status, APPOINTMENT_STATUSES.CHECKED_IN);
    assert.equal(fresh.checkedInBy, admin1.id);

    const outbox = await OutboxEvent.findOne({
      'payload.appointmentId': appt.id,
      eventType: 'DOCTOR_PATIENT_CHECKED_IN',
    });
    assert.equal(outbox.payload.verificationMethod, 'IDENTITY_CONFIRMED');
  });

  it('3. Sai ngày khám: Ngày khám khác ngày hiện tại phòng khám trả về 409', async () => {
    // Current date is 2026-11-05, appointment date is 2026-11-06 (future)
    const apptFuture = await Appointment.create({
      id: 2003,
      appointmentNo: 'CHK2003',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-06',
      appointmentTime: '09:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.CONFIRMED,
    });

    const resFuture = await apiRequest('PUT', `/appointments/checkin/${apptFuture.id}`, {
      token: receptionist1Token,
      body: { identityVerified: true },
    });
    assert.equal(resFuture.status, 409);
    assert.equal(resFuture.body.error.code, 'CHECKIN_TOO_EARLY');

    // Appointment date is 2026-11-04 (past day)
    const apptPast = await Appointment.create({
      id: 2004,
      appointmentNo: 'CHK2004',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-04',
      appointmentTime: '09:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.CONFIRMED,
    });

    const resPast = await apiRequest('PUT', `/appointments/checkin/${apptPast.id}`, {
      token: receptionist1Token,
      body: { identityVerified: true },
    });
    assert.equal(resPast.status, 409);
    assert.equal(resPast.body.error.code, 'CHECKIN_WINDOW_CLOSED');
  });

  it('4. Quá sớm: Trước giờ khám hơn CHECKIN_EARLY_MINUTES (60p) trả về 409 CHECKIN_TOO_EARLY', async () => {
    // Slot time 09:00. Early minutes = 60 -> window opens at 08:00.
    // Set clock to 07:55 (Vietnam GMT+7: 00:55 UTC) -> Too early!
    setClock(createFakeClock('2026-11-05T00:55:00.000Z'));

    const appt = await Appointment.create({
      id: 2005,
      appointmentNo: 'CHK2005',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '09:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.CONFIRMED,
    });

    const res = await apiRequest('PUT', `/appointments/checkin/${appt.id}`, {
      token: receptionist1Token,
      body: { identityVerified: true },
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CHECKIN_TOO_EARLY');
  });

  it('5. Quá muộn: Sau giờ kết thúc ca trực (shift.endTime 12:00) trả về 409 CHECKIN_WINDOW_CLOSED', async () => {
    // Shift ends at 12:00. Set clock to 12:05 (Vietnam GMT+7: 05:05 UTC).
    setClock(createFakeClock('2026-11-05T05:05:00.000Z'));

    const appt = await Appointment.create({
      id: 2006,
      appointmentNo: 'CHK2006',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '09:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.CONFIRMED,
    });

    const res = await apiRequest('PUT', `/appointments/checkin/${appt.id}`, {
      token: receptionist1Token,
      body: { identityVerified: true },
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CHECKIN_WINDOW_CLOSED');
  });

  it('6. Biên 00:00 theo timezone clinic (FakeClock kiểm tra giao thời chuẩn)', async () => {
    // Exactly at midnight in Vietnam (2026-11-05 00:00:00 GMT+7 = 2026-11-04 17:00:00 UTC)
    setClock(createFakeClock('2026-11-04T17:00:00.000Z'));

    // Today in clinic is 2026-11-05
    const appt = await Appointment.create({
      id: 2007,
      appointmentNo: 'CHK2007',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '00:30', // Slot 00:30 midnight
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.CONFIRMED,
    });

    // 00:00 is within 60 minutes of 00:30 slot!
    // Shift created for 00:00 - 04:00 (EVENING shift to satisfy unique index doctorId + date + shift)
    const midnightShift = await DoctorShift.create({
      id: 509,
      doctorId: doctor1.id,
      date: '2026-11-05',
      shift: 'EVENING',
      startTime: '00:00',
      endTime: '04:00',
      status: 'ACTIVE',
    });
    await Appointment.updateOne({ id: appt.id }, { shiftId: midnightShift.id });

    const res = await apiRequest('PUT', `/appointments/checkin/${appt.id}`, {
      token: receptionist1Token,
      body: { identityVerified: true },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, APPOINTMENT_STATUSES.CHECKED_IN);
  });

  it('7. Sai xác minh: verifyPhoneLast4 không khớp trả về 409 IDENTITY_VERIFICATION_FAILED', async () => {
    const appt = await Appointment.create({
      id: 2008,
      appointmentNo: 'CHK2008',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '09:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      patients: [
        { id: 1, fullName: 'Bệnh nhân Checkin 101', phoneNumber: '0901234567' },
      ],
    });

    const res = await apiRequest('PUT', `/appointments/checkin/${appt.id}`, {
      token: receptionist1Token,
      body: { verifyPhoneLast4: '9999' }, // Phone ends in 4567
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'IDENTITY_VERIFICATION_FAILED');
  });

  it('8. Thiếu thông tin xác minh (identityVerified: false và không có phone) trả về 400', async () => {
    const appt = await Appointment.create({
      id: 2009,
      appointmentNo: 'CHK2009',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '09:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.CONFIRMED,
    });

    const res = await apiRequest('PUT', `/appointments/checkin/${appt.id}`, {
      token: receptionist1Token,
      body: { identityVerified: false },
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'MISSING_VERIFICATION_INFO');
  });

  it('9. Idempotent: Đã CHECKED_IN gọi lại trả HTTP 200 và giữ nguyên dữ liệu', async () => {
    const originalCheckedInAt = new Date('2026-11-05T01:15:00.000Z');
    const appt = await Appointment.create({
      id: 2010,
      appointmentNo: 'CHK2010',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '09:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.CHECKED_IN,
      checkedIn: true,
      checkedInBy: receptionist1.id,
      checkedInAt: originalCheckedInAt,
    });

    const outboxCountBefore = await OutboxEvent.countDocuments({
      'payload.appointmentId': appt.id,
      eventType: 'DOCTOR_PATIENT_CHECKED_IN',
    });

    const res = await apiRequest('PUT', `/appointments/checkin/${appt.id}`, {
      token: receptionist1Token,
      body: { identityVerified: true },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, APPOINTMENT_STATUSES.CHECKED_IN);

    const outboxCountAfter = await OutboxEvent.countDocuments({
      'payload.appointmentId': appt.id,
      eventType: 'DOCTOR_PATIENT_CHECKED_IN',
    });
    assert.equal(outboxCountAfter, outboxCountBefore, 'Không tạo outbox event lặp lại khi idempotent');

    const fresh = await Appointment.findOne({ id: appt.id });
    assert.equal(fresh.checkedInAt.getTime(), originalCheckedInAt.getTime());
  });

  it('10. Sai state: Lịch PENDING_CONFIRMATION, CANCELLED, COMPLETED, IN_PROGRESS trả về 409 INVALID_STATE', async () => {
    const invalidStatuses = [
      APPOINTMENT_STATUSES.PENDING_CONFIRMATION,
      APPOINTMENT_STATUSES.PENDING_PAYMENT,
      APPOINTMENT_STATUSES.CANCELLED,
      APPOINTMENT_STATUSES.COMPLETED,
      APPOINTMENT_STATUSES.IN_PROGRESS,
    ];

    let id = 2020;
    for (const st of invalidStatuses) {
      id += 1;
      const appt = await Appointment.create({
        id,
        appointmentNo: `CHK${id}`,
        patientId: patient1.id,
        doctorId: doctor1.id,
        specialtyId: 1,
        shiftId: activeShift.id,
        slotIds: [1],
        appointmentDate: '2026-11-05',
        appointmentTime: '09:00',
        type: 'OFFLINE',
        status: st,
      });

      const res = await apiRequest('PUT', `/appointments/checkin/${appt.id}`, {
        token: receptionist1Token,
        body: { identityVerified: true },
      });

      assert.equal(res.status, 409, `Status ${st} should return 409`);
      assert.equal(res.body.error.code, 'INVALID_STATE');
    }
  });

  it('11. Role sai: Patient hoặc Doctor gọi check-in trả về 403', async () => {
    const appt = await Appointment.create({
      id: 2030,
      appointmentNo: 'CHK2030',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-05',
      appointmentTime: '09:00',
      type: 'OFFLINE',
      status: APPOINTMENT_STATUSES.CONFIRMED,
    });

    const patientRes = await apiRequest('PUT', `/appointments/checkin/${appt.id}`, {
      token: patient1Token,
      body: { identityVerified: true },
    });
    assert.equal(patientRes.status, 403);
    assert.equal(patientRes.body.error.code, 'FORBIDDEN_ROLE');

    const doctorRes = await apiRequest('PUT', `/appointments/checkin/${appt.id}`, {
      token: doctor1Token,
      body: { identityVerified: true },
    });
    assert.equal(doctorRes.status, 403);
    assert.equal(doctorRes.body.error.code, 'FORBIDDEN_ROLE');
  });
});
