const crypto = require('crypto');
const {
  Appointment,
  DoctorShift,
  User,
  Specialty,
  PatientProfile,
  Prescription,
} = require('../models');
const { ROLES, APPOINTMENT_STATUSES } = require('../constants/enums');
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

const generateAppointmentNo = () => {
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `OFF${randomHex}`;
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

  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
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
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 15) + 5));
    if (attempt === MAX_ATTEMPTS) {
      throw new ApiError(
        409,
        'Không thể giữ chỗ do có lượt đặt khác diễn ra đồng thời, vui lòng thử lại',
      );
    }
  }

  // 9. Create Appointment record with retry on unique appointmentNo (max 3 times)
  let appointment = null;
  let createError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const appointmentNo = generateAppointmentNo();
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
      break;
    } catch (err) {
      if (err.code === 11000 && attempt < 3) {
        continue; // Retry duplicate appointmentNo
      }
      createError = err;
      break;
    }
  }

  // Compensate / Rollback slots ONLY IF Appointment was NOT created
  if (!appointment) {
    if (reservationHeld) {
      try {
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
            arrayFilters: [{ 'elem.id': { $in: reservedSlotIds }, 'elem.bookingRef': holdToken }],
          },
        );
      } catch (rollbackErr) {
        console.error('Failed to rollback slots on appointment creation error:', rollbackErr);
      }
    }
    throw createError || new ApiError(500, 'Không thể khởi tạo lịch hẹn, vui lòng thử lại');
  }

  // Appointment created successfully: DO NOT rollback slots from this point onwards.
  // Associate slot bookingRef with official appointmentNo in isolated try/catch.
  try {
    await DoctorShift.updateOne(
      { id: shift.id },
      {
        $set: {
          'slots.$[elem].bookingRef': appointment.appointmentNo,
        },
      },
      {
        arrayFilters: [{ 'elem.id': { $in: reservedSlotIds }, 'elem.bookingRef': holdToken }],
      },
    );
  } catch (updateRefErr) {
    // Log failure, but do NOT fail or rollback appointment; reconciliation handles via slotIds
    console.error('Failed to update slot bookingRef to appointmentNo:', updateRefErr);
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
        shiftId: s.id,
        slotIds: slot.id,
        status: { $nin: ['CANCELLED', 'EXPIRED'] },
      });

      if (!appointmentExists) {
        const updateRes = await DoctorShift.updateOne(
          {
            id: s.id,
            slots: {
              $elemMatch: {
                id: slot.id,
                status: 'BOOKED',
                bookedAt: slot.bookedAt,
              },
            },
          },
          {
            $set: {
              'slots.$[elem].status': 'AVAILABLE',
              'slots.$[elem].bookingRef': null,
              'slots.$[elem].bookedAt': null,
            },
          },
          {
            arrayFilters: [
              {
                'elem.id': slot.id,
                'elem.status': 'BOOKED',
                'elem.bookedAt': slot.bookedAt,
              },
            ],
          },
        );
        if (updateRes.modifiedCount === 1) {
          reconciledCount += 1;
        }
      }
    }
  }

  return { reconciledCount };
}

/**
 * Helper to serialize an appointment for Patient response,
 * matching frontend normalizeAppointment contract.
 */
function serializePatientAppointment(
  appointment,
  doctorMap = new Map(),
  specialtyMap = new Map(),
  prescriptions = [],
) {
  const doctorName = doctorMap.get(appointment.doctorId) || 'N/A';
  const specialtyName = specialtyMap.get(appointment.specialtyId) || 'N/A';
  const primaryPatientName = appointment.patients?.[0]?.fullName || 'N/A';

  const serialized = {
    id: appointment.id,
    appointmentNo: appointment.appointmentNo,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    status: appointment.status,
    patientName: primaryPatientName,
    doctorId: appointment.doctorId,
    doctorName,
    specialtyId: appointment.specialtyId,
    specialtyName,
    shiftId: appointment.shiftId,
    reason: appointment.reason || undefined,
    type: appointment.type || 'OFFLINE',
    patients: (appointment.patients || []).map((p) => ({
      id: p.id,
      fullName: p.fullName,
      gender: p.gender,
      phoneNumber: p.phoneNumber,
      dob: p.dob,
      relationship: p.relationship,
    })),
    createdAt: appointment.createdAt
      ? new Date(appointment.createdAt).toISOString()
      : undefined,
    updatedAt: appointment.updatedAt
      ? new Date(appointment.updatedAt).toISOString()
      : undefined,
  };

  if (prescriptions && prescriptions.length > 0) {
    serialized.prescriptions = prescriptions.map((p) => ({
      id: p.id,
      medicineName: p.medicineName,
      dosage: p.dosage,
      duration: p.duration,
      instructions: p.instructions,
    }));
  }

  return serialized;
}

