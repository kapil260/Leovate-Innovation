// ============================================================
// routes/authRoutes.js
// Handles user authentication:
//   POST /api/auth/signup  — Create a new account
//   POST /api/auth/login   — Log in and receive a JWT token
//   GET  /api/auth/me      — Get logged in user's profile
// ============================================================

const express  = require("express");
const router   = express.Router();
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const supabase = require("../supabaseClient");
const protect  = require("../middleware/authMiddleware");
require("dotenv").config();


// ── SIGNUP ────────────────────────────────────────────────────
// POST /api/auth/signup
// Body: { name, email, password }
// Returns: { message, token, user }

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate all fields are present
    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Please provide name, email, and password."
      });
    }

    // Validate email format
    if (!email.includes("@")) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long."
      });
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existing) {
      return res.status(400).json({
        error: "An account with this email already exists. Please log in."
      });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new user in Supabase
    const { data: newUser, error: insertError } = await supabase
      .from("profiles")
      .insert({
        username: name,
        email: email.toLowerCase(),
        password: hashedPassword
      })
      .select()
      .single();

    if (insertError) {
      console.error("Signup DB error:", insertError.message);
      return res.status(500).json({
        error: "Could not create account. Please try again."
      });
    }

    // Create JWT token valid for 7 days
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Account created successfully!",
      token,
      user: {
        id:    newUser.id,
        name:  newUser.username,
        email: newUser.email
      }
    });

  } catch (error) {
    console.error("Signup error:", error.message);
    res.status(500).json({ error: "Server error during signup." });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
// Returns: { message, token, user }

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Please provide your email and password."
      });
    }

    // Find user by email
    const { data: user, error: findError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email.toLowerCase())
      .single();

    if (findError || !user) {
      return res.status(401).json({
        error: "No account found with this email address."
      });
    }

    // Compare password with hashed password in database
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Incorrect password. Please try again."
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Logged in successfully!",
      token,
      user: {
        id:    user.id,
        name:  user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ error: "Server error during login." });
  }
});


// ── GET CURRENT USER ──────────────────────────────────────────
// GET /api/auth/me
// Protected — requires token
// Returns: { user }

router.get("/me", protect, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("profiles")
      .select("id, username, email, created_at")
      .eq("id", req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.status(200).json({
      user: {
        id:        user.id,
        name:      user.username,
        email:     user.email,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error("Get user error:", error.message);
    res.status(500).json({ error: "Server error." });
  }
});


module.exports = router;
