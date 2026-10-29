const { Router } = require('express');
const specialtyController = require('../controllers/specialty.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');

const router = Router();

router.get('/all', specialtyController.getAllSpecialties);
router.post(
  '/create',
  authenticate,
  authorize(ROLES.ADMIN),
  specialtyController.createSpecialty,
);
router.put(
  '/update/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  specialtyController.updateSpecialty,
);

module.exports = router;

