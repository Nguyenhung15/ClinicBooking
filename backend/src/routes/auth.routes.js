const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/register-admin', authController.registerAdmin);
router.post('/change-password', authenticate, authController.changePassword);
router.post('/oauth2/logout', authController.oauth2Logout);

module.exports = router;

