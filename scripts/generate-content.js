/**
 * generate-content.js
 * Agente que genera posts y stories para Instagram 3x por semana
 * Envía resumen por email a agent.ai.cr@gmail.com
 */

const fs = require("fs");
const path = require("path");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GMAIL_USER = "agent.ai.cr@gmail.com";
const GMAIL_PASSWORD = process.env.GMAIL_PASSWORD;

const AFFILIATES_PATH = path.join(__dirname, "..", "affiliates.json");
const CONTENT_DIR = path.join(__dirname, "..", "content");
const POSTS_PATH = path.join(CONTENT_DIR, "posts.md");

if (!ANTHROPIC_API_KEY) {
  console.error("❌ Falta ANTHROPIC_API_KEY");
  process.exit(1);
}

function getCourses() {
  if (!fs.existsSync(AFFILIATES_PATH)) return [];
  return JSON.parse(fs.readFileSync(AFFILIATES_PATH, "utf8")).courses || [];
}

function buildPrompt(courses) {
  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  const courseList = courses.map(c =>
    `- ${c.name} (${c.category || "IA"}): ${c.affiliate_url}`
  ).join("\n");

  return `Eres experto en marketing de contenidos para Instagram sobre Inteligencia Artificial.

Hoy es ${today}.

Cursos de afiliado disponibles:
${courseList}

Genera contenido para Instagram. Alterna entre: tips de IA gratis, promoción de cursos, frases motivacionales, tendencias de IA.

Reglas:
- Post: 150-300 palabras con 10-15 hashtags al final
- Story: máximo 3 líneas cortas e impactantes
- Usa emojis naturalmente
- Español latinoamericano
- Tono educativo, cercano y motivador
- Si promocionas un curso incluye el link real

Responde SOLO con este JSON sin texto adicional:
{
  "date": "${today}",
  "post": {
    "type": "tip|promo|tendencia|frase",
    "caption": "texto completo con emojis y hashtags",
    "course_featured": "nombre del curso o null"
  },
  "story": {
    "line1": "primera línea impactante",
    "line2": "segunda línea",
    "line3": "llamado a la acción",
    "link": "link afiliado o null"
  }
}`;
}

async function generateContent(courses) {
  console.log("🤖 Generando contenido con Claude...");
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
      messages: [{ role: "user", content: buildPrompt(courses) }],
    }),
  });

  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";

  // Limpiar el texto antes de parsear
  let jsonText = text.trim();
  jsonText = jsonText.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

  // Extraer solo el bloque JSON
  const match = jsonText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No se encontró JSON en la respuesta");

  // Limpiar caracteres problemáticos
  let cleaned = match[0]
    .replace(/[\u0000-\u001F\u007F]/g, " ")  // caracteres de control
    .replace(/\n/g, "\\n")                    // saltos de línea
    .replace(/\r/g, "")                       // retornos de carro
    .replace(/\\n\\n/g, "\\n")               // dobles saltos
    .replace(/"/g, '"')                       // comillas especiales
    .replace(/"/g, '"');                      // comillas especiales

  try {
    return JSON.parse(cleaned);
  } catch(e) {
    // Si falla, devolver contenido por defecto
    console.log("⚠️ JSON inválido, usando contenido por defecto");
    return {
      date: new Date().toLocaleDateString("es-ES"),
      post: {
        type: "tip",
        caption: "🤖 La Inteligencia Artificial está cambiando el mundo.\n\n¿Ya estás aprovechando estas herramientas?\n\n👉 Link en bio para ver nuestros cursos\n\n#IA #InteligenciaArtificial #CursoIA #AprendeIA",
        course_featured: null
      },
      story: {
        line1: "🤖 ¿Usas IA en tu trabajo?",
        line2: "Aprende con los mejores cursos",
        line3: "👆 Link en bio",
        link: null
      }
    };
  }
}

function saveToFile(content) {
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });

  const entry = `
---
## 📅 ${content.date}

### 📸 POST (${content.post.type.toUpperCase()})
${content.post.course_featured ? `> Curso: ${content.post.course_featured}\n` : ""}
\`\`\`
${content.post.caption}
\`\`\`

### 📱 STORY
\`\`\`
${content.story.line1}
${content.story.line2}
${content.story.line3}${content.story.link ? `\n🔗 ${content.story.link}` : ""}
\`\`\`
`;

  const existing = fs.existsSync(POSTS_PATH)
    ? fs.readFileSync(POSTS_PATH, "utf8")
    : "# 📲 Contenido Instagram — curso-ai.com\n";

  const parts = existing.split("\n---\n");
  const newContent = parts[0] + entry + (parts.length > 1 ? "\n---\n" + parts.slice(1).join("\n---\n") : "");
  fs.writeFileSync(POSTS_PATH, newContent, "utf8");
  console.log("✅ Guardado en content/posts.md");
}

async function sendEmail(content) {
  if (!GMAIL_PASSWORD) {
    console.log("⚠️ GMAIL_PASSWORD no configurado — saltando email");
    return;
  }

  // Usar nodemailer via require dinámico
  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch {
    console.log("⚠️ nodemailer no instalado — saltando email");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_PASSWORD },
  });

  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f5f5;padding:20px}
  .header{background:linear-gradient(135deg,#1a6fff,#00cfff);color:white;border-radius:12px;padding:24px;text-align:center;margin-bottom:16px}
  .card{background:white;border-radius:12px;padding:24px;margin-bottom:16px;border:1px solid #e0e0e0}
  .caption{background:#f8f9ff;border-left:3px solid #1a6fff;padding:16px;border-radius:0 8px 8px 0;font-size:14px;line-height:1.6;white-space:pre-wrap}
  .story{background:linear-gradient(135deg,#020818,#041830);color:white;border-radius:12px;padding:24px;text-align:center}
  .sl{font-size:20px;font-weight:bold;margin:8px 0}
  .badge{display:inline-block;background:#e8f0ff;color:#1a6fff;padding:4px 12px;border-radius:100px;font-size:12px;font-weight:bold;margin-bottom:12px}
  .footer{text-align:center;color:#999;font-size:12px;margin-top:20px}
</style></head><body>
<div class="header"><h1 style="margin:0">🤖 Contenido para Instagram</h1><p style="margin:8px 0 0;opacity:.9">${content.date}</p></div>
<div class="card">
  <div class="badge">📸 POST — ${content.post.type.toUpperCase()}</div>
  ${content.post.course_featured ? `<p style="color:#666;font-size:13px">Curso: <strong>${content.post.course_featured}</strong></p>` : ""}
  <div class="caption">${content.post.caption}</div>
</div>
<div class="card">
  <p style="color:#1a6fff;font-weight:bold;margin-top:0">📱 STORY</p>
  <div class="story">
    <div class="sl">${content.story.line1}</div>
    <div class="sl">${content.story.line2}</div>
    <div class="sl">${content.story.line3}</div>
    ${content.story.link ? `<div style="color:#00cfff;margin-top:12px;font-size:14px">🔗 ${content.story.link}</div>` : ""}
  </div>
</div>
<div class="footer"><p>Generado por el agente de curso-ai.com · Ver historial en GitHub → content/posts.md</p></div>
</body></html>`;

  await transporter.sendMail({
    from: `"Agente curso-ai" <${GMAIL_USER}>`,
    to: GMAIL_USER,
    subject: `📲 Contenido Instagram — ${content.date}`,
    html,
  });

  console.log(`✅ Email enviado a ${GMAIL_USER}`);
}

async function main() {
  console.log("🚀 Agente de contenido Instagram iniciado");
  console.log("=".repeat(50));
  try {
    const courses = getCourses();
    console.log(`📦 ${courses.length} cursos cargados`);
    const content = await generateContent(courses);
    console.log(`✅ Tipo de contenido: ${content.post.type}`);
    saveToFile(content);
    try { await sendEmail(content); } catch(e) { console.log("⚠️ Email omitido:", e.message); }
    console.log("=".repeat(50));
    console.log("✅ Completado");
    console.log(`📸 ${content.post.caption.substring(0, 80)}...`);
    console.log(`📱 ${content.story.line1}`);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
