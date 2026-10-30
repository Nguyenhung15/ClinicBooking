const { Router } = require('express');
const patientProfileController = require('../controllers/patientProfile.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');

const router = Router();

router.get('/my', authenticate, authorize(ROLES.PATIENT), patientProfileController.getMyProfiles);
router.get('/:id', authenticate, patientProfileController.getProfileById);
router.post('/create', authenticate, authorize(ROLES.PATIENT), patientProfileController.createProfile);
router.put('/update/:id', authenticate, authorize(ROLES.PATIENT), patientProfileController.updateProfile);
router.delete('/delete/:id', authenticate, authorize(ROLES.PATIENT), patientProfileController.deleteProfile);

module.exports = router;

