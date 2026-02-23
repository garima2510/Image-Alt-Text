// ── Configuration ──
const API_URL =
  "https://contapp-eus2-translate.livelytree-8516c0db.eastus2.azurecontainerapps.io/alt-translate";

// Language code → display name mapping (for known checkbox languages)
const LANGUAGE_NAMES = {
  en: "English",
  nl: "Dutch",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  ja: "Japanese",
  "zh-Hans": "Chinese (Simplified)",
  "zh-Hant": "Chinese (Traditional)",
  sv: "Swedish",
  da: "Danish",
  nb: "Norwegian",
  hi: "Hindi",
};

// Azure Translator supported languages: name → code lookup (loaded on startup)
// This lets users type language names like "Tamil" instead of codes like "ta"
let translatorLanguages = {}; // { "tamil": "ta", "korean": "ko", ... }

async function loadTranslatorLanguages() {
  try {
    const resp = await fetch(
      "https://api.cognitive.microsofttranslator.com/languages?api-version=3.0&scope=translation"
    );
    const data = await resp.json();
    const translation = data.translation || {};
    for (const [code, info] of Object.entries(translation)) {
      // Map lowercase name → code
      translatorLanguages[info.name.toLowerCase()] = code;
      if (info.nativeName) {
        translatorLanguages[info.nativeName.toLowerCase()] = code;
      }
      // Also map the code itself
      translatorLanguages[code.toLowerCase()] = code;

      // Add to LANGUAGE_NAMES if not already present
      if (!LANGUAGE_NAMES[code]) {
        LANGUAGE_NAMES[code] = info.name;
      }
    }
  } catch (err) {
    console.warn("Could not load Translator languages:", err);
  }
}

// Load on startup
loadTranslatorLanguages();

// ── DOM references ──
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const imageUrlInput = document.getElementById("image-url");
const sendBtn = document.getElementById("send-btn");
const langToggle = document.getElementById("lang-toggle");
const langDropdown = document.getElementById("lang-dropdown");
const selectAllBtn = document.getElementById("select-all");
const selectNoneBtn = document.getElementById("select-none");
const langCheckboxes = document.querySelectorAll('.lang-grid input[type="checkbox"]');
const customLangInput = document.getElementById("custom-lang-input");

// ── Language dropdown toggle ──
langToggle.addEventListener("click", () => {
  langDropdown.classList.toggle("hidden");
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".language-selector")) {
    langDropdown.classList.add("hidden");
  }
});

selectAllBtn.addEventListener("click", () => {
  langCheckboxes.forEach((cb) => (cb.checked = true));
});

selectNoneBtn.addEventListener("click", () => {
  langCheckboxes.forEach((cb) => (cb.checked = false));
});

// ── Helpers ──
function resolveLanguageCode(input) {
  const lower = input.toLowerCase();
  // Check if it's a known name or code in the Translator lookup
  if (translatorLanguages[lower]) {
    return translatorLanguages[lower];
  }
  // Return as-is (the backend will validate and return an error if unsupported)
  return lower;
}

function getSelectedLanguages() {
  // Checkbox selections
  const checked = Array.from(langCheckboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  // Custom language input — accepts codes ("ta") or names ("Tamil")
  const customRaw = customLangInput.value.trim();
  const custom = customRaw
    ? customRaw.split(/[,;]+/).map((c) => c.trim()).filter(Boolean).map(resolveLanguageCode)
    : [];

  // Merge and deduplicate
  return [...new Set([...checked, ...custom])];
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addMessage(html, sender = "bot") {
  const div = document.createElement("div");
  div.className = `message ${sender}-message`;
  div.innerHTML = `<div class="message-content">${html}</div>`;
  chatMessages.appendChild(div);
  scrollToBottom();
  return div;
}

function addLoadingMessage() {
  return addMessage(
    '<div class="loading-dots"><span></span><span></span><span></span></div>',
    "bot"
  );
}

function removeMessage(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function buildTranslationsTable(translations) {
  let rows = "";
  for (const [code, text] of Object.entries(translations)) {
    const name = LANGUAGE_NAMES[code] || code.toUpperCase();
    rows += `<tr><th>${name}</th><td>${escapeHtml(text)}</td></tr>`;
  }
  return `<table class="translations-table"><tbody>${rows}</tbody></table>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Form submit ──
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const imageUrl = imageUrlInput.value.trim();
  if (!imageUrl) return;

  const selectedLangs = getSelectedLanguages();

  // Show user message with image preview
  addMessage(
    `${escapeHtml(imageUrl)}<img src="${escapeHtml(imageUrl)}" alt="User provided image" onerror="this.style.display='none'" />`,
    "user"
  );

  // Show selected languages or default to English only
  if (selectedLangs.length > 0) {
    const langNames = selectedLangs.map((c) => LANGUAGE_NAMES[c] || c).join(", ");
    addMessage(`Translating to: <strong>${langNames}</strong>`, "bot");
  } else {
    addMessage(`No languages selected — generating <strong>English</strong> alt text only.`, "bot");
  }

  // Clear input and disable
  imageUrlInput.value = "";
  customLangInput.value = "";
  sendBtn.disabled = true;
  langDropdown.classList.add("hidden");

  // Show loading indicator
  const loadingMsg = addLoadingMessage();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        target_language_codes: selectedLangs,
      }),
    });

    removeMessage(loadingMsg);

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      const errMsg = errData?.error || `HTTP ${response.status}`;
      addMessage(`<span class="error-text">Error: ${escapeHtml(errMsg)}</span>`, "bot");
      return;
    }

    const data = await response.json();
    const table = buildTranslationsTable(data.translations);
    addMessage(`<strong>Alt-text translations:</strong>${table}`, "bot");
  } catch (err) {
    removeMessage(loadingMsg);
    addMessage(
      `<span class="error-text">Failed to connect to the API. Please check the URL and try again.</span>`,
      "bot"
    );
    console.error("API call failed:", err);
  } finally {
    sendBtn.disabled = false;
    imageUrlInput.focus();
  }
});
