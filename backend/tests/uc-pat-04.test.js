const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'uc_pat_04_test_secret';
const TEST_DB_URI =
  process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017/clinic_booking_test_uc_pat_04';

const app = require('../src/app');
const {
  User,
  Specialty,
  DoctorShift,
  Appointment,
  PatientProfile,
} = require('../src/models');
const { ROLES } = require('../src/constants/enums');
const patientAppointmentService = require('../src/services/patientAppointment.service');

let server;
let baseUrl;
let patient1Token;
let patient1Id;
let patient2Token;
let patient2Id;
let doctorToken;
let doctorId;
let specialty1Id;
let specialty2Id;

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

describe('UC-PAT-04: Đặt lịch khám nguyên tử (POST /appointments/create)', () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();

    const passwordHash = await bcrypt.hash('Secret@123', 10);

    // Specialties
    const sp1 = await Specialty.create({
      id: 1,
      name: 'Nội tổng quát',
      description: 'Chuyên khoa Nội tổng quát',
    });
    specialty1Id = sp1.id;

    const sp2 = await Specialty.create({
      id: 2,
      name: 'Răng Hàm Mặt',
      description: 'Chuyên khoa Răng Hàm Mặt',
    });
    specialty2Id = sp2.id;

    // Doctor with specialtyId = 1
    const doc = await User.create({
      email: 'doctor1@clinicbooking.com',
      password: passwordHash,
      fullName: 'BS. Lê Văn Bác',
      userType: ROLES.DOCTOR,
      specialtyId: specialty1Id,
      gender: 'Male',
      isEnable: true,
    });
    doctorId = doc.id;

    // Patient 1
    const p1 = await User.create({
      email: 'patient1@clinicbooking.com',
      password: passwordHash,
      fullName: 'Bệnh Nhân Một',
      userType: ROLES.PATIENT,
      gender: 'Male',
      isEnable: true,
    });
    patient1Id = p1.id;

    // Patient 2
    const p2 = await User.create({
      email: 'patient2@clinicbooking.com',
      password: passwordHash,
      fullName: 'Bệnh Nhân Hai',
      userType: ROLES.PATIENT,
      gender: 'Female',
      isEnable: true,
    });
    patient2Id = p2.id;

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });

    const l1 = await apiRequest('POST', '/auth/login', {
      body: { email: 'patient1@clinicbooking.com', password: 'Secret@123' },
    });
    patient1Token = l1.body.data.token;

    const l2 = await apiRequest('POST', '/auth/login', {
      body: { email: 'patient2@clinicbooking.com', password: 'Secret@123' },
    });
    patient2Token = l2.body.data.token;

    const ldoc = await apiRequest('POST', '/auth/login', {
      body: { email: 'doctor1@clinicbooking.com', password: 'Secret@123' },
    });
    doctorToken = ldoc.body.data.token;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  });

  it('1. Precondition: rejects unauthenticated (401) and non-patient role (403)', async () => {
    const unauth = await apiRequest('POST', '/appointments/create?specialtyId=1', {
      body: { shiftId: 1, patients: [{ fullName: 'Test' }] },
    });
    assert.equal(unauth.status, 401);

    const doctorCall = await apiRequest('POST', '/appointments/create?specialtyId=1', {
      token: doctorToken,
      body: { shiftId: 1, patients: [{ fullName: 'Test' }] },
    });
    assert.equal(doctorCall.status, 403);
  });

  it('2. Main Flow: Patient books appointment successfully (201), reserves slots, returns exact contract', async () => {
    // Create shift with 3 available slots
    const shift = await DoctorShift.create({
      doctorId,
      date: '2099-10-10',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      maxPatients: 3,
      status: 'ACTIVE',
      slots: [
        { id: 1001, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'AVAILABLE' },
        { id: 1002, slotNumber: 2, startTime: '09:00', endTime: '09:45', status: 'AVAILABLE' },
        { id: 1003, slotNumber: 3, startTime: '10:00', endTime: '10:45', status: 'AVAILABLE' },
      ],
    });

    const res = await apiRequest(
      'POST',
      `/appointments/create?specialtyId=${specialty1Id}&doctorId=${doctorId}`,
      {
        token: patient1Token,
        body: {
          appointment: {
            reason: 'Đau đầu âm ỉ',
            type: 'OFFLINE',
          },
          shiftId: shift.id,
          patients: [
            {
              fullName: 'Nguyễn Bệnh Nhân',
              gender: 'Male',
              phoneNumber: '0912345678',
              dob: '1992-05-15',
              relationship: 'Bản thân',
            },
          ],
        },
      },
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    const data = res.body.data;

    // Contract validations
    assert.ok(data.appointmentNo.startsWith('OFF'));
    assert.equal(data.appointmentNo.length, 11); // 'OFF' + 8 hex
    assert.equal(data.patientId, patient1Id);
    assert.equal(data.doctorId, doctorId);
    assert.equal(data.specialtyId, specialty1Id);
    assert.equal(data.shiftId, shift.id);
    assert.deepEqual(data.slotIds, [1001]);
    assert.equal(data.appointmentDate, '2099-10-10');
    assert.equal(data.appointmentTime, '08:00');
    assert.equal(data.type, 'OFFLINE');
    assert.equal(data.status, 'PENDING_CONFIRMATION');
    assert.equal(data.doctorName, 'BS. Lê Văn Bác');
    assert.equal(data.specialtyName, 'Nội tổng quát');
    assert.equal(data.patients.length, 1);
    assert.equal(data.patients[0].fullName, 'Nguyễn Bệnh Nhân');

    // Verify slot 1001 is now BOOKED with bookingRef = appointmentNo
    const updatedShift = await DoctorShift.findOne({ id: shift.id });
    const s1 = updatedShift.slots.find((s) => s.id === 1001);
    assert.equal(s1.status, 'BOOKED');
    assert.equal(s1.bookingRef, data.appointmentNo);
    assert.ok(s1.bookedAt);

    // Verify slots 1002, 1003 remain AVAILABLE
    const s2 = updatedShift.slots.find((s) => s.id === 1002);
    assert.equal(s2.status, 'AVAILABLE');
  });

  it('3. Validation: rejects invalid doctorId/specialtyId mismatch, empty patients, exceeding limit', async () => {
    const shift = await DoctorShift.create({
      doctorId,
      date: '2099-10-11',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      maxPatients: 5,
      status: 'ACTIVE',
      slots: [
        { id: 2001, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'AVAILABLE' },
      ],
    });

    // Specialty mismatch (Doctor is in specialty1, query asks for specialty2)
    const mismatchSp = await apiRequest(
      'POST',
      `/appointments/create?specialtyId=${specialty2Id}&doctorId=${doctorId}`,
      {
        token: patient1Token,
        body: {
          shiftId: shift.id,
          patients: [{ fullName: 'Test Name' }],
        },
      },
    );
    assert.equal(mismatchSp.status, 400);

    // DoctorId in query does not match shift.doctorId
    const mismatchDoc = await apiRequest(
      'POST',
      `/appointments/create?specialtyId=${specialty1Id}&doctorId=9999`,
      {
        token: patient1Token,
        body: {
          shiftId: shift.id,
          patients: [{ fullName: 'Test Name' }],
        },
      },
    );
    assert.equal(mismatchDoc.status, 400);

    // Empty patients array
    const emptyPatients = await apiRequest(
      'POST',
      `/appointments/create?specialtyId=${specialty1Id}`,
      {
        token: patient1Token,
        body: {
          shiftId: shift.id,
          patients: [],
        },
      },
    );
    assert.equal(emptyPatients.status, 400);

    // Patients exceeding max limit (more than 4)
    const tooManyPatients = await apiRequest(
      'POST',
      `/appointments/create?specialtyId=${specialty1Id}`,
      {
        token: patient1Token,
        body: {
          shiftId: shift.id,
          patients: [
            { fullName: 'P1' },
            { fullName: 'P2' },
            { fullName: 'P3' },
            { fullName: 'P4' },
            { fullName: 'P5' },
          ],
        },
      },
    );
    assert.equal(tooManyPatients.status, 400);
  });

  it('4. Profile guards: rejects using another users profile or an archived profile', async () => {
    const shift = await DoctorShift.create({
      doctorId,
      date: '2099-10-12',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      maxPatients: 2,
      status: 'ACTIVE',
      slots: [
        { id: 3001, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'AVAILABLE' },
      ],
    });

    // Patient 2 creates a dependent profile
    const p2Profile = await PatientProfile.create({
      ownerId: patient2Id,
      fullName: 'Con của Patient 2',
      gender: 'Male',
      relationship: 'Con',
      isArchived: false,
    });

    // Patient 1 attempts to book using Patient 2's profile ID
    const stolenProfile = await apiRequest(
      'POST',
      `/appointments/create?specialtyId=${specialty1Id}`,
      {
        token: patient1Token,
        body: {
          shiftId: shift.id,
          patients: [{ id: p2Profile.id, fullName: 'Tên mạo danh' }],
        },
      },
    );
    assert.equal(stolenProfile.status, 400);

    // Patient 1 creates their own profile and archives it
    const p1Archived = await PatientProfile.create({
      ownerId: patient1Id,
      fullName: 'Hồ sơ đã archive',
      gender: 'Female',
      relationship: 'Mẹ',
      isArchived: true,
    });

    const useArchived = await apiRequest(
      'POST',
      `/appointments/create?specialtyId=${specialty1Id}`,
      {
        token: patient1Token,
        body: {
          shiftId: shift.id,
          patients: [{ id: p1Archived.id, fullName: 'Hồ sơ đã archive' }],
        },
      },
    );
    assert.equal(useArchived.status, 400);
  });

  it('5. Concurrency Race: 5 concurrent requests for a 1-slot shift -> exactly 1 succeeds (201), 4 get 409', async () => {
    // Create shift with exactly 1 available slot
    const shift = await DoctorShift.create({
      doctorId,
      date: '2099-10-20',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      maxPatients: 1,
      status: 'ACTIVE',
      slots: [
        { id: 4001, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'AVAILABLE' },
      ],
    });

    const requests = Array.from({ length: 5 }, (_, i) =>
      apiRequest('POST', `/appointments/create?specialtyId=${specialty1Id}`, {
        token: patient1Token,
        body: {
          shiftId: shift.id,
          patients: [{ fullName: `Candidate ${i + 1}` }],
        },
      }),
    );

    const responses = await Promise.all(requests);
    const successes = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);

    assert.equal(successes.length, 1);
    assert.equal(conflicts.length, 4);

    // Verify exactly 1 appointment created in DB for this shift
    const apptsInDb = await Appointment.find({ shiftId: shift.id });
    assert.equal(apptsInDb.length, 1);
  });

  it('6. Atomicity: multi-slot booking where 1 slot is taken -> none of the slots change state', async () => {
    // Create shift with 3 slots, but middle slot 5002 is already BOOKED
    const shift = await DoctorShift.create({
      doctorId,
      date: '2099-10-25',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      maxPatients: 3,
      status: 'ACTIVE',
      slots: [
        { id: 5001, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'AVAILABLE' },
        { id: 5002, slotNumber: 2, startTime: '09:00', endTime: '09:45', status: 'BOOKED' },
        { id: 5003, slotNumber: 3, startTime: '10:00', endTime: '10:45', status: 'AVAILABLE' },
      ],
    });

    // Request requires 3 slots, but shift only has 2 available slots
    const res = await apiRequest('POST', `/appointments/create?specialtyId=${specialty1Id}`, {
      token: patient1Token,
      body: {
        shiftId: shift.id,
        patients: [{ fullName: 'P1' }, { fullName: 'P2' }, { fullName: 'P3' }],
      },
    });

    assert.equal(res.status, 409);

    // Verify slots 5001 and 5003 are STILL AVAILABLE (untouched)
    const fresh = await DoctorShift.findOne({ id: shift.id });
    const s1 = fresh.slots.find((s) => s.id === 5001);
    const s3 = fresh.slots.find((s) => s.id === 5003);
    assert.equal(s1.status, 'AVAILABLE');
    assert.equal(s3.status, 'AVAILABLE');
  });

  it('7. Compensation Rollback: if appointment creation fails, reserved slots are rolled back to AVAILABLE', async () => {
    const shift = await DoctorShift.create({
      doctorId,
      date: '2099-10-30',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      maxPatients: 1,
      status: 'ACTIVE',
      slots: [
        { id: 6001, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'AVAILABLE' },
      ],
    });

    // Temporarily mock Appointment.create to simulate catastrophic DB failure
    const originalCreate = Appointment.create;
    Appointment.create = async () => {
      throw new Error('Simulated Database crash during appointment creation');
    };

    try {
      await assert.rejects(
        async () => {
          await patientAppointmentService.bookAppointment(
            { id: patient1Id, userType: ROLES.PATIENT },
            { specialtyId: specialty1Id },
            { shiftId: shift.id, patients: [{ fullName: 'Rollback Test' }] },
          );
        },
        /Simulated Database crash/,
      );

      // Verify slot 6001 was rolled back to AVAILABLE and bookingRef was cleared
      const rolledBackShift = await DoctorShift.findOne({ id: shift.id });
      const slot = rolledBackShift.slots.find((s) => s.id === 6001);
      assert.equal(slot.status, 'AVAILABLE');
      assert.equal(slot.bookingRef, null);
      assert.equal(slot.bookedAt, null);
    } finally {
      Appointment.create = originalCreate;
    }
  });

  it('8. Reconciliation: orphan BOOKED slots older than cutoff are released to AVAILABLE', async () => {
    const shift = await DoctorShift.create({
      doctorId,
      date: '2099-11-01',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      maxPatients: 2,
      status: 'ACTIVE',
      slots: [
        {
          id: 7001,
          slotNumber: 1,
          startTime: '08:00',
          endTime: '08:45',
          status: 'BOOKED',
          bookingRef: 'ORPHAN_REF',
          bookedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 mins ago (stale)
        },
        {
          id: 7002,
          slotNumber: 2,
          startTime: '09:00',
          endTime: '09:45',
          status: 'BOOKED',
          bookingRef: 'RECENT_REF',
          bookedAt: new Date(Date.now() - 2 * 60 * 1000), // 2 mins ago (not stale)
        },
      ],
    });

    // Run reconciliation with maxAgeMinutes = 10
    const result = await patientAppointmentService.reconcileOrphanSlots(10);
    assert.equal(result.reconciledCount >= 1, true);

    const refreshed = await DoctorShift.findOne({ id: shift.id });
    const s1 = refreshed.slots.find((s) => s.id === 7001);
    const s2 = refreshed.slots.find((s) => s.id === 7002);

    // s1 was stale orphan -> rolled back to AVAILABLE
    assert.equal(s1.status, 'AVAILABLE');
    assert.equal(s1.bookingRef, null);

    // s2 was recent (< 10 mins) -> left untouched
    assert.equal(s2.status, 'BOOKED');
  });
  it('9. Concurrency Race: 6 concurrent requests (1 patient each) for a 5-slot shift -> exactly 5 succeed (201), 1 gets 409, no double booking', async () => {
    const shift = await DoctorShift.create({
      doctorId,
      date: '2099-11-15',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      maxPatients: 5,
      status: 'ACTIVE',
      slots: [
        { id: 8001, slotNumber: 1, startTime: '08:00', endTime: '08:45', status: 'AVAILABLE' },
        { id: 8002, slotNumber: 2, startTime: '08:45', endTime: '09:30', status: 'AVAILABLE' },
        { id: 8003, slotNumber: 3, startTime: '09:30', endTime: '10:15', status: 'AVAILABLE' },
        { id: 8004, slotNumber: 4, startTime: '10:15', endTime: '11:00', status: 'AVAILABLE' },
        { id: 8005, slotNumber: 5, startTime: '11:00', endTime: '11:45', status: 'AVAILABLE' },
      ],
    });

    const { signAccessToken } = require('../src/utils/jwt');
    const passwordHash = await bcrypt.hash('Secret@123', 10);
    const tokens = [];

    for (let i = 1; i <= 6; i += 1) {
      const u = await User.create({
        email: `race_patient_${Date.now()}_${i}@clinicbooking.com`,
        password: passwordHash,
        fullName: `Bệnh Nhân Race ${i}`,
        userType: ROLES.PATIENT,
        gender: 'Male',
        isEnable: true,
      });
      tokens.push(signAccessToken(u));
    }

    const requests = tokens.map((token, i) =>
      apiRequest('POST', `/appointments/create?specialtyId=${specialty1Id}`, {
        token,
        body: {
          shiftId: shift.id,
          patients: [{ fullName: `Patient Candidate ${i + 1}` }],
        },
      }),
    );

    const responses = await Promise.all(requests);
    const successes = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);

    assert.equal(successes.length, 5);
    assert.equal(conflicts.length, 1);

    // Verify all 5 appointments have unique slotIds
    const appts = await Appointment.find({ shiftId: shift.id });
    assert.equal(appts.length, 5);
    const assignedSlotIds = appts.flatMap((a) => a.slotIds);
    assert.equal(assignedSlotIds.length, 5);
    assert.equal(new Set(assignedSlotIds).size, 5);

    // Verify shift slots state in DB: all 5 slots are BOOKED, each has a bookingRef matching its appointment
    const freshShift = await DoctorShift.findOne({ id: shift.id });
    for (const slot of freshShift.slots) {
      assert.equal(slot.status, 'BOOKED');
      assert.ok(slot.bookingRef);
      assert.match(slot.bookingRef, /^OFF[A-F0-9]{8}$/);
    }
  });
});
