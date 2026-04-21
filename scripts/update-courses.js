/**
 * update-courses.js
 * Agente IA que busca cursos de IA en Hotmart y actualiza index.html
 * Corre semanalmente via GitHub Actions
 *
 * Requiere: ANTHROPIC_API_KEY en los secrets de GitHub
 */

const fs = require("fs");
const path = require("path");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const INDEX_PATH = path.join(__dirname, "..", "index.html");

if (!ANTHROPIC_API_KEY) {
  console.error("❌ Falta ANTHROPIC_API_KEY en las variables de entorno");
  process.exit(1);
}

// ─── 1. PROMPT DEL AGENTE ──────────────────────────────────────────────────

const AGENT_PROMPT = `
Eres un agente especialista en marketing de afiliados de Hotmart.

Tu tarea es buscar en internet los cursos de Inteligencia Artificial más populares 
y mejor valorados actualmente disponibles en Hotmart en español.

Para cada curso necesitas encontrar:
1. El nombre exacto del curso
2. Una descripción breve (máximo 100 caracteres)
3. El precio actual en dólares
4. El precio original (tachado) si tiene descuento
5. La URL del producto en Hotmart (formato: https://hotmart.com/product/...)
6. La categoría: "ChatGPT", "Machine Learning", "Automatización", "IA para Diseño", "Datos", "IA para Negocios", o "Programación con IA"
7. Un emoji representativo
8. La valoración (ej: 4.8)
9. El número de reseñas aproximado
10. Si es "hot" (más vendido), "new" (nuevo), o "popular"

Busca al menos 6 cursos diferentes de categorías distintas.
Prioriza cursos con muchas reseñas positivas y buenas ventas.

IMPORTANTE: Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta,
sin markdown, sin backticks, sin texto adicional:

{
  "updated_at": "YYYY-MM-DD",
  "courses": [
    {
      "id": 1,
      "title": "Nombre del curso",
      "description": "Descripción corta del curso",
      "price": 97,
      "original_price": 197,
      "hotmart_url": "https://hotmart.com/product/...",
      "category": "ChatGPT",
      "emoji": "🤖",
      "rating": 4.9,
      "reviews": 1200,
      "badge": "hot",
      "badge_text": "🔥 Más vendido",
      "thumbnail_class": "t1"
    }
  ]
}

Para thumbnail_class usa: t1, t2, t3, t4, t5, t6 rotando en orden.
`;

// ─── 2. LLAMADA AL AGENTE CON WEB SEARCH ──────────────────────────────────

async function fetchCourses() {
  console.log("🔍 Buscando cursos en Hotmart...");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
        },
      ],
      messages: [
        {
          role: "user",
          content: AGENT_PROMPT,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  console.log(`✅ Agente respondió. Tokens usados: ${data.usage?.output_tokens}`);

  // Extraer el texto de la respuesta
  const textBlock = data.content?.find((b) => b.type === "text");
  if (!textBlock?.text) {
    throw new Error("El agente no devolvió texto");
  }

// Extraer JSON aunque venga con texto antes o después
  let jsonText = textBlock.text.trim();
  jsonText = jsonText.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

  // Buscar el JSON dentro del texto
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No se encontró JSON en la respuesta del agente");
  }
  const parsed = JSON.parse(jsonMatch[0]);
  console.log(`📦 Encontrados ${parsed.courses.length} cursos`);
  return parsed;
}

// ─── 3. GENERAR HTML DE CARDS ──────────────────────────────────────────────

function buildCourseCard(course) {
  const badgeClass = course.badge === "hot" ? "card-badge hot" : 
                     course.badge === "new" ? "card-badge new" : "card-badge";
  const priceOld = course.original_price > course.price
    ? `<span class="card-price-old">$${course.original_price}</span>`
    : "";
  const reviewCount = course.reviews > 1000
    ? `(${(course.reviews / 1000).toFixed(1)}k)`
    : `(${course.reviews})`;
  const stars = course.rating >= 4.9
    ? "★★★★★"
    : course.rating >= 4.5
    ? "★★★★☆"
    : "★★★★☆";

  return `
      <!-- CURSO: ${course.title} | Actualizado automáticamente -->
      <a class="course-card" href="${course.hotmart_url}" target="_blank" rel="noopener">
        <div class="card-thumbnail ${course.thumbnail_class}">${course.emoji}</div>
        <div class="card-body">
          <div class="card-meta">
            <span class="card-category">${course.category}</span>
            <span class="${badgeClass}">${course.badge_text}</span>
          </div>
          <div class="card-title">${course.title}</div>
          <div class="card-desc">${course.description}</div>
          <div class="card-footer">
            <div>
              <span class="card-price">$${course.price}</span>
              ${priceOld}
            </div>
            <div>
              <div class="card-rating">
                <span class="stars">${stars}</span>
                <span>${reviewCount}</span>
              </div>
            </div>
          </div>
          <br>
          <button class="card-cta" style="width:100%">Ver curso →</button>
        </div>
      </a>`;
}

// ─── 4. ACTUALIZAR INDEX.HTML ──────────────────────────────────────────────

function updateIndexHtml(courseData) {
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(`No se encontró index.html en: ${INDEX_PATH}`);
  }

  let html = fs.readFileSync(INDEX_PATH, "utf8");

  // Generar el bloque nuevo de cards
  const cardsHtml = courseData.courses.map(buildCourseCard).join("\n");

  // Reemplazar entre los marcadores <!-- COURSES_START --> y <!-- COURSES_END -->
  const startMarker = "<!-- COURSES_START -->";
  const endMarker = "<!-- COURSES_END -->";

  if (!html.includes(startMarker) || !html.includes(endMarker)) {
    throw new Error(
      "No se encontraron los marcadores <!-- COURSES_START --> y <!-- COURSES_END --> en index.html"
    );
  }

  const before = html.split(startMarker)[0];
  const after = html.split(endMarker)[1];
  const updatedHtml = `${before}${startMarker}\n${cardsHtml}\n    ${endMarker}${after}`;

  // Actualizar también la fecha de última actualización
  const dateStr = courseData.updated_at;
  const finalHtml = updatedHtml.replace(
    /<!-- LAST_UPDATED:.*?-->/,
    `<!-- LAST_UPDATED:${dateStr}-->`
  );

  fs.writeFileSync(INDEX_PATH, finalHtml, "utf8");
  console.log(`✅ index.html actualizado con ${courseData.courses.length} cursos`);
  console.log(`📅 Fecha: ${dateStr}`);
}

// ─── 5. GUARDAR LOG ────────────────────────────────────────────────────────

function saveLog(courseData) {
  const logDir = path.join(__dirname, "..", "logs");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const logFile = path.join(logDir, `courses-${courseData.updated_at}.json`);
  fs.writeFileSync(logFile, JSON.stringify(courseData, null, 2));
  console.log(`📝 Log guardado: ${logFile}`);
}

// ─── 6. MAIN ───────────────────────────────────────────────────────────────

async function main() {
  console.log("🤖 Agente de actualización de cursos iniciado");
  console.log("=".repeat(50));

  try {
    const courseData = await fetchCourses();
    updateIndexHtml(courseData);
    saveLog(courseData);

    console.log("=".repeat(50));
    console.log("✅ Actualización completada exitosamente");

    // Mostrar resumen
    courseData.courses.forEach((c, i) => {
      console.log(`  ${i + 1}. [${c.category}] ${c.title} — $${c.price}`);
    });
  } catch (err) {
    console.error("❌ Error en el agente:", err.message);
    process.exit(1);
  }
}

main();
