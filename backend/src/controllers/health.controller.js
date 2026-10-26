const mongoose = require('mongoose');

const getHealth = (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    uptime: process.uptime(),
    database: dbConnected ? 'connected' : 'disconnected',
  });
};

module.exports = { getHealth };
