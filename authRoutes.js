// ============================================================
// routes/authRoutes.js
//
// POST /api/auth/signup-send-otp   — Validate + create unverified account + send OTP
// POST /api/auth/signup-verify     — Verify OTP → mark email_verified = true
// POST /api/auth/signup-resend-otp — Resend OTP to a pending account
// POST /api/auth/login             — Login (blocks unverified accounts)
// GET  /api/auth/me                — Get current user profile
// ============================================================

const express    = require("express");
const router     = express.Router();
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const crypto     = require("crypto");
const nodemailer = require("nodemailer");
const supabase   = require("../supabaseClient");
const protect    = require("../middleware/authMiddleware");
require("dotenv").config();

// ── Email regex (strict) ──────────────────────────────────────
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// ── EMAIL TRANSPORTER ─────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

// ── SEND SIGNUP OTP EMAIL ─────────────────────────────────────
async function sendSignupOtpEmail(toEmail, otp, username) {
  const transporter = createTransporter();
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#060e20;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#060e20;padding:40px 0;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0"
            style="background:#0d1b35;border-radius:16px;border:1px solid rgba(159,167,255,0.15);overflow:hidden;">
            <tr>
              <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid rgba(159,167,255,0.1);">
                <span style="font-size:22px;font-weight:700;color:#9fa7ff;">⚡ Recall AI</span>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px;">
                <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#e8eaff;text-align:center;">
                  Verify Your Email
                </p>
                <p style="margin:0 0 28px;font-size:14px;color:#6b7db3;text-align:center;">
                  Hi ${username || "there"}, enter the code below to complete your Recall AI sign-up.
                </p>
                <div style="background:rgba(159,167,255,0.07);border:2px dashed rgba(159,167,255,0.3);
                  border-radius:14px;padding:28px;text-align:center;margin-bottom:28px;">
                  <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;
                    letter-spacing:0.15em;color:#6b7db3;">Your verification code</p>
                  <p style="margin:0;font-size:42px;font-weight:700;letter-spacing:10px;
                    color:#9fa7ff;font-family:'Courier New',monospace;">${otp}</p>
                </div>
                <div style="background:rgba(255,107,107,0.06);border-left:3px solid #ff6b6b;
                  border-radius:4px;padding:12px 16px;margin-bottom:24px;">
                  <p style="margin:0;font-size:13px;color:#6b7db3;">
                    ⏱️ This code expires in <strong style="color:#e8eaff;">10 minutes</strong>.
                    Do not share it with anyone.
                  </p>
                </div>
                <p style="margin:0;font-size:13px;color:#6b7db3;text-align:center;">
                  If you didn't create a Recall AI account, you can safely ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px;text-align:center;border-top:1px solid rgba(159,167,255,0.1);">
                <p style="margin:0;font-size:12px;color:#3d4f73;">
                  © ${new Date().getFullYear()} Recall AI. This is an automated email.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
  await transporter.sendMail({
    from:    `"Recall AI" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: `${otp} is your Recall AI verification code`,
    html,
  });
}

// ── Helper: save/replace OTP record (avoids upsert constraint issues) ──
async function saveOtpRecord(userId, hashedOtp, expiresAt) {
  // Delete any existing OTP for this user first, then insert fresh
  await supabase.from("otp_resets").delete().eq("user_id", userId);
  const { error } = await supabase.from("otp_resets").insert({
    user_id:    userId,
    otp_hash:   hashedOtp,
    expires_at: expiresAt,
    verified:   false,
    attempts:   0,
  });
  return error;
}

// ── SIGNUP STEP 1: Validate → create/update account → send OTP ─
// POST /api/auth/signup-send-otp
// Body: { name, email, password }

router.post("/signup-send-otp", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // ── Validate fields ───────────────────────────────────────
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Please enter your full name." });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email address is required." });
    }
    if (!EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: "Please enter a valid email address (e.g. you@example.com)." });
    }
    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    const normalEmail = email.toLowerCase().trim();
    const cleanName   = name.trim();

    // ── Check if a VERIFIED account already exists ────────────
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, email_verified")
      .eq("email", normalEmail)
      .maybeSingle();

    if (existing && existing.email_verified) {
      return res.status(400).json({
        error: "An account with this email already exists. Please log in instead.",
      });
    }

    // ── Hash password ─────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10);
    let userId;

    if (existing && !existing.email_verified) {
      // Previous unverified attempt — update details and re-send
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ username: cleanName, password: hashedPassword })
        .eq("id", existing.id);
      if (updateErr) {
        console.error("Profile update error:", updateErr.message);
        return res.status(500).json({ error: "Could not update account. Please try again." });
      }
      userId = existing.id;
    } else {
      // Brand new account — insert as unverified
      const { data: newUser, error: insertError } = await supabase
        .from("profiles")
        .insert({
          username:       cleanName,
          email:          normalEmail,
          password:       hashedPassword,
          email_verified: false,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Signup insert error:", insertError.message);
        return res.status(500).json({ error: "Could not create account. Please try again." });
      }
      userId = newUser.id;
    }

    // ── Generate 6-digit OTP ──────────────────────────────────
    const otp        = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry  = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const hashedOtp  = crypto.createHash("sha256").update(otp).digest("hex");

    // ── Save OTP (delete-then-insert to avoid constraint errors) ─
    const otpError = await saveOtpRecord(userId, hashedOtp, otpExpiry);
    if (otpError) {
      console.error("OTP save error:", otpError.message);
      return res.status(500).json({ error: "Could not send verification code. Please try again." });
    }

    // ── Send OTP email ─────────────────────────────────────────
    try {
      await sendSignupOtpEmail(normalEmail, otp, cleanName);
    } catch (emailErr) {
      console.error("Email send error:", emailErr.message);
      // Clean up the OTP record so user can retry
      await supabase.from("otp_resets").delete().eq("user_id", userId);
      return res.status(500).json({
        error: "Could not send verification email. Check your Gmail credentials in .env and try again.",
      });
    }

    console.log(`[Recall AI] ✅ Signup OTP sent to ${normalEmail}`);
    return res.status(200).json({
      message: `Verification code sent to ${normalEmail}. Please check your inbox.`,
      email:   normalEmail,
    });

  } catch (err) {
    console.error("signup-send-otp error:", err.message);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});


// ── SIGNUP STEP 2: Verify OTP → activate account ─────────────
// POST /api/auth/signup-verify
// Body: { email, otp }

router.post("/signup-verify", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and verification code are required." });
    }

    const normalEmail = email.toLowerCase().trim();

    // ── Find the unverified user ──────────────────────────────
    const { data: user } = await supabase
      .from("profiles")
      .select("id, username, email")
      .eq("email", normalEmail)
      .eq("email_verified", false)
      .maybeSingle();

    if (!user) {
      return res.status(400).json({
        error: "No pending signup found for this email. Please start over.",
      });
    }

    // ── Find the OTP record ───────────────────────────────────
    const { data: otpRecord } = await supabase
      .from("otp_resets")
      .select("*")
      .eq("user_id", user.id)
      .eq("verified", false)
      .maybeSingle();

    if (!otpRecord) {
      return res.status(400).json({
        error: "Verification code not found. Please request a new one.",
      });
    }

    // ── Check expiry ──────────────────────────────────────────
    if (new Date() > new Date(otpRecord.expires_at)) {
      return res.status(400).json({
        error: "This code has expired. Please click 'Resend code' to get a new one.",
      });
    }

    // ── Check attempt limit ───────────────────────────────────
    if ((otpRecord.attempts || 0) >= 5) {
      return res.status(400).json({
        error: "Too many incorrect attempts. Please request a new code.",
      });
    }

    // ── Verify OTP ────────────────────────────────────────────
    const hashedInput = crypto.createHash("sha256").update(otp.trim()).digest("hex");
    if (hashedInput !== otpRecord.otp_hash) {
      const newAttempts = (otpRecord.attempts || 0) + 1;
      await supabase
        .from("otp_resets")
        .update({ attempts: newAttempts })
        .eq("user_id", user.id);
      const remaining = 5 - newAttempts;
      return res.status(400).json({
        error: remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Too many incorrect attempts. Please request a new code.",
      });
    }

    // ── OTP correct — activate the account ───────────────────
    await supabase
      .from("profiles")
      .update({ email_verified: true })
      .eq("id", user.id);
    await supabase
      .from("otp_resets")
      .delete()
      .eq("user_id", user.id);

    // ── Issue JWT ─────────────────────────────────────────────
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`[Recall AI] ✅ Email verified + account activated: ${normalEmail}`);
    return res.status(201).json({
      message: "Account created successfully! Welcome to Recall AI.",
      token,
      user: { id: user.id, name: user.username, email: user.email },
    });

  } catch (err) {
    console.error("signup-verify error:", err.message);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});


// ── RESEND OTP ────────────────────────────────────────────────
// POST /api/auth/signup-resend-otp
// Body: { email }

router.post("/signup-resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const normalEmail = email.toLowerCase().trim();

    const { data: user } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("email", normalEmail)
      .eq("email_verified", false)
      .maybeSingle();

    if (!user) {
      return res.status(400).json({
        error: "No pending signup found. Please start the signup process again.",
      });
    }

    const otp       = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    const otpError = await saveOtpRecord(user.id, hashedOtp, otpExpiry);
    if (otpError) {
      console.error("OTP resend save error:", otpError.message);
      return res.status(500).json({ error: "Could not resend code. Please try again." });
    }

    try {
      await sendSignupOtpEmail(normalEmail, otp, user.username);
    } catch (emailErr) {
      console.error("Resend email error:", emailErr.message);
      return res.status(500).json({ error: "Could not send email. Please try again." });
    }

    console.log(`[Recall AI] ✅ Signup OTP resent to ${normalEmail}`);
    return res.status(200).json({ message: "New verification code sent." });

  } catch (err) {
    console.error("signup-resend-otp error:", err.message);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});


// ── LOGIN ─────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Please provide your email and password." });
    }

    if (!EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const { data: user, error: findError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (findError || !user) {
      return res.status(401).json({ error: "No account found with this email address." });
    }

    // Block login until email is verified
    if (!user.email_verified) {
      return res.status(401).json({
        error: "Please verify your email before logging in. Check your inbox for the verification code.",
        unverified: true,
        email: user.email,
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Incorrect password. Please try again." });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Logged in successfully!",
      token,
      user: { id: user.id, name: user.username, email: user.email },
    });

  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ error: "Server error during login." });
  }
});


// ── GET CURRENT USER ──────────────────────────────────────────
// GET /api/auth/me  (protected)

router.get("/me", protect, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("profiles")
      .select(
        "id, username, email, phone, bio, location, display_name, " +
        "timezone, language, github, twitter, linkedin, website, avatar_url, created_at"
      )
      .eq("id", req.user.id)
      .single();

    if (error || !user) return res.status(404).json({ error: "User not found." });

    return res.status(200).json({
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
        createdAt:   user.created_at,
      },
    });
  } catch (err) {
    console.error("Get user error:", err.message);
    return res.status(500).json({ error: "Server error." });
  }
});


module.exports = router;
