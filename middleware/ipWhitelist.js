/**
 * IP Whitelist Middleware
 * 
 * IMPORTANT: This middleware restricts access to specific IP addresses.
 * Only use this if you have static IP addresses for your users.
 * 
 * To use:
 * 1. Set ALLOWED_IPS environment variable (comma-separated list)
 *    Example: ALLOWED_IPS=192.168.1.100,203.0.113.50
 * 2. Add this middleware before your routes in server.js:
 *    const ipWhitelist = require('./middleware/ipWhitelist');
 *    app.use(ipWhitelist);
 */

function getClientIP(req) {
  // Check various headers (in case of proxies/load balancers)
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

module.exports = function ipWhitelist(req, res, next) {
  // If no IP whitelist is configured, allow all (for development)
  const allowedIPs = process.env.ALLOWED_IPS;
  
  if (!allowedIPs || allowedIPs.trim() === '') {
    // No whitelist configured - allow all (development mode)
    return next();
  }

  const clientIP = getClientIP(req);
  const allowedList = allowedIPs.split(',').map(ip => ip.trim());

  // Check if client IP is in whitelist
  if (allowedList.includes(clientIP)) {
    return next();
  }

  // IP not whitelisted - deny access
  console.warn(`Access denied for IP: ${clientIP}`);
  res.status(403).json({
    success: false,
    error: 'Access denied. Your IP address is not authorized.'
  });
};

