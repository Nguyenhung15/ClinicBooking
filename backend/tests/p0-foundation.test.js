const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_p0_secret_key_sdn302';
process.env.CLINIC_TIMEZONE = 'Asia/Ho_Chi_Minh';
const TEST_DB_URI = process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017/clinic_booking_test_p0';

const {
  ClockService,
  RealClock,
  FakeClock,
  setClock,
  clock,
  createFakeClock,
} = require('../src/services/clock.service');
const {
  toClinicDateString,
  toClinicTimeString,
  parseClinicDateTimeToUtc,
  diffHours,
} = require('../src/utils/timezone');
const {
  appointmentStateService,
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  isValidTransition,
} = require('../src/services/appointmentState.service');
const auditService = require('../src/services/audit.service');
const outboxService = require('../src/services/outbox.service');
const ApiError = require('../src/utils/ApiError');
const { errorHandler } = require('../src/middlewares/error.middleware');
const {
  requireRoles,
  Roles,
  getPrincipal,
} = require('../src/middlewares/auth.middleware');
const { createRateLimiter } = require('../src/middlewares/rateLimiter.middleware');
const { configService, ConfigService } = require('../src/config/config.service');
const {
  Appointment,
  DoctorShift,
  AuditLog,
  OutboxEvent,
  User,
} = require('../src/models');
const { APPOINTMENT_STATUSES, ROLES } = require('../src/constants/enums');

