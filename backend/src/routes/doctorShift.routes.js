const { Router } = require('express');
const { createShift, getMyShifts } = require('../controllers/doctorShift.controller');
const shiftCancellationController = require('../controllers/shiftCancellation.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');

const router = Router();
router.get(
  '/cancellation-requests/pending',
  authenticate,
  authorize(ROLES.RECEPTIONIST),
  shiftCancellationController.getPending,
);
router.use(authenticate, authorize(ROLES.DOCTOR));

router.post('/create', createShift);
router.get('/my', getMyShifts);
router.get('/cancellation-requests/my', shiftCancellationController.getMine);
router.post('/:shiftId/cancellation-requests', shiftCancellationController.create);

module.exports = router;
