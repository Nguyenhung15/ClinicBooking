const { Router } = require('express');
const { createShift, getMyShifts } = require('../controllers/doctorShift.controller');
const shiftCancellationController = require('../controllers/shiftCancellation.controller');
const { authenticate, requireRoles, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');

const router = Router();

// =========================================================================
// RECEPTIONIST & ADMIN: Shift Cancellation Requests Management (UC-REC-06)
// =========================================================================

// GET /shifts/cancellation-requests/pending - Danh sách yêu cầu chờ duyệt kèm tổng hợp
router.get(
  '/cancellation-requests/pending',
  authenticate,
  requireRoles(ROLES.RECEPTIONIST, ROLES.ADMIN),
  shiftCancellationController.getPending,
);

// PUT /shifts/cancellation-requests/:id/approve - Duyệt yêu cầu hủy ca
router.put(
  '/cancellation-requests/:id/approve',
  authenticate,
  requireRoles(ROLES.RECEPTIONIST, ROLES.ADMIN),
  shiftCancellationController.approve,
);

// PUT /shifts/cancellation-requests/:id/reject - Từ chối yêu cầu hủy ca (bắt buộc note)
router.put(
  '/cancellation-requests/:id/reject',
  authenticate,
  requireRoles(ROLES.RECEPTIONIST, ROLES.ADMIN),
  shiftCancellationController.reject,
);

// =========================================================================
// DOCTOR: Shift Cancellation Requests & Shift Management
// =========================================================================
router.use(authenticate, authorize(ROLES.DOCTOR));

router.post('/create', createShift);
router.get('/my', getMyShifts);
router.get('/cancellation-requests/my', shiftCancellationController.getMine);
router.post('/:shiftId/cancellation-requests', shiftCancellationController.create);

module.exports = router;
