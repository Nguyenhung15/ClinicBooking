const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'uc_pat_06_test_secret_key';
const TEST_DB_URI =
  process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017/clinic_booking_test_uc_pat_06';

const app = require('../src/app');
const {
  User,
  Specialty,
  DoctorShift,
  Appointment,
  AuditLog,
} = require('../src/models');
const { ROLES, APPOINTMENT_STATUSES, AUDIT_ACTIONS } = require('../src/constants/enums');
const { signAccessToken } = require('../src/utils/jwt');
const env = require('../src/config/env');
const { getAppointmentStartDateTime } = require('../src/services/patientAppointment.service');

let server;
let baseUrl;

let patient1;
let patient1Token;
let patient2;
let patient2Token;
let doctor1;
let doctor1Token;
let receptionist1;
let receptionist1Token;

let specialty1;

const formatISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

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

describe('UC-PAT-06: Cancel Appointment – Hủy lịch khám (/appointments/cancel/:id)', () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();

    const passwordHash = await bcrypt.hash('Secret@123', 10);

    // 1. Seed Specialty
    specialty1 = await Specialty.create({
      id: 1,
      name: 'Nội tim mạch',
      description: 'Chuyên khoa tim mạch',
    });

    // 2. Seed Users
    patient1 = await User.create({
      id: 1,
      email: 'pat1_uc06@clinicbooking.com',
      password: passwordHash,
      fullName: 'Bệnh Nhân Một',
      userType: ROLES.PATIENT,
      gender: 'Male',
      phoneNumber: '0901111111',
      isEnable: true,
    });
    patient1Token = signAccessToken(patient1);

    patient2 = await User.create({
      id: 2,
      email: 'pat2_uc06@clinicbooking.com',
      password: passwordHash,
      fullName: 'Bệnh Nhân Hai',
      userType: ROLES.PATIENT,
      gender: 'Female',
      phoneNumber: '0902222222',
      isEnable: true,
    });
    patient2Token = signAccessToken(patient2);

    doctor1 = await User.create({
      id: 3,
      email: 'doc1_uc06@clinicbooking.com',
      password: passwordHash,
      fullName: 'BS Nguyễn Văn C',
      userType: ROLES.DOCTOR,
      gender: 'Male',
      specialtyId: specialty1.id,
      phoneNumber: '0903333333',
      isEnable: true,
    });
    doctor1Token = signAccessToken(doctor1);

    receptionist1 = await User.create({
      id: 4,
      email: 'rec1_uc06@clinicbooking.com',
      password: passwordHash,
      fullName: 'Lễ Tân Một',
      userType: ROLES.RECEPTIONIST,
      gender: 'Female',
      phoneNumber: '0904444444',
      isEnable: true,
    });
    receptionist1Token = signAccessToken(receptionist1);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  });

  it('1. Trả về 401 Unauthorized khi không có JWT token', async () => {
    const res = await apiRequest('PUT', '/appointments/cancel/100', {
      body: { reason: 'Tôi muốn hủy' },
    });
    assert.strictEqual(res.status, 401);
  });

  it('2. Trả về 403 Forbidden khi người gọi không phải role Patient (Doctor, Receptionist)', async () => {
    const resDoc = await apiRequest('PUT', '/appointments/cancel/100', {
      token: doctor1Token,
      body: { reason: 'Bác sĩ hủy' },
    });
    assert.strictEqual(resDoc.status, 403);

    const resRec = await apiRequest('PUT', '/appointments/cancel/100', {
      token: receptionist1Token,
      body: { reason: 'Lễ tân hủy' },
    });
    assert.strictEqual(resRec.status, 403);
  });

  it('3. Main Flow: Patient hủy thành công lịch hẹn cách xa hơn 24 giờ (> 24h)', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const dateStr = formatISODate(futureDate);

    // Ca trực có 2 slots
    const shift = await DoctorShift.create({
      id: 101,
      doctorId: doctor1.id,
      date: dateStr,
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '10:00',
      slots: [
        { id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED', bookingRef: 'APPT101', bookedAt: new Date() },
        { id: 2, slotNumber: 2, startTime: '09:00', endTime: '09:45', status: 'BOOKED', bookingRef: 'APPT101', bookedAt: new Date() },
      ],
    });

    const appointment = await Appointment.create({
      id: 101,
      appointmentNo: 'APPT101',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: shift.id,
      slotIds: [1, 2],
      appointmentDate: dateStr,
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      reason: 'Đau thắt ngực',
      patients: [
        { id: 1, fullName: 'Bệnh Nhân Một', relationship: 'Bản thân' },
        { id: 2, fullName: 'Người Nhà', relationship: 'Vợ/Chồng' },
      ],
    });

    const res = await apiRequest('PUT', `/appointments/cancel/${appointment.id}`, {
      token: patient1Token,
      body: { reason: 'Có lịch công tác đột xuất' },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, APPOINTMENT_STATUSES.CANCELLED);
    assert.strictEqual(res.body.data.cancelReason, 'Có lịch công tác đột xuất');
    assert.ok(res.body.data.cancelledAt);

    // Kiểm tra DB: Appointment đã chuyển CANCELLED
    const updatedAppt = await Appointment.findOne({ id: appointment.id }).lean();
    assert.strictEqual(updatedAppt.status, APPOINTMENT_STATUSES.CANCELLED);
    assert.strictEqual(updatedAppt.cancelReason, 'Có lịch công tác đột xuất');
    assert.ok(updatedAppt.cancelledAt);
  });

  it('4. BR-05: Sức chứa khung giờ được giải phóng chính xác (slots trở về AVAILABLE, bookingRef = null)', async () => {
    const shift = await DoctorShift.findOne({ id: 101 }).lean();
    assert.strictEqual(shift.slots.length, 2);
    for (const slot of shift.slots) {
      assert.strictEqual(slot.status, 'AVAILABLE', `Slot ${slot.id} phải trở về AVAILABLE`);
      assert.strictEqual(slot.bookingRef, null, `Slot ${slot.id} bookingRef phải null`);
      assert.strictEqual(slot.bookedAt, null, `Slot ${slot.id} bookedAt phải null`);
    }
  });

  it('5. Đặt lại slot vừa được giải phóng thành công ngay lập tức', async () => {
    // Patient 2 đặt lại slot 1 trong ca 101 vừa được giải phóng
    const bookRes = await apiRequest('POST', `/appointments/create?specialtyId=${specialty1.id}&doctorId=${doctor1.id}`, {
      token: patient2Token,
      body: {
        shiftId: 101,
        patients: [{ fullName: 'Bệnh Nhân Hai', gender: 'Female' }],
        appointment: { reason: 'Khám lại tim mạch' },
      },
    });

    assert.strictEqual(bookRes.status, 201);
    assert.strictEqual(bookRes.body.success, true);
    assert.strictEqual(bookRes.body.data.status, APPOINTMENT_STATUSES.PENDING_CONFIRMATION);

    const shift = await DoctorShift.findOne({ id: 101 }).lean();
    const bookedSlot = shift.slots.find((s) => s.id === 1);
    assert.strictEqual(bookedSlot.status, 'BOOKED');
    assert.strictEqual(bookedSlot.bookingRef, bookRes.body.data.appointmentNo);
  });

  it('6. BR-02, A3: Từ chối hủy khi thời gian trước giờ khám còn dưới 24 giờ (< 24h)', async () => {
    const nearFuture = new Date();
    nearFuture.setHours(nearFuture.getHours() + 10); // Trong vòng 10 giờ nữa (< 24h)
    const dateStr = formatISODate(nearFuture);
    const timeStr = `${String(nearFuture.getHours()).padStart(2, '0')}:${String(nearFuture.getMinutes()).padStart(2, '0')}`;

    const shift = await DoctorShift.create({
      id: 102,
      doctorId: doctor1.id,
      date: dateStr,
      shift: 'MORNING',
      startTime: timeStr,
      endTime: '12:00',
      slots: [{ id: 1, slotNumber: 1, startTime: timeStr, endTime: '12:00', status: 'BOOKED', bookingRef: 'APPT102' }],
    });

    const appointment = await Appointment.create({
      id: 102,
      appointmentNo: 'APPT102',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: shift.id,
      slotIds: [1],
      appointmentDate: dateStr,
      appointmentTime: timeStr,
      status: APPOINTMENT_STATUSES.CONFIRMED,
      patients: [{ fullName: 'Bệnh Nhân Một' }],
    });

    const res = await apiRequest('PUT', `/appointments/cancel/${appointment.id}`, {
      token: patient1Token,
      body: { reason: 'Tôi muốn hủy gấp' },
    });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /24 giờ/);

    // Lịch hẹn không bị hủy, slot vẫn BOOKED
    const dbAppt = await Appointment.findOne({ id: appointment.id }).lean();
    assert.strictEqual(dbAppt.status, APPOINTMENT_STATUSES.CONFIRMED);
    const dbShift = await DoctorShift.findOne({ id: shift.id }).lean();
    assert.strictEqual(dbShift.slots[0].status, 'BOOKED');
  });

  it('7. BR-02, A4: Từ chối hủy khi ca khám đã bắt đầu hoặc ở trong quá khứ', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);
    const dateStr = formatISODate(pastDate);

    const shift = await DoctorShift.create({
      id: 103,
      doctorId: doctor1.id,
      date: dateStr,
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '10:00',
      slots: [{ id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED' }],
    });

    const appointment = await Appointment.create({
      id: 103,
      appointmentNo: 'APPT103',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: shift.id,
      slotIds: [1],
      appointmentDate: dateStr,
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      patients: [{ fullName: 'Bệnh Nhân Một' }],
    });

    const res = await apiRequest('PUT', `/appointments/cancel/${appointment.id}`, {
      token: patient1Token,
      body: { reason: 'Hủy ca cũ' },
    });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /đã bắt đầu hoặc đã qua thời gian khám/);
  });

  it('8. BR-04, A5: Từ chối hủy khi lịch hẹn ở trạng thái không cho phép (COMPLETED, CHECKED_IN, IN_PROGRESS)', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 4);
    const dateStr = formatISODate(futureDate);

    const shift = await DoctorShift.create({
      id: 104,
      doctorId: doctor1.id,
      date: dateStr,
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '11:00',
      slots: [
        { id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED' },
        { id: 2, slotNumber: 2, startTime: '09:00', endTime: '09:45', status: 'BOOKED' },
        { id: 3, slotNumber: 3, startTime: '10:00', endTime: '10:45', status: 'BOOKED' },
      ],
    });

    const apptCompleted = await Appointment.create({
      id: 1041,
      appointmentNo: 'APPT1041',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: shift.id,
      slotIds: [1],
      appointmentDate: dateStr,
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.COMPLETED,
      patients: [{ fullName: 'Bệnh Nhân Một' }],
    });

    const apptCheckedIn = await Appointment.create({
      id: 1042,
      appointmentNo: 'APPT1042',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: shift.id,
      slotIds: [2],
      appointmentDate: dateStr,
      appointmentTime: '09:00',
      status: APPOINTMENT_STATUSES.CHECKED_IN,
      patients: [{ fullName: 'Bệnh Nhân Một' }],
    });

    const resCompleted = await apiRequest('PUT', `/appointments/cancel/${apptCompleted.id}`, {
      token: patient1Token,
      body: { reason: 'Hủy' },
    });
    assert.strictEqual(resCompleted.status, 400);

    const resCheckedIn = await apiRequest('PUT', `/appointments/cancel/${apptCheckedIn.id}`, {
      token: patient1Token,
      body: { reason: 'Hủy' },
    });
    assert.strictEqual(resCheckedIn.status, 400);
  });

  it('9. BR-01, A1, A2: Kiểm tra quyền sở hữu (không cho hủy lịch của người khác, lịch không tồn tại trả 404)', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 4);
    const dateStr = formatISODate(futureDate);

    const shift = await DoctorShift.create({
      id: 105,
      doctorId: doctor1.id,
      date: dateStr,
      shift: 'AFTERNOON',
      startTime: '13:00',
      endTime: '14:00',
      slots: [{ id: 1, slotNumber: 1, startTime: '13:00', endTime: '13:45', status: 'BOOKED' }],
    });

    const apptPatient1 = await Appointment.create({
      id: 105,
      appointmentNo: 'APPT105',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: shift.id,
      slotIds: [1],
      appointmentDate: dateStr,
      appointmentTime: '13:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      patients: [{ fullName: 'Bệnh Nhân Một' }],
    });

    // Patient 2 cố hủy lịch của Patient 1 -> 403 Forbidden
    const resOther = await apiRequest('PUT', `/appointments/cancel/${apptPatient1.id}`, {
      token: patient2Token,
      body: { reason: 'Hủy trộm' },
    });
    assert.strictEqual(resOther.status, 403);

    // Hủy lịch không tồn tại (id = 999999) -> 404 Not Found
    const resNotFound = await apiRequest('PUT', '/appointments/cancel/999999', {
      token: patient1Token,
      body: { reason: 'Hủy không tồn tại' },
    });
    assert.strictEqual(resNotFound.status, 404);
  });

  it('10. BR-05, A8: Tính idempotent – gọi hủy lặp lại trên lịch đã CANCELLED trả trạng thái hiện tại, không giải phóng slot 2 lần', async () => {
    // Lịch 101 đã hủy ở test 3
    const resRepeat = await apiRequest('PUT', '/appointments/cancel/101', {
      token: patient1Token,
      body: { reason: 'Hủy lần hai' },
    });

    assert.strictEqual(resRepeat.status, 200);
    assert.strictEqual(resRepeat.body.success, true);
    assert.strictEqual(resRepeat.body.data.status, APPOINTMENT_STATUSES.CANCELLED);
    assert.strictEqual(resRepeat.body.data.id, 101);
  });

  it('11. A7: Kiểm tra hợp lệ lý do hủy (chuỗi trắng hoặc sai kiểu dữ liệu bị từ chối 400)', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const dateStr = formatISODate(futureDate);

    const shift = await DoctorShift.create({
      id: 106,
      doctorId: doctor1.id,
      date: dateStr,
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '09:00',
      slots: [{ id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED' }],
    });

    const appointment = await Appointment.create({
      id: 106,
      appointmentNo: 'APPT106',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: shift.id,
      slotIds: [1],
      appointmentDate: dateStr,
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      patients: [{ fullName: 'Bệnh Nhân Một' }],
    });

    // Lý do là khoảng trắng rỗng
    const resWhitespace = await apiRequest('PUT', `/appointments/cancel/${appointment.id}`, {
      token: patient1Token,
      body: { reason: '    ' },
    });
    assert.strictEqual(resWhitespace.status, 400);
    assert.match(resWhitespace.body.message, /không được để trống/);

    // Lý do sai kiểu dữ liệu (số)
    const resWrongType = await apiRequest('PUT', `/appointments/cancel/${appointment.id}`, {
      token: patient1Token,
      body: { reason: 12345 },
    });
    assert.strictEqual(resWrongType.status, 400);
    assert.match(resWrongType.body.message, /không hợp lệ/);
  });

  it('12. BR-03, A6: Chính sách khóa quyền đặt lịch khi đạt ngưỡng 3 lần hủy (không khóa tài khoản, vẫn xem được lịch sử)', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 6);
    const dateStr = formatISODate(futureDate);

    // Tạo user riêng patient3 để kiểm tra đủ 3 lần hủy
    const passwordHash = await bcrypt.hash('Secret@123', 10);
    const patient3 = await User.create({
      id: 10,
      email: 'pat3_lock@clinicbooking.com',
      password: passwordHash,
      fullName: 'Bệnh Nhân Ba',
      userType: ROLES.PATIENT,
      gender: 'Male',
      phoneNumber: '0905555555',
      isEnable: true,
    });
    const patient3Token = signAccessToken(patient3);

    // Tạo ca trực có 3 slots
    const shift = await DoctorShift.create({
      id: 107,
      doctorId: doctor1.id,
      date: dateStr,
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '11:00',
      slots: [
        { id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED', bookingRef: 'APPT1071' },
        { id: 2, slotNumber: 2, startTime: '09:00', endTime: '09:45', status: 'BOOKED', bookingRef: 'APPT1072' },
        { id: 3, slotNumber: 3, startTime: '10:00', endTime: '10:45', status: 'BOOKED', bookingRef: 'APPT1073' },
      ],
    });

    const appt1 = await Appointment.create({
      id: 1071,
      appointmentNo: 'APPT1071',
      patientId: patient3.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: shift.id,
      slotIds: [1],
      appointmentDate: dateStr,
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      patients: [{ fullName: 'Bệnh Nhân Ba' }],
    });

    const appt2 = await Appointment.create({
      id: 1072,
      appointmentNo: 'APPT1072',
      patientId: patient3.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: shift.id,
      slotIds: [2],
      appointmentDate: dateStr,
      appointmentTime: '09:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      patients: [{ fullName: 'Bệnh Nhân Ba' }],
    });

    const appt3 = await Appointment.create({
      id: 1073,
      appointmentNo: 'APPT1073',
      patientId: patient3.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: shift.id,
      slotIds: [3],
      appointmentDate: dateStr,
      appointmentTime: '10:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      patients: [{ fullName: 'Bệnh Nhân Ba' }],
    });

    // Lần hủy thứ 1
    const res1 = await apiRequest('PUT', `/appointments/cancel/${appt1.id}`, { token: patient3Token });
    assert.strictEqual(res1.status, 200);

    // Lần hủy thứ 2
    const res2 = await apiRequest('PUT', `/appointments/cancel/${appt2.id}`, { token: patient3Token });
    assert.strictEqual(res2.status, 200);

    // Kiểm tra lúc này User chưa bị lock quyền đặt
    let p3User = await User.findOne({ id: patient3.id }).lean();
    assert.strictEqual(p3User.isBookingLocked, false);

    // Lần hủy thứ 3 (đạt ngưỡng cancelLockThreshold = 3)
    const res3 = await apiRequest('PUT', `/appointments/cancel/${appt3.id}`, { token: patient3Token });
    assert.strictEqual(res3.status, 200);

    // Kiểm tra: User đã bị gắn cờ isBookingLocked = true
    p3User = await User.findOne({ id: patient3.id }).lean();
    assert.strictEqual(p3User.isBookingLocked, true);
    assert.ok(p3User.bookingLockedAt);
    assert.strictEqual(p3User.isEnable, true, 'isEnable vẫn là true, tài khoản không bị xóa/khóa đăng nhập');

    // Cố gắng đặt lịch mới -> Bị từ chối 403
    const bookRes = await apiRequest('POST', `/appointments/create?specialtyId=${specialty1.id}&doctorId=${doctor1.id}`, {
      token: patient3Token,
      body: {
        shiftId: 107,
        patients: [{ fullName: 'Bệnh Nhân Ba', gender: 'Male' }],
      },
    });
    assert.strictEqual(bookRes.status, 403);
    assert.match(bookRes.body.message, /khóa quyền đặt lịch mới/);

    // Patient3 vẫn xem được danh sách lịch sử lịch hẹn bình thường
    const historyRes = await apiRequest('GET', '/appointments/my-completed', { token: patient3Token });
    assert.strictEqual(historyRes.status, 200);

    // Kiểm tra bookingLockedUntil đúng 24 giờ kể từ bookingLockedAt
    assert.ok(p3User.bookingLockedUntil, 'Phải có bookingLockedUntil');
    const diffLock = new Date(p3User.bookingLockedUntil).getTime() - new Date(p3User.bookingLockedAt).getTime();
    assert.strictEqual(diffLock, 24 * 3600 * 1000, 'Thời hạn khóa đặt lịch phải đúng 24 giờ');

    // Sau khi 24 giờ trôi qua (bookingLockedUntil <= now): Patient được phép đặt lịch lại bình thường
    await User.updateOne(
      { id: patient3.id },
      { $set: { bookingLockedUntil: new Date(Date.now() - 1000) } },
    );

    const unlockBookRes = await apiRequest(
      'POST',
      `/appointments/create?specialtyId=${specialty1.id}&doctorId=${doctor1.id}`,
      {
        token: patient3Token,
        body: {
          shiftId: 107,
          patients: [{ fullName: 'Bệnh Nhân Ba', gender: 'Male' }],
          appointment: { reason: 'Khám lại sau khi hết thời hạn khóa' },
        },
      },
    );
    assert.strictEqual(unlockBookRes.status, 201, 'Sau khi hết 24h khóa, đặt lịch phải thành công');
    assert.strictEqual(unlockBookRes.body.success, true);
  });

  it('13. BR-06: Hệ thống ghi AuditLog đầy đủ khi hủy lịch hẹn', async () => {
    // Tìm log audit cho appointment 101
    const audit = await AuditLog.findOne({
      targetType: 'APPOINTMENT',
      targetId: 101,
      action: AUDIT_ACTIONS.APPOINTMENT_CANCEL,
    }).lean();

    assert.ok(audit, 'Phải có bản ghi AuditLog');
    assert.strictEqual(audit.actorId, patient1.id);
    assert.strictEqual(audit.actorRole, ROLES.PATIENT);
    assert.strictEqual(audit.reason, 'Có lịch công tác đột xuất');
    assert.strictEqual(audit.changes.newStatus, APPOINTMENT_STATUSES.CANCELLED);
    assert.deepStrictEqual(audit.changes.releasedSlotIds, [1, 2]);
  });

  it('14. Hủy khi không truyền body (frontend call mặc định): thành công với lý do mặc định', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const dateStr = formatISODate(futureDate);

    const shift = await DoctorShift.create({
      id: 108,
      doctorId: doctor1.id,
      date: dateStr,
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '09:00',
      slots: [{ id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED' }],
    });

    const appointment = await Appointment.create({
      id: 108,
      appointmentNo: 'APPT108',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: shift.id,
      slotIds: [1],
      appointmentDate: dateStr,
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.PENDING_CONFIRMATION,
      patients: [{ fullName: 'Bệnh Nhân Một' }],
    });

    // Gọi không truyền body (giống web/src/api/appointment.ts: cancelAppointment)
    const res = await apiRequest('PUT', `/appointments/cancel/${appointment.id}`, {
      token: patient1Token,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, APPOINTMENT_STATUSES.CANCELLED);
    assert.strictEqual(res.body.data.cancelReason, 'Bệnh nhân yêu cầu hủy');
  });

  it('15. Xử lý đồng thời (concurrency): 2 request hủy cùng lúc chỉ giải phóng slot 1 lần', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 8);
    const dateStr = formatISODate(futureDate);

    const shift = await DoctorShift.create({
      id: 109,
      doctorId: doctor1.id,
      date: dateStr,
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '09:00',
      slots: [{ id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED', bookingRef: 'APPT109' }],
    });

    const appointment = await Appointment.create({
      id: 109,
      appointmentNo: 'APPT109',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: shift.id,
      slotIds: [1],
      appointmentDate: dateStr,
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      patients: [{ fullName: 'Bệnh Nhân Một' }],
    });

    const [resA, resB] = await Promise.all([
      apiRequest('PUT', `/appointments/cancel/${appointment.id}`, {
        token: patient1Token,
        body: { reason: 'Concurrent request A' },
      }),
      apiRequest('PUT', `/appointments/cancel/${appointment.id}`, {
        token: patient1Token,
        body: { reason: 'Concurrent request B' },
      }),
    ]);

    // Cả 2 đều trả 200 (1 cái hủy thành công, 1 cái idempotent)
    assert.strictEqual(resA.status, 200);
    assert.strictEqual(resB.status, 200);

    const finalShift = await DoctorShift.findOne({ id: shift.id }).lean();
    assert.strictEqual(finalShift.slots[0].status, 'AVAILABLE');
    assert.strictEqual(finalShift.slots[0].bookingRef, null);
  });

  it('16. LOW-01: Mốc biên chính xác đúng 24.0 giờ – được chấp nhận hủy thành công và giải phóng slot', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 9);
    const dateStr = formatISODate(futureDate);
    const timeStr = '10:00';

    const shift = await DoctorShift.create({
      id: 110,
      doctorId: doctor1.id,
      date: dateStr,
      shift: 'MORNING',
      startTime: timeStr,
      endTime: '11:00',
      slots: [{ id: 1, slotNumber: 1, startTime: timeStr, endTime: '10:45', status: 'BOOKED', bookingRef: 'APPT110', bookedAt: new Date() }],
    });

    const appointment = await Appointment.create({
      id: 110,
      appointmentNo: 'APPT110',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: shift.id,
      slotIds: [1],
      appointmentDate: dateStr,
      appointmentTime: timeStr,
      status: APPOINTMENT_STATUSES.CONFIRMED,
      patients: [{ fullName: 'Bệnh Nhân Một' }],
    });

    // Mock thời điểm gửi request đúng 24 giờ 00 phút trước giờ khám
    const apptStart = getAppointmentStartDateTime(dateStr, timeStr, env.clinicTimeZone);
    const exact24hBefore = new Date(apptStart.getTime() - 24 * 3600 * 1000);

    const RealDate = global.Date;
    class MockDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(exact24hBefore.getTime());
        } else {
          super(...args);
        }
      }
      static now() {
        return exact24hBefore.getTime();
      }
    }

    try {
      global.Date = MockDate;
      // Sign fresh token inside mocked timeframe so JWT is not considered expired
      const validTokenAtMockTime = signAccessToken(patient1);

      const res = await apiRequest('PUT', `/appointments/cancel/${appointment.id}`, {
        token: validTokenAtMockTime,
        body: { reason: 'Hủy đúng mốc 24h' },
      });

      assert.strictEqual(res.status, 200, 'Đúng 24 giờ phải được chấp nhận hủy');
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, APPOINTMENT_STATUSES.CANCELLED);
      assert.strictEqual(res.body.data.cancelReason, 'Hủy đúng mốc 24h');

      const updatedShift = await DoctorShift.findOne({ id: shift.id }).lean();
      assert.strictEqual(updatedShift.slots[0].status, 'AVAILABLE');
      assert.strictEqual(updatedShift.slots[0].bookingRef, null);
    } finally {
      global.Date = RealDate;
    }
  });

  it('17. MEDIUM-01: Chỉ giải phóng slot có bookingRef khớp với appointment, không giải phóng slot có bookingRef khác', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const dateStr = formatISODate(futureDate);

    // Ca trực có 2 slots: slot 1 mang bookingRef APPT111, slot 2 mang bookingRef OTHER_REF
    const shift = await DoctorShift.create({
      id: 111,
      doctorId: doctor1.id,
      date: dateStr,
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '10:00',
      slots: [
        { id: 1, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED', bookingRef: 'APPT111', bookedAt: new Date() },
        { id: 2, slotNumber: 2, startTime: '09:00', endTime: '09:45', status: 'BOOKED', bookingRef: 'OTHER_REF_999', bookedAt: new Date() },
      ],
    });

    const appointment = await Appointment.create({
      id: 111,
      appointmentNo: 'APPT111',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: shift.id,
      slotIds: [1, 2], // Chứa cả slot 1 và slot 2
      appointmentDate: dateStr,
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      patients: [{ fullName: 'Bệnh Nhân Một' }],
    });

    const res = await apiRequest('PUT', `/appointments/cancel/${appointment.id}`, {
      token: patient1Token,
      body: { reason: 'Hủy ca có slot lệch bookingRef' },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, APPOINTMENT_STATUSES.CANCELLED);

    const updatedShift = await DoctorShift.findOne({ id: shift.id }).lean();
    const slot1 = updatedShift.slots.find((s) => s.id === 1);
    const slot2 = updatedShift.slots.find((s) => s.id === 2);

    // Slot 1 khớp bookingRef -> ĐƯỢC giải phóng
    assert.strictEqual(slot1.status, 'AVAILABLE');
    assert.strictEqual(slot1.bookingRef, null);

    // Slot 2 lệch bookingRef -> KHÔNG ĐƯỢC giải phóng
    assert.strictEqual(slot2.status, 'BOOKED');
    assert.strictEqual(slot2.bookingRef, 'OTHER_REF_999');
  });
});
