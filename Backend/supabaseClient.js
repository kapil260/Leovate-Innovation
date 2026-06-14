// ============================================================
// supabaseClient.js
// Creates and exports the Supabase database connection
// Used by all route files to read/write data
// ============================================================

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// Create connection using Service Role Key
// Service Role Key gives full database access (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = supabase;