describe('P0 Foundation: Shared Architecture & Core Services', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    setClock(new RealClock());
    outboxService.stopOutboxWorker();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('1. Timezone Utils & Clock Service', () => {
    it('toClinicDateString và toClinicTimeString format đúng múi giờ Asia/Ho_Chi_Minh (UTC+7)', () => {
      // 2026-10-31 01:30:00 UTC = 2026-10-31 08:30:00 in Vietnam (UTC+7)
      const utcMorning = new Date('2026-10-31T01:30:00.000Z');
      assert.equal(toClinicDateString(utcMorning), '2026-10-31');
      assert.equal(toClinicTimeString(utcMorning), '08:30');

      // 2026-10-31 17:05:00 UTC = 2026-11-01 00:05:00 in Vietnam (next day)
      const utcNight = new Date('2026-10-31T17:05:00.000Z');
      assert.equal(toClinicDateString(utcNight), '2026-11-01');
      assert.equal(toClinicTimeString(utcNight), '00:05');
    });

    it('parseClinicDateTimeToUtc chuyển đổi ngày giờ phòng khám thành UTC Date chính xác', () => {
      const utcDate = parseClinicDateTimeToUtc('2026-10-31', '08:30');
      // 08:30 GMT+7 should be 01:30:00.000Z
      assert.equal(utcDate.toISOString(), '2026-10-31T01:30:00.000Z');
    });

    it('diffHours tính khoảng cách giờ chính xác', () => {
      const d1 = new Date('2026-10-31T10:00:00Z');
      const d2 = new Date('2026-10-31T06:00:00Z');
      assert.equal(diffHours(d1, d2), 4);
    });

    it('FakeClock có thể tua và đặt thời gian phục vụ kiểm thử', () => {
      const fake = createFakeClock('2026-10-31T01:00:00.000Z');
      setClock(fake);

      assert.equal(clock.today(), '2026-10-31');
      assert.equal(clock.currentTime(), '08:00');

      // Advance by 3 hours
      fake.advanceByHours(3);
      assert.equal(clock.currentTime(), '11:00');

      // Set explicit time
      fake.setNow('2026-11-15T07:15:00.000Z');
      assert.equal(clock.today(), '2026-11-15');
      assert.equal(clock.currentTime(), '14:15');

      setClock(new RealClock());
    });
  });

  describe('2. AppointmentStateService (State Machine, Idempotency & Conditional Update)', () => {
    let testAppointment;

    beforeEach(async () => {
      await Appointment.deleteMany({ appointmentNo: { $regex: /^TEST-P0-/ } });
      testAppointment = await Appointment.create({
        appointmentNo: `TEST-P0-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        patientId: 9901,
        doctorId: 8801,
        specialtyId: 1,
        shiftId: 501,
        slotIds: [1],
        appointmentDate: '2026-11-01',
        appointmentTime: '08:00',
        status: APPOINTMENT_STATUSES.PENDING_CONFIRMATION,
        type: 'OFFLINE',
      });
    });

    it('isValidTransition kiểm tra đúng ma trận trạng thái', () => {
      assert.equal(
        isValidTransition(APPOINTMENT_STATUSES.PENDING_CONFIRMATION, APPOINTMENT_STATUSES.CONFIRMED),
        true,
      );
      assert.equal(
        isValidTransition(APPOINTMENT_STATUSES.CONFIRMED, APPOINTMENT_STATUSES.CHECKED_IN),
        true,
      );
      assert.equal(
        isValidTransition(APPOINTMENT_STATUSES.CHECKED_IN, APPOINTMENT_STATUSES.IN_PROGRESS),
        true,
      );
      assert.equal(
        isValidTransition(APPOINTMENT_STATUSES.IN_PROGRESS, APPOINTMENT_STATUSES.COMPLETED),
        true,
      );

      // Illegal jumps
      assert.equal(
        isValidTransition(APPOINTMENT_STATUSES.PENDING_CONFIRMATION, APPOINTMENT_STATUSES.COMPLETED),
        false,
      );
      assert.equal(
        isValidTransition(APPOINTMENT_STATUSES.COMPLETED, APPOINTMENT_STATUSES.CONFIRMED),
        false,
      );
    });

    it('transition hợp lệ: PENDING_CONFIRMATION -> CONFIRMED lưu actor, timestamp và confirmedBy', async () => {
      const actor = { userId: '120012', role: ROLES.RECEPTIONIST, email: 'receptionist1@clinic.com' };

      const result = await appointmentStateService.transition(
        testAppointment.id,
        [APPOINTMENT_STATUSES.PENDING_CONFIRMATION],
        APPOINTMENT_STATUSES.CONFIRMED,
        actor,
        { reason: 'Lễ tân xác nhận lịch qua điện thoại' },
      );

      assert.equal(result.changed, true);
      assert.equal(result.idempotent, false);
      assert.equal(result.status, APPOINTMENT_STATUSES.CONFIRMED);
      assert.equal(result.appointment.status, APPOINTMENT_STATUSES.CONFIRMED);
      assert.equal(Number(result.appointment.confirmedBy), 120012);
    });

    it('Tính Idempotent: gọi lại transition khi đã ở trạng thái đích sẽ trả state hiện tại không lỗi', async () => {
      const actor = { userId: '120012', role: ROLES.RECEPTIONIST };

      // First transition
      await appointmentStateService.transition(
        testAppointment.id,
        [APPOINTMENT_STATUSES.PENDING_CONFIRMATION],
        APPOINTMENT_STATUSES.CONFIRMED,
        actor,
      );

      // Duplicate idempotent call
      const secondCall = await appointmentStateService.transition(
        testAppointment.id,
        [APPOINTMENT_STATUSES.PENDING_CONFIRMATION],
        APPOINTMENT_STATUSES.CONFIRMED,
        actor,
      );

      assert.equal(secondCall.changed, false);
      assert.equal(secondCall.idempotent, true);
      assert.equal(secondCall.status, APPOINTMENT_STATUSES.CONFIRMED);
    });

    it('Từ chối transition nếu trạng thái hiện tại không khớp fromStatuses (409 Conflict)', async () => {
      const actor = { userId: '120012', role: ROLES.RECEPTIONIST };

      await assert.rejects(
        async () => {
          await appointmentStateService.transition(
            testAppointment.id,
            [APPOINTMENT_STATUSES.CHECKED_IN], // But appointment is in PENDING_CONFIRMATION
            APPOINTMENT_STATUSES.IN_PROGRESS,
            actor,
          );
        },
        (err) => {
          assert.equal(err.statusCode, 409);
          return true;
        },
      );
    });

    it('Từ chối transition từ terminal state (ví dụ COMPLETED)', async () => {
      await Appointment.updateOne({ _id: testAppointment._id }, { status: APPOINTMENT_STATUSES.COMPLETED });
      const actor = { userId: '8801', role: ROLES.DOCTOR };

      await assert.rejects(
        async () => {
          await appointmentStateService.transition(
            testAppointment.id,
            [APPOINTMENT_STATUSES.COMPLETED],
            APPOINTMENT_STATUSES.CONFIRMED,
            actor,
          );
        },
        (err) => {
          assert.equal(err.statusCode, 409);
          return true;
        },
      );
    });
  });

  describe('3. AuditService (PII Filtering & Zero Secret Leakage)', () => {
    it('lọc triệt để password, token và secrets khỏi diff và payload', () => {
      const rawSnapshot = {
        fullName: 'Nguyễn Văn A',
        email: 'patient@example.com',
        password: '$2a$10$verysecretpasswordhash',
        temporaryPassword: 'temp-123456',
        token: 'eyJhbGciOiJIUzI1Ni...',
        apiKey: 'secret_live_key',
        nested: {
          authorization: 'Bearer eyJ...',
          normalField: 100,
        },
      };

      const cleaned = auditService.sanitizePiiAndSecrets(rawSnapshot);
      assert.equal(cleaned.fullName, 'Nguyễn Văn A');
      assert.equal(cleaned.password, '[REDACTED]');
      assert.equal(cleaned.temporaryPassword, '[REDACTED]');
      assert.equal(cleaned.token, '[REDACTED]');
      assert.equal(cleaned.apiKey, '[REDACTED]');
      assert.equal(cleaned.nested.authorization, '[REDACTED]');
      assert.equal(cleaned.nested.normalField, 100);
    });

    it('AuditService.log lưu bản ghi thành công với String ID', async () => {
      const logEntry = await auditService.log({
        actor: { userId: 'USR_STRING_123', role: 'Doctor', email: 'doctor@clinic.com' },
        action: 'APPOINTMENT_START',
        resource: { type: 'Appointment', id: 'APP_STRING_999' },
        reason: 'Bác sĩ bắt đầu khám ca 1',
        summary: 'Bắt đầu khám',
        changes: {
          before: { status: 'CHECKED_IN', password: 'should_not_leak' },
          after: { status: 'IN_PROGRESS', password: 'should_not_leak' },
        },
      });

      assert.ok(logEntry._id);
      assert.equal(String(logEntry.actorId), 'USR_STRING_123');
      assert.equal(String(logEntry.targetId), 'APP_STRING_999');
      assert.equal(logEntry.summary, 'Bắt đầu khám');
      assert.equal(logEntry.changes.before.status, 'CHECKED_IN');
      assert.equal(logEntry.changes.before.password, '[REDACTED]');
    });
  });

  describe('4. Transactional Outbox & Notification Adapter', () => {
    it('ghi event vào outbox sau commit với trạng thái PENDING', async () => {
      const event = await outboxService.recordEvent({
        eventType: 'APPOINTMENT_CONFIRMED',
        channel: 'EMAIL',
        payload: { appointmentId: '99', patientName: 'Trần Văn B' },
      });

      assert.ok(event._id);
      assert.equal(event.status, 'PENDING');
      assert.equal(event.retries, 0);
    });

    it('dispatchPendingEvents xử lý thành công chuyển status sang SENT', async () => {
      let emailSent = false;
      outboxService.registerAdapter('EMAIL', async (_evt) => {
        emailSent = true;
        return { success: true };
      });

      await outboxService.recordEvent({
        eventType: 'APPOINTMENT_TEST_SENT',
        channel: 'EMAIL',
        payload: { info: 'Test' },
      });

      const result = await outboxService.dispatchPendingEvents({ limit: 10 });
      assert.ok(result.processedCount >= 1);
      assert.ok(result.successCount >= 1);
      assert.equal(emailSent, true);
    });

    it('lỗi adapter không ném exception ra ngoài mà tăng retries và tính backoff', async () => {
      outboxService.registerAdapter('EMAIL', async (_evt) => {
        throw new Error('SMTP connection timed out');
      });

      const failedEvent = await outboxService.recordEvent({
        eventType: 'APPOINTMENT_TEST_FAIL',
        channel: 'EMAIL',
        payload: { errorCase: true },
      });

      await outboxService.dispatchPendingEvents({ limit: 10 });

      const updated = await OutboxEvent.findById(failedEvent._id);
      assert.equal(updated.retries, 1);
      assert.equal(updated.status, 'PENDING'); // Kept in pending for next retry
      assert.ok(updated.nextRetryAt > new Date());
      assert.ok(updated.lastError.includes('SMTP connection timed out'));
    });
  });

  describe('5. Unified Error Format ({ code, message, details, traceId })', () => {
    it('ApiError tạo đầy đủ code, statusCode, details', () => {
      const err = ApiError.conflict('Lịch khám đã có người giữ', 'SLOT_ALREADY_BOOKED', [{ slotId: 1 }]);
      assert.equal(err.statusCode, 409);
      assert.equal(err.code, 'SLOT_ALREADY_BOOKED');
      assert.equal(err.details[0].slotId, 1);
    });

    it('errorHandler format response chuẩn xác, có traceId và không lộ stack ở production', () => {
      let sentStatus;
      let sentJson;
      const fakeReq = { headers: { 'x-request-id': 'custom-trace-id-123' } };
      const fakeRes = {
        setHeader: () => {},
        status: (s) => {
          sentStatus = s;
          return { json: (j) => { sentJson = j; } };
        },
      };

      const testErr = ApiError.badRequest('Tham số không hợp lệ', 'INVALID_PARAM', ['fieldA is required']);
      errorHandler(testErr, fakeReq, fakeRes, () => {});

      assert.equal(sentStatus, 400);
      assert.equal(sentJson.success, false);
      assert.equal(sentJson.error.code, 'INVALID_PARAM');
      assert.equal(sentJson.error.traceId, 'custom-trace-id-123');
      assert.equal(sentJson.error.details[0], 'fieldA is required');
      assert.equal(sentJson.message, 'Tham số không hợp lệ');
    });
  });

  describe('6. Role Guards (Deny-by-default) & getPrincipal', () => {
    it('requireRoles deny-by-default: từ chối 401 nếu chưa đăng nhập', () => {
      const guard = requireRoles(ROLES.ADMIN);
      const req = {};
      assert.throws(
        () => guard(req, {}, () => {}),
        (err) => err.statusCode === 401,
      );
    });

    it('requireRoles deny-by-default: từ chối 403 nếu role không khớp', () => {
      const guard = requireRoles(ROLES.DOCTOR);
      const req = { user: { userType: ROLES.PATIENT } };
      assert.throws(
        () => guard(req, {}, () => {}),
        (err) => err.statusCode === 403,
      );
    });

    it('requireRoles cho phép tiếp tục nếu role khớp', () => {
      const guard = requireRoles(ROLES.RECEPTIONIST, ROLES.ADMIN);
      const req = { user: { userType: ROLES.RECEPTIONIST } };
      let calledNext = false;
      guard(req, {}, () => { calledNext = true; });
      assert.equal(calledNext, true);
    });

    it('getPrincipal trích xuất userId dưới dạng String và lấy thông tin từ JWT', () => {
      const req = {
        user: {
          id: 120012,
          _id: new mongoose.Types.ObjectId(),
          userType: ROLES.RECEPTIONIST,
          email: 'receptionist1@clinic.com',
          fullName: 'Võ Mai Phương',
        },
      };

      const principal = getPrincipal(req);
      assert.equal(typeof principal.userId, 'string');
      assert.equal(principal.userId, '120012');
      assert.equal(principal.role, ROLES.RECEPTIONIST);
      assert.equal(principal.email, 'receptionist1@clinic.com');
    });
  });

  describe('7. Rate Limiter (Per User / IP)', () => {
    it('chặn 429 khi số lượng request vượt ngưỡng cho phép', () => {
      const limiter = createRateLimiter({
        windowMs: 5000,
        max: 2,
        keyGenerator: () => 'test-user-limit',
      });

      const fakeReq = { headers: { 'x-test-rate-limit': '1' } };
      const fakeRes = { setHeader: () => {} };

      // Req 1: OK
      limiter(fakeReq, fakeRes, () => {});
      // Req 2: OK
      limiter(fakeReq, fakeRes, () => {});

      // Req 3: Exceeded -> Throws 429
      assert.throws(
        () => limiter(fakeReq, fakeRes, () => {}),
        (err) => {
          assert.equal(err.statusCode, 429);
          assert.equal(err.code, 'RATE_LIMIT_EXCEEDED');
          return true;
        },
      );

      limiter.reset();
    });
  });

  describe('8. ConfigService (Type-Safe & Validated)', () => {
    it('đọc đúng kiểu boolean, number, string, array và cung cấp default an toàn', () => {
      const customEnv = {
        PORT: '4000',
        ENABLE_MONGO_TRANSACTIONS: 'true',
        CORS_ORIGINS: 'http://a.com, http://b.com',
        RATE_LIMIT_MAX: '250',
      };
      const cfg = new ConfigService(customEnv);

      assert.equal(cfg.port, 4000);
      assert.equal(cfg.enableMongoTransactions, true);
      assert.deepEqual(cfg.corsOrigins, ['http://a.com', 'http://b.com']);
      assert.equal(cfg.rateLimitMax, 250);
      assert.equal(cfg.clinicTimeZone, 'Asia/Ho_Chi_Minh'); // fallback default
    });
  });

  describe('9. Database Baseline Indexes', () => {
    it('appointmentSchema và doctorShiftSchema có đầy đủ các index theo yêu cầu P0', () => {
      const apptIndexes = Appointment.schema.indexes();
      const shiftIndexes = DoctorShift.schema.indexes();

      // Check unique appointmentNo
      const hasUniqueApptNo =
        Appointment.schema.path('appointmentNo')?.options?.unique === true ||
        apptIndexes.some(([fields, opts]) => fields.appointmentNo === 1 && opts?.unique === true);
      assert.ok(hasUniqueApptNo, 'Missing unique appointmentNo index');

      // Check compound patientId + appointmentDate
      const hasPatientDate = apptIndexes.some(
        ([fields]) => fields.patientId === 1 && fields.appointmentDate === 1,
      );
      assert.ok(hasPatientDate, 'Missing compound patientId+appointmentDate index');

      // Check compound doctorId + appointmentDate + status
      const hasDoctorDateStatus = apptIndexes.some(
        ([fields]) => fields.doctorId === 1 && fields.appointmentDate === 1 && fields.status === 1,
      );
      assert.ok(hasDoctorDateStatus, 'Missing compound doctorId+appointmentDate+status index');

      // Check compound shiftId + slotIds
      const hasShiftSlot = apptIndexes.some(
        ([fields]) => fields.shiftId === 1 && fields.slotIds === 1,
      );
      assert.ok(hasShiftSlot, 'Missing compound shiftId+slotIds index');

      // Check unique doctorShift doctorId + date + shift
      const hasUniqueShift = shiftIndexes.some(
        ([fields, opts]) => fields.doctorId === 1 && fields.date === 1 && fields.shift === 1 && opts?.unique === true,
      );
      assert.ok(hasUniqueShift, 'Missing unique doctorId+date+shift index');
    });
  });
});
