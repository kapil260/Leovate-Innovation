// ============================================================
// routes/authRoutes.js
// Handles user authentication:
//   POST /api/auth/signup        — Create a new account
//   POST /api/auth/login         — Log in and receive a JWT token
//   GET  /api/auth/me            — Get logged in user's profile
//   GET  /api/auth/check-email   — Check if an email address is real/deliverable
// ============================================================

const express  = require("express");
const router   = express.Router();
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const supabase = require("../supabaseClient");
const protect  = require("../middleware/authMiddleware");
require("dotenv").config();


// ── CHECK EMAIL EXISTENCE ──────────────────────────────────────
// GET /api/auth/check-email?email=someone@example.com
//
// Uses eva.pingutil.com (free, no API key needed) to verify:
//   1. The email format is valid
//   2. The domain has proper MX records (can receive mail)
//   3. The mailbox is likely to exist (SMTP probe)
//
// Returns: { valid: true/false, reason: string }

router.get("/check-email", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ valid: false, reason: "No email provided." });
    }

    // Basic format check first — avoids wasting an external API call
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(email)) {
      return res.status(200).json({ valid: false, reason: "Invalid email format." });
    }

    // Call eva.pingutil.com — free MX + SMTP deliverability check
    // Response shape: { status: "ok", data: { valid_syntax, deliverable, ... } }
    const evaUrl = `https://api.eva.pingutil.com/email?email=${encodeURIComponent(email)}`;

    let evaData;
    try {
      const evaRes = await fetch(evaUrl, {
        signal: AbortSignal.timeout(6000), // 6 second timeout
      });
      evaData = await evaRes.json();
    } catch (fetchErr) {
      // If the external API is unreachable, fail open so users aren't blocked
      console.warn("Email check API unreachable:", fetchErr.message);
      return res.status(200).json({
        valid: true,
        reason: "Could not verify email (validation service unavailable). Proceeding.",
        skipped: true,
      });
    }

    const d = evaData?.data;

    // eva returns deliverable: true/false/null
    // valid_syntax: true/false
    // disposable: true/false (catch-all burner emails)
    if (!d) {
      // Unexpected response shape — fail open
      return res.status(200).json({ valid: true, reason: "Validation inconclusive. Proceeding.", skipped: true });
    }

    if (!d.valid_syntax) {
      return res.status(200).json({ valid: false, reason: "This email address has an invalid format." });
    }

    if (d.disposable) {
      return res.status(200).json({
        valid: false,
        reason: "Disposable/temporary email addresses are not allowed. Please use a real email.",
      });
    }

    // deliverable === false means the mailbox is confirmed non-existent
    if (d.deliverable === false) {
      return res.status(200).json({
        valid: false,
        reason: "This email address does not appear to exist. Please check for typos.",
      });
    }

    // deliverable === true or null (unknown) — allow it
    return res.status(200).json({ valid: true, reason: "Email looks good." });

  } catch (error) {
    console.error("check-email error:", error.message);
    // Fail open — don't block users due to our own server error
    res.status(200).json({ valid: true, reason: "Server error during validation. Proceeding.", skipped: true });
  }
});


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
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long."
      });
    }

    // ── Email existence check (server-side guard) ──────────────
    // Even though the frontend checks this, we re-verify on the
    // backend so the API cannot be bypassed by direct requests.
    try {
      const evaUrl = `https://api.eva.pingutil.com/email?email=${encodeURIComponent(email.toLowerCase())}`;
      const evaRes = await fetch(evaUrl, { signal: AbortSignal.timeout(6000) });
      const evaData = await evaRes.json();
      const d = evaData?.data;

      if (d) {
        if (d.disposable) {
          return res.status(400).json({
            error: "Disposable/temporary email addresses are not allowed. Please use a real email."
          });
        }
        if (d.deliverable === false) {
          return res.status(400).json({
            error: "This email address does not appear to exist. Please enter a valid, working email."
          });
        }
      }
    } catch (evaErr) {
      // External API down — log it, but don't block signup
      console.warn("Signup email-check skipped (API unavailable):", evaErr.message);
    }
    // ── End email existence check ──────────────────────────────

    // Check if email already exists in our database
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
      .select("id, username, email, phone, bio, location, display_name, timezone, language, github, twitter, linkedin, website, avatar_url, created_at")
      .eq("id", req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.status(200).json({
      user: {
        id:          user.id,
        name:        user.username,
        email:       user.email,
        phone:       user.phone        || "",
        bio:         user.bio          || "",
        location:    user.location     || "",
        displayName: user.display_name || "",
        timezone:    user.timezone     || "asia/kathmandu",
        language:    user.language     || "en",
        github:      user.github       || "",
        twitter:     user.twitter      || "",
        linkedin:    user.linkedin     || "",
        website:     user.website      || "",
        avatarUrl:   user.avatar_url   || "",
        createdAt:   user.created_at
      }
    });

  } catch (error) {
    console.error("Get user error:", error.message);
    res.status(500).json({ error: "Server error." });
  }
});


module.exports = router;
