const express = require("express");
const cors = require("cors");
const multer = require("multer");
const vision = require("@google-cloud/vision");

const app = express();
app.use(cors({
  origin: ["http://127.0.0.1:5500", "http://localhost:5500"],
  methods: ["GET", "POST", "OPTIONS"],
}));
app.use(express.json());

app.get("/ping", (req, res) => {
  res.json({ ok: true, from: "express" });
});

const upload = multer({ storage: multer.memoryStorage() }); // keep uploaded file in memory
const client = new vision.ImageAnnotatorClient();

function words_center(bbox) {

  // bbox.vertices: [{x,y}, ...]
    const xs = bbox.vertices.map(v => v.x ?? 0);
    const ys = bbox.vertices.map(v => v.y ?? 0);
    return {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
}


function getWords(result) {
    const out = [];
    const pages = result.fullTextAnnotation?.pages ?? [];
    for (const page of pages) {
        for (const block of page.blocks ?? []) {
            for (const para of block.paragraphs ?? []) {
                for (const word of para.words ?? []) {
                    const text = (word.symbols ?? []).map(s => s.text).join("");
                    const c = words_center(word.boundingBox);
                    out.push({ text, x: c.x, y: c.y });
                }
            }
        }
    }
    return out;
}

function groupIntoRows(words, yThreshold = 12) {
  // sort by y first
  const sorted = [...words].sort((a, b) => a.y - b.y);

  const rows = [];
  for (const w of sorted) {
    let placed = false;
    for (const row of rows) {
      // compare to row's average y
      if (Math.abs(w.y - row.y) <= yThreshold) {
        row.words.push(w);
        // update avg y
        row.y = row.words.reduce((s, t) => s + t.y, 0) / row.words.length;
        placed = true;
        break;
      }
    }
    if (!placed) rows.push({ y: w.y, words: [w] });
  }

  // sort words left->right in each row and also sort rows top->bottom
  for (const row of rows) row.words.sort((a, b) => a.x - b.x);
  rows.sort((a, b) => a.y - b.y);

  return rows.map(r => r.words.map(w => w.text).join(" ").replace(/\s+/g, " ").trim());
}

function splitSections(lines) {
  const sections = { tests: [], assignments: [] };
  let mode = null;

  for (const line of lines) {
    const clean = line.trim();

    // Detect section headers (tune these keywords as needed)
    if (/^Tests$/i.test(clean)) { mode = "tests"; continue; }
    if (/^Assignments$/i.test(clean)) { mode = "assignments"; continue; }

    // Skip stuff before we know mode
    if (!mode) continue;

    // Skip obvious headers
    if (/^(Title|Status|Score|Due|date|Performance report)$/i.test(clean)) continue;

    sections[mode].push(clean);
  }

  return sections;
}

function parseTests(testLines) {
  const out = [];
  for (const line of testLines) {
    const m = line.match(/^(.*?)\s+Graded\s+(\d{1,3})\s*%/i);
    if (!m) continue;
    out.push({ title: m[1].trim(), score: m[2] + "%" });
  }
  return out;
}

function parseAssignments(assignmentLines) {
  const out = [];
  for (const line of assignmentLines) {
    // Split by assignment id, other random information, and score
    const m = line.match(/^(a\d+|assignment)\s+(.*?)\s+.*?Graded\s+(\d{1,3})\s*%/i);
    if (!m) continue;

    out.push({
      title: m[1],          
      due: m[2].trim(),     
      score: m[3] + "%"
    });
  }
  return out;
}

function midtermAverages(tests) {
    let total = 0;
    let count = 0;
    for (const midterm of tests) {
        if (/midterm/i.test(midterm.title)) {
            const score = parseInt(midterm.score);
            total += score;
            count++;
        }
    }

    return count === 0 ? null : Math.round(total / count);
}

function quizAverages(tests) {
    let total = 0;
    let count = 0;
    for (const quiz of tests) {
        if (/q/i.test(quiz.title)) {
            const score = parseInt(quiz.score);
            total += score;
            count++;
        }
    }

    return count === 0 ? null : Math.round(total / count);
}

function assignmentAverages(assignments) {
    let total = 0;
    let count = 0;
    for (const assignment of assignments) {
        if (/a|homework/i.test(assignment.title)) {
            const score = parseInt(assignment.score);
            total += score;
            count++;
        }
    }

    return count === 0 ? null : Math.round(total / count);
}


app.post("/api/grade-ocr", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded (field name must be 'image')." });

    // Vision can accept bytes directly:
        const [result] = await client.documentTextDetection({
            image: { content: req.file.buffer }
        });

        const words = getWords(result);
        const lines = groupIntoRows(words, 12);
        const sections = splitSections(lines);
        const tests = parseTests(sections.tests);
        const assignments = parseAssignments(sections.assignments);

        res.json({
            tests,
            assignments,
            averages: {
                midterm: midtermAverages(tests),
                quiz: quizAverages(tests),
                assignment: assignmentAverages(assignments),
                },
            debug: { lines } // remove if you don’t want to send reconstructed lines
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "OCR failed", details: String(err?.message ?? err) });
    }
});

module.exports = {
  words_center,
  getWords,
  groupIntoRows,
  splitSections,
  parseTests,
  parseAssignments,
  midtermAverages,
  quizAverages,
  assignmentAverages
};

app.listen(3000, () => console.log("Server listening on http://localhost:3000"));





