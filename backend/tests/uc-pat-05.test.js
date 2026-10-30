const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'uc_pat_05_test_secret_key';
const TEST_DB_URI =
  process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017/clinic_booking_test_uc_pat_05';

const app = require('../src/app');
const {
  User,
  Specialty,
  DoctorShift,
  Appointment,
  Prescription,
} = require('../src/models');
const { ROLES, APPOINTMENT_STATUSES } = require('../src/constants/enums');
const { signAccessToken } = require('../src/utils/jwt');

let server;
let baseUrl;

let patient1;
let patient1Token;
let patient2;
let patient2Token;
let doctor1;
let doctor1Token;

let specialty1;
let doctorShift1;

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

describe('UC-PAT-05: Xem danh sách và chi tiết lịch hẹn (/appointments)', () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();

    const passwordHash = await bcrypt.hash('Secret@123', 10);

    // 1. Seed Specialty
    specialty1 = await Specialty.create({
      id: 1,
      name: 'Nội tổng quát',
      description: 'Khám nội khoa tổng quát',
    });

    // 2. Seed Users
    patient1 = await User.create({
      email: 'pat1_uc05@clinicbooking.com',
      password: passwordHash,
      fullName: 'Bệnh Nhân Một',
      userType: ROLES.PATIENT,
      gender: 'Male',
      phoneNumber: '0901111111',
      isEnable: true,
    });
    patient1Token = signAccessToken(patient1);

    patient2 = await User.create({
      email: 'pat2_uc05@clinicbooking.com',
      password: passwordHash,
      fullName: 'Bệnh Nhân Hai',
      userType: ROLES.PATIENT,
      gender: 'Female',
      phoneNumber: '0902222222',
      isEnable: true,
    });
    patient2Token = signAccessToken(patient2);

    doctor1 = await User.create({
      email: 'doc1_uc05@clinicbooking.com',
      password: passwordHash,
      fullName: 'BS Nguyễn Văn A',
      userType: ROLES.DOCTOR,
      gender: 'Male',
      specialtyId: specialty1.id,
      phoneNumber: '0903333333',
      isEnable: true,
    });
    doctor1Token = signAccessToken(doctor1);

    // 3. Seed DoctorShift
    doctorShift1 = await DoctorShift.create({
      doctorId: doctor1.id,
      date: '2099-10-20',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      maxPatients: 10,
      status: 'ACTIVE',
      slots: [
        { id: 101, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'BOOKED' },
        { id: 102, slotNumber: 2, startTime: '09:00', endTime: '09:45', status: 'BOOKED' },
        { id: 103, slotNumber: 3, startTime: '10:00', endTime: '10:45', status: 'BOOKED' },
        { id: 104, slotNumber: 4, startTime: '11:00', endTime: '11:45', status: 'BOOKED' },
      ],
    });

    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  });

  it('1. Precondition: rejects unauthenticated request (401) on all three endpoints', async () => {
    const resUpcoming = await apiRequest('GET', '/appointments/my-upcoming');
    assert.equal(resUpcoming.status, 401);
    assert.equal(resUpcoming.body.success, false);

    const resCompleted = await apiRequest('GET', '/appointments/my-completed');
    assert.equal(resCompleted.status, 401);
    assert.equal(resCompleted.body.success, false);

    const resDetail = await apiRequest('GET', '/appointments/1');
    assert.equal(resDetail.status, 401);
    assert.equal(resDetail.body.success, false);
  });

  it('2. Authorization: rejects wrong role (403) when Doctor calls patient-only list endpoints', async () => {
    const resUpcoming = await apiRequest('GET', '/appointments/my-upcoming', {
      token: doctor1Token,
    });
    assert.equal(resUpcoming.status, 403);
    assert.equal(resUpcoming.body.success, false);

    const resCompleted = await apiRequest('GET', '/appointments/my-completed', {
      token: doctor1Token,
    });
    assert.equal(resCompleted.status, 403);
    assert.equal(resCompleted.body.success, false);
  });

  it('3. Main Flow: Patient retrieves their upcoming appointments sorted by date/time ASC', async () => {
    // Seed upcoming appointments for Patient 1 with different dates/times/statuses
    await Appointment.create([
      {
        id: 1001,
        appointmentNo: 'OFF2610200001',
        patientId: patient1.id,
        doctorId: doctor1.id,
        specialtyId: specialty1.id,
        shiftId: doctorShift1.id,
        appointmentDate: '2099-10-25',
        appointmentTime: '10:00',
        status: APPOINTMENT_STATUSES.CHECKED_IN,
        reason: 'Tái khám định kỳ',
        patients: [{ fullName: 'Bệnh Nhân Một', gender: 'Male', relationship: 'SELF' }],
      },
      {
        id: 1002,
        appointmentNo: 'OFF2610200002',
        patientId: patient1.id,
        doctorId: doctor1.id,
        specialtyId: specialty1.id,
        shiftId: doctorShift1.id,
        appointmentDate: '2099-10-21',
        appointmentTime: '08:30',
        status: APPOINTMENT_STATUSES.CONFIRMED,
        reason: 'Đau đầu chóng mặt',
        patients: [{ fullName: 'Con của BN Một', gender: 'Female', relationship: 'CHILD' }],
      },
      {
        id: 1003,
        appointmentNo: 'OFF2610200003',
        patientId: patient1.id,
        doctorId: doctor1.id,
        specialtyId: specialty1.id,
        shiftId: doctorShift1.id,
        appointmentDate: '2099-10-21',
        appointmentTime: '14:00',
        status: APPOINTMENT_STATUSES.PENDING_CONFIRMATION,
        reason: 'Khám mắt',
        patients: [{ fullName: 'Bệnh Nhân Một', gender: 'Male', relationship: 'SELF' }],
      },
    ]);

    const res = await apiRequest('GET', '/appointments/my-upcoming', {
      token: patient1Token,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.data.length, 3);

    // Verify ordering: 2099-10-21 08:30 -> 2099-10-21 14:00 -> 2099-10-25 10:00
    assert.equal(res.body.data[0].appointmentNo, 'OFF2610200002');
    assert.equal(res.body.data[1].appointmentNo, 'OFF2610200003');
    assert.equal(res.body.data[2].appointmentNo, 'OFF2610200001');

    // Verify populated doctorName and specialtyName
    assert.equal(res.body.data[0].doctorName, 'BS Nguyễn Văn A');
    assert.equal(res.body.data[0].specialtyName, 'Nội tổng quát');
    assert.equal(res.body.data[0].patientName, 'Con của BN Một');
  });

  it('4. Filter Guard: Upcoming does NOT return CANCELLED, EXPIRED, or COMPLETED appointments', async () => {
    // Seed non-upcoming appointments for Patient 1
    await Appointment.create([
      {
        id: 1004,
        appointmentNo: 'OFF2610200004',
        patientId: patient1.id,
        doctorId: doctor1.id,
        specialtyId: specialty1.id,
        shiftId: doctorShift1.id,
        appointmentDate: '2099-10-22',
        appointmentTime: '09:00',
        status: APPOINTMENT_STATUSES.CANCELLED,
      },
      {
        id: 1005,
        appointmentNo: 'OFF2610200005',
        patientId: patient1.id,
        doctorId: doctor1.id,
        specialtyId: specialty1.id,
        shiftId: doctorShift1.id,
        appointmentDate: '2099-10-22',
        appointmentTime: '09:30',
        status: APPOINTMENT_STATUSES.EXPIRED,
      },
      {
        id: 1006,
        appointmentNo: 'OFF2610200006',
        patientId: patient1.id,
        doctorId: doctor1.id,
        specialtyId: specialty1.id,
        shiftId: doctorShift1.id,
        appointmentDate: '2099-10-22',
        appointmentTime: '10:00',
        status: APPOINTMENT_STATUSES.COMPLETED,
      },
    ]);

    const res = await apiRequest('GET', '/appointments/my-upcoming', {
      token: patient1Token,
    });

    assert.equal(res.status, 200);
    // Still exactly 3 upcoming appointments; the cancelled, expired, completed ones are excluded
    assert.equal(res.body.data.length, 3);
    const statuses = res.body.data.map((a) => a.status);
    assert.ok(!statuses.includes('CANCELLED'));
    assert.ok(!statuses.includes('EXPIRED'));
    assert.ok(!statuses.includes('COMPLETED'));
  });

  it('5. Ownership & Data Isolation: Patient 1 cannot see appointments of Patient 2 in upcoming list', async () => {
    // Seed upcoming appointment for Patient 2
    await Appointment.create({
      id: 2001,
      appointmentNo: 'OFF2610200021',
      patientId: patient2.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: doctorShift1.id,
      appointmentDate: '2099-10-23',
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CONFIRMED,
      patients: [{ fullName: 'Bệnh Nhân Hai' }],
    });

    // Patient 1 calls upcoming
    const res1 = await apiRequest('GET', '/appointments/my-upcoming', {
      token: patient1Token,
    });
    assert.ok(res1.body.data.every((a) => a.appointmentNo !== 'OFF2610200021'));

    // Patient 2 calls upcoming -> only sees their own
    const res2 = await apiRequest('GET', '/appointments/my-upcoming', {
      token: patient2Token,
    });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.length, 1);
    assert.equal(res2.body.data[0].appointmentNo, 'OFF2610200021');
  });

  it('6. Main Flow: Patient retrieves history/completed appointments sorted by date/time DESC', async () => {
    // Seed completed appointments for Patient 1
    await Appointment.create([
      {
        id: 1010,
        appointmentNo: 'OFF2610200010',
        patientId: patient1.id,
        doctorId: doctor1.id,
        specialtyId: specialty1.id,
        shiftId: doctorShift1.id,
        appointmentDate: '2026-09-10',
        appointmentTime: '09:00',
        status: APPOINTMENT_STATUSES.COMPLETED,
        patients: [{ fullName: 'Bệnh Nhân Một' }],
      },
      {
        id: 1011,
        appointmentNo: 'OFF2610200011',
        patientId: patient1.id,
        doctorId: doctor1.id,
        specialtyId: specialty1.id,
        shiftId: doctorShift1.id,
        appointmentDate: '2026-10-01',
        appointmentTime: '15:00',
        status: APPOINTMENT_STATUSES.COMPLETED,
        patients: [{ fullName: 'Bệnh Nhân Một' }],
      },
    ]);

    const res = await apiRequest('GET', '/appointments/my-completed', {
      token: patient1Token,
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    // We created 1006 earlier + 1010 + 1011 = 3 completed appointments
    assert.equal(res.body.data.length, 3);

    // Verify ordering is DESC (newest first: 2099-10-22 -> 2026-10-01 -> 2026-09-10)
    assert.equal(res.body.data[0].appointmentNo, 'OFF2610200006');
    assert.equal(res.body.data[1].appointmentNo, 'OFF2610200011');
    assert.equal(res.body.data[2].appointmentNo, 'OFF2610200010');
  });

  it('7. History Guard: my-completed only returns COMPLETED status, not active or cancelled', async () => {
    const res = await apiRequest('GET', '/appointments/my-completed', {
      token: patient1Token,
    });

    assert.equal(res.status, 200);
    for (const appt of res.body.data) {
      assert.equal(appt.status, 'COMPLETED');
    }
  });

  it('8. Main Flow: Patient views detail of their appointment with populated names and prescriptions', async () => {
    // Add prescriptions to appointment 1011
    await Prescription.create([
      {
        id: 501,
        appointmentId: 1011,
        medicineName: 'Paracetamol 500mg',
        dosage: '1 viên x 2 lần/ngày',
        duration: '5 ngày',
        instructions: 'Uống sau ăn',
      },
    ]);

    const res = await apiRequest('GET', '/appointments/1011', {
      token: patient1Token,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data;

    assert.equal(data.id, 1011);
    assert.equal(data.appointmentNo, 'OFF2610200011');
    assert.equal(data.doctorName, 'BS Nguyễn Văn A');
    assert.equal(data.specialtyName, 'Nội tổng quát');
    assert.equal(data.status, 'COMPLETED');
    assert.ok(Array.isArray(data.prescriptions));
    assert.equal(data.prescriptions.length, 1);
    assert.equal(data.prescriptions[0].medicineName, 'Paracetamol 500mg');
  });

  it('9. Ownership Guard: Patient cannot view detail of another patient appointment (returns 404)', async () => {
    // Appointment 2001 belongs to Patient 2. Patient 1 tries to view it.
    const res = await apiRequest('GET', '/appointments/2001', {
      token: patient1Token,
    });

    // Must return 404 to avoid leaking existence of Patient 2 appointment
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  it('10. Validation & Error Handling: non-existent ID (404) and invalid ID format (400)', async () => {
    const resNotFound = await apiRequest('GET', '/appointments/999999', {
      token: patient1Token,
    });
    assert.equal(resNotFound.status, 404);

    const resInvalidStr = await apiRequest('GET', '/appointments/abc', {
      token: patient1Token,
    });
    assert.equal(resInvalidStr.status, 400);

    const resNegative = await apiRequest('GET', '/appointments/-5', {
      token: patient1Token,
    });
    assert.equal(resNegative.status, 400);

    const resZero = await apiRequest('GET', '/appointments/0', {
      token: patient1Token,
    });
    assert.equal(resZero.status, 400);
  });

  it('11. Security: Response does not leak sensitive fields or internal keys', async () => {
    const res = await apiRequest('GET', '/appointments/1001', {
      token: patient1Token,
    });

    assert.equal(res.status, 200);
    const bodyStr = JSON.stringify(res.body);
    assert.ok(!bodyStr.includes('password'));
    assert.ok(!bodyStr.includes('token'));
    assert.ok(!bodyStr.includes('_id'));
    assert.ok(!bodyStr.includes('__v'));
  });

  it('12. Contract compatibility: matches fields expected by frontend normalizeAppointment()', async () => {
    const res = await apiRequest('GET', '/appointments/1002', {
      token: patient1Token,
    });

    assert.equal(res.status, 200);
    const data = res.body.data;

    // Verify all fields needed by normalizeAppointment()
    assert.ok(typeof data.id === 'number');
    assert.ok(typeof data.appointmentDate === 'string');
    assert.ok(typeof data.appointmentTime === 'string');
    assert.ok(typeof data.appointmentNo === 'string');
    assert.ok(typeof data.status === 'string');
    assert.ok(typeof data.patientName === 'string');
    assert.ok(typeof data.doctorId === 'number');
    assert.ok(typeof data.doctorName === 'string');
    assert.ok(typeof data.specialtyName === 'string');
    assert.ok(typeof data.type === 'string');
    assert.ok(Array.isArray(data.patients));
    assert.equal(data.patients[0].fullName, 'Con của BN Một');
    assert.equal(data.patients[0].gender, 'Female');
    assert.equal(data.patients[0].relationship, 'CHILD');
  });

  it('13. Cascading & Doctor API Compatibility: Doctor can still access GET /appointments/:id and PUT /appointments/start/:id', async () => {
    // Create an appointment assigned to doctor1 in CHECKED_IN status
    const doctorAppt = await Appointment.create({
      id: 3001,
      appointmentNo: 'OFF2610200099',
      patientId: patient1.id,
      doctorId: doctor1.id,
      specialtyId: specialty1.id,
      shiftId: doctorShift1.id,
      appointmentDate: '2099-10-20',
      appointmentTime: '08:00',
      status: APPOINTMENT_STATUSES.CHECKED_IN,
      patients: [{ fullName: 'Bệnh Nhân Kiểm Tra Bác Sĩ' }],
    });

    // Doctor calls GET /appointments/:id -> should pass through to doctorAppointment router
    const resDoctorDetail = await apiRequest('GET', `/appointments/${doctorAppt.id}`, {
      token: doctor1Token,
    });
    assert.equal(resDoctorDetail.status, 200);
    assert.equal(resDoctorDetail.body.data.id, doctorAppt.id);
    assert.equal(resDoctorDetail.body.data.doctorName, doctor1.fullName);

    // Doctor calls PUT /appointments/start/:id -> should pass through to doctorAppointment router
    const resDoctorStart = await apiRequest('PUT', `/appointments/start/${doctorAppt.id}`, {
      token: doctor1Token,
    });
    assert.equal(resDoctorStart.status, 200);
    assert.equal(resDoctorStart.body.data.status, 'IN_PROGRESS');

    // Verify status updated in DB
    const fresh = await Appointment.findOne({ id: doctorAppt.id });
    assert.equal(fresh.status, 'IN_PROGRESS');
  });

  it('14. Route Conflict Check: /my-upcoming and /my-completed are NOT swallowed by /:id', async () => {
    const resUpcoming = await apiRequest('GET', '/appointments/my-upcoming', {
      token: patient1Token,
    });
    assert.equal(resUpcoming.status, 200);
    assert.ok(Array.isArray(resUpcoming.body.data));

    const resCompleted = await apiRequest('GET', '/appointments/my-completed', {
      token: patient1Token,
    });
    assert.equal(resCompleted.status, 200);
    assert.ok(Array.isArray(resCompleted.body.data));
  });
});
