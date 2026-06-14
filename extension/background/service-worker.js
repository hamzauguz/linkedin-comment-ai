const DEFAULTS = {
  apiKey: "",
  tone: "professional",
  useEmoji: false,
};

const TONE_LABELS = {
  professional: "professional and concise",
  friendly: "warm and conversational",
  thoughtful: "insightful and reflective",
  enthusiastic: "energetic and supportive",
};

async function getSettings() {
  return chrome.storage.sync.get(DEFAULTS);
}

function buildPrompt({ authorName, postText, tone, useEmoji }) {
  const toneDesc = TONE_LABELS[tone] || TONE_LABELS.professional;
  const emojiRule = useEmoji
    ? "You may use 0-1 relevant emoji per comment."
    : "Do not use emojis.";

  return `You write LinkedIn comments in English.

Post author: ${authorName || "Unknown"}
Post content:
"""
${postText || "(No post text found — write a generic professional engagement comment)"}
"""

Write exactly 3 distinct comment suggestions.
Tone: ${toneDesc}
Length: 1-2 sentences each, under 280 characters.
${emojiRule}
Sound human, specific to the post, not generic praise like "Great post!".
Avoid hashtags. Do not mention AI.

Return ONLY a JSON array of 3 strings, no markdown.`;
}

async function generateComments(context) {
  const settings = await getSettings();

  if (!settings.apiKey) {
    throw new Error("Add your OpenAI API key in the extension popup.");
  }

  if (!context.postText && !context.authorName) {
    throw new Error("Could not read post content. Scroll the post into view and try again.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        {
          role: "user",
          content: buildPrompt({
            ...context,
            tone: settings.tone,
            useEmoji: settings.useEmoji,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const message = err?.error?.message || `OpenAI API error (${response.status})`;
    throw new Error(message);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content?.trim();

  if (!raw) {
    throw new Error("Empty response from OpenAI.");
  }

  let suggestions;
  try {
    suggestions = JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Could not parse AI response.");
    suggestions = JSON.parse(match[0]);
  }

  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    throw new Error("Invalid suggestions format.");
  }

  return suggestions.slice(0, 3).map(String);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "GENERATE_COMMENTS") return;

  generateComments(message.payload)
    .then((suggestions) => sendResponse({ ok: true, suggestions }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
