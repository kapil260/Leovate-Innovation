// ============================================================
// middleware/authMiddleware.js
// Protects routes that require the user to be logged in.
// Checks the Authorization header for a valid JWT token.
// If valid — allows the request through and sets req.user
// If invalid — blocks the request with a 401 error
// ============================================================

const jwt = require("jsonwebtoken");
require("dotenv").config();

const protect = (req, res, next) => {

  // Get the Authorization header from the request
  // It looks like: "Bearer eyJ..."
  const authHeader = req.headers["authorization"];

  // If no Authorization header provided
  if (!authHeader) {
    return res.status(401).json({
      error: "Access denied. No token provided. Please log in."
    });
  }

  // Split "Bearer TOKEN" and take just the token part
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "Access denied. Invalid token format. Please log in again."
    });
  }

  try {
    // Verify the token using our JWT_SECRET
    // If valid, decoded contains the data we stored (id, email)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Store user info on the request so routes can access it
    req.user = decoded;

    // Move on to the actual route
    next();

  } catch (error) {
    return res.status(401).json({
      error: "Token is invalid or expired. Please log in again."
    });
  }
};

module.exports = protect;
