const fs = require('node:fs/promises');
const { connectDB, disconnectDB } = require('../src/config/db');
const { User, Specialty, DoctorShift, Appointment, syncSequenceFloor } = require('../src/models');

const tick = String.fromCharCode(96);

const getTableColumns = (sql, tableName) => {
  const tableIdentifier = tick + tableName + tick;
  const pattern = new RegExp(
    'CREATE TABLE\\s+' + tableIdentifier + '\\s*\\(([\\s\\S]*?)\\)\\s*ENGINE=',
    'i',
  );
  const match = sql.match(pattern);
  if (!match) throw new Error('CREATE TABLE not found for ' + tableName);

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.match(new RegExp('^\\s*' + tick + '([^' + tick + ']+)' + tick)))
    .filter(Boolean)
    .map((column) => column[1]);
};

const readSqlString = (text, start) => {
  let index = start + 1;
  let value = '';

  while (index < text.length) {
    const char = text[index];
    if (char === '\\') {
      const escaped = text[index + 1];
      const replacements = {
        '0': '\0',
        b: '\b',
        n: '\n',
        r: '\r',
        t: '\t',
        Z: '\x1a',
        '\\': '\\',
        "'": "'",
        '"': '"',
      };
      value += Object.prototype.hasOwnProperty.call(replacements, escaped)
        ? replacements[escaped]
        : escaped;
      index += 2;
      continue;
    }
    if (char === "'") {
      if (text[index + 1] === "'") {
        value += "'";
        index += 2;
        continue;
      }
      return { value, index: index + 1 };
    }
    value += char;
    index += 1;
  }

  throw new Error('Unterminated SQL string in dump');
};

const readSqlValue = (text, start) => {
  let index = start;
  if (text[index] === "'") return readSqlString(text, index);
  if ((text[index] === 'b' || text[index] === 'B') && text[index + 1] === "'") {
    return readSqlString(text, index + 1);
  }

  while (index < text.length && text[index] !== ',' && text[index] !== ')') index += 1;
  const raw = text.slice(start, index).trim();
  if (raw.toUpperCase() === 'NULL') return { value: null, index };
  if (/^-?\d+$/.test(raw)) return { value: Number(raw), index };
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)) {
    return { value: Number(raw), index };
  }
  return { value: raw, index };
};

const parseValues = (text) => {
  const rows = [];
  let index = 0;

  while (index < text.length) {
    while (/\s|,/.test(text[index] || '')) index += 1;
    if (index >= text.length) break;
    if (text[index] !== '(') throw new Error('Unexpected SQL value syntax in dump');
    index += 1;
    const row = [];

    while (index < text.length) {
      while (/\s/.test(text[index] || '')) index += 1;
      if (text[index] === ')') {
        index += 1;
        break;
      }

      const parsed = readSqlValue(text, index);
      row.push(parsed.value);
      index = parsed.index;
      while (/\s/.test(text[index] || '')) index += 1;
      if (text[index] === ',') {
        index += 1;
        continue;
      }
      if (text[index] === ')') {
        index += 1;
        break;
      }
      throw new Error('Expected comma or closing parenthesis in dump');
    }

    rows.push(row);
  }
  return rows;
};

const extractInsertRows = (sql, tableName) => {
  const marker = 'INSERT INTO ' + tick + tableName + tick + ' VALUES ';
  const start = sql.indexOf(marker);
  if (start < 0) return [];

  let index = start + marker.length;
  let inString = false;
  for (; index < sql.length; index += 1) {
    const char = sql[index];
    if (inString) {
      if (char === '\\') {
        index += 1;
      } else if (char === "'") {
        if (sql[index + 1] === "'") index += 1;
        else inString = false;
      }
    } else if (char === "'") {
      inString = true;
    } else if (char === ';') {
      break;
    }
  }
  if (index >= sql.length) throw new Error('INSERT statement is incomplete for ' + tableName);

  const columns = getTableColumns(sql, tableName);
  const rows = parseValues(sql.slice(start + marker.length, index));
  return rows.map((values) => {
    if (values.length !== columns.length) {
      throw new Error('Column/value count mismatch in ' + tableName + ' table');
    }
    return Object.fromEntries(columns.map((column, position) => [column, values[position]]));
  });
};

