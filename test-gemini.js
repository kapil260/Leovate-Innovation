// ============================================================
// test-gemini.js — Tests the Groq API connection
// Run: node test-gemini.js
// ============================================================

require("dotenv").config();

async function runTest() {
  console.log("\n🔍 RECALL AI — Groq API Test\n");

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.error("❌ GROQ_API_KEY not found in .env");
    console.error("   Add this line to backend/.env:");
    console.error("   GROQ_API_KEY=gsk_your_key_here");
    process.exit(1);
  }
  console.log("✅ GROQ_API_KEY found:", key.substring(0, 8) + "...\n");

  try {
    console.log("🤖 Calling Groq API...");
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model:       "llama-3.1-8b-instant",
        temperature: 0.1,
        max_tokens:  10,
        messages: [
          { role: "system",  content: "Reply with one word only." },
          { role: "user",    content: 'Classify "how to code in Python" into one of: Science, Tech, Health, Finance, History, Other' }
        ]
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ API Error:", JSON.stringify(data).substring(0, 300));
      process.exit(1);
    }

    const answer = data?.choices?.[0]?.message?.content?.trim();
    console.log("✅ Groq responded:", answer);
    console.log("\n🎉 Groq is working! Tags and summaries will work correctly.\n");

  } catch (err) {
    console.error("❌ Failed:", err.message);
    process.exit(1);
  }
}

runTest();
