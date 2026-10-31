const { Router } = require('express');
const patientAppointmentController = require('../controllers/patientAppointment.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');

const router = Router();

router.post(
  '/create',
  authenticate,
  authorize(ROLES.PATIENT),
  patientAppointmentController.createAppointment,
);

router.get(
  '/my-upcoming',
  authenticate,
  authorize(ROLES.PATIENT),
  patientAppointmentController.getMyUpcomingAppointments,
);

router.get(
  '/my-completed',
  authenticate,
  authorize(ROLES.PATIENT),
  patientAppointmentController.getMyCompletedAppointments,
);

router.put(
  '/cancel/:id',
  authenticate,
  (req, res, next) => {
    if (req.user?.userType !== ROLES.PATIENT) {
      return next();
    }
    return patientAppointmentController.cancelAppointment(req, res, next);
  },
);

router.get(
  '/:id',
  authenticate,
  (req, res, next) => {
    if (req.user.userType !== ROLES.PATIENT) {
      return next();
    }
    return patientAppointmentController.getAppointmentDetail(req, res, next);
  },
);

module.exports = router;
