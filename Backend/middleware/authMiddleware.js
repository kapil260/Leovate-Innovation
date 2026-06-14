// ============================================================
// middleware/authMiddleware.js
// Protects routes that require the user to be logged in.
// ============================================================

const jwt = require("jsonwebtoken");
require("dotenv").config();

const protect = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({
      error: "Access denied. No token provided. Please log in.",
    });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      error: "Access denied. Invalid token format. Please log in again.",
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[Recall AI] ❌ JWT_SECRET missing — cannot verify tokens");
    return res.status(500).json({
      error: "Server configuration error: JWT_SECRET is not set.",
    });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Token is invalid or expired. Please log in again.",
    });
  }
};

module.exports = protect;
