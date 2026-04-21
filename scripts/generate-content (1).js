/**
 * generate-content.js
 * Agente completo de Instagram — genera texto + imagen con IA
 * Claude genera el copy, DALL-E genera la imagen
 * Corre lunes, miércoles y viernes via GitHub Actions
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const AFFILIATES_PATH = path.join(__dirname, "..", "affiliates.json");
const CONTENT_DIR = path.join(__dirname, "..", "content");
const POSTS_PATH = path.join(CONTENT_DIR, "posts.md");
const IMAGES_DIR = path.join(CONTENT_DIR, "images");

if (!ANTHROPIC_API_KEY) { console.error("❌ Falta ANTHROPIC_API_KEY"); process.exit(1); }
if (!OPENAI_API_KEY)    { console.error("❌ Falta OPENAI_API_KEY");    process.exit(1); }

// ─── HELPERS ──────────────────────────────────────────────────────────────

function getCourses() {
  if (!fs.existsSync(AFFILIATES_PATH)) return [];
  return JSON.parse(fs.readFileSync(AFFILIATES_PATH, "utf8")).courses || [];
}

function getDateStr() {
  return new Date().toISOString().split("T")[0];
}

function getReadableDate() {
  return new Date().toLocaleDateString("es-ES", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

// Rotar entre 4 tipos de contenido
function getContentType() {
  const types = ["tip", "promo", "tendencia", "frase"];
  const dayOfYear = Math.floor(Date.now() / 86400000);
  return types[dayOfYear % types.length];
}

// Descargar imagen desde URL y guardarla
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

// ─── PASO 1: GENERAR TEXTO CON CLAUDE ─────────────────────────────────────

async function generateText(courses, contentType) {
  console.log(`📝 Generando texto (tipo: ${contentType})...`);

  const courseList = courses.map(c =>
    `- ${c.name} (${c.category || "IA"}): ${c.affiliate_url}`
  ).join("\n");

  const typeInstructions = {
    tip: "Un tip práctico de IA que la gente pueda aplicar hoy. No promociones un curso, da valor gratis.",
    promo: `Promociona UNO de estos cursos de forma natural y persuasiva:\n${courseList}\nIncluye el link real del curso.`,
    tendencia: "Una tendencia actual de IA que está cambiando el mundo. Menciona herramientas reales.",
    frase: "Una frase motivacional sobre IA y el futuro del trabajo. Inspira a aprender."
  };

  const prompt = `Eres experto en marketing de contenidos para Instagram sobre Inteligencia Artificial en español latinoamericano.

Hoy es ${getReadableDate()}. Tipo de post: ${contentType.toUpperCase()}

Instrucciones: ${typeInstructions[contentType]}

Genera el contenido y también un prompt en inglés para DALL-E que genere una imagen profesional para este post.

La imagen debe ser: moderna, futurista, colores azul eléctrico y negro, estilo tecnológico, sin texto en la imagen, apta para Instagram 1080x1080.

Responde SOLO con este JSON sin texto adicional:
{
  "type": "${contentType}",
  "caption": "texto del post con emojis y 10 hashtags al final en español",
  "story_line1": "frase corta impactante máximo 6 palabras",
  "story_line2": "segunda frase máximo 6 palabras",
  "story_line3": "llamado a la acción máximo 5 palabras",
  "story_link": "link de afiliado si es promo o null",
  "course_featured": "nombre del curso si es promo o null",
  "image_prompt": "detailed prompt in English for DALL-E to generate a professional Instagram image related to this post, futuristic style, electric blue and black colors, no text in image, 1:1 ratio"
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error ${response.status}`);
  const data = await response.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";

  let jsonText = text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
  const match = jsonText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No se encontró JSON en respuesta de Claude");

  try {
    return JSON.parse(match[0]);
  } catch {
    // Limpiar y reintentar
    const cleaned = match[0]
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/(?<!\\)"/g, '\\"')
      .replace(/^{/, '{')
      .replace(/}$/, '}');
    return JSON.parse(match[0].replace(/\n/g, "\\n").replace(/\r/g, ""));
  }
}

// ─── PASO 2: GENERAR IMAGEN CON DALL-E ────────────────────────────────────

async function generateImage(imagePrompt, dateStr) {
  console.log("🎨 Generando imagen con DALL-E...");

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DALL-E error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) throw new Error("DALL-E no devolvió imagen");

  // Descargar y guardar la imagen
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const imagePath = path.join(IMAGES_DIR, `post-${dateStr}.png`);
  await downloadImage(imageUrl, imagePath);

  console.log(`✅ Imagen guardada: content/images/post-${dateStr}.png`);
  return `content/images/post-${dateStr}.png`;
}

// ─── PASO 3: GUARDAR TODO EN posts.md ─────────────────────────────────────

function saveContent(content, imagePath, dateStr) {
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });

  const entry = `
---
## 📅 ${getReadableDate()} — ${content.type.toUpperCase()}

### 🖼️ IMAGEN
![Post ${dateStr}](${imagePath})
> Archivo: \`${imagePath}\`
> Descárgala desde GitHub para subirla a Instagram

### 📸 POST — Caption completo
\`\`\`
${content.caption}
\`\`\`
${content.course_featured ? `> 🎓 Curso promocionado: ${content.course_featured}\n` : ""}

### 📱 STORY — 3 líneas
\`\`\`
${content.story_line1}
${content.story_line2}
${content.story_line3}${content.story_link ? `\n🔗 ${content.story_link}` : ""}
\`\`\`

### 📋 Instrucciones para publicar
1. Descarga la imagen de arriba desde GitHub
2. Abre Instagram → Nueva publicación → sube la imagen
3. Copia el caption completo y pégalo
4. Publica el post
5. Luego crea una Story nueva con las 3 líneas

`;

  const existing = fs.existsSync(POSTS_PATH)
    ? fs.readFileSync(POSTS_PATH, "utf8")
    : "# 📲 Contenido Instagram — curso-ai.com\n> Generado automáticamente por el agente de IA\n";

  const parts = existing.split("\n---\n");
  const newContent = parts[0] + entry + (parts.length > 1 ? "\n---\n" + parts.slice(1).join("\n---\n") : "");
  fs.writeFileSync(POSTS_PATH, newContent, "utf8");
  console.log("✅ Guardado en content/posts.md");
}

// ─── MAIN ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Agente de contenido Instagram iniciado");
  console.log("=".repeat(50));

  try {
    const courses = getCourses();
    const contentType = getContentType();
    const dateStr = getDateStr();

    console.log(`📦 ${courses.length} cursos cargados`);
    console.log(`📅 Fecha: ${dateStr}`);
    console.log(`📌 Tipo: ${contentType}`);

    // Paso 1: Generar texto con Claude
    const content = await generateText(courses, contentType);
    console.log(`✅ Texto generado`);
    console.log(`📝 Caption: ${content.caption.substring(0, 60)}...`);

    // Paso 2: Generar imagen con DALL-E
    const imagePath = await generateImage(content.image_prompt, dateStr);

    // Paso 3: Guardar todo
    saveContent(content, imagePath, dateStr);

    console.log("=".repeat(50));
    console.log("✅ Completado exitosamente");
    console.log("");
    console.log("📲 Para publicar en Instagram:");
    console.log(`   1. Descarga: ${imagePath}`);
    console.log(`   2. Abre content/posts.md y copia el caption`);
    console.log(`   3. Publica en Instagram`);

  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
