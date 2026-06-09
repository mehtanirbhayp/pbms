const authTokens = require('../utils/authTokens');

function extractToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  if (req.headers['x-auth-token']) {
    return String(req.headers['x-auth-token']).trim();
  }

  return null;
}

module.exports = function authenticate(req, res, next) {
  const token = extractToken(req);

  const userId = authTokens.validateToken(token);
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  req.userId = userId;
  next();
};


