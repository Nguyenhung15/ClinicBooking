const doctorShiftService = require('../services/doctorShift.service');

const createShift = async (req, res) => {
  const created = await doctorShiftService.createShift(req.user, req.body || {});
  res.status(201).json({
    success: true,
    message: 'Shift created successfully',
    data: created[0],
    occurrences: created,
  });
};

const getMyShifts = async (req, res) => {
  const shifts = await doctorShiftService.getMyShifts(req.user, req.query.week, req.query.date);
  res.json({ success: true, message: 'Your registered shifts', data: shifts });
};

module.exports = { createShift, getMyShifts };
