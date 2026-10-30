const crypto = require('crypto');
const {
  Appointment,
  DoctorShift,
  User,
  Specialty,
  PatientProfile,
} = require('../models');
const { ROLES } = require('../constants/enums');
const ApiError = require('../utils/ApiError');
const { parsePositiveInt, normalizeGender } = require('../utils/normalizers');
const patientProfileService = require('./patientProfile.service');
const env = require('../config/env');

const getTodayString = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: env.clinicTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getCurrentTimeString = () =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: env.clinicTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());

const generateAppointmentNo = (type = 'OFFLINE') => {
  const prefix = type === 'ONLINE' ? 'ONL' : 'OFF';
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${randomHex}`;
};

/**
 * UC-PAT-04: Book appointment with atomic slot reservation.
 */
async function bookAppointment(user, query = {}, body = {}) {
  if (!user || user.userType !== ROLES.PATIENT) {
    throw new ApiError(403, 'Chỉ bệnh nhân mới có quyền đặt lịch khám');
  }

  // 1. Validate query and inputs
  const shiftId = parsePositiveInt(body.shiftId, 'shiftId');
  const specialtyId = parsePositiveInt(query.specialtyId, 'specialtyId');

  const specialty = await Specialty.findOne({ id: specialtyId }).lean();
  if (!specialty) {
    throw new ApiError(404, 'Chuyên khoa không tồn tại');
  }

  // 2. Fetch and validate DoctorShift
  const shift = await DoctorShift.findOne({ id: shiftId }).lean();
  if (!shift) {
    throw new ApiError(404, 'Ca trực không tồn tại');
  }
  if (shift.status !== 'ACTIVE') {
    throw new ApiError(400, 'Ca trực không còn khả dụng hoặc đã bị hủy');
  }

  // 3. Validate Doctor
  let doctorId = shift.doctorId;
  if (query.doctorId != null && String(query.doctorId).trim() !== '') {
    const queryDoctorId = parsePositiveInt(query.doctorId, 'doctorId');
    if (queryDoctorId !== shift.doctorId) {
      throw new ApiError(400, 'Bác sĩ được chọn không khớp với ca trực');
    }
    doctorId = queryDoctorId;
  }

  const doctor = await User.findOne({
    id: doctorId,
    userType: ROLES.DOCTOR,
    isEnable: true,
  }).lean();

  if (!doctor) {
    throw new ApiError(404, 'Bác sĩ không tồn tại hoặc đã ngừng hoạt động');
  }

  if (doctor.specialtyId !== specialty.id) {
    throw new ApiError(400, 'Chuyên khoa không khớp với chuyên khoa của bác sĩ phụ trách ca trực');
  }

  // 4. Validate Date and Time (must not be past)
  const today = getTodayString();
  const currentTime = getCurrentTimeString();
  if (shift.date < today) {
    throw new ApiError(400, 'Không thể đặt lịch cho ca trực trong quá khứ');
  }

  // 5. Validate Patients payload
  const rawPatients = Array.isArray(body.patients) ? body.patients : [];
  const maxPatients = env.maxPatientsPerAppointment || 4;

  if (rawPatients.length < 1) {
    throw new ApiError(400, 'Vui lòng cung cấp ít nhất một người khám bệnh');
  }
  if (rawPatients.length > maxPatients) {
    throw new ApiError(
      400,
      `Số lượng người khám vượt quá giới hạn tối đa cho phép (${maxPatients} người)`,
    );
  }

  // Check duplicate patient IDs in the same request
  const patientIds = rawPatients
    .map((p) => (p.id != null ? Number(p.id) : null))
    .filter((id) => id != null && !Number.isNaN(id));

  if (new Set(patientIds).size !== patientIds.length) {
    throw new ApiError(400, 'Không được chọn trùng hồ sơ bệnh nhân trong cùng một lịch hẹn');
  }

  // 6. Check pending appointments limit for patient
  const maxPending = env.maxPendingAppointmentsPerPatient || 5;
  const pendingCount = await Appointment.countDocuments({
    patientId: user.id,
    status: { $in: ['PENDING_CONFIRMATION', 'PENDING_PAYMENT'] },
  });

  if (pendingCount >= maxPending) {
    throw new ApiError(
      400,
      `Bạn đang có ${pendingCount} lịch hẹn đang chờ xử lý, vượt quá giới hạn cho phép (${maxPending})`,
    );
  }

  // 7. Validate and prepare patient snapshots
  const snapshotPatients = [];
  const newPatientsToSave = [];

  for (let i = 0; i < rawPatients.length; i += 1) {
    const p = rawPatients[i];
    if (!p || typeof p !== 'object') {
      throw new ApiError(400, `Thông tin bệnh nhân thứ ${i + 1} không hợp lệ`);
    }

    if (p.id != null && String(p.id).trim() !== '') {
      // Existing profile: must belong to owner and NOT be archived
      const profile = await patientProfileService.getActiveProfileForOwner(user.id, p.id);
      snapshotPatients.push({
        id: profile.id,
        fullName: profile.fullName,
        gender: profile.gender,
        phoneNumber: profile.phoneNumber,
        dob: profile.dob,
        relationship: profile.relationship,
      });
    } else {
      // New profile entered inline
      const fullName = typeof p.fullName === 'string' ? p.fullName.trim() : '';
      if (!fullName) {
        throw new ApiError(400, `Họ và tên của bệnh nhân thứ ${i + 1} không được để trống`);
      }
      if (fullName.length > 255) {
        throw new ApiError(400, `Họ và tên của bệnh nhân thứ ${i + 1} không được vượt quá 255 ký tự`);
      }

      const gender = normalizeGender(p.gender);
      let phoneNumber = null;
      if (p.phoneNumber != null && String(p.phoneNumber).trim() !== '') {
        const phone = String(p.phoneNumber).trim();
        const phoneRegex = /^(?:\+84|0)[1-9]\d{8}$/;
        if (!phoneRegex.test(phone)) {
          throw new ApiError(
            400,
            `Số điện thoại bệnh nhân thứ ${i + 1} không hợp lệ (yêu cầu 10 chữ số)`,
          );
        }
        phoneNumber = phone;
      }

      let dob = null;
      if (p.dob != null && String(p.dob).trim() !== '') {
        const parsedDob = new Date(String(p.dob).trim());
        if (Number.isNaN(parsedDob.getTime())) {
          throw new ApiError(400, `Ngày sinh của bệnh nhân thứ ${i + 1} không hợp lệ`);
        }
        const isoDob = parsedDob.toISOString().slice(0, 10);
        if (isoDob > today) {
          throw new ApiError(
            400,
            `Ngày sinh của bệnh nhân thứ ${i + 1} không được lớn hơn ngày hiện tại`,
          );
        }
        dob = isoDob;
      }

      let relationship = null;
      if (p.relationship != null && String(p.relationship).trim() !== '') {
        relationship = String(p.relationship).trim().slice(0, 100);
      }

      snapshotPatients.push({
        id: null,
        fullName,
        gender,
        phoneNumber,
        dob,
        relationship,
      });

      newPatientsToSave.push({
        fullName,
        gender,
        phoneNumber,
        dob,
        relationship,
      });
    }
  }

  const requestedSlotsCount = snapshotPatients.length;
  const appointmentType = body.appointment?.type === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
  const reason =
    typeof body.appointment?.reason === 'string' ? body.appointment.reason.trim() : null;

  // 8. Atomic slot reservation loop (max 3 retries on concurrency collision)
  let reservedSlotIds = [];
  let firstSlotTime = null;
  let reservationHeld = false;
  const holdToken = `HOLD_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const now = new Date();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const currentShift = await DoctorShift.findOne({ id: shift.id, status: 'ACTIVE' }).lean();
    if (!currentShift) {
      throw new ApiError(400, 'Ca trực không còn khả dụng hoặc đã bị hủy');
    }

    const rawSlots = Array.isArray(currentShift.slots) ? currentShift.slots : [];
    // Only slots AVAILABLE and (if today) start time strictly in future
    const availableSlots = rawSlots.filter((slot) => {
      if (slot.status !== 'AVAILABLE') return false;
      if (shift.date === today && slot.startTime <= currentTime) return false;
      return true;
    });

    if (availableSlots.length < requestedSlotsCount) {
      throw new ApiError(
        409,
        `Ca trực không đủ chỗ trống (cần ${requestedSlotsCount} slot, hiện còn ${availableSlots.length} slot khả dụng)`,
      );
    }

    const candidateSlots = availableSlots.slice(0, requestedSlotsCount);
    const candidateIds = candidateSlots.map((s) => s.id);

    // Atomic update on single document: verify ALL selected slots are still AVAILABLE
    const updateResult = await DoctorShift.updateOne(
      {
        id: shift.id,
        status: 'ACTIVE',
        slots: {
          $all: candidateIds.map((sid) => ({
            $elemMatch: { id: sid, status: 'AVAILABLE' },
          })),
        },
      },
      {
        $set: {
          'slots.$[elem].status': 'BOOKED',
          'slots.$[elem].bookingRef': holdToken,
          'slots.$[elem].bookedAt': now,
        },
      },
      {
        arrayFilters: [{ 'elem.id': { $in: candidateIds } }],
      },
    );

    if (updateResult.modifiedCount === 1) {
      reservedSlotIds = candidateIds;
      firstSlotTime = candidateSlots[0].startTime;
      reservationHeld = true;
      break;
    }

    // modifiedCount === 0 means race condition (another request took one of candidateIds)
    if (attempt === 3) {
      throw new ApiError(
        409,
        'Không thể giữ chỗ do có lượt đặt khác diễn ra đồng thời, vui lòng thử lại',
      );
    }
  }

  // 9. Create Appointment record with retry on unique appointmentNo (max 3 times)
  let appointment = null;
  let createError = null;

  try {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const appointmentNo = generateAppointmentNo(appointmentType);
      try {
        appointment = await Appointment.create({
          appointmentNo,
          patientId: user.id,
          doctorId: doctor.id,
          specialtyId: specialty.id,
          shiftId: shift.id,
          slotIds: reservedSlotIds,
          appointmentDate: shift.date,
          appointmentTime: firstSlotTime,
          type: appointmentType,
          status: 'PENDING_CONFIRMATION',
          reason,
          patients: snapshotPatients,
        });

        // Associated slot bookingRef with official appointmentNo
        await DoctorShift.updateOne(
          { id: shift.id },
          {
            $set: {
              'slots.$[elem].bookingRef': appointmentNo,
            },
          },
          {
            arrayFilters: [{ 'elem.id': { $in: reservedSlotIds } }],
          },
        );

        break;
      } catch (err) {
        if (err.code === 11000 && attempt < 3) {
          continue; // Retry duplicate appointmentNo
        }
        createError = err;
        break;
      }
    }
  } catch (err) {
    createError = err;
  }

  // Compensate / Rollback slots if appointment creation failed
  if (!appointment || createError) {
    if (reservationHeld) {
      await DoctorShift.updateOne(
        { id: shift.id },
        {
          $set: {
            'slots.$[elem].status': 'AVAILABLE',
            'slots.$[elem].bookingRef': null,
            'slots.$[elem].bookedAt': null,
          },
        },
        {
          arrayFilters: [{ 'elem.id': { $in: reservedSlotIds } }],
        },
      );
    }
    throw createError || new ApiError(500, 'Không thể khởi tạo lịch hẹn, vui lòng thử lại');
  }

  // 10. Best-effort auto-save new patient profiles (failures will not roll back appointment)
  for (const newP of newPatientsToSave) {
    try {
      const exists = await PatientProfile.findOne({
        ownerId: user.id,
        fullName: newP.fullName,
        dob: newP.dob,
        phoneNumber: newP.phoneNumber,
        isArchived: false,
      });

      if (!exists) {
        const count = await PatientProfile.countDocuments({
          ownerId: user.id,
          isArchived: false,
        });
        if (count < patientProfileService.MAX_PROFILES_PER_USER) {
          await PatientProfile.create({
            ownerId: user.id,
            fullName: newP.fullName,
            gender: newP.gender,
            phoneNumber: newP.phoneNumber,
            dob: newP.dob,
            relationship: newP.relationship,
            isArchived: false,
          });
        }
      }
    } catch (saveErr) {
      // Log error silently, do not fail the appointment
    }
  }

  // 11. Format final response
  return {
    id: appointment.id,
    appointmentNo: appointment.appointmentNo,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    specialtyId: appointment.specialtyId,
    shiftId: appointment.shiftId,
    slotIds: appointment.slotIds,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    type: appointment.type,
    status: appointment.status,
    patientName: snapshotPatients[0]?.fullName || user.fullName,
    doctorName: doctor.fullName,
    specialtyName: specialty.name,
    reason: appointment.reason,
    patients: appointment.patients,
  };
}

