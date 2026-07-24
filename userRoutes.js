// ============================================================
// routes/userRoutes.js
// ============================================================

const express      = require("express");
const router       = express.Router();
const bcrypt       = require("bcryptjs");
const crypto       = require("crypto");
const nodemailer   = require("nodemailer");
const supabase     = require("../supabaseClient");
const protect      = require("../middleware/authMiddleware");
require("dotenv").config();


// ── EMAIL TRANSPORTER ─────────────────────────────────────────
function createTransporter() {
  // Strip spaces from app password (Google shows it with spaces but it works without)
  const appPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: appPass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

// Test transporter on startup
createTransporter().verify().then(() => {
  console.log("[Recall AI] ✅ Gmail SMTP ready — emails will send");
}).catch(err => {
  console.error("[Recall AI] ❌ Gmail SMTP error:", err.message);
  console.error("[Recall AI] Check GMAIL_USER and GMAIL_APP_PASSWORD in .env");
});

// ── SEND OTP EMAIL ────────────────────────────────────────────
async function sendOtpEmail(toEmail, otp, username) {
  const transporter = createTransporter();

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#060e20;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#060e20;padding:40px 0;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#0d1b35;border-radius:16px;border:1px solid rgba(159,167,255,0.15);overflow:hidden;">
            <tr>
              <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid rgba(159,167,255,0.1);">
                <span style="font-size:22px;font-weight:700;color:#9fa7ff;">⚡ Recall AI</span>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px;">
                <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#e8eaff;text-align:center;">Reset Your Password</p>
                <p style="margin:0 0 28px;font-size:14px;color:#6b7db3;text-align:center;">Hi ${username || "there"}, use the code below to reset your Recall AI password.</p>
                <div style="background:rgba(159,167,255,0.07);border:2px dashed rgba(159,167,255,0.3);border-radius:14px;padding:28px;text-align:center;margin-bottom:28px;">
                  <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#6b7db3;">Your verification code</p>
                  <p style="margin:0;font-size:42px;font-weight:700;letter-spacing:10px;color:#9fa7ff;font-family:'Courier New',monospace;">${otp}</p>
                </div>
                <div style="background:rgba(255,107,107,0.06);border-left:3px solid #ff6b6b;border-radius:4px;padding:12px 16px;margin-bottom:24px;">
                  <p style="margin:0;font-size:13px;color:#6b7db3;">⏱️ This code expires in <strong style="color:#e8eaff;">10 minutes</strong>. Do not share it with anyone.</p>
                </div>
                <p style="margin:0;font-size:13px;color:#6b7db3;text-align:center;">If you didn't request this, you can safely ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px;text-align:center;border-top:1px solid rgba(159,167,255,0.1);">
                <p style="margin:0;font-size:12px;color:#3d4f73;">© ${new Date().getFullYear()} Recall AI. This is an automated email.</p>
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
    subject: `${otp} is your Recall AI password reset code`,
    html
  });
}


// ── FORGOT PASSWORD — Send OTP ────────────────────────────────
// POST /api/user/forgot-password
// Body: { email }
// Saves OTP to otp_resets table and emails it to the user

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const { data: user } = await supabase
      .from("profiles")
      .select("id, email, username")
      .eq("email", email.toLowerCase())
      .single();

    // Always return success — prevents email enumeration
    if (!user) {
      return res.status(200).json({
        message: "If an account with that email exists, a reset code has been sent."
      });
    }

    // Generate 6-digit OTP
    const otp       = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    // Save to otp_resets table (correct table with correct columns)
    const { error: upsertError } = await supabase
      .from("otp_resets")
      .upsert({
        user_id:    user.id,
        otp_hash:   hashedOtp,
        expires_at: otpExpiry.toISOString(),
        verified:   false,
        attempts:   0
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("OTP upsert error:", upsertError.message);
      return res.status(500).json({ error: "Could not generate reset code. Please try again." });
    }

    // Send OTP email
    try {
      await sendOtpEmail(user.email, otp, user.username);
      console.log(`[Recall AI] ✅ OTP sent to ${user.email}`);
    } catch (emailErr) {
      console.error("[Recall AI] ❌ Email send failed:", emailErr.message);
      // In development — log OTP to console so it can be tested without email
      console.log(`[Recall AI] 🔑 OTP for ${user.email}: ${otp} (valid 10 min)`);
      return res.status(500).json({
        error: "Could not send email. Check GMAIL_USER and GMAIL_APP_PASSWORD in .env",
        // Return OTP in error response so frontend can show it (dev/demo mode)
        devOtp: otp
      });
    }

    res.status(200).json({
      message: "A 6-digit verification code has been sent to your email.",
      ...(process.env.NODE_ENV === "development" && { devOtp: otp })
    });

  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});


