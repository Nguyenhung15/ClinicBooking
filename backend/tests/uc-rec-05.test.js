const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'uc_rec_05_test_secret_key';
const TEST_DB_URI =
  process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017/clinic_booking_test_uc_rec_05';

const app = require('../src/app');
const {
  User,
  DoctorShift,
  Appointment,
  AuditLog,
  OutboxEvent,
  Specialty,
} = require('../src/models');
const { ROLES, APPOINTMENT_STATUSES, AUDIT_ACTIONS } = require('../src/constants/enums');
const { signAccessToken } = require('../src/utils/jwt');
const { setClock, createFakeClock, RealClock } = require('../src/services/clock.service');
const { appointmentStateService } = require('../src/services/appointmentState.service');

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

let activeShift1;
let activeShift2;

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

describe('UC-REC-05: Lễ tân/Admin Hủy hoặc Đổi lịch hẹn', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    await mongoose.connection.dropDatabase();

    const hashedPassword = await bcrypt.hash('Test@123456', 10);

    // Create Specialty
    await Specialty.create({
      id: 1,
      name: 'Tim Mạch',
      description: 'Chuyên khoa tim mạch',
    });

    // Create Patient
    patient1 = await User.create({
      id: 1,
      userType: ROLES.PATIENT,
      email: 'patient1_uc05@clinic.test',
      fullName: 'Bệnh Nhân Test 05',
      password: hashedPassword,
      phoneNumber: '0912345678',
      isEnable: true,
      cancelledCount: 0,
      isBookingLocked: false,
    });
    patient1Token = signAccessToken({
      userId: patient1.id,
      userType: patient1.userType,
      email: patient1.email,
    });

    // Create Doctor
    doctor1 = await User.create({
      id: 2,
      userType: ROLES.DOCTOR,
      email: 'doctor1_uc05@clinic.test',
      fullName: 'Bác Sĩ Test 05',
      password: hashedPassword,
      specialtyId: 1,
      isEnable: true,
    });
    doctor1Token = signAccessToken({
      userId: doctor1.id,
      userType: doctor1.userType,
      email: doctor1.email,
    });

    // Create Receptionist
    receptionist1 = await User.create({
      id: 3,
      userType: ROLES.RECEPTIONIST,
      email: 'recep1_uc05@clinic.test',
      fullName: 'Lễ Tân Test 05',
      password: hashedPassword,
      isEnable: true,
    });
    receptionist1Token = signAccessToken({
      userId: receptionist1.id,
      userType: receptionist1.userType,
      email: receptionist1.email,
    });

    // Create Admin
    admin1 = await User.create({
      id: 4,
      userType: ROLES.ADMIN,
      email: 'admin1_uc05@clinic.test',
      fullName: 'Quản Trị Viên 05',
      password: hashedPassword,
      isEnable: true,
    });
    admin1Token = signAccessToken({
      userId: admin1.id,
      userType: admin1.userType,
      email: admin1.email,
    });

    // Setup active shifts for doctor1
    activeShift1 = await DoctorShift.create({
      id: 101,
      doctorId: doctor1.id,
      date: '2026-11-10',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [
        { id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED', bookingRef: 'OFF_INIT_01' },
        { id: 2, slotNumber: 2, startTime: '08:45', endTime: '09:30', status: 'AVAILABLE', bookingRef: null },
      ],
    });

    activeShift2 = await DoctorShift.create({
      id: 102,
      doctorId: doctor1.id,
      date: '2026-11-11',
      shift: 'AFTERNOON',
      startTime: '13:00',
      endTime: '17:00',
      status: 'ACTIVE',
      slots: [
        { id: 11, slotNumber: 1, startTime: '13:00', endTime: '13:45', status: 'AVAILABLE', bookingRef: null },
        { id: 12, slotNumber: 2, startTime: '13:45', endTime: '14:30', status: 'AVAILABLE', bookingRef: null },
      ],
    });

    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;
  });

  after(async () => {
    setClock(new RealClock());
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    setClock(createFakeClock('2026-11-05T08:00:00Z'));
  });

  // ==========================================
  // HỦY LỊCH HẸN (CANCEL)
  // ==========================================

  it('1. Hủy thành công & slot được giải phóng (BOOKED -> AVAILABLE), không tăng counter của Patient', async () => {
    // Setup shift and slot
    const shift = await DoctorShift.create({
      id: 201,
      doctorId: doctor1.id,
      date: '2026-11-12',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [
        { id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED', bookingRef: 'OFF_TEST_CANCEL_1' },
      ],
    });

    const appt = await Appointment.create({
      appointmentNo: 'OFF_TEST_CANCEL_1',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: shift.id,
      slotIds: [1],
      appointmentDate: '2026-11-12',
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      patients: [{ fullName: 'Bệnh nhân A', phoneNumber: '0912345678' }],
    });

    const res = await apiRequest('PUT', `/appointments/cancel/${appt.id}`, {
      token: receptionist1Token,
      body: { reason: 'Bệnh nhân bận công tác đột xuất' },
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, APPOINTMENT_STATUSES.CANCELLED);

    // Verify DB appointment updated
    const updatedAppt = await Appointment.findOne({ id: appt.id });
    assert.equal(updatedAppt.status, APPOINTMENT_STATUSES.CANCELLED);
    assert.equal(updatedAppt.cancelReason, 'Bệnh nhân bận công tác đột xuất');
    assert.equal(String(updatedAppt.cancelledBy), String(receptionist1.id));
    assert.ok(updatedAppt.cancelledAt);

    // Verify slot in DoctorShift was released back to AVAILABLE
    const updatedShift = await DoctorShift.findOne({ id: shift.id });
    const slot = updatedShift.slots.find((s) => s.id === 1);
    assert.equal(slot.status, 'AVAILABLE');
    assert.equal(slot.bookingRef, null);

    // Verify Patient cancel counter/lock is NOT triggered (staff cancellation does NOT penalize patient)
    const patientDoc = await User.findOne({ id: patient1.id });
    assert.equal(patientDoc.isBookingLocked, false);
    assert.equal(patientDoc.bookingLockedUntil, null);

    // Verify Audit Log was recorded
    const audit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.CANCEL_APPOINTMENT,
      $or: [{ targetId: appt.id }, { targetId: String(appt.id) }],
    });
    assert.ok(audit, 'Audit log CANCEL_APPOINTMENT must exist');
    assert.equal(audit.reason, 'Bệnh nhân bận công tác đột xuất');

    // Verify Outbox event was recorded
    const outbox = await OutboxEvent.findOne({
      eventType: 'APPOINTMENT_CANCELLED_BY_STAFF',
      'payload.appointmentId': appt.id,
    });
    assert.ok(outbox, 'Outbox event APPOINTMENT_CANCELLED_BY_STAFF must exist');
  });

  it('2. Hủy lịch COMPLETED bị từ chối 409 INVALID_STATE', async () => {
    const appt = await Appointment.create({
      appointmentNo: 'OFF_COMPLETED_1',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift1.id,
      slotIds: [1],
      appointmentDate: '2026-11-10',
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.COMPLETED,
    });

    const res = await apiRequest('PUT', `/appointments/cancel/${appt.id}`, {
      token: admin1Token,
      body: { reason: 'Muốn hủy sau khi đã khám xong' },
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.error?.code, 'INVALID_STATE');
  });

  it('3. Thiếu hoặc rỗng reason khi hủy bị từ chối 400 REASON_REQUIRED', async () => {
    const appt = await Appointment.create({
      appointmentNo: 'OFF_NO_REASON_1',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift1.id,
      slotIds: [1],
      appointmentDate: '2026-11-10',
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.PENDING_CONFIRMATION,
    });

    const res = await apiRequest('PUT', `/appointments/cancel/${appt.id}`, {
      token: receptionist1Token,
      body: { reason: '   ' },
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error?.code, 'REASON_REQUIRED');
  });

  it('4. Role sai: Bệnh nhân hoặc Bác sĩ gọi endpoint của staff bị từ chối 403', async () => {
    const appt = await Appointment.create({
      appointmentNo: 'OFF_FORBIDDEN_ROLE_1',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift1.id,
      slotIds: [1],
      appointmentDate: '2026-11-10',
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
    });

    // Doctor calling staff cancel route
    const resDoctor = await apiRequest('PUT', `/appointments/cancel/${appt.id}`, {
      token: doctor1Token,
      body: { reason: 'Bác sĩ tự ý gọi staff cancel' },
    });
    assert.equal(resDoctor.status, 403);
  });

  // ==========================================
  // ĐỔI LỊCH HẸN (RESCHEDULE)
  // ==========================================

  it('5. Đổi lịch thành công: tạo appointment mới, liên kết history, giải phóng slot cũ, state CONFIRMED', async () => {
    // Old shift & slot
    const oldShift = await DoctorShift.create({
      id: 301,
      doctorId: doctor1.id,
      date: '2026-11-15',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [
        { id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED', bookingRef: 'OFF_OLD_RESCHED_1' },
      ],
    });

    // New shift & slot
    const newShift = await DoctorShift.create({
      id: 302,
      doctorId: doctor1.id,
      date: '2026-11-16',
      shift: 'AFTERNOON',
      startTime: '13:00',
      endTime: '17:00',
      status: 'ACTIVE',
      slots: [
        { id: 21, slotNumber: 1, startTime: '13:00', endTime: '13:45', status: 'AVAILABLE', bookingRef: null },
      ],
    });

    const oldAppt = await Appointment.create({
      appointmentNo: 'OFF_OLD_RESCHED_1',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: oldShift.id,
      slotIds: [1],
      appointmentDate: '2026-11-15',
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      type: 'OFFLINE',
      patients: [{ fullName: 'Nguyễn Văn Test', phoneNumber: '0987654321' }],
    });

    const res = await apiRequest('PUT', `/appointments/reschedule/${oldAppt.id}`, {
      token: receptionist1Token,
      body: {
        newShiftId: newShift.id,
        newSlotId: 21,
        reason: 'Bệnh nhân xin dời sang ca chiều hôm sau',
      },
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.success, true);

    const newApptData = res.body.data;
    assert.equal(newApptData.status, APPOINTMENT_STATUSES.CONFIRMED);
    assert.equal(newApptData.shiftId, newShift.id);
    assert.equal(newApptData.appointmentDate, '2026-11-16');
    assert.equal(newApptData.appointmentTime, '13:00');
    assert.equal(newApptData.rescheduledFromId, oldAppt.id);

    // Verify old appointment transitioned to RESCHEDULED and linked rescheduledToId
    const updatedOldAppt = await Appointment.findOne({ id: oldAppt.id });
    assert.equal(updatedOldAppt.status, APPOINTMENT_STATUSES.RESCHEDULED);
    assert.equal(updatedOldAppt.rescheduledToId, newApptData.id);

    // Verify old slot is released to AVAILABLE
    const updatedOldShift = await DoctorShift.findOne({ id: oldShift.id });
    const oldSlot = updatedOldShift.slots.find((s) => s.id === 1);
    assert.equal(oldSlot.status, 'AVAILABLE');
    assert.equal(oldSlot.bookingRef, null);

    // Verify new slot is BOOKED with new appointmentNo
    const updatedNewShift = await DoctorShift.findOne({ id: newShift.id });
    const newSlot = updatedNewShift.slots.find((s) => s.id === 21);
    assert.equal(newSlot.status, 'BOOKED');
    assert.equal(newSlot.bookingRef, newApptData.appointmentNo);

    // Verify Outbox event recorded
    const outbox = await OutboxEvent.findOne({
      eventType: 'APPOINTMENT_RESCHEDULED_BY_STAFF',
      'payload.oldAppointmentId': oldAppt.id,
    });
    assert.ok(outbox, 'Outbox event APPOINTMENT_RESCHEDULED_BY_STAFF must exist');
  });

  it('6. Đổi sang slot đã bị đặt: trả 409 và KHÔNG thay đổi gì', async () => {
    // Target shift with already BOOKED slot
    const targetShift = await DoctorShift.create({
      id: 401,
      doctorId: doctor1.id,
      date: '2026-11-18',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [
        { id: 31, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED', bookingRef: 'ALREADY_TAKEN' },
      ],
    });

    const currentAppt = await Appointment.create({
      appointmentNo: 'OFF_CANNOT_RESCHED_1',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift1.id,
      slotIds: [1],
      appointmentDate: '2026-11-10',
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
    });

    const res = await apiRequest('PUT', `/appointments/reschedule/${currentAppt.id}`, {
      token: receptionist1Token,
      body: {
        newShiftId: targetShift.id,
        newSlotId: 31,
        reason: 'Cố đổi sang slot đã kín',
      },
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.error?.code, 'SLOT_ALREADY_BOOKED');

    // Verify current appointment unchanged
    const unchangedAppt = await Appointment.findOne({ id: currentAppt.id });
    assert.equal(unchangedAppt.status, APPOINTMENT_STATUSES.CONFIRMED);

    // Verify target shift slot unchanged
    const unchangedShift = await DoctorShift.findOne({ id: targetShift.id });
    const slot = unchangedShift.slots.find((s) => s.id === 31);
    assert.equal(slot.status, 'BOOKED');
    assert.equal(slot.bookingRef, 'ALREADY_TAKEN');
  });

  it('7. Concurrency: 2 request đổi cùng vào một slot -> chỉ 1 thành công, 1 nhận 409', async () => {
    // Target shift with exactly 1 available slot
    const targetShift = await DoctorShift.create({
      id: 501,
      doctorId: doctor1.id,
      date: '2026-11-20',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [
        { id: 41, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'AVAILABLE', bookingRef: null },
      ],
    });

    const appt1 = await Appointment.create({
      appointmentNo: 'OFF_RACE_1',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift1.id,
      slotIds: [1],
      appointmentDate: '2026-11-10',
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
    });

    const appt2 = await Appointment.create({
      appointmentNo: 'OFF_RACE_2',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift1.id,
      slotIds: [2],
      appointmentDate: '2026-11-10',
      appointmentTime: '08:45',
      status: APPOINTMENT_STATUSES.CONFIRMED,
    });

    const [res1, res2] = await Promise.all([
      apiRequest('PUT', `/appointments/reschedule/${appt1.id}`, {
        token: receptionist1Token,
        body: { newShiftId: targetShift.id, newSlotId: 41, reason: 'Race 1' },
      }),
      apiRequest('PUT', `/appointments/reschedule/${appt2.id}`, {
        token: admin1Token,
        body: { newShiftId: targetShift.id, newSlotId: 41, reason: 'Race 2' },
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [200, 409], 'Exactly one request must succeed and one must fail with 409');
  });

  it('8. Giả lập lỗi giữa chừng (mock failure) -> compensation rollback slot mới về AVAILABLE', async () => {
    const targetShift = await DoctorShift.create({
      id: 601,
      doctorId: doctor1.id,
      date: '2026-11-22',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [
        { id: 51, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'AVAILABLE', bookingRef: null },
      ],
    });

    const appt = await Appointment.create({
      appointmentNo: 'OFF_MOCK_FAIL_1',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift1.id,
      slotIds: [1],
      appointmentDate: '2026-11-10',
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
    });

    // Mock failure during transition of old appointment
    const originalTransition = appointmentStateService.transition;
    let transitionCalls = 0;
    appointmentStateService.transition = async function (...args) {
      transitionCalls += 1;
      throw new Error('SIMULATED_DB_NETWORK_FAILURE_MIDWAY');
    };

    try {
      const res = await apiRequest('PUT', `/appointments/reschedule/${appt.id}`, {
        token: receptionist1Token,
        body: {
          newShiftId: targetShift.id,
          newSlotId: 51,
          reason: 'Dời lịch bị sự cố mạng giữa chừng',
        },
      });

      assert.equal(res.status, 500);

      // Verify that the new slot was compensated / rolled back to AVAILABLE
      const checkShift = await DoctorShift.findOne({ id: targetShift.id });
      const slot = checkShift.slots.find((s) => s.id === 51);
      assert.equal(slot.status, 'AVAILABLE', 'Slot must be rolled back to AVAILABLE after failure');
      assert.equal(slot.bookingRef, null, 'Slot bookingRef must be cleared');

      // Verify no orphaned new appointment document remains
      const orphanedAppt = await Appointment.findOne({ rescheduledFromId: appt.id });
      assert.equal(orphanedAppt, null, 'Orphaned appointment must be cleaned up');

      // Verify old appointment is still in original state
      const checkOldAppt = await Appointment.findOne({ id: appt.id });
      assert.equal(checkOldAppt.status, APPOINTMENT_STATUSES.CONFIRMED);
    } finally {
      appointmentStateService.transition = originalTransition;
    }
  });

  it('9. Đổi lịch cho ca khám chưa CONFIRMED (PENDING_CONFIRMATION) -> lịch mới giữ PENDING_CONFIRMATION', async () => {
    const targetShift = await DoctorShift.create({
      id: 701,
      doctorId: doctor1.id,
      date: '2026-11-25',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'ACTIVE',
      slots: [
        { id: 61, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'AVAILABLE', bookingRef: null },
      ],
    });

    const pendingAppt = await Appointment.create({
      appointmentNo: 'OFF_PENDING_RESCHED_1',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: 1,
      shiftId: activeShift1.id,
      slotIds: [1],
      appointmentDate: '2026-11-10',
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.PENDING_CONFIRMATION,
    });

    const res = await apiRequest('PUT', `/appointments/reschedule/${pendingAppt.id}`, {
      token: receptionist1Token,
      body: {
        newShiftId: targetShift.id,
        newSlotId: 61,
        reason: 'Đổi lịch đang chờ duyệt',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, APPOINTMENT_STATUSES.PENDING_CONFIRMATION);
  });
});
