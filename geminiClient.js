// ============================================================
// geminiClient.js
// Handles all Gemini AI operations for Recall AI:
//   1. getAutoTag()     — classifies search into a category
//   2. getAutoSummary() — writes a short summary of the search
//   3. getWeeklyInsight() — generates weekly usage insight
// All functions are free using Google Gemini API
// Get your free API key from: aistudio.google.com
// ============================================================

const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Create the Gemini AI client using our API key from .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use the gemini-pro model — free and very capable
const model = genAI.getGenerativeModel({ model: "gemini-pro" });


// ── AUTO TAG FUNCTION ─────────────────────────────────────────
// Sends the search query to Gemini and asks it to classify
// it into one of our 6 categories
// Returns: "Science", "Tech", "Health", "Finance", "History", or "Other"

async function getAutoTag(query) {
  try {
    // The prompt we send to Gemini
    const prompt = `You are a search query classifier for an AI search history dashboard called Recall AI.
    
Your task is to classify the following search query into EXACTLY ONE of these categories:
Science, Tech, Health, Finance, History, Other

Rules:
- Science: biology, chemistry, physics, space, environment, nature, research
- Tech: programming, software, hardware, AI, apps, computers, coding, internet
- Health: medicine, diseases, fitness, mental health, nutrition, symptoms, doctors
- Finance: money, investing, stocks, banking, economy, budgeting, cryptocurrency
- History: historical events, wars, civilizations, famous people from the past
- Other: anything that does not fit the above categories

Search query: "${query}"

Reply with ONLY the category name. No explanation. No punctuation. Just one word.`;

    // Send to Gemini and get response
    const result = await model.generateContent(prompt);
    const tag = result.response.text().trim();

    // Make sure it is a valid tag — if not default to Other
    const validTags = ["Science", "Tech", "Health", "Finance", "History", "Other"];
    return validTags.includes(tag) ? tag : "Other";

  } catch (error) {
    // If Gemini fails for any reason, default to Other
    // This makes sure the search still saves even if AI is down
    console.error("Gemini auto-tag error:", error.message);
    return "Other";
  }
}


// ── AUTO SUMMARY FUNCTION ─────────────────────────────────────
// Sends the search query to Gemini and asks it to write
// a short plain-English summary of what the search is about
// Returns: a short string of max 12 words

async function getAutoSummary(query) {
  try {
    const prompt = `You are a summarizer for an AI search history dashboard called Recall AI.

Write a very short summary (MAXIMUM 12 words) of what the following search query is about.
Write in simple, clear English. 
Do NOT start with "This query", "The user", or "This search".
Just describe what the topic is about directly.

Search query: "${query}"

Reply with ONLY the summary. Nothing else.`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim();

    // Limit to 150 characters just in case Gemini returns something long
    return summary.substring(0, 150);

  } catch (error) {
    console.error("Gemini auto-summary error:", error.message);
    // Return empty string if AI fails — search still saves without summary
    return "";
  }
}


// ── WEEKLY INSIGHT FUNCTION ───────────────────────────────────
// Generates a smart weekly insight message for the dashboard
// Based on the user's actual search history from the past 7 days
// This powers the "Weekly Insights" banner on the dashboard
// Returns: a short insight string

async function getWeeklyInsight(searches) {
  try {
    // If no searches this week, return a default message
    if (!searches || searches.length === 0) {
      return "Start searching on ChatGPT to see your weekly insights here!";
    }

    // Build a summary of the searches to send to Gemini
    const searchList = searches
      .slice(0, 20) // only send up to 20 searches to keep prompt short
      .map(s => `- ${s.query}`)
      .join("\n");

    // Count tags to find the most common one
    const tagCounts = {};
    searches.forEach(s => {
      tagCounts[s.tag] = (tagCounts[s.tag] || 0) + 1;
    });
    const topTag = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a])[0];

    const prompt = `You are an AI assistant for Recall AI, a search history dashboard.

A user has made ${searches.length} searches this week. Their most common topic is ${topTag}.

Here are some of their searches:
${searchList}

Write ONE short, engaging insight sentence (maximum 20 words) about their search patterns this week.
Make it feel personal and helpful, like a smart assistant summarizing their week.
Do not start with "You" — vary the sentence structure.

Reply with ONLY the insight sentence. Nothing else.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();

  } catch (error) {
    console.error("Gemini weekly insight error:", error.message);
    return `You made ${searches.length} searches this week. Keep exploring!`;
  }
}


// Export all three functions so routes can use them
module.exports = { getAutoTag, getAutoSummary, getWeeklyInsight };
