// ============================================================
// routes/authRoutes.js — Uses Resend for email (works on Render)
// ============================================================

const express  = require("express");
const router   = express.Router();
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const crypto   = require("crypto");
const supabase = require("../supabaseClient");
const protect  = require("../middleware/authMiddleware");
require("dotenv").config();

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// ── SEND EMAIL VIA RESEND API ─────────────────────────────────
async function sendSignupOtpEmail(toEmail, otp, username) {
  const html = `<!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
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
                <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#e8eaff;text-align:center;">Verify Your Email</p>
                <p style="margin:0 0 28px;font-size:14px;color:#6b7db3;text-align:center;">
                  Hi ${username || "there"}, enter the code below to complete your Recall AI sign-up.
                </p>
                <div style="background:rgba(159,167,255,0.07);border:2px dashed rgba(159,167,255,0.3);
                  border-radius:14px;padding:28px;text-align:center;margin-bottom:28px;">
                  <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#6b7db3;">Your verification code</p>
                  <p style="margin:0;font-size:42px;font-weight:700;letter-spacing:10px;color:#9fa7ff;font-family:'Courier New',monospace;">${otp}</p>
                </div>
                <p style="margin:0;font-size:13px;color:#6b7db3;text-align:center;">
                  This code expires in <strong style="color:#e8eaff;">10 minutes</strong>. Do not share it.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body></html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    "Recall AI <onboarding@resend.dev>",
      to:      [toEmail],
      subject: `${otp} is your Recall AI verification code`,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend API error: ${err}`);
  }
}

// ── Helper: save OTP ──────────────────────────────────────────
async function saveOtpRecord(userId, hashedOtp, expiresAt) {
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

// ── SIGNUP STEP 1 ─────────────────────────────────────────────
router.post("/signup-send-otp", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim())
      return res.status(400).json({ error: "Please enter your full name." });
    if (!email || !email.trim())
      return res.status(400).json({ error: "Email address is required." });
    if (!EMAIL_RE.test(email.trim()))
      return res.status(400).json({ error: "Please enter a valid email address." });
    if (!password)
      return res.status(400).json({ error: "Password is required." });
    if (password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters long." });

    const normalEmail = email.toLowerCase().trim();
    const cleanName   = name.trim();

    const { data: existing, error: lookupErr } = await supabase
      .from("profiles")
      .select("id, email_verified")
      .eq("email", normalEmail)
      .maybeSingle();

    if (lookupErr) {
      console.error("Lookup error:", lookupErr.message);
      return res.status(500).json({ error: "Database error. Please try again." });
    }

    if (existing && existing.email_verified)
      return res.status(400).json({ error: "An account with this email already exists. Please log in instead." });

    const hashedPassword = await bcrypt.hash(password, 10);
    let userId;

    if (existing && !existing.email_verified) {
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ username: cleanName, password: hashedPassword })
        .eq("id", existing.id);
      if (updateErr) return res.status(500).json({ error: "Could not update account. Please try again." });
      userId = existing.id;
    } else {
      const { data: newUser, error: insertError } = await supabase
        .from("profiles")
        .insert({ username: cleanName, email: normalEmail, password: hashedPassword, email_verified: false })
        .select("id")
        .single();
      if (insertError) {
        console.error("Insert error:", insertError.message, insertError.code);
        return res.status(500).json({ error: "Could not create account. Please try again." });
      }
      userId = newUser.id;
    }

    const otp       = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    const otpError = await saveOtpRecord(userId, hashedOtp, otpExpiry);
    if (otpError) {
      console.error("OTP save error:", otpError.message);
      return res.status(500).json({ error: "Could not save verification code. Please try again." });
    }

    try {
      await sendSignupOtpEmail(normalEmail, otp, cleanName);
    } catch (emailErr) {
      console.error("Email error:", emailErr.message);
      await supabase.from("otp_resets").delete().eq("user_id", userId);
      return res.status(500).json({ error: "Could not send verification email. Please try again." });
    }

    console.log(`[Recall AI] ✅ OTP sent to ${normalEmail}`);
    return res.status(200).json({
      message: `Verification code sent to ${normalEmail}. Please check your inbox.`,
      email:   normalEmail,
    });

  } catch (err) {
    console.error("signup-send-otp error:", err.message);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});

