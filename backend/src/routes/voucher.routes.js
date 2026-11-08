const { Router } = require('express');
const voucherController = require('../controllers/voucher.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');

const router = Router();

// Public routes for Home page (Guest & Patient)
router.get('/public', voucherController.getPublicActiveVouchers);
router.get('/active', voucherController.getPublicActiveVouchers);

// Admin & Receptionist routes
router.get(
  '/all',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  voucherController.getAllVouchers,
);

// Patient personal vouchers
router.get(
  '/my',
  authenticate,
  authorize(ROLES.PATIENT),
  voucherController.getMyVouchers,
);

// Receptionist & Admin inspect user's vouchers
router.get(
  '/user/:userId',
  authenticate,
  authorize(ROLES.RECEPTIONIST, ROLES.ADMIN),
  voucherController.getUserVouchers,
);

// Admin CRUD
router.post(
  '/create',
  authenticate,
  authorize(ROLES.ADMIN),
  voucherController.createVoucher,
);

router.put(
  '/update/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  voucherController.updateVoucher,
);

router.delete(
  '/delete/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  voucherController.deleteVoucher,
);

// Patient claims a voucher from Home page
router.post(
  '/:voucherId/claim',
  authenticate,
  authorize(ROLES.PATIENT),
  voucherController.claimVoucher,
);

// Receptionist & Admin view owners of a voucher
router.get(
  '/:voucherId/owners',
  authenticate,
  authorize(ROLES.RECEPTIONIST, ROLES.ADMIN),
  voucherController.getVoucherOwners,
);

// Receptionist & Admin mark voucher as used for a user
router.post(
  '/:voucherId/use',
  authenticate,
  authorize(ROLES.RECEPTIONIST, ROLES.ADMIN),
  voucherController.useVoucherForUser,
);

// Get single voucher detail (Authenticated users)
router.get(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.PATIENT, ROLES.DOCTOR),
  voucherController.getVoucherById,
);

module.exports = router;

