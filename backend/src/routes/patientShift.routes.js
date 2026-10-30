const { Router } = require('express');
const patientShiftController = require('../controllers/patientShift.controller');
const { optionalAuthenticate } = require('../middlewares/auth.middleware');

const router = Router();

router.get(
  '/by-doctor/:doctorId',
  optionalAuthenticate,
  patientShiftController.getShiftsByDoctor,
);

module.exports = router;
