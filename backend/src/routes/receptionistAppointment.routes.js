const { Router } = require('express');
const receptionistAppointmentController = require('../controllers/receptionistAppointment.controller');
const { authenticate, requireRoles } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');

const router = Router();

// UC-REC-03: Lễ tân / Admin xác nhận lịch hẹn
// Endpoint: PUT /appointments/confirm/:id
// Allowed roles: RECEPTIONIST, ADMIN
router.put(
  '/confirm/:id',
  authenticate,
  requireRoles(ROLES.RECEPTIONIST, ROLES.ADMIN),
  receptionistAppointmentController.confirmAppointment,
);

module.exports = router;
