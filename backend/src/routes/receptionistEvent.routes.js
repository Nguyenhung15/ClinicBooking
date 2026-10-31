const { Router } = require('express');
const receptionistEventController = require('../controllers/receptionistEvent.controller');
const { authenticate, requireRoles } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');

const router = Router();

// Endpoint group: /reception/events/* (RECEPTIONIST, ADMIN)
router.get(
  '/events',
  authenticate,
  requireRoles(ROLES.RECEPTIONIST, ROLES.ADMIN),
  receptionistEventController.getEvents,
);

router.post(
  '/events/:eventId/confirm/:userId',
  authenticate,
  requireRoles(ROLES.RECEPTIONIST, ROLES.ADMIN),
  receptionistEventController.confirmAttendance,
);

module.exports = router;
