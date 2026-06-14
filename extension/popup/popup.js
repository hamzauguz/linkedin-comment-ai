const DEFAULTS = {
  apiKey: "",
  tone: "professional",
  useEmoji: false,
};

const form = document.getElementById("settings-form");
const apiKeyInput = document.getElementById("api-key");
const toneSelect = document.getElementById("tone");
const useEmojiCheckbox = document.getElementById("use-emoji");
const statusEl = document.getElementById("status");

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  apiKeyInput.value = stored.apiKey || "";
  toneSelect.value = stored.tone || DEFAULTS.tone;
  useEmojiCheckbox.checked = Boolean(stored.useEmoji);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const apiKey = apiKeyInput.value.trim();
  const tone = toneSelect.value;
  const useEmoji = useEmojiCheckbox.checked;

  if (apiKey && !apiKey.startsWith("sk-")) {
    showStatus("API key should start with sk-", true);
    return;
  }

  await chrome.storage.sync.set({ apiKey, tone, useEmoji });
  showStatus(apiKey ? "Settings saved." : "Settings saved (add API key to generate).");
});

loadSettings();
