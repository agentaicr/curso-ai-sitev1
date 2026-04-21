const fs = require("fs");
const path = require("path");

const INDEX_PATH = path.join(__dirname, "..", "index.html");
const AFFILIATES_PATH = path.join(__dirname, "..", "affiliates.json");

const EMOJIS = ["🤖", "✨", "🚀", "🎓", "💼", "💡"];
const THUMBNAILS = ["t1", "t2", "t3", "t4", "t5", "t6"];
const BADGES = [
  { badge: "hot", badge_text: "🔥 Más vendido" },
  { badge: "new", badge_text: "✨ Nuevo" },
  { badge: "popular", badge_text: "⭐ Popular" },
];

function buildCourseCard(course, index) {
  const emoji = EMOJIS[index % EMOJIS.length];
  const thumbnail = THUMBNAILS[index % THUMBNAILS.length];
  const badge = BADGES[index % BADGES.length];
  const badgeClass = badge.badge === "hot" ? "card-badge hot" :
                     badge.badge === "new" ? "card-badge new" : "card-badge";

  return `
      <a class="course-card" href="${course.affiliate_url}" target="_blank" rel="noopener" data-category="${course.category}">
        <div class="card-thumbnail ${thumbnail}">${emoji}</div>
        <div class="card-body">
          <div class="card-meta">
            <span class="card-category">IA</span>
            <span class="${badgeClass}">${badge.badge_text}</span>
          </div>
          <div class="card-title">${course.name}</div>
          <div class="card-desc">Curso disponible en Hotmart. Acceso inmediato y certificado oficial.</div>
          <div class="card-footer">
            <div>
              <span class="card-price">Ver precio</span>
            </div>
            <div>
              <div class="card-rating">
                <span class="stars">★★★★★</span>
                <span>(Hotmart)</span>
              </div>
            </div>
          </div>
          <br>
          <button class="card-cta" style="width:100%">Ver curso →</button>
        </div>
      </a>`;
}

function updateIndexHtml(courses) {
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(`No se encontró index.html en: ${INDEX_PATH}`);
  }

  let html = fs.readFileSync(INDEX_PATH, "utf8");

  const startMarker = "<!-- COURSES_START -->";
  const endMarker = "<!-- COURSES_END -->";

  if (!html.includes(startMarker) || !html.includes(endMarker)) {
    throw new Error("No se encontraron los marcadores en index.html");
  }

  const cardsHtml = courses.map((c, i) => buildCourseCard(c, i)).join("\n");
  const before = html.split(startMarker)[0];
  const after = html.split(endMarker)[1];
  const updatedHtml = `${before}${startMarker}\n${cardsHtml}\n    ${endMarker}${after}`;

  fs.writeFileSync(INDEX_PATH, updatedHtml, "utf8");
  console.log(`✅ index.html actualizado con ${courses.length} cursos`);
}

function main() {
  console.log("🤖 Agente iniciado");
  console.log("=".repeat(50));

  if (!fs.existsSync(AFFILIATES_PATH)) {
    throw new Error("No se encontró affiliates.json");
  }

  const affiliates = JSON.parse(fs.readFileSync(AFFILIATES_PATH, "utf8"));
  const courses = affiliates.courses;

  console.log(`📦 Encontrados ${courses.length} cursos en affiliates.json`);
  courses.forEach((c, i) => console.log(`  ${i + 1}. ${c.name}`));

  updateIndexHtml(courses);

  console.log("=".repeat(50));
  console.log("✅ Actualización completada");
}

main();
