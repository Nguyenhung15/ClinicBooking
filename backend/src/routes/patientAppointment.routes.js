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

module.exports = router;

