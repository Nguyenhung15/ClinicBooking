const shiftCancellationService = require('../services/shiftCancellation.service');

const create = async (req, res) => {
  const request = await shiftCancellationService.create(req.user, req.params.shiftId, req.body || {});
  res.status(201).json({ success: true, message: 'Shift cancellation request submitted', data: request });
};

const getMine = async (req, res) => {
  const requests = await shiftCancellationService.getMine(req.user);
  res.json({ success: true, message: 'Your shift cancellation requests', data: requests });
};

const getPending = async (req, res) => {
  const requests = await shiftCancellationService.getPending();
  res.json({ success: true, message: 'Pending shift cancellation requests', data: requests });
};

module.exports = { create, getMine, getPending };
