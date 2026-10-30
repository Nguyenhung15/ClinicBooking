const { Router } = require('express');
const adminGroupHealthController = require('../controllers/adminGroupHealth.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');

const router = Router();

// UC-ADM-07 Precondition: Requires authenticated Admin JWT
router.use(authenticate, authorize(ROLES.ADMIN));

// Group Health Requests inspection & source file opening
router.get('/requests', adminGroupHealthController.listRequests);
router.get('/requests/:requestId', adminGroupHealthController.getRequestDetail);
router.get(
  '/requests/:requestId/source',
  adminGroupHealthController.openRequestSourceFile,
);

// Group Health Assignments inspection & result/source file opening
router.get('/assignments', adminGroupHealthController.listAssignments);
router.get(
  '/assignments/:assignmentId',
  adminGroupHealthController.getAssignmentDetail,
);
router.get(
  '/assignments/:assignmentId/source',
  adminGroupHealthController.openAssignmentSourceFile,
);
router.get(
  '/assignments/:assignmentId/result',
  adminGroupHealthController.openAssignmentResultFile,
);
router.get(
  '/assignments/:assignmentId/results/latest',
  adminGroupHealthController.openAssignmentResultFile,
);
router.get(
  '/assignments/:assignmentId/results/:version',
  adminGroupHealthController.openAssignmentResultFile,
);

// Approve / Reject / Review uploaded group health result
router.post(
  '/assignments/:assignmentId/approve',
  adminGroupHealthController.approveAssignmentResult,
);
router.put(
  '/assignments/:assignmentId/approve',
  adminGroupHealthController.approveAssignmentResult,
);
router.patch(
  '/assignments/:assignmentId/approve',
  adminGroupHealthController.approveAssignmentResult,
);

router.post(
  '/assignments/:assignmentId/reject',
  adminGroupHealthController.rejectAssignmentResult,
);
router.put(
  '/assignments/:assignmentId/reject',
  adminGroupHealthController.rejectAssignmentResult,
);
router.patch(
  '/assignments/:assignmentId/reject',
  adminGroupHealthController.rejectAssignmentResult,
);

router.post(
  '/assignments/:assignmentId/review',
  adminGroupHealthController.reviewAssignmentResult,
);

module.exports = router;

