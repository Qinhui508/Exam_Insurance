let currentPage = 1;
const totalPages = 4;

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  updateProgress();
}

function nextPage() {
  if(currentPage < totalPages){
    currentPage++;
    showPage(currentPage);
  }
}

function prevPage() {
  if(currentPage > 1){
    currentPage--;
    showPage(currentPage);
  }
}

function updateProgress() {
  const progress = (currentPage / totalPages) * 100;
  document.getElementById("progress-bar").style.width = progress + "%";
}


function showThankYou() {
  document.getElementById(`page-${currentPage}`).classList.remove("active");
  document.getElementById("thanks").classList.add("active");
  document.getElementById("progress-bar").style.width = "100%";
}

// Calculate Support Tier based on current average
function calculateTier(avg) {
  if (avg == null || Number.isNaN(avg)) return "Please upload your grade screenshot first.";

  if (avg < 55) return `Your current average is ${avg}%. Based on this, you qualify for: 50% Support Tier.`;
  if (avg < 65) return `Your current average is ${avg}%. Based on this, you qualify for: 60% Support Tier.`;
  if (avg < 75) return `Your current average is ${avg}%. Based on this, you qualify for: 70% Support Tier.`;
  return `${avg}%. Based on this, you qualify for: 80% Support Tier.`;
}

document.getElementById("verificationFile").addEventListener("change", async function (event) {
  const file = event.target.files[0];
  if (!file) return;

  console.log("File uploaded:", file);

  const formData = new FormData();
  formData.append("image", file); // must match upload.single("image")

  try {
    const resp = await fetch("http://localhost:3000/api/grade-ocr", {
      method: "POST",
      body: formData
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    console.log("OCR result:", data);

    // Example: show averages on the page
    document.getElementById("midtermAvg").textContent = data.averages.midterm ?? "N/A";
    document.getElementById("assignmentAvg").textContent = data.averages.assignment ?? "N/A";
    document.getElementById("quizAvg").textContent = data.averages.quiz ?? "N/A";

    const avg = Number(data.averages.midterm);
    document.getElementById("tier-text").textContent = calculateTier(avg);
    // render tests/assignments however you like
  } catch (e) {
    console.error("Upload/OCR failed:", e);
  }
});





// Initialize first page
showPage(currentPage);
