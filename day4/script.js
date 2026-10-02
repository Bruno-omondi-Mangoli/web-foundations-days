// ---------- 1. Select the elements we need ----------
const textarea = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

const DRAFT_KEY = "day4-draft";
const THEME_KEY = "day4-theme";
const MAX_CHARS = 200;
const WARNING_CHARS = 180;

// ---------- 2. Counters ----------
function updateCounts() {
  const text = textarea.value;
  const length = text.length;

  // Characters
  charCount.textContent = `${length} / ${MAX_CHARS} characters`;

  // Words: trim first, then split on any group of spaces
  const trimmed = text.trim();
  let words = 0;
  if (trimmed !== "") {
    words = trimmed.split(/\s+/).length;
  }
  if (words === 1) {
    wordCount.textContent = "1 word";
  } else {
    wordCount.textContent = `${words} words`;
  }

  // Warning classes
  if (length > WARNING_CHARS) {
    charCount.classList.add("warning");
  } else {
    charCount.classList.remove("warning");
  }

  if (length > MAX_CHARS) {
    charCount.classList.add("over");
  } else {
    charCount.classList.remove("over");
  }
}

// ---------- 3. Draft: save, restore and clear ----------
function saveDraft() {
  localStorage.setItem(DRAFT_KEY, textarea.value);
}

function loadDraft() {
  const savedDraft = localStorage.getItem(DRAFT_KEY);
  if (savedDraft !== null) {
    textarea.value = savedDraft;
  }
}

function clearAll() {
  textarea.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounts();
  textarea.focus();
}

// ---------- 4. Theme ----------
function applyTheme(isDark) {
  if (isDark) {
    document.body.classList.add("dark");
    themeToggle.textContent = "Light mode";
  } else {
    document.body.classList.remove("dark");
    themeToggle.textContent = "Dark mode";
  }
}

function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  applyTheme(savedTheme === "dark");
}

// ---------- 5. Event listeners ----------
textarea.addEventListener("input", () => {
  updateCounts();
  saveDraft();
});

textarea.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearAll();
  }
});

clearBtn.addEventListener("click", clearAll);

themeToggle.addEventListener("click", () => {
  const goingDark = !document.body.classList.contains("dark");
  applyTheme(goingDark);
  localStorage.setItem(THEME_KEY, goingDark ? "dark" : "light");
});

// ---------- 6. When the page loads ----------
loadDraft();
loadTheme();
updateCounts();