const asBoolean = (value) =>
  value === true || value === 1 || value === '1' || value === '\x01';

const toDoctorUser = (user, doctor, specialty) => {
  const passwordHash = user.password;
  if (typeof passwordHash !== 'string' || !/^\$2[aby]\$/.test(passwordHash)) {
    throw new Error('A doctor account in the dump does not contain a compatible BCrypt hash');
  }

  return {
    id: Number(user.id),
    fullName: user.full_name || 'Doctor',
    email: String(user.email).trim().toLowerCase(),
    password: passwordHash,
    phoneNumber: user.phone_number || null,
    gender: user.gender === 'Male' || user.gender === 'Female' ? user.gender : 'Other',
    userType: 'Doctor',
    isEnable: asBoolean(user.is_enable),
    specialtyId: specialty.id,
    consultationFee: doctor.consultation_fee === null ? null : Number(doctor.consultation_fee),
    degree: doctor.degree || null,
    description: doctor.description || null,
    experience: doctor.experience || null,
    isVip: asBoolean(doctor.is_vip),
  };
};

const main = async () => {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    throw new Error('Usage: npm run import:doctors -- <path-to-mysql-dump.sql>');
  }

  const sql = await fs.readFile(dumpPath, 'utf8');
  const userRows = extractInsertRows(sql, 'users');
  const doctorRows = extractInsertRows(sql, 'doctor');
  const specialtyRows = extractInsertRows(sql, 'specialties');
  const shiftRows = extractInsertRows(sql, 'doctor_shifts');
  const slotRows = extractInsertRows(sql, 'shift_slots');
  const appointmentRows = extractInsertRows(sql, 'appointments');
  const usersById = new Map(userRows.map((user) => [String(user.id), user]));

  if (doctorRows.length === 0) throw new Error('The SQL dump contains no doctor rows');
  await connectDB();

  try {
    const specialtiesByLegacyId = new Map();
    for (const source of specialtyRows) {
      const specialty = await Specialty.findOneAndUpdate(
        { id: Number(source.id) },
        {
          $set: { name: source.name, description: source.description || '' },
          $setOnInsert: { id: Number(source.id) },
        },
        { upsert: true, returnDocument: 'after', runValidators: true },
      );
      specialtiesByLegacyId.set(String(source.id), specialty);
    }

    let imported = 0;
    const doctorsByLegacyId = new Map();
    for (const doctor of doctorRows) {
      const user = usersById.get(String(doctor.doctor_id));
      if (!user || user.user_type !== 'Doctor') {
        throw new Error('A doctor profile does not match a Doctor account in users');
      }
      const specialty = specialtiesByLegacyId.get(String(doctor.specialty_id));
      if (!specialty) throw new Error('A doctor references a specialty missing from the dump');

      const document = toDoctorUser(user, doctor, specialty);
      const importedDoctor = await User.findOneAndUpdate(
        { id: document.id },
        { $set: document },
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
      );
      doctorsByLegacyId.set(String(doctor.doctor_id), importedDoctor);
      imported += 1;
    }

    let importedShifts = 0;
    const shiftsByLegacyId = new Map();
    for (const source of shiftRows) {
      const doctor = doctorsByLegacyId.get(String(source.doctor_id));
      if (!doctor) continue;

      const sourceSlots = slotRows
        .filter((slot) => String(slot.shift_id) === String(source.id))
        .sort((left, right) => Number(left.slot_number) - Number(right.slot_number));
      const shiftDocument = {
        id: Number(source.id),
        doctorId: doctor.id,
        date: String(source.date).slice(0, 10),
        shift: source.shift,
        startTime: String(source.start_time).slice(0, 5),
        endTime: String(source.end_time).slice(0, 5),
        slotDurationMinutes: Number(source.slot_duration_minutes) || 45,
        bufferMinutes: Number(source.buffer_minutes) || 0,
        maxPatients: Math.max(1, Number(source.max_patients) || 1),
        note: source.note || '',
        repeatWeekly: asBoolean(source.repeat_weekly),
        repeatCount: Math.max(0, Number(source.repeat_count) || 0),
        status: source.status || 'ACTIVE',
        slots: sourceSlots.map((slot) => ({
          id: Number(slot.id),
          slotNumber: Number(slot.slot_number),
          startTime: String(slot.start_time).slice(0, 5),
          endTime: String(slot.end_time).slice(0, 5),
          status: slot.status || 'AVAILABLE',
        })),
      };

      const importedShift = await DoctorShift.findOneAndUpdate(
        { id: shiftDocument.id },
        { $set: shiftDocument },
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
      );
      shiftsByLegacyId.set(String(source.id), importedShift);
      importedShifts += 1;
    }

    let importedAppointments = 0;
    for (const source of appointmentRows) {
      const doctor = doctorsByLegacyId.get(String(source.doctor_id));
      if (!doctor) continue;

      const patient = source.patient_id === null ? null : usersById.get(String(source.patient_id));
      const specialty = specialtiesByLegacyId.get(String(source.specialty_id));
      const shift = source.shift_id === null ? null : shiftsByLegacyId.get(String(source.shift_id));
      const toTime = (value) => value === null ? null : String(value).slice(0, 5);
      const appointmentDocument = {
        id: Number(source.id),
        appointmentNo: source.appointment_no,
        patientId: source.patient_id === null ? 0 : Number(source.patient_id),
        doctorId: doctor.id,
        specialtyId: specialty ? specialty.id : 0,
        shiftId: shift ? shift.id : 0,
        slotIds: source.slot_id === null ? [] : [Number(source.slot_id)],
        appointmentDate: source.appointment_date === null ? '1970-01-01' : String(source.appointment_date).slice(0, 10),
        appointmentTime: toTime(source.appointment_time),
        checkedIn: asBoolean(source.checked_in),
        confirmedBy: null,
        patients: patient ? [{ id: Number(patient.id), fullName: patient.full_name || 'Patient', gender: patient.gender || 'Other', phoneNumber: patient.phone_number || null }] : [],
        reason: source.reason || null,
        status: source.status || 'PENDING_CONFIRMATION',
        type: source.type || 'OFFLINE',
        actualStartTime: toTime(source.actual_start_time),
        actualEndTime: toTime(source.actual_end_time),
      };

      await Appointment.findOneAndUpdate(
        { id: appointmentDocument.id },
        { $set: appointmentDocument },
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
      );
      importedAppointments += 1;
    }

    await Promise.all([
      syncSequenceFloor('users', Math.max(0, ...userRows.map((row) => Number(row.id) || 0))),
      syncSequenceFloor('specialties', Math.max(0, ...specialtyRows.map((row) => Number(row.id) || 0))),
      syncSequenceFloor('doctor_shifts', Math.max(0, ...shiftRows.map((row) => Number(row.id) || 0))),
      syncSequenceFloor('shift_slots', Math.max(0, ...slotRows.map((row) => Number(row.id) || 0))),
      syncSequenceFloor('appointments', Math.max(0, ...appointmentRows.map((row) => Number(row.id) || 0))),
    ]);

    console.log(
      'Imported ' + imported + ' doctor account(s), ' +
      specialtiesByLegacyId.size + ' specialty record(s), and ' +
      importedShifts + ' doctor shift(s) with their slots, and ' +
      importedAppointments + ' appointment(s) assigned to those doctors.',
    );
  } finally {
    await disconnectDB();
  }
};

main().catch((error) => {
  console.error('Doctor import failed:', error.message);
  process.exitCode = 1;
});
