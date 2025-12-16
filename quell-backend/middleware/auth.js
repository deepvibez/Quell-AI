const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token
 * Adds user info to req.user if valid
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      message: 'Please provide authentication token' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        error: 'Invalid or expired token',
        message: 'Please login again' 
      });
    }
    
    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };
