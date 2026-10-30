const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'uc_pat_02_test_secret';
const TEST_DB_URI =
  process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017/clinic_booking_test_uc_pat_02';

const app = require('../src/app');
const { User, PatientProfile, Appointment } = require('../src/models');
const { ROLES } = require('../src/constants/enums');
const patientProfileService = require('../src/services/patientProfile.service');

let server;
let baseUrl;
let patientAToken;
let patientBToken;
let doctorToken;
let patientAId;
let patientBId;

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

describe('UC-PAT-02: Quản lý hồ sơ người phụ thuộc (/patients-info)', () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();

    const passwordHash = await bcrypt.hash('Patient@123', 10);

    const patientA = await User.create({
      email: 'patientA@clinicbooking.com',
      password: passwordHash,
      fullName: 'Patient Alpha',
      userType: ROLES.PATIENT,
      gender: 'Male',
      isEnable: true,
    });
    patientAId = patientA.id;

    const patientB = await User.create({
      email: 'patientB@clinicbooking.com',
      password: passwordHash,
      fullName: 'Patient Beta',
      userType: ROLES.PATIENT,
      gender: 'Female',
      isEnable: true,
    });
    patientBId = patientB.id;

    await User.create({
      email: 'doctor1@clinicbooking.com',
      password: passwordHash,
      fullName: 'Doctor Strange',
      userType: ROLES.DOCTOR,
      gender: 'Male',
      isEnable: true,
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });

    const loginA = await apiRequest('POST', '/auth/login', {
      body: { email: 'patientA@clinicbooking.com', password: 'Patient@123' },
    });
    assert.equal(loginA.status, 200);
    patientAToken = loginA.body.data.token;

    const loginB = await apiRequest('POST', '/auth/login', {
      body: { email: 'patientB@clinicbooking.com', password: 'Patient@123' },
    });
    assert.equal(loginB.status, 200);
    patientBToken = loginB.body.data.token;

    const loginDoc = await apiRequest('POST', '/auth/login', {
      body: { email: 'doctor1@clinicbooking.com', password: 'Patient@123' },
    });
    assert.equal(loginDoc.status, 200);
    doctorToken = loginDoc.body.data.token;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  });

  it('1. Precondition: rejects unauthenticated (401) and wrong role (403)', async () => {
    const unauthGet = await apiRequest('GET', '/patients-info/my');
    assert.equal(unauthGet.status, 401);

    const docCreate = await apiRequest('POST', '/patients-info/create', {
      token: doctorToken,
      body: { fullName: 'Child of Doctor', relationship: 'Con' },
    });
    assert.equal(docCreate.status, 403);
  });

  it('2. Main Flow: Patient creates, reads, updates dependent profile', async () => {
    // Create profile
    const createRes = await apiRequest('POST', '/patients-info/create', {
      token: patientAToken,
      body: {
        fullName: 'Nguyễn Văn Con',
        gender: 'Nam',
        phoneNumber: '0901234567',
        dob: '2015-05-10',
        relationship: 'Con',
      },
    });

    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.success, true);
    const profile = createRes.body.data;
    assert.ok(Number.isInteger(profile.id));
    assert.equal(profile.id > 0, true);
    assert.equal(profile.fullName, 'Nguyễn Văn Con');
    assert.equal(profile.gender, 'Male'); // normalized
    assert.equal(profile.phoneNumber, '0901234567');
    assert.equal(profile.dob, '2015-05-10');
    assert.equal(profile.relationship, 'Con');
    assert.equal(profile._id, undefined);
    assert.equal(profile.__v, undefined);

    // List profiles of Patient A
    const listRes = await apiRequest('GET', '/patients-info/my', {
      token: patientAToken,
    });
    assert.equal(listRes.status, 200);
    assert.equal(Array.isArray(listRes.body.data), true);
    assert.equal(listRes.body.data.length, 1);
    assert.equal(listRes.body.data[0].id, profile.id);

    // Get single profile by ID
    const getRes = await apiRequest('GET', `/patients-info/${profile.id}`, {
      token: patientAToken,
    });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.data.fullName, 'Nguyễn Văn Con');

    // Update profile
    const updateRes = await apiRequest('PUT', `/patients-info/update/${profile.id}`, {
      token: patientAToken,
      body: {
        fullName: 'Nguyễn Văn Con Đã Lớn',
        gender: 'Male',
        phoneNumber: '+84901234567',
        relationship: 'Con trai',
      },
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.fullName, 'Nguyễn Văn Con Đã Lớn');
    assert.equal(updateRes.body.data.phoneNumber, '+84901234567');
    assert.equal(updateRes.body.data.relationship, 'Con trai');
  });

  it('3. Validation: rejects invalid inputs, future dob, bad phone, and limit (400)', async () => {
    // Missing fullName
    const emptyName = await apiRequest('POST', '/patients-info/create', {
      token: patientAToken,
      body: { fullName: '   ', relationship: 'Con' },
    });
    assert.equal(emptyName.status, 400);

    // Future dob
    const futureDob = await apiRequest('POST', '/patients-info/create', {
      token: patientAToken,
      body: { fullName: 'Baby Future', dob: '2099-01-01', relationship: 'Con' },
    });
    assert.equal(futureDob.status, 400);

    // Invalid phone number
    const badPhone = await apiRequest('POST', '/patients-info/create', {
      token: patientAToken,
      body: { fullName: 'Phone Test', phoneNumber: '12345', relationship: 'Con' },
    });
    assert.equal(badPhone.status, 400);

    // Invalid ID
    const invalidId = await apiRequest('GET', '/patients-info/abc', {
      token: patientAToken,
    });
    assert.equal(invalidId.status, 400);

    // Profile limit per user: create up to MAX_PROFILES_PER_USER (10) for Patient B
    for (let i = 1; i <= 10; i += 1) {
      const res = await apiRequest('POST', '/patients-info/create', {
        token: patientBToken,
        body: { fullName: `Người thân ${i}`, phoneNumber: '0912345678', relationship: 'Con' },
      });
      assert.equal(res.status, 201);
    }

    // 11th profile should be rejected with 400 limit exceeded
    const overflow = await apiRequest('POST', '/patients-info/create', {
      token: patientBToken,
      body: { fullName: 'Người thân 11', phoneNumber: '0912345678', relationship: 'Con' },
    });
    assert.equal(overflow.status, 400);
    assert.match(overflow.body.message, /tối đa 10 hồ sơ/i);
  });

  it('4. Ownership & Access Control: Patient B cannot access or modify Patient A profiles', async () => {
    // Patient A creates a profile
    const createA = await apiRequest('POST', '/patients-info/create', {
      token: patientAToken,
      body: { fullName: 'Bí mật của A', relationship: 'Bản thân' },
    });
    assert.equal(createA.status, 201);
    const profileAId = createA.body.data.id;

    // Patient B tries to get Patient A's profile
    const getForbidden = await apiRequest('GET', `/patients-info/${profileAId}`, {
      token: patientBToken,
    });
    assert.equal(getForbidden.status, 403);

    // Patient B tries to update Patient A's profile
    const updateForbidden = await apiRequest('PUT', `/patients-info/update/${profileAId}`, {
      token: patientBToken,
      body: { fullName: 'Hacked name' },
    });
    assert.equal(updateForbidden.status, 403);

    // Patient B tries to delete Patient A's profile
    const deleteForbidden = await apiRequest('DELETE', `/patients-info/delete/${profileAId}`, {
      token: patientBToken,
    });
    assert.equal(deleteForbidden.status, 403);
  });

  it('5. Deletion: unlinked profile is hard-deleted; appointment-linked profile is soft-archived', async () => {
    // Case A: Unlinked profile -> hard delete
    const createUnlinked = await apiRequest('POST', '/patients-info/create', {
      token: patientAToken,
      body: { fullName: 'Hồ sơ tạm thời', relationship: 'Bạn bè' },
    });
    assert.equal(createUnlinked.status, 201);
    const unlinkedId = createUnlinked.body.data.id;

    const delRes1 = await apiRequest('DELETE', `/patients-info/delete/${unlinkedId}`, {
      token: patientAToken,
    });
    assert.equal(delRes1.status, 200);

    // Verify it is completely removed from DB
    const foundInDb = await PatientProfile.findOne({ id: unlinkedId });
    assert.equal(foundInDb, null);

    // Case B: Profile linked to an Appointment -> soft archive
    const createLinked = await apiRequest('POST', '/patients-info/create', {
      token: patientAToken,
      body: { fullName: 'Bà Nội Đã Khám', relationship: 'Bà' },
    });
    assert.equal(createLinked.status, 201);
    const linkedId = createLinked.body.data.id;

    // Simulate an appointment snapshot referencing this profile
    await Appointment.create({
      appointmentNo: 'OFFTEST12345',
      patientId: patientAId,
      doctorId: 1,
      specialtyId: 1,
      shiftId: 1,
      slotIds: [1],
      appointmentDate: '2026-11-01',
      appointmentTime: '08:00',
      type: 'OFFLINE',
      status: 'CONFIRMED',
      patients: [
        {
          id: linkedId,
          fullName: 'Bà Nội Đã Khám',
          gender: 'Female',
          relationship: 'Bà',
        },
      ],
    });

    // Now delete profile
    const delRes2 = await apiRequest('DELETE', `/patients-info/delete/${linkedId}`, {
      token: patientAToken,
    });
    assert.equal(delRes2.status, 200);

    // Should no longer appear in /patients-info/my
    const listAfter = await apiRequest('GET', '/patients-info/my', {
      token: patientAToken,
    });
    const idsInList = listAfter.body.data.map((p) => p.id);
    assert.equal(idsInList.includes(linkedId), false);

    // Direct fetch returns 404 because isArchived = true
    const getArchived = await apiRequest('GET', `/patients-info/${linkedId}`, {
      token: patientAToken,
    });
    assert.equal(getArchived.status, 404);

    // In DB, document is preserved with isArchived = true
    const archivedDoc = await PatientProfile.findOne({ id: linkedId });
    assert.ok(archivedDoc);
    assert.equal(archivedDoc.isArchived, true);

    // Booking guard rejects using an archived profile
    await assert.rejects(
      async () => {
        await patientProfileService.getActiveProfileForOwner(patientAId, linkedId);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /đã bị lưu trữ/i);
        return true;
      },
    );
  });
});
