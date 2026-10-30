const { Router } = require('express');
const { getHealth } = require('../controllers/health.controller');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const adminRoutes = require('./admin.routes');
const adminGroupHealthRoutes = require('./adminGroupHealth.routes');
const doctorRoutes = require('./doctor.routes');
const receptionistRoutes = require('./receptionist.routes');
const specialtyRoutes = require('./specialty.routes');
const imageRoutes = require('./image.routes');
const doctorShiftRoutes = require('./doctorShift.routes');
const doctorAppointmentRoutes = require('./doctorAppointment.routes');
const doctorPrescriptionRoutes = require('./doctorPrescription.routes');
const doctorGroupHealthRoutes = require('./doctorGroupHealth.routes');

const router = Router();

router.get('/health', getHealth);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/admin/group-health', adminGroupHealthRoutes);
router.use('/admin', adminRoutes);
router.use('/doctors', doctorRoutes);
router.use('/receptionists', receptionistRoutes);
router.use('/specialties', specialtyRoutes);
router.use('/images', imageRoutes);
router.use('/shifts', doctorShiftRoutes);
router.use('/appointments', doctorAppointmentRoutes);
router.use('/prescriptions', doctorPrescriptionRoutes);
router.use('/group-health', doctorGroupHealthRoutes);

module.exports = router;
