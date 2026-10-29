const { Router } = require('express');
const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');

const router = Router();

router.get('/me', authenticate, userController.getMe);
router.put('/update', authenticate, userController.updateMe);
router.get(
  '/search',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  userController.searchUsers,
);

module.exports = router;

