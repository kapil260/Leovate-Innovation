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
