const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'uc_rec_06_test_secret_key';
const TEST_DB_URI =
  process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017/clinic_booking_test_uc_rec_06';

const app = require('../src/app');
const {
  User,
  DoctorShift,
  Appointment,
  ShiftCancellationRequest,
  AuditLog,
  OutboxEvent,
  Specialty,
} = require('../src/models');
const {
  ROLES,
  APPOINTMENT_STATUSES,
  AUDIT_ACTIONS,
  SHIFT_STATUSES,
} = require('../src/constants/enums');
const { signAccessToken } = require('../src/utils/jwt');
const { setClock, createFakeClock, RealClock } = require('../src/services/clock.service');

let server;
let baseUrl;

let doctor1;
let doctor1Token;
let doctor2;
let doctor2Token;
let receptionist1;
let receptionist1Token;
let receptionist2;
let receptionist2Token;
let admin1;
let admin1Token;
let patient1;
let patient1Token;

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

describe('UC-REC-06: Lễ tân duyệt yêu cầu hủy ca của bác sĩ', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    await mongoose.connection.dropDatabase();

    const passwordHash = await bcrypt.hash('Secret@123', 10);

    // Seed Doctor 1
    doctor1 = await User.create({
      id: 101,
      email: 'doctor1_rec06@clinic.com',
      password: passwordHash,
      fullName: 'Bác Sĩ Nguyễn Văn A',
      userType: ROLES.DOCTOR,
      isEnable: true,
    });
    doctor1Token = signAccessToken(doctor1);

    // Seed Doctor 2
    doctor2 = await User.create({
      id: 102,
      email: 'doctor2_rec06@clinic.com',
      password: passwordHash,
      fullName: 'Bác Sĩ Trần Văn B',
      userType: ROLES.DOCTOR,
      isEnable: true,
    });
    doctor2Token = signAccessToken(doctor2);

    // Seed Receptionist 1
    receptionist1 = await User.create({
      id: 201,
      email: 'recep1_rec06@clinic.com',
      password: passwordHash,
      fullName: 'Lễ Tân Lê Thị Mai',
      userType: ROLES.RECEPTIONIST,
      isEnable: true,
    });
    receptionist1Token = signAccessToken(receptionist1);

    // Seed Receptionist 2
    receptionist2 = await User.create({
      id: 202,
      email: 'recep2_rec06@clinic.com',
      password: passwordHash,
      fullName: 'Lễ Tân Phạm Thị Hoa',
      userType: ROLES.RECEPTIONIST,
      isEnable: true,
    });
    receptionist2Token = signAccessToken(receptionist2);

    // Seed Admin
    admin1 = await User.create({
      id: 301,
      email: 'admin1_rec06@clinic.com',
      password: passwordHash,
      fullName: 'Quản Trị Viên Vương',
      userType: ROLES.ADMIN,
      isEnable: true,
    });
    admin1Token = signAccessToken(admin1);

    // Seed Patient
    patient1 = await User.create({
      id: 401,
      email: 'patient1_rec06@clinic.com',
      password: passwordHash,
      fullName: 'Bệnh Nhân Đỗ Đức',
      userType: ROLES.PATIENT,
      isEnable: true,
    });
    patient1Token = signAccessToken(patient1);

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
  // 1. Phía Bác sĩ tạo yêu cầu (Validation & Guard)
  // =========================================================================
  it('1. Bác sĩ tạo yêu cầu hủy ca: doctorId phải khớp ca trực, không tạo hộ, không tạo trùng PENDING', async () => {
    const shift = await DoctorShift.create({
      id: 1001,
      doctorId: doctor1.id,
      date: '2026-11-15',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [
        { id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'AVAILABLE' },
      ],
    });

    // Doctor 2 attempts to request cancellation of Doctor 1's shift -> 403
    const resForbidden = await apiRequest('POST', `/shifts/${shift.id}/cancellation-requests`, {
      token: doctor2Token,
      body: { reason: 'Tôi muốn hủy ca của đồng nghiệp' },
    });
    assert.equal(resForbidden.status, 403);
    assert.equal(resForbidden.body.error?.code, 'DOCTOR_MISMATCH');

    // Doctor 1 requests cancellation successfully
    const resCreate = await apiRequest('POST', `/shifts/${shift.id}/cancellation-requests`, {
      token: doctor1Token,
      body: { reason: 'Bận tham gia hội thảo y khoa đột xuất' },
    });
    assert.equal(resCreate.status, 201);
    assert.equal(resCreate.body.success, true);
    assert.equal(resCreate.body.data.status, 'PENDING');
    assert.equal(resCreate.body.data.shiftId, shift.id);

    // Duplicate request while PENDING exists -> 409
    const resDup = await apiRequest('POST', `/shifts/${shift.id}/cancellation-requests`, {
      token: doctor1Token,
      body: { reason: 'Gửi lại yêu cầu lần 2' },
    });
    assert.equal(resDup.status, 409);
    assert.equal(resDup.body.error?.code, 'DUPLICATE_PENDING_REQUEST');
  });

  // =========================================================================
  // 2. Danh sách Pending Requests (Phân trang & Summary)
  // =========================================================================
  it('2. Lấy danh sách yêu cầu PENDING kèm số booking bị ảnh hưởng và tóm tắt summary', async () => {
    const res = await apiRequest('GET', '/shifts/cancellation-requests/pending', {
      token: receptionist1Token,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.pagination);
    assert.ok(res.body.summary);
    assert.ok(res.body.summary.pendingRequestsCount >= 1);
  });

  // =========================================================================
  // 3. Phân quyền Endpoint Approve / Reject (Role Guard)
  // =========================================================================
  it('3. Role sai (Patient, Doctor) gọi endpoint duyệt hoặc từ chối bị chặn 403', async () => {
    // Patient calls approve
    const resPatient = await apiRequest('PUT', '/shifts/cancellation-requests/1001/approve', {
      token: patient1Token,
    });
    assert.equal(resPatient.status, 403);

    // Doctor calls reject
    const resDoctor = await apiRequest('PUT', '/shifts/cancellation-requests/1001/reject', {
      token: doctor1Token,
      body: { note: 'Bác sĩ tự từ chối' },
    });
    assert.equal(resDoctor.status, 403);
  });

  // =========================================================================
  // 4. Từ chối yêu cầu hủy ca (Reject Flow)
  // =========================================================================
  it('4. Từ chối yêu cầu hủy ca: BẮT BUỘC có note, lưu rejectedBy/rejectedAt, ghi audit & outbox', async () => {
    const shift = await DoctorShift.create({
      id: 1002,
      doctorId: doctor1.id,
      date: '2026-11-16',
      shift: 'AFTERNOON',
      startTime: '13:00',
      endTime: '17:00',
      status: 'ACTIVE',
      slots: [],
    });

    const createRes = await apiRequest('POST', `/shifts/${shift.id}/cancellation-requests`, {
      token: doctor1Token,
      body: { reason: 'Việc gia đình' },
    });
    const requestId = createRes.body.data.id;

    // Reject without note -> 400
    const resEmptyNote = await apiRequest('PUT', `/shifts/cancellation-requests/${requestId}/reject`, {
      token: receptionist1Token,
      body: { note: '   ' },
    });
    assert.equal(resEmptyNote.status, 400);
    assert.equal(resEmptyNote.body.error?.code, 'REJECTION_NOTE_REQUIRED');

    // Reject with note -> 200
    const resReject = await apiRequest('PUT', `/shifts/cancellation-requests/${requestId}/reject`, {
      token: receptionist1Token,
      body: { note: 'Phòng khám đang thiếu bác sĩ chuyên khoa này, đề nghị dời lịch' },
    });
    assert.equal(resReject.status, 200);
    assert.equal(resReject.body.data.status, 'REJECTED');
    assert.ok(resReject.body.data.rejectedAt);

    // Verify DB
    const reqDoc = await ShiftCancellationRequest.findOne({ id: requestId });
    assert.equal(reqDoc.status, 'REJECTED');
    assert.equal(reqDoc.decisionNote, 'Phòng khám đang thiếu bác sĩ chuyên khoa này, đề nghị dời lịch');

    // Verify AuditLog
    const audit = await AuditLog.findOne({
      targetType: 'ShiftCancellationRequest',
      $or: [{ targetId: requestId }, { targetId: String(requestId) }],
      action: AUDIT_ACTIONS.REJECT_SHIFT_CANCEL,
    });
    assert.ok(audit, 'Phải có AuditLog REJECT_SHIFT_CANCEL');

    // Verify Outbox for Doctor
    const outbox = await OutboxEvent.findOne({
      eventType: 'SHIFT_CANCELLATION_REJECTED',
      'payload.recipient': `doctor_${doctor1.id}`,
    });
    assert.ok(outbox, 'Phải có outbox SHIFT_CANCELLATION_REJECTED');
  });

  // =========================================================================
  // 5. Duyệt yêu cầu khi không có booking nào (Không có booking)
  // =========================================================================
  it('5. Duyệt thành công ca trực không có booking: shift -> CANCELLED, slots AVAILABLE -> CANCELLED', async () => {
    const shift = await DoctorShift.create({
      id: 1003,
      doctorId: doctor1.id,
      date: '2026-11-17',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [
        { id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'AVAILABLE' },
        { id: 2, slotNumber: 2, startTime: '08:45', endTime: '09:30', status: 'AVAILABLE' },
      ],
    });

    const createRes = await apiRequest('POST', `/shifts/${shift.id}/cancellation-requests`, {
      token: doctor1Token,
      body: { reason: 'Nghỉ phép thường niên' },
    });
    const requestId = createRes.body.data.id;

    // Receptionist approves
    const resApprove = await apiRequest('PUT', `/shifts/cancellation-requests/${requestId}/approve`, {
      token: receptionist1Token,
      body: { note: 'Đã duyệt' },
    });
    assert.equal(resApprove.status, 200);
    assert.equal(resApprove.body.data.status, 'APPROVED');
    assert.ok(resApprove.body.data.approvedAt);

    // Verify Shift and slots in DB
    const updatedShift = await DoctorShift.findOne({ id: shift.id });
    assert.equal(updatedShift.status, 'CANCELLED');
    for (const slot of updatedShift.slots) {
      assert.equal(slot.status, 'CANCELLED');
    }

    // Verify AuditLog
    const audit = await AuditLog.findOne({
      targetType: 'ShiftCancellationRequest',
      $or: [{ targetId: requestId }, { targetId: String(requestId) }],
      action: AUDIT_ACTIONS.APPROVE_SHIFT_CANCEL,
    });
    assert.ok(audit, 'Phải có AuditLog APPROVE_SHIFT_CANCEL');

    // Verify Outbox
    const outbox = await OutboxEvent.findOne({
      eventType: 'SHIFT_CANCELLATION_APPROVED',
      'payload.recipient': `doctor_${doctor1.id}`,
    });
    assert.ok(outbox, 'Phải có outbox SHIFT_CANCELLATION_APPROVED');
  });

  // =========================================================================
  // 6. Có booking ở chế độ BLOCK_UNTIL_RESOLVED (mặc định)
  // =========================================================================
  it('6. Có booking ở chế độ BLOCK_UNTIL_RESOLVED: trả 409 SHIFT_HAS_ACTIVE_BOOKINGS kèm danh sách', async () => {
    const shift = await DoctorShift.create({
      id: 1004,
      doctorId: doctor1.id,
      date: '2026-11-18',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [
        { id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED', bookingRef: 'OFF_ACTIVE_1' },
      ],
    });

    const appt = await Appointment.create({
      appointmentNo: 'OFF_ACTIVE_1',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: shift.id,
      slotIds: [1],
      appointmentDate: '2026-11-18',
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
    });

    const createRes = await apiRequest('POST', `/shifts/${shift.id}/cancellation-requests`, {
      token: doctor1Token,
      body: { reason: 'Nghỉ ốm' },
    });
    const requestId = createRes.body.data.id;

    // Approve with default policy BLOCK_UNTIL_RESOLVED -> 409
    const resApprove = await apiRequest('PUT', `/shifts/cancellation-requests/${requestId}/approve`, {
      token: receptionist1Token,
      body: { policy: 'BLOCK_UNTIL_RESOLVED' },
    });
    assert.equal(resApprove.status, 409);
    assert.equal(resApprove.body.error?.code, 'SHIFT_HAS_ACTIVE_BOOKINGS');
    const detailsObj = Array.isArray(resApprove.body.error?.details)
      ? resApprove.body.error.details[0]
      : resApprove.body.error?.details;
    assert.ok(detailsObj?.activeAppointments?.length > 0);

    // Shift remains ACTIVE and request remains PENDING
    const shiftAfter = await DoctorShift.findOne({ id: shift.id });
    assert.equal(shiftAfter.status, 'ACTIVE');
    const reqAfter = await ShiftCancellationRequest.findOne({ id: requestId });
    assert.equal(reqAfter.status, 'PENDING');
  });

  // =========================================================================
  // 7. Có booking ở chế độ AUTO_CANCEL_AFFECTED
  // =========================================================================
  it('7. Có booking ở chế độ AUTO_CANCEL_AFFECTED: tự động hủy từng appointment (logic REC-05) & shift -> CANCELLED', async () => {
    const shift = await DoctorShift.create({
      id: 1005,
      doctorId: doctor1.id,
      date: '2026-11-19',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [
        { id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED', bookingRef: 'OFF_AUTO_CANCEL_1' },
        { id: 2, slotNumber: 2, startTime: '08:45', endTime: '09:30', status: 'AVAILABLE' },
      ],
    });

    const appt = await Appointment.create({
      appointmentNo: 'OFF_AUTO_CANCEL_1',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: shift.id,
      slotIds: [1],
      appointmentDate: '2026-11-19',
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      refundRequired: false,
    });

    const createRes = await apiRequest('POST', `/shifts/${shift.id}/cancellation-requests`, {
      token: doctor1Token,
      body: { reason: 'Công tác nước ngoài' },
    });
    const requestId = createRes.body.data.id;

    // Approve with AUTO_CANCEL_AFFECTED policy
    const resApprove = await apiRequest('PUT', `/shifts/cancellation-requests/${requestId}/approve`, {
      token: receptionist1Token,
      body: { policy: 'AUTO_CANCEL_AFFECTED', note: 'Duyệt và tự động hủy lịch bị ảnh hưởng' },
    });
    assert.equal(resApprove.status, 200);
    assert.equal(resApprove.body.data.status, 'APPROVED');

    // Appointment has been cancelled via REC-05 logic
    const apptAfter = await Appointment.findOne({ id: appt.id });
    assert.equal(apptAfter.status, APPOINTMENT_STATUSES.CANCELLED);
    assert.ok(apptAfter.cancelledAt);

    // Shift has been cancelled
    const shiftAfter = await DoctorShift.findOne({ id: shift.id });
    assert.equal(shiftAfter.status, 'CANCELLED');

    // Outbox notification for patient
    const outboxPatient = await OutboxEvent.findOne({
      eventType: 'PATIENT_APPOINTMENT_CANCELLED_DUE_TO_SHIFT',
      'payload.recipient': `patient_${patient1.id}`,
    });
    assert.ok(outboxPatient, 'Phải có outbox event thông báo cho bệnh nhân');
  });

  // =========================================================================
  // 8. Tính Idempotent (Duyệt lặp lại / Từ chối lặp lại)
  // =========================================================================
  it('8. Tính Idempotent: Duyệt hoặc từ chối lại yêu cầu đã xử lý trả về HTTP 200 kèm state hiện tại', async () => {
    const shift = await DoctorShift.create({
      id: 1006,
      doctorId: doctor1.id,
      date: '2026-11-20',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [],
    });

    const createRes = await apiRequest('POST', `/shifts/${shift.id}/cancellation-requests`, {
      token: doctor1Token,
      body: { reason: 'Nghỉ việc riêng' },
    });
    const requestId = createRes.body.data.id;

    // Approve first time
    const res1 = await apiRequest('PUT', `/shifts/cancellation-requests/${requestId}/approve`, {
      token: receptionist1Token,
    });
    assert.equal(res1.status, 200);
    assert.equal(res1.body.data.status, 'APPROVED');

    // Approve second time -> 200 idempotent
    const res2 = await apiRequest('PUT', `/shifts/cancellation-requests/${requestId}/approve`, {
      token: receptionist2Token,
    });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.status, 'APPROVED');
    assert.equal(res2.body.data.idempotent, true);
  });

  // =========================================================================
  // 9. Concurrency (Hai lễ tân duyệt cùng lúc)
  // =========================================================================
  it('9. Concurrency: Hai lễ tân duyệt cùng lúc -> cả hai nhận kết quả APPROVED, DB cập nhật nhất quán', async () => {
    const shift = await DoctorShift.create({
      id: 1007,
      doctorId: doctor1.id,
      date: '2026-11-21',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [],
    });

    const createRes = await apiRequest('POST', `/shifts/${shift.id}/cancellation-requests`, {
      token: doctor1Token,
      body: { reason: 'Cần nghỉ ngơi' },
    });
    const requestId = createRes.body.data.id;

    // Run parallel approvals
    const [resA, resB] = await Promise.all([
      apiRequest('PUT', `/shifts/cancellation-requests/${requestId}/approve`, {
        token: receptionist1Token,
        body: { note: 'Lễ tân 1 duyệt' },
      }),
      apiRequest('PUT', `/shifts/cancellation-requests/${requestId}/approve`, {
        token: receptionist2Token,
        body: { note: 'Lễ tân 2 duyệt' },
      }),
    ]);

    // Both should receive HTTP 200 and APPROVED
    assert.equal(resA.status, 200);
    assert.equal(resB.status, 200);
    assert.equal(resA.body.data.status, 'APPROVED');
    assert.equal(resB.body.data.status, 'APPROVED');

    // DB has single approved request
    const finalDoc = await ShiftCancellationRequest.findOne({ id: requestId });
    assert.equal(finalDoc.status, 'APPROVED');
  });
});
