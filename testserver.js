const vision = require("@google-cloud/vision");
const client = new vision.ImageAnnotatorClient();


const { words_center, getWords, groupIntoRows, splitSections,
        parseTests, parseAssignments,
        midtermAverages, quizAverages, assignmentAverages } = require("./server.js"); // or wherever they are

async function run() {
  const imagePath = "E:\\webproject\\exam_insurance\\examplescore2.png";

  const [result] = await client.documentTextDetection(imagePath);

  const words = getWords(result);
  const lines = groupIntoRows(words, 12);

  const sections = splitSections(lines);
  const tests = parseTests(sections.tests);
  const assignments = parseAssignments(sections.assignments);

  console.log(assignments);
  console.table(tests);
  
  console.log("Midterm:", midtermAverages(tests));
  console.log("Quiz:", quizAverages(tests));
  console.log("Assignment:", assignmentAverages(assignments));
}

run().catch(console.error);