const { Router } = require('express');
const eventController = require('../controllers/event.controller');
const {
  authenticate,
  optionalAuthenticate,
  authorize,
} = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');

const router = Router();

// Public / Patient list available active events on Home page
router.get('/', optionalAuthenticate, eventController.getAvailableEvents);

// Admin & Receptionist list all events
router.get(
  '/all',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  eventController.getAllEvents,
);

// Patient personal registered events
router.get(
  '/my',
  authenticate,
  authorize(ROLES.PATIENT),
  eventController.getMyEvents,
);

// Admin CRUD
router.post(
  '/create',
  authenticate,
  authorize(ROLES.ADMIN),
  eventController.createEvent,
);

router.put(
  '/update/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  eventController.updateEvent,
);

router.delete(
  '/delete/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  eventController.deleteEvent,
);

// Patient registers for an event
router.post(
  '/:eventId/register',
  authenticate,
  authorize(ROLES.PATIENT),
  eventController.registerForEvent,
);

module.exports = router;