// ── SIGNUP STEP 2: Verify OTP ─────────────────────────────────
router.post("/signup-verify", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ error: "Email and verification code are required." });

    const normalEmail = email.toLowerCase().trim();

    const { data: user } = await supabase
      .from("profiles")
      .select("id, username, email")
      .eq("email", normalEmail)
      .eq("email_verified", false)
      .maybeSingle();

    if (!user)
      return res.status(400).json({ error: "No pending signup found. Please start over." });

    const { data: otpRecord } = await supabase
      .from("otp_resets")
      .select("*")
      .eq("user_id", user.id)
      .eq("verified", false)
      .maybeSingle();

    if (!otpRecord)
      return res.status(400).json({ error: "Verification code not found. Please request a new one." });

    if (new Date() > new Date(otpRecord.expires_at))
      return res.status(400).json({ error: "This code has expired. Please request a new one." });

    if ((otpRecord.attempts || 0) >= 5)
      return res.status(400).json({ error: "Too many incorrect attempts. Please request a new code." });

    const hashedInput = crypto.createHash("sha256").update(otp.trim()).digest("hex");
    if (hashedInput !== otpRecord.otp_hash) {
      const newAttempts = (otpRecord.attempts || 0) + 1;
      await supabase.from("otp_resets").update({ attempts: newAttempts }).eq("user_id", user.id);
      const remaining = 5 - newAttempts;
      return res.status(400).json({
        error: remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Too many incorrect attempts. Please request a new code.",
      });
    }

    await supabase.from("profiles").update({ email_verified: true }).eq("id", user.id);
    await supabase.from("otp_resets").delete().eq("user_id", user.id);

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });

    console.log(`[Recall AI] ✅ Account verified: ${normalEmail}`);
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

    if (!user)
      return res.status(400).json({ error: "No pending signup found. Please start again." });

    const otp       = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    const otpError = await saveOtpRecord(user.id, hashedOtp, otpExpiry);
    if (otpError) return res.status(500).json({ error: "Could not resend code. Please try again." });

    await sendSignupOtpEmail(normalEmail, otp, user.username);

    return res.status(200).json({ message: "New verification code sent." });
  } catch (err) {
    console.error("resend error:", err.message);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Please provide your email and password." });
    if (!EMAIL_RE.test(email.trim()))
      return res.status(400).json({ error: "Please enter a valid email address." });

    const { data: user, error: findError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (findError || !user)
      return res.status(401).json({ error: "No account found with this email address." });

    if (!user.email_verified)
      return res.status(401).json({
        error: "Please verify your email before logging in.",
        unverified: true,
        email: user.email,
      });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch)
      return res.status(401).json({ error: "Incorrect password. Please try again." });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });

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
router.get("/me", protect, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("profiles")
      .select("id, username, email, phone, bio, location, display_name, timezone, language, github, twitter, linkedin, website, avatar_url, created_at")
      .eq("id", req.user.id)
      .single();

    if (error || !user) return res.status(404).json({ error: "User not found." });

    return res.status(200).json({
      user: {
        id: user.id, name: user.username, email: user.email,
        phone: user.phone || "", bio: user.bio || "",
        location: user.location || "", displayName: user.display_name || "",
        timezone: user.timezone || "asia/kathmandu", language: user.language || "en",
        github: user.github || "", twitter: user.twitter || "",
        linkedin: user.linkedin || "", website: user.website || "",
        avatarUrl: user.avatar_url || "", createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error("Get user error:", err.message);
    return res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
