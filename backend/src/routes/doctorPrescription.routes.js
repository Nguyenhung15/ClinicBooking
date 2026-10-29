const { Router } = require('express');
const {
  createBatch,
  createSingle,
  getByAppointment,
  updateBatch,
} = require('../controllers/doctorPrescription.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');

const router = Router();
router.get('/by-appointment/:appointmentId', authenticate, getByAppointment);
router.post('/create/:appointmentId', authenticate, authorize(ROLES.DOCTOR), createSingle);
router.post('/batch-create/:appointmentId', authenticate, authorize(ROLES.DOCTOR), createBatch);
router.put('/update/:appointmentId', authenticate, authorize(ROLES.DOCTOR), updateBatch);

module.exports = router;
