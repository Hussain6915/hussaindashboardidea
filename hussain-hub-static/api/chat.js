// api/chat.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      res.status(500).json({ error: "Missing GEMINI_API_KEY" });
      return;
    }

    const { message, friendName, language, userBio, dashboardSummary } = req.body || {};
    if (!message) {
      res.status(400).json({ error: "Missing message" });
      return;
    }

    const system = `
You are an AI friend named "${friendName || "Nova"}".
Speak in ${language || "English"}.
Be warm, supportive, and casual like a close friend.
Ask a small follow-up question most times.
Use the user's dashboard summary to be helpful (not creepy).
Do NOT mention backend, API, server, Vercel, or technical details.
`;

    const summary = dashboardSummary ? JSON.stringify(dashboardSummary) : "{}";

    const prompt = `
SYSTEM:
${system}

USER BIO:
${userBio || "Not provided"}

DASHBOARD SUMMARY (safe):
${summary}

USER MESSAGE:
${message}
`;

    const resp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + encodeURIComponent(key),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 450 }
        })
      }
    );

    if (!resp.ok) {
      const t = await resp.text();
      res.status(500).json({ error: "Gemini error", detail: t });
      return;
    }

    const data = await resp.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ||
      "I’m here. Tell me what’s on your mind?";

    res.status(200).json({ reply });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
}