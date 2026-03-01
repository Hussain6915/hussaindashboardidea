async function callGemini(apiKey, prompt) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  const data = await resp.json();
  return { ok: resp.ok, status: resp.status, data };
}

function getRetrySeconds(msg) {
  // Tries to extract "...retry in 38.43s"
  const m = String(msg || "").match(/retry in ([0-9.]+)s/i);
  if (!m) return null;
  return Math.ceil(Number(m[1]));
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).end(JSON.stringify({ error: "Missing GEMINI_API_KEY" }));
    }

    const { messages } = req.body || {};
    const prompt =
      (messages || []).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n") ||
      "Say hello";

    // Try once
    let r = await callGemini(apiKey, prompt);

    // If quota/rate limited, return a friendly message + retry seconds
    const errMsg = r?.data?.error?.message;
    if (!r.ok && errMsg && /quota|rate|exceeded/i.test(errMsg)) {
      const retrySeconds = getRetrySeconds(errMsg) ?? 60;
      return res.status(429).end(
        JSON.stringify({
          error: "RATE_LIMIT",
          message: "Slow down a bit 😅 Gemini limit hit. Try again shortly.",
          retrySeconds,
        })
      );
    }

    // Other errors
    if (!r.ok) {
      return res.status(500).end(
        JSON.stringify({
          error: "GEMINI_ERROR",
          message: errMsg || "Gemini request failed.",
        })
      );
    }

    const text = r?.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
    return res.status(200).end(JSON.stringify({ text }));
  } catch (err) {
    return res.status(500).end(JSON.stringify({ error: String(err) }));
  }
}
