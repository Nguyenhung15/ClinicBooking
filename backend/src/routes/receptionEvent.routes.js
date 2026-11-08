const { Router } = require('express');
const eventController = require('../controllers/event.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');

const router = Router();

// Receptionist & Admin view events with participant registrations
router.get(
  '/events',
  authenticate,
  authorize(ROLES.RECEPTIONIST, ROLES.ADMIN),
  eventController.getReceptionEvents,
);

// Receptionist & Admin confirm participant check-in and auto-issue voucher
router.post(
  '/events/:eventId/confirm/:userId',
  authenticate,
  authorize(ROLES.RECEPTIONIST, ROLES.ADMIN),
  eventController.confirmEventAttendance,
);

module.exports = router;