// ── VERIFY OTP ────────────────────────────────────────────────
// POST /api/user/verify-otp
// Body: { email, otp }
// Returns: { resetToken } to use in reset-password call

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required." });
    }

    const { data: user } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email.toLowerCase())
      .single();

    if (!user) {
      return res.status(400).json({ error: "Invalid request." });
    }

    const hashedOtp = crypto.createHash("sha256").update(String(otp).trim()).digest("hex");

    // Look up in otp_resets with correct column names
    const { data: otpRecord, error: otpErr } = await supabase
      .from("otp_resets")
      .select("*")
      .eq("user_id", user.id)
      .eq("otp_hash", hashedOtp)
      .eq("verified", false)
      .single();

    if (otpErr || !otpRecord) {
      return res.status(400).json({ error: "Incorrect code. Please check and try again." });
    }

    if (new Date() > new Date(otpRecord.expires_at)) {
      return res.status(400).json({ error: "Code has expired. Please request a new one." });
    }

    // Mark OTP as verified
    await supabase
      .from("otp_resets")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Generate short-lived reset token (5 min) and save to password_resets
    const resetToken       = crypto.randomBytes(32).toString("hex");
    const resetTokenHash   = crypto.createHash("sha256").update(resetToken).digest("hex");
    const resetTokenExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await supabase
      .from("password_resets")
      .upsert({
        user_id:    user.id,
        token:      resetTokenHash,
        expires_at: resetTokenExpiry.toISOString(),
        used:       false
      }, { onConflict: "user_id" });

    res.status(200).json({
      message:    "Code verified successfully!",
      resetToken
    });

  } catch (err) {
    console.error("Verify OTP error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});


// ── RESET PASSWORD ────────────────────────────────────────────
// POST /api/user/reset-password
// Body: { resetToken, newPassword }

router.post("/reset-password", async (req, res) => {
  try {
    const { token, resetToken, newPassword } = req.body;
    const finalToken = resetToken || token;

    if (!finalToken || !newPassword) {
      return res.status(400).json({ error: "Reset token and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const hashedToken = crypto.createHash("sha256").update(finalToken).digest("hex");

    const { data: resetRecord } = await supabase
      .from("password_resets")
      .select("*")
      .eq("token", hashedToken)
      .eq("used", false)
      .single();

    if (!resetRecord) {
      return res.status(400).json({ error: "Invalid or expired reset token. Please start over." });
    }

    if (new Date() > new Date(resetRecord.expires_at)) {
      return res.status(400).json({ error: "Reset session expired. Please request a new code." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await supabase
      .from("profiles")
      .update({ password: hashedPassword })
      .eq("id", resetRecord.user_id);

    await supabase
      .from("password_resets")
      .update({ used: true })
      .eq("id", resetRecord.id);

    res.status(200).json({ message: "Password reset successfully! You can now log in." });

  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});


// ── SEND / RESEND EMAIL VERIFICATION ─────────────────────────
router.post("/resend-verification", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: user } = await supabase
      .from("profiles")
      .select("id, email, email_verified")
      .eq("id", userId)
      .single();

    if (!user) return res.status(404).json({ error: "User not found." });
    if (user.email_verified) return res.status(400).json({ error: "Email is already verified." });

    const verifyToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(verifyToken).digest("hex");
    const expiry      = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await supabase
      .from("email_verifications")
      .upsert({
        user_id:    userId,
        token:      hashedToken,
        expires_at: expiry.toISOString(),
        used:       false
      }, { onConflict: "user_id" });

    const verifyLink = `${process.env.FRONTEND_URL || "http://localhost:5000"}/verify-email?token=${verifyToken}`;
    console.log(`[Recall AI] Email verification link for ${user.email}: ${verifyLink}`);

    res.status(200).json({
      message: "Verification email sent! Check your inbox.",
      ...(process.env.NODE_ENV === "development" && { devVerifyToken: verifyToken })
    });

  } catch (err) {
    console.error("Resend verification error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
});


// ── VERIFY EMAIL ──────────────────────────────────────────────
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Verification token is required." });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const { data: verifyRecord } = await supabase
      .from("email_verifications")
      .select("*")
      .eq("token", hashedToken)
      .eq("used", false)
      .single();

    if (!verifyRecord) {
      return res.status(400).json({ error: "Invalid or expired verification token." });
    }
    if (new Date() > new Date(verifyRecord.expires_at)) {
      return res.status(400).json({ error: "Verification link has expired. Please request a new one." });
    }

    await supabase
      .from("profiles")
      .update({ email_verified: true })
      .eq("id", verifyRecord.user_id);

    await supabase
      .from("email_verifications")
      .update({ used: true })
      .eq("id", verifyRecord.id);

    res.status(200).json({ message: "Email verified successfully! Your account is now fully active." });

  } catch (err) {
    console.error("Verify email error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
});


// ── CHANGE PASSWORD (authenticated) ──────────────────────────
// POST /api/user/password
// Body: { currentPassword, newPassword }
// Requires: valid JWT token (protect middleware)

router.post("/password", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters." });
    }

    // Fetch the stored hashed password
    const { data: user, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, password")
      .eq("id", userId)
      .single();

    if (fetchErr || !user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Verify the current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    // Hash and save the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ password: hashedPassword, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (updateErr) {
      console.error("Change password DB error:", updateErr.message);
      return res.status(500).json({ error: "Could not update password. Please try again." });
    }

    console.log(`[Recall AI] Password changed for user_id: ${userId}`);
    res.status(200).json({ message: "Password updated successfully!" });

  } catch (err) {
    console.error("Change password error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});


// ── GET USER SETTINGS ─────────────────────────────────────────
router.get("/settings", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!settings) {
      return res.status(200).json({
        settings: {
          weekly_digest:        true,
          save_alerts:          false,
          auto_sync:            true,
          notification_channel: "haptic",
          visualization:        "vector",
          processing_mode:      "precision",
          theme:                "dark",
          ai_platforms:         ["ChatGPT", "Gemini", "Claude"],
          export_format:        "json"
        }
      });
    }

    res.status(200).json({ settings: settings.data });

  } catch (err) {
    console.error("Get settings error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
});


// ── SAVE USER SETTINGS ────────────────────────────────────────
router.post("/settings", protect, async (req, res) => {
  try {
    const userId      = req.user.id;
    const newSettings = req.body.settings;

    if (!newSettings || typeof newSettings !== "object") {
      return res.status(400).json({ error: "Settings object is required." });
    }

    const { data, error } = await supabase
      .from("user_settings")
      .upsert({
        user_id:    userId,
        data:       newSettings,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      console.error("Save settings DB error:", error.message);
      return res.status(500).json({ error: "Could not save settings." });
    }

    res.status(200).json({ message: "Settings saved successfully!", settings: data.data });

  } catch (err) {
    console.error("Save settings error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
});


// ── GET SUBSCRIPTION INFO ─────────────────────────────────────
router.get("/subscription", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!sub) {
      return res.status(200).json({
        subscription: {
          plan:           "free",
          status:         "active",
          searches_limit: 100,
          searches_used:  0,
          renews_at:      null,
          features:       ["50 searches/month", "3 AI platforms", "Basic export"]
        }
      });
    }

    res.status(200).json({ subscription: sub });

  } catch (err) {
    console.error("Get subscription error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
});


// ── UPGRADE SUBSCRIPTION ──────────────────────────────────────
router.post("/subscription/upgrade", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan } = req.body;

    if (!["pro", "team"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan. Choose 'pro' or 'team'." });
    }

    const planDetails = {
      pro:  { searches_limit: 1000, features: ["1000 searches/month", "All AI platforms", "CSV/JSON export", "Share links", "Priority support"] },
      team: { searches_limit: 9999, features: ["Unlimited searches", "All AI platforms", "Full export", "Team sharing", "Analytics", "Priority support"] }
    };

    const renewsAt = new Date();
    renewsAt.setMonth(renewsAt.getMonth() + 1);

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .upsert({
        user_id:        userId,
        plan,
        status:         "active",
        searches_limit: planDetails[plan].searches_limit,
        searches_used:  0,
        renews_at:      renewsAt.toISOString(),
        features:       planDetails[plan].features,
        upgraded_at:    new Date().toISOString()
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: "Could not update subscription." });
    }

    res.status(200).json({
      message:      `Successfully upgraded to ${plan.toUpperCase()} plan!`,
      subscription: sub
    });

  } catch (err) {
    console.error("Upgrade subscription error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
});


// ── CANCEL SUBSCRIPTION ───────────────────────────────────────
router.post("/subscription/cancel", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    await supabase
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("user_id", userId);

    res.status(200).json({
      message: "Subscription cancelled. You'll retain access until the end of your billing period."
    });

  } catch (err) {
    console.error("Cancel subscription error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
});


// ── EXPORT ALL DATA (GDPR) ────────────────────────────────────
router.get("/export", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const format = req.query.format === "csv" ? "csv" : "json";

    const { data: user } = await supabase
      .from("profiles")
      .select("id, username, email, created_at")
      .eq("id", userId)
      .single();

    const { data: searches } = await supabase
      .from("searches")
      .select("id, query, source, tag, summary, timestamp, is_shared, created_at")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false });

    const { data: settings } = await supabase
      .from("user_settings")
      .select("data, updated_at")
      .eq("user_id", userId)
      .single();

    const exportData = {
      exported_at:    new Date().toISOString(),
      user:           { ...user, password: "[REDACTED]" },
      searches:       searches || [],
      settings:       settings?.data || {},
      total_searches: (searches || []).length
    };

    if (format === "csv") {
      const headers = ["id", "query", "source", "tag", "summary", "timestamp", "is_shared"];
      const rows    = (searches || []).map(s =>
        headers.map(h => `"${String(s[h] || "").replace(/"/g, '""')}"`).join(",")
      );
      const csv = [headers.join(","), ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="recall-ai-export-${Date.now()}.csv"`);
      return res.send(csv);
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="recall-ai-export-${Date.now()}.json"`);
    res.send(JSON.stringify(exportData, null, 2));

  } catch (err) {
    console.error("Export error:", err.message);
    res.status(500).json({ error: "Server error during export." });
  }
});


// ── DELETE ACCOUNT (GDPR) ─────────────────────────────────────
router.delete("/account", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password, confirmation } = req.body;

    if (confirmation !== "DELETE") {
      return res.status(400).json({ error: "Type 'DELETE' to confirm account deletion." });
    }

    const { data: user } = await supabase
      .from("profiles")
      .select("password")
      .eq("id", userId)
      .single();

    if (!user) return res.status(404).json({ error: "User not found." });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Incorrect password. Account not deleted." });
    }

    await supabase.from("user_settings").delete().eq("user_id", userId);
    await supabase.from("subscriptions").delete().eq("user_id", userId);
    await supabase.from("password_resets").delete().eq("user_id", userId);
    await supabase.from("otp_resets").delete().eq("user_id", userId);
    await supabase.from("email_verifications").delete().eq("user_id", userId);
    await supabase.from("searches").delete().eq("user_id", userId);
    await supabase.from("profiles").delete().eq("id", userId);

    console.log(`[Recall AI] Account deleted for user_id: ${userId}`);

    res.status(200).json({
      message: "Your account and all associated data have been permanently deleted. We're sorry to see you go."
    });

  } catch (err) {
    console.error("Delete account error:", err.message);
    res.status(500).json({ error: "Server error during account deletion." });
  }
});


// ── GET FULL PROFILE ──────────────────────────────────────────
router.get("/profile", protect, async (req, res) => {
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
  } catch (err) {
    console.error("Get profile error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
});


// ── UPDATE PROFILE ────────────────────────────────────────────
router.patch("/profile", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      username, email, phone, bio, location,
      display_name, timezone, language,
      github, twitter, linkedin, website, avatar_url
    } = req.body;

    if (email) {
      if (!email.includes("@")) {
        return res.status(400).json({ error: "Please provide a valid email address." });
      }
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.toLowerCase())
        .neq("id", userId)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({ error: "That email is already used by another account." });
      }
    }

    const updates = { updated_at: new Date().toISOString() };
    if (username     !== undefined) updates.username     = username.trim();
    if (email        !== undefined) updates.email        = email.toLowerCase().trim();
    if (phone        !== undefined) updates.phone        = phone.trim();
    if (bio          !== undefined) updates.bio          = bio.trim();
    if (location     !== undefined) updates.location     = location.trim();
    if (display_name !== undefined) updates.display_name = display_name.trim();
    if (timezone     !== undefined) updates.timezone     = timezone;
    if (language     !== undefined) updates.language     = language;
    if (github       !== undefined) updates.github       = github.trim();
    if (twitter      !== undefined) updates.twitter      = twitter.trim();
    if (linkedin     !== undefined) updates.linkedin     = linkedin.trim();
    if (website      !== undefined) updates.website      = website.trim();
    if (avatar_url   !== undefined) updates.avatar_url   = avatar_url;

    const { data: updatedUser, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select("id, username, email, phone, bio, location, display_name, timezone, language, github, twitter, linkedin, website, avatar_url, created_at")
      .maybeSingle();

    if (error) {
      console.error("Update profile DB error:", error.message);
      return res.status(500).json({ error: "Could not update profile. Please try again." });
    }

    if (!updatedUser) {
      return res.status(401).json({ error: "Your session is out of date. Please log out and log back in, then try again." });
    }

    res.status(200).json({
      message: "Profile updated successfully!",
      user: {
        id:          updatedUser.id,
        name:        updatedUser.username,
        email:       updatedUser.email,
        phone:       updatedUser.phone        || "",
        bio:         updatedUser.bio          || "",
        location:    updatedUser.location     || "",
        displayName: updatedUser.display_name || "",
        timezone:    updatedUser.timezone     || "asia/kathmandu",
        language:    updatedUser.language     || "en",
        github:      updatedUser.github       || "",
        twitter:     updatedUser.twitter      || "",
        linkedin:    updatedUser.linkedin     || "",
        website:     updatedUser.website      || "",
        avatarUrl:   updatedUser.avatar_url   || "",
        createdAt:   updatedUser.created_at
      }
    });

  } catch (err) {
    console.error("Update profile error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});


module.exports = router;
