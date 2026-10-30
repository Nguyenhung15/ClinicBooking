const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'uc_adm_08_test_secret';
const TEST_DB_URI =
  process.env.MONGO_TEST_URI_ADM08 ||
  'mongodb://127.0.0.1:27017/clinic_booking_test_uc_adm_08';

const app = require('../src/app');
const { User, Specialty, Appointment } = require('../src/models');
const { ROLES, APPOINTMENT_STATUSES } = require('../src/constants/enums');

let server;
let baseUrl;
let adminToken;
let doctorToken;
let receptionistToken;
let patientToken;

let docCardio;
let docGeneral;
let docDental;
let patientA;
let patientB;

async function apiGet(path, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method: 'GET', headers });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function createSeededUser(fields, createdAtIso) {
  const doc = await User.create(fields);
  await User.collection.updateOne(
    { id: doc.id },
    {
      $set: {
        createdAt: new Date(createdAtIso),
        updatedAt: new Date(createdAtIso),
      },
    },
  );
  return doc;
}

describe('UC-ADM-08: Xem analytics quản trị', () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();

    await Specialty.create([
      { id: 1, name: 'Nội tổng quát', description: 'Khám nội tổng quát' },
      { id: 5, name: 'Tim mạch', description: 'Khám tim mạch' },
      { id: 3, name: 'Răng Hàm Mặt', description: 'Khám nha khoa' },
    ]);

    const passwordHash = await bcrypt.hash('Analytics@123', 10);

    // --- 1. Baseline users created BEFORE previous & current periods (2026-09-01 .. 2026-09-10) ---
    await createSeededUser(
      {
        email: 'admin.analytics@clinicbooking.com',
        password: passwordHash,
        fullName: 'Admin Analytics',
        userType: ROLES.ADMIN,
        gender: 'Male',
        isEnable: true,
      },
      '2026-09-01T08:00:00.000Z',
    );

    docCardio = await createSeededUser(
      {
        email: 'dr.cardio@clinicbooking.com',
        password: passwordHash,
        fullName: 'PGS.TS Nguyễn Tim Mạch',
        userType: ROLES.DOCTOR,
        specialtyId: 5,
        degree: 'PGS.TS',
        isVip: true,
        gender: 'Male',
        isEnable: true,
      },
      '2026-09-05T09:00:00.000Z',
    );

    docGeneral = await createSeededUser(
      {
        email: 'dr.general@clinicbooking.com',
        password: passwordHash,
        fullName: 'BS.CKII Trần Nội Khoa',
        userType: ROLES.DOCTOR,
        specialtyId: 1,
        degree: 'BS.CKII',
        isVip: false,
        gender: 'Female',
        isEnable: true,
      },
      '2026-09-06T09:00:00.000Z',
    );

    // --- 2. Previous comparison window (2026-09-24 .. 2026-09-30, 7 days -> 2 new users) ---
    patientA = await createSeededUser(
      {
        email: 'secret.patient.pii.a@example.com',
        password: passwordHash,
        fullName: 'Nguyễn Bí Mật PII Alpha',
        phoneNumber: '0999888771',
        userType: ROLES.PATIENT,
        gender: 'Female',
        isEnable: true,
      },
      '2026-09-25T10:00:00.000Z',
    );

    await createSeededUser(
      {
        email: 'recep.analytics@clinicbooking.com',
        password: passwordHash,
        fullName: 'Lễ Tân Hệ Thống',
        userType: ROLES.RECEPTIONIST,
        gender: 'Female',
        isEnable: true,
      },
      '2026-09-28T14:00:00.000Z',
    );

    // Total baseline before 2026-10-01 = 5 users (1 Admin, 2 Doctors, 1 Patient, 1 Receptionist)

    // --- 3. Selected 7-day period (2026-10-01 .. 2026-10-07 -> 5 new users) ---
    patientB = await createSeededUser(
      {
        email: 'secret.patient.pii.b@example.com',
        password: passwordHash,
        fullName: 'Phạm Ẩn Danh PII Beta',
        phoneNumber: '0999888772',
        userType: ROLES.PATIENT,
        gender: 'Male',
        isEnable: true,
      },
      '2026-10-01T02:00:00.000Z',
    );

    await createSeededUser(
      {
        email: 'secret.patient.pii.c@example.com',
        password: passwordHash,
        fullName: 'Lê Bảo Mật PII Gamma',
        phoneNumber: '0999888773',
        userType: ROLES.PATIENT,
        gender: 'Female',
        isEnable: true,
      },
      '2026-10-01T15:30:00.000Z',
    );

    docDental = await createSeededUser(
      {
        email: 'dr.dental@clinicbooking.com',
        password: passwordHash,
        fullName: 'ThS.BS Lê Răng Hàm',
        userType: ROLES.DOCTOR,
        specialtyId: 3,
        degree: 'ThS.BS',
        isVip: false,
        gender: 'Male',
        isEnable: true,
      },
      '2026-10-03T08:00:00.000Z',
    );

    await createSeededUser(
      {
        email: 'secret.patient.pii.d@example.com',
        password: passwordHash,
        fullName: 'Hoàng Tuyệt Mật PII Delta',
        phoneNumber: '0999888774',
        userType: ROLES.PATIENT,
        gender: 'Other',
        isEnable: false,
      },
      '2026-10-05T11:00:00.000Z',
    );

    await createSeededUser(
      {
        email: 'recep2.analytics@clinicbooking.com',
        password: passwordHash,
        fullName: 'Lễ Tân Ca Tối',
        userType: ROLES.RECEPTIONIST,
        gender: 'Female',
        isEnable: true,
      },
      '2026-10-07T23:59:59.000Z',
    );

    // Out-of-range future user (2026-10-10) -> must NOT be counted in 2026-10-01..2026-10-07
    await createSeededUser(
      {
        email: 'future.user@example.com',
        password: passwordHash,
        fullName: 'Future User Outside Window',
        userType: ROLES.PATIENT,
        gender: 'Male',
        isEnable: true,
      },
      '2026-10-10T10:00:00.000Z',
    );

    // --- 4. Seed Appointments in [2026-10-01 .. 2026-10-07] & outside window ---
    await Appointment.create([
      // docCardio: 3 COMPLETED (1 with 2 family members -> 4 visits), 1 CANCELLED => total 4, completed 3 (75%)
      {
        appointmentNo: 'OFF99990001',
        patientId: patientA.id,
        doctorId: docCardio.id,
        specialtyId: 5,
        shiftId: 101,
        appointmentDate: '2026-10-02',
        appointmentTime: '08:00',
        type: 'OFFLINE',
        status: APPOINTMENT_STATUSES.COMPLETED,
        reason: 'Triệu chứng nhạy cảm tuyệt mật 001',
        patients: [
          {
            fullName: 'Nguyễn Bí Mật PII Alpha',
            phoneNumber: '0999888771',
            dob: '1992-08-19',
          },
          {
            fullName: 'Người Thân PII Phụ Thuộc',
            phoneNumber: '0999888779',
            dob: '2018-05-10',
          },
        ],
      },
      {
        appointmentNo: 'ONL99990002',
        patientId: patientB.id,
        doctorId: docCardio.id,
        specialtyId: 5,
        shiftId: 101,
        appointmentDate: '2026-10-03',
        appointmentTime: '09:00',
        type: 'ONLINE',
        status: APPOINTMENT_STATUSES.COMPLETED,
        reason: 'Triệu chứng nhạy cảm tuyệt mật 002',
        patients: [{ fullName: 'Phạm Ẩn Danh PII Beta', phoneNumber: '0999888772' }],
      },
      {
        appointmentNo: 'OFF99990003',
        patientId: patientA.id,
        doctorId: docCardio.id,
        specialtyId: 5,
        shiftId: 102,
        appointmentDate: '2026-10-06',
        appointmentTime: '10:00',
        type: 'OFFLINE',
        status: APPOINTMENT_STATUSES.COMPLETED,
        reason: 'Tái khám tuyệt mật 003',
        patients: [{ fullName: 'Nguyễn Bí Mật PII Alpha', phoneNumber: '0999888771' }],
      },
      {
        appointmentNo: 'OFF99990004',
        patientId: patientB.id,
        doctorId: docCardio.id,
        specialtyId: 5,
        shiftId: 102,
        appointmentDate: '2026-10-06',
        appointmentTime: '11:00',
        type: 'OFFLINE',
        status: APPOINTMENT_STATUSES.CANCELLED,
        reason: 'Bận đột xuất',
        patients: [{ fullName: 'Phạm Ẩn Danh PII Beta', phoneNumber: '0999888772' }],
      },

      // docGeneral: 1 COMPLETED, 1 NO_SHOW => total 2, completed 1 (50%)
      {
        appointmentNo: 'ONL99990005',
        patientId: patientA.id,
        doctorId: docGeneral.id,
        specialtyId: 1,
        shiftId: 103,
        appointmentDate: '2026-10-04',
        appointmentTime: '14:00',
        type: 'ONLINE',
        status: APPOINTMENT_STATUSES.COMPLETED,
        reason: 'Khám tổng quát',
        patients: [{ fullName: 'Nguyễn Bí Mật PII Alpha', phoneNumber: '0999888771' }],
      },
      {
        appointmentNo: 'OFF99990006',
        patientId: patientB.id,
        doctorId: docGeneral.id,
        specialtyId: 1,
        shiftId: 103,
        appointmentDate: '2026-10-05',
        appointmentTime: '15:00',
        type: 'OFFLINE',
        status: APPOINTMENT_STATUSES.NO_SHOW,
        patients: [{ fullName: 'Phạm Ẩn Danh PII Beta', phoneNumber: '0999888772' }],
      },

      // Out-of-range appointment on 2026-09-20 -> must NOT be counted
      {
        appointmentNo: 'OFF99990007',
        patientId: patientA.id,
        doctorId: docDental.id,
        specialtyId: 3,
        shiftId: 104,
        appointmentDate: '2026-09-20',
        appointmentTime: '08:00',
        type: 'OFFLINE',
        status: APPOINTMENT_STATUSES.COMPLETED,
        patients: [{ fullName: 'Nguyễn Bí Mật PII Alpha' }],
      },
    ]);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });

    const loginAs = async (email) => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Analytics@123' }),
      });
      const json = await res.json();
      assert.equal(res.status, 200);
      return json.data.token;
    };

    adminToken = await loginAs('admin.analytics@clinicbooking.com');
    doctorToken = await loginAs('dr.cardio@clinicbooking.com');
    receptionistToken = await loginAs('recep.analytics@clinicbooking.com');
    patientToken = await loginAs('secret.patient.pii.a@example.com');
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    }
  });

  it('1. Phân quyền: chỉ cho phép JWT Admin truy cập (chặn 401 unauthenticated và 403 Doctor/Receptionist/Patient)', async () => {
    const unauth = await apiGet('/admin/analytics?from=2026-10-01&to=2026-10-07');
    assert.equal(unauth.status, 401);

    for (const token of [doctorToken, receptionistToken, patientToken]) {
      const forbidden = await apiGet(
        '/admin/analytics?from=2026-10-01&to=2026-10-07',
        token,
      );
      assert.equal(forbidden.status, 403);
    }
  });

  it('2. Điều kiện trước & Giới hạn query: kiểm tra chặt chẽ khoảng ngày hợp lệ, max range 366 ngày và topLimit <= 50', async () => {
    // Reversed date range (from > to)
    const reversed = await apiGet(
      '/admin/analytics?from=2026-10-10&to=2026-10-01',
      adminToken,
    );
    assert.equal(reversed.status, 400);

    // Non-existent calendar rollover date (2026-02-30)
    const invalidCalendar = await apiGet(
      '/admin/analytics?from=2026-02-30&to=2026-03-05',
      adminToken,
    );
    assert.equal(invalidCalendar.status, 400);

    // Missing one side of date range
    const partialRange = await apiGet(
      '/admin/analytics?from=2026-10-01',
      adminToken,
    );
    assert.equal(partialRange.status, 400);

    // Exceeds MAX_DATE_RANGE_DAYS (366 days)
    const oversizedRange = await apiGet(
      '/admin/analytics?from=2025-01-01&to=2026-06-01',
      adminToken,
    );
    assert.equal(oversizedRange.status, 400);

    // Exceeds MAX_TOP_DOCTORS_LIMIT (50) or < 1
    const oversizedLimit = await apiGet(
      '/admin/analytics?from=2026-10-01&to=2026-10-07&topLimit=100',
      adminToken,
    );
    assert.equal(oversizedLimit.status, 400);

    const zeroLimit = await apiGet(
      '/admin/analytics?from=2026-10-01&to=2026-10-07&topLimit=0',
      adminToken,
    );
    assert.equal(zeroLimit.status, 400);

    // Invalid granularity
    const invalidGranularity = await apiGet(
      '/admin/analytics?from=2026-10-01&to=2026-10-07&granularity=minute',
      adminToken,
    );
    assert.equal(invalidGranularity.status, 400);
  });

  it('3. Luồng chính — Tổng hợp chính xác tăng trưởng user, chuỗi thời gian lũy kế, top doctor và định nghĩa metric', async () => {
    const res = await apiGet(
      '/admin/analytics?from=2026-10-01&to=2026-10-07&granularity=day&topLimit=5',
      adminToken,
    );
    assert.equal(res.status, 200);

    const {
      period,
      queryLimits,
      userGrowth,
      topDoctors,
      appointmentSummary,
      metricDefinitions,
    } = res.body.data;

    // Period & comparison window verification
    assert.equal(period.from, '2026-10-01');
    assert.equal(period.to, '2026-10-07');
    assert.equal(period.days, 7);
    assert.equal(period.previousFrom, '2026-09-24');
    assert.equal(period.previousTo, '2026-09-30');
    assert.equal(queryLimits.appliedTopLimit, 5);

    // User Growth summary verification:
    // Baseline (< 2026-10-01): 5 users | Previous 7d: 2 users | Current 7d: 5 users -> +150%
    assert.equal(userGrowth.summary.totalUsersBeforePeriod, 5);
    assert.equal(userGrowth.summary.newUsersInPeriod, 5);
    assert.equal(userGrowth.summary.newUsersPreviousPeriod, 2);
    assert.equal(userGrowth.summary.growthDelta, 3);
    assert.equal(userGrowth.summary.growthRatePercent, 150);
    assert.equal(userGrowth.summary.totalUsersAtPeriodEnd, 10);
    assert.equal(userGrowth.summary.activeUsersAtPeriodEnd, 9);
    assert.equal(userGrowth.summary.disabledUsersAtPeriodEnd, 1);
    assert.deepEqual(userGrowth.summary.newByRole, {
      Patient: 3,
      Doctor: 1,
      Receptionist: 1,
      Admin: 0,
    });

    // Continuous 7 daily buckets with zero-filled gaps and cumulative rollup
    assert.equal(userGrowth.series.length, 7);
    assert.equal(userGrowth.series[0].bucket, '2026-10-01');
    assert.equal(userGrowth.series[0].newUsers, 2);
    assert.equal(userGrowth.series[0].cumulativeUsers, 7);
    assert.equal(userGrowth.series[1].bucket, '2026-10-02');
    assert.equal(userGrowth.series[1].newUsers, 0);
    assert.equal(userGrowth.series[1].cumulativeUsers, 7);
    assert.equal(userGrowth.series[6].bucket, '2026-10-07');
    assert.equal(userGrowth.series[6].cumulativeUsers, 10);

    // Top Doctors ranking verification:
    // Rank 1: docCardio (3 completed / 4 total = 75%, 2 unique patients, 4 completed patient visits)
    // Rank 2: docGeneral (1 completed / 2 total = 50%, 2 unique patients, 1 completed patient visit)
    // Rank 3: docDental (0 in window; its 2026-09-20 appointment is excluded!)
    assert.equal(topDoctors.items.length, 3);
    const [rank1, rank2, rank3] = topDoctors.items;

    assert.equal(rank1.rank, 1);
    assert.equal(rank1.doctorId, docCardio.id);
    assert.equal(rank1.fullName, 'PGS.TS Nguyễn Tim Mạch');
    assert.equal(rank1.specialtyName, 'Tim mạch');
    assert.equal(rank1.completedAppointments, 3);
    assert.equal(rank1.totalAppointments, 4);
    assert.equal(rank1.cancelledAppointments, 1);
    assert.equal(rank1.onlineAppointments, 1);
    assert.equal(rank1.offlineAppointments, 3);
    assert.equal(rank1.uniquePatientsCount, 2);
    assert.equal(rank1.totalPatientVisitsCount, 4);
    assert.equal(rank1.completionRatePercent, 75);

    assert.equal(rank2.rank, 2);
    assert.equal(rank2.doctorId, docGeneral.id);
    assert.equal(rank2.completedAppointments, 1);
    assert.equal(rank2.totalAppointments, 2);
    assert.equal(rank2.completionRatePercent, 50);

    assert.equal(rank3.rank, 3);
    assert.equal(rank3.doctorId, docDental.id);
    assert.equal(rank3.completedAppointments, 0);
    assert.equal(rank3.totalAppointments, 0);

    // Overall clinic appointment summary in [2026-10-01..2026-10-07]
    assert.equal(appointmentSummary.totalAppointments, 6);
    assert.equal(appointmentSummary.completedAppointments, 4);
    assert.equal(appointmentSummary.cancelledAppointments, 1);
    assert.equal(appointmentSummary.noShowAppointments, 1);
    assert.equal(appointmentSummary.completionRatePercent, 66.67);

    // Metric definitions catalog included & complete
    assert.ok(Array.isArray(metricDefinitions));
    assert.ok(metricDefinitions.length >= 8);
    const metricKeys = new Set(metricDefinitions.map((m) => m.key));
    for (const expectedKey of [
      'newUsersInPeriod',
      'growthRatePercent',
      'cumulativeUsers',
      'completedAppointments',
      'completionRatePercent',
      'uniquePatientsCount',
    ]) {
      assert.ok(metricKeys.has(expectedKey), `Missing metric definition: ${expectedKey}`);
    }
    for (const def of metricDefinitions) {
      assert.ok(def.label && def.unit && def.formula && def.description);
    }
  });

  it('4. Hỗ trợ định dạng ngày dd/MM/yyyy, lọc theo tháng/tuần và cắt giới hạn topLimit chính xác', async () => {
    const res = await apiGet(
      '/admin/analytics?startDate=01/10/2026&endDate=07/10/2026&granularity=month&topLimit=1&onlyWithAppointments=true',
      adminToken,
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.data.period.from, '2026-10-01');
    assert.equal(res.body.data.period.to, '2026-10-07');
    assert.equal(res.body.data.userGrowth.series.length, 1);
    assert.equal(res.body.data.userGrowth.series[0].bucket, '2026-10');
    assert.equal(res.body.data.userGrowth.series[0].newUsers, 5);
    assert.equal(res.body.data.topDoctors.items.length, 1);
    assert.equal(res.body.data.topDoctors.items[0].doctorId, docCardio.id);
  });

  it('5. Bảo vệ quyền riêng tư: tuyệt đối KHÔNG rò rỉ bất kỳ định danh cá nhân bệnh nhân (PII) nào trong kết quả analytics', async () => {
    const [overviewRes, topDocRes, growthRes] = await Promise.all([
      apiGet('/admin/analytics?from=2026-10-01&to=2026-10-07', adminToken),
      apiGet('/admin/analytics/top-doctors?from=2026-10-01&to=2026-10-07', adminToken),
      apiGet('/admin/analytics/user-growth?from=2026-10-01&to=2026-10-07', adminToken),
    ]);

    assert.equal(overviewRes.body.data.privacy.containsPatientPii, false);

    const combinedPayloadText = JSON.stringify({
      overview: overviewRes.body,
      topDoc: topDocRes.body,
      growth: growthRes.body,
    });

    const forbiddenPiiTokens = [
      'Nguyễn Bí Mật PII Alpha',
      'Phạm Ẩn Danh PII Beta',
      'Lê Bảo Mật PII Gamma',
      'Hoàng Tuyệt Mật PII Delta',
      'Người Thân PII Phụ Thuộc',
      'secret.patient.pii',
      '0999888771',
      '0999888772',
      '0999888773',
      '0999888774',
      '0999888779',
      '1992-08-19',
      'OFF99990001',
      'ONL99990002',
      'Triệu chứng nhạy cảm tuyệt mật',
      '"patientId":',
      '"patients":',
      '"patientName":',
      '"dob":',
    ];

    for (const sensitiveToken of forbiddenPiiTokens) {
      assert.equal(
        combinedPayloadText.includes(sensitiveToken),
        false,
        `Analytics payload leaked sensitive patient PII token: ${sensitiveToken}`,
      );
    }
  });
});
