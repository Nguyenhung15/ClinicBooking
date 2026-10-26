const { Router } = require('express');
const { getHealth } = require('../controllers/health.controller');

const router = Router();

router.get('/health', getHealth);

// Register feature routes here, e.g.:
// router.use('/appointments', require('./appointment.routes'));

module.exports = router;
