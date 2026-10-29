const { Router } = require('express');
const { getHealth } = require('../controllers/health.controller');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const adminRoutes = require('./admin.routes');
const doctorRoutes = require('./doctor.routes');
const receptionistRoutes = require('./receptionist.routes');
const specialtyRoutes = require('./specialty.routes');
const imageRoutes = require('./image.routes');

const router = Router();

router.get('/health', getHealth);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/doctors', doctorRoutes);
router.use('/receptionists', receptionistRoutes);
router.use('/specialties', specialtyRoutes);
router.use('/images', imageRoutes);

module.exports = router;
