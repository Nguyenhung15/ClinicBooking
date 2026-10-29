const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Sign JWT matching Frontend expectations (OAuth2Callback.tsx reads userId, sub, role).
 */
function signAccessToken(user) {
  const payload = {
    userId: user.id,
    sub: user.email,
    role: user.userType,
  };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
};