/**
 * UC-PAT-05: Get upcoming appointments for current Patient.
 * Statuses: PENDING_CONFIRMATION, CONFIRMED, CHECKED_IN.
 * Ordered by appointmentDate ASC, appointmentTime ASC.
 */
async function getMyUpcomingAppointments(user) {
  if (!user || user.userType !== ROLES.PATIENT) {
    throw new ApiError(403, 'Chỉ bệnh nhân mới có quyền truy cập');
  }

  const upcomingStatuses = [
    APPOINTMENT_STATUSES.PENDING_CONFIRMATION,
    APPOINTMENT_STATUSES.CONFIRMED,
    APPOINTMENT_STATUSES.CHECKED_IN,
  ];

  const appointments = await Appointment.find({
    patientId: user.id,
    status: { $in: upcomingStatuses },
  })
    .sort({ appointmentDate: 1, appointmentTime: 1, id: 1 })
    .lean();

  if (!appointments.length) {
    return [];
  }

  const doctorIds = [...new Set(appointments.map((a) => a.doctorId))];
  const specialtyIds = [...new Set(appointments.map((a) => a.specialtyId))];

  const [doctors, specialties] = await Promise.all([
    User.find({ id: { $in: doctorIds } }).select('id fullName').lean(),
    Specialty.find({ id: { $in: specialtyIds } }).select('id name').lean(),
  ]);

  const doctorMap = new Map(doctors.map((d) => [d.id, d.fullName]));
  const specialtyMap = new Map(specialties.map((s) => [s.id, s.name]));

  return appointments.map((a) =>
    serializePatientAppointment(a, doctorMap, specialtyMap),
  );
}

/**
 * UC-PAT-05: Get history/completed appointments for current Patient.
 * Statuses: COMPLETED.
 * Ordered by appointmentDate DESC, appointmentTime DESC.
 */
async function getMyCompletedAppointments(user) {
  if (!user || user.userType !== ROLES.PATIENT) {
    throw new ApiError(403, 'Chỉ bệnh nhân mới có quyền truy cập');
  }

  const completedStatuses = [APPOINTMENT_STATUSES.COMPLETED];

  const appointments = await Appointment.find({
    patientId: user.id,
    status: { $in: completedStatuses },
  })
    .sort({ appointmentDate: -1, appointmentTime: -1, id: -1 })
    .lean();

  if (!appointments.length) {
    return [];
  }

  const doctorIds = [...new Set(appointments.map((a) => a.doctorId))];
  const specialtyIds = [...new Set(appointments.map((a) => a.specialtyId))];

  const [doctors, specialties] = await Promise.all([
    User.find({ id: { $in: doctorIds } }).select('id fullName').lean(),
    Specialty.find({ id: { $in: specialtyIds } }).select('id name').lean(),
  ]);

  const doctorMap = new Map(doctors.map((d) => [d.id, d.fullName]));
  const specialtyMap = new Map(specialties.map((s) => [s.id, s.name]));

  return appointments.map((a) =>
    serializePatientAppointment(a, doctorMap, specialtyMap),
  );
}

/**
 * UC-PAT-05: Get single appointment detail for current Patient.
 * Must belong to current Patient (patientId === user.id); otherwise 404.
 */
async function getPatientAppointmentDetail(user, appointmentId) {
  if (!user || user.userType !== ROLES.PATIENT) {
    throw new ApiError(403, 'Chỉ bệnh nhân mới có quyền truy cập');
  }

  const id = parsePositiveInt(appointmentId, 'id');

  const appointment = await Appointment.findOne({
    id,
    patientId: user.id,
  }).lean();

  if (!appointment) {
    throw new ApiError(404, 'Không tìm thấy lịch hẹn');
  }

  const [doctor, specialty, prescriptions] = await Promise.all([
    User.findOne({ id: appointment.doctorId }).select('id fullName').lean(),
    Specialty.findOne({ id: appointment.specialtyId }).select('id name').lean(),
    Prescription.find({ appointmentId: appointment.id }).sort({ id: 1 }).lean(),
  ]);

  const doctorMap = new Map([[appointment.doctorId, doctor?.fullName || 'N/A']]);
  const specialtyMap = new Map([[appointment.specialtyId, specialty?.name || 'N/A']]);

  return serializePatientAppointment(
    appointment,
    doctorMap,
    specialtyMap,
    prescriptions,
  );
}

module.exports = {
  bookAppointment,
  reconcileOrphanSlots,
  generateAppointmentNo,
  getMyUpcomingAppointments,
  getMyCompletedAppointments,
  getPatientAppointmentDetail,
  serializePatientAppointment,
};