/**
 * Reconciliation helper: clean up orphaned 'BOOKED' slots older than `maxAgeMinutes`
 * that have no active Appointment record.
 */
async function reconcileOrphanSlots(maxAgeMinutes = 10) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const shiftsWithBookedSlots = await DoctorShift.find({
    'slots.status': 'BOOKED',
    'slots.bookedAt': { $lte: cutoff },
  });

  let reconciledCount = 0;

  for (const s of shiftsWithBookedSlots) {
    const staleSlots = (s.slots || []).filter(
      (slot) => slot.status === 'BOOKED' && slot.bookedAt && slot.bookedAt <= cutoff,
    );

    for (const slot of staleSlots) {
      // Check if an active appointment exists for this slot
      const appointmentExists = await Appointment.exists({
        slotIds: slot.id,
        status: { $nin: ['CANCELLED', 'EXPIRED'] },
      });

      if (!appointmentExists) {
        await DoctorShift.updateOne(
          { id: s.id },
          {
            $set: {
              'slots.$[elem].status': 'AVAILABLE',
              'slots.$[elem].bookingRef': null,
              'slots.$[elem].bookedAt': null,
            },
          },
          {
            arrayFilters: [{ 'elem.id': slot.id }],
          },
        );
        reconciledCount += 1;
      }
    }
  }

  return { reconciledCount };
}

module.exports = {
  bookAppointment,
  reconcileOrphanSlots,
  generateAppointmentNo,
};

