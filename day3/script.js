// ===== Starting data =====
let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

const allowedCategories = ["personal", "work", "study"];

// Helper: trim, lower-case and collapse extra spaces so texts can be compared
function normalise(text) {
  return text.trim().toLowerCase().split(/\s+/).join(" ");
}

// ===== 1. searchNotes(word) =====
// Returns a new array of notes whose text contains the word (any case)
function searchNotes(word) {
  const searchWord = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(searchWord));
}

// ===== 2. longestNote() =====
// Returns the note object with the most characters, or null if there are none
function longestNote() {
  if (notes.length === 0) {
    return null;
  }
  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

// ===== 3. countByCategory() =====
// Returns an object such as { personal: 2, work: 1, study: 2 }
function countByCategory() {
  const counts = { personal: 0, work: 0, study: 0 };
  for (const note of notes) {
    counts[note.category] = (counts[note.category] || 0) + 1;
  }
  return counts;
}

// ===== 4. getSummary() =====
// Returns a sentence such as "5 notes: 2 personal, 1 work, 2 study."
function getSummary() {
  const counts = countByCategory();
  let noteWord = "notes";
  if (notes.length === 1) {
    noteWord = "note";
  }
  return `${notes.length} ${noteWord}: ${counts.personal} personal, ${counts.work} work, ${counts.study} study.`;
}

// ===== 5. isDuplicate(text) =====
// True if a note with the same text exists (ignoring case and extra spaces)
function isDuplicate(text) {
  const cleaned = normalise(text);
  return notes.some((note) => normalise(note.text) === cleaned);
}

// ===== 6. addNote(text, category) =====
// Adds a note only if valid. Returns true when added, false otherwise.
function addNote(text, category) {
  const cleaned = text.trim();

  if (cleaned.length === 0 || cleaned.length > 200) {
    console.log("❌ Note rejected: text must be 1-200 characters.");
    return false;
  }
  if (!allowedCategories.includes(category)) {
    console.log(`❌ Note rejected: category must be personal, work or study (got "${category}").`);
    return false;
  }
  if (isDuplicate(cleaned)) {
    console.log("❌ Note rejected: a note with this text already exists.");
    return false;
  }

  const newNote = {
    id: Date.now(),
    text: cleaned,
    category: category,
  };
  notes.push(newNote);
  console.log(`✅ Added: "${cleaned}" (${category})`);
  return true;
}

// =====================================================
// TESTS (expected output is written in the comments)
// =====================================================

// --- searchNotes ---
console.log("--- searchNotes ---");
console.log(searchNotes("milk"));
// [ { id: 1, text: "Buy milk and bread", category: "personal" } ]
console.log(searchNotes("JAVASCRIPT"));
// [ { id: 4, text: "Revise JavaScript arrays", category: "study" } ]  (ignores case)
console.log(searchNotes("the").length);
// 2  (notes 2 and 3)
console.log(searchNotes("zebra"));
// []  (edge case: no results)

// --- longestNote ---
console.log("--- longestNote ---");
console.log(longestNote());
// { id: 3, text: "Email the project report to Grace", category: "work" }
console.log(longestNote().text.length);
// 33
const savedNotes = notes; // keep the real data safe
notes = [];
console.log(longestNote());
// null  (edge case: empty array)
notes = savedNotes;

// --- countByCategory ---
console.log("--- countByCategory ---");
console.log(countByCategory());
// { personal: 2, work: 1, study: 2 }
notes = [];
console.log(countByCategory());
// { personal: 0, work: 0, study: 0 }  (edge case: no notes)
notes = savedNotes;

// --- getSummary ---
console.log("--- getSummary ---");
console.log(getSummary());
// "5 notes: 2 personal, 1 work, 2 study."
notes = [savedNotes[0]];
console.log(getSummary());
// "1 note: 1 personal, 0 work, 0 study."  (edge case: exactly one note)
notes = [];
console.log(getSummary());
// "0 notes: 0 personal, 0 work, 0 study."  (edge case: no notes)
notes = savedNotes;

// --- isDuplicate ---
console.log("--- isDuplicate ---");
console.log(isDuplicate("Buy milk and bread"));
// true
console.log(isDuplicate("  BUY   milk and bread  "));
// true  (edge case: different case and extra spaces)
console.log(isDuplicate("Buy eggs"));
// false

// --- addNote ---
console.log("--- addNote ---");
console.log(addNote("Learn CSS Grid", "study"));
// logs ✅ Added: "Learn CSS Grid" (study), then prints true
console.log(addNote("   ", "work"));
// logs ❌ ... must be 1-200 characters, then prints false (edge case: only spaces)
console.log(addNote("a".repeat(201), "work"));
// logs ❌ ... must be 1-200 characters, then prints false (edge case: too long)
console.log(addNote("Water the plants", "hobby"));
// logs ❌ ... category must be personal, work or study, then prints false
console.log(addNote("  buy MILK and bread ", "personal"));
// logs ❌ ... a note with this text already exists, then prints false

// --- Final check after the successful add ---
console.log("--- final state ---");
console.log(getSummary());
// "6 notes: 2 personal, 1 work, 3 study."
console.log(countByCategory());
// { personal: 2, work: 1, study: 3 }