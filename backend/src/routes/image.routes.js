const { Router } = require('express');
const imageController = require('../controllers/image.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { createImageUploader } = require('../config/multer');
const { ROLES } = require('../constants/enums');

const router = Router();
const doctorUpload = createImageUploader('doctors');

router.get('/doctor/:doctorId', imageController.getDoctorImage);
router.post(
  '/doctor/:doctorId',
  authenticate,
  authorize(ROLES.ADMIN),
  doctorUpload.single('file'),
  imageController.uploadDoctorImage,
);
router.put(
  '/doctor/:doctorId',
  authenticate,
  authorize(ROLES.ADMIN),
  doctorUpload.single('file'),
  imageController.updateDoctorImage,
);
router.delete(
  '/doctor/:doctorId',
  authenticate,
  authorize(ROLES.ADMIN),
  imageController.deleteDoctorImage,
);

module.exports = router;

