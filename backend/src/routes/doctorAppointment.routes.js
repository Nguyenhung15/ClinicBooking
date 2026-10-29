const { Router } = require('express');
const {
  completeAppointment,
  getByMyShift,
  getMyDetail,
  getMyByStatus,
  startAppointment,
} = require('../controllers/doctorAppointment.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');

const router = Router();
router.use(authenticate, authorize(ROLES.DOCTOR));
router.get('/status/:status', getMyByStatus);
router.get('/by-shift/:shiftId', getByMyShift);
router.get('/:appointmentId', getMyDetail);
router.put('/start/:appointmentId', startAppointment);
router.put('/complete/:appointmentId', completeAppointment);

module.exports = router;
