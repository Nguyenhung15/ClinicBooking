const { Router } = require('express');
const doctorController = require('../controllers/doctor.controller');

const router = Router();

router.get('/search', doctorController.searchDoctors);
router.get('/by-specialty/:specialtyId', doctorController.getDoctorsBySpecialty);
router.get('/:id', doctorController.getDoctorById);

module.exports = router;

