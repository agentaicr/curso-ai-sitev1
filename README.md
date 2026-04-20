# curso-ai.com 🤖

Hub de cursos de Inteligencia Artificial con afiliados de Hotmart.

## 🚀 Deploy en GitHub + Vercel

### 1. Sube a GitHub
```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/curso-ai.git
git push -u origin main
```

### 2. Conecta con Vercel
1. Ve a [vercel.com](https://vercel.com) → **Add New Project**
2. Importa tu repositorio de GitHub
3. Framework Preset: **Other**
4. Click **Deploy** ✅

### 3. Conecta tu dominio curso-ai.com
En Vercel → Settings → Domains → agrega `curso-ai.com`
Copia los nameservers de Vercel y apúntalos en tu registrador de dominio.

---

## 🔗 Cómo agregar tus links de afiliado de Hotmart

En `index.html` busca los comentarios `<!-- CARD 1 -->`, `<!-- CARD 2 -->`, etc.

Reemplaza `TU_LINK_HOTMART_1`, `TU_LINK_HOTMART_2`, etc. con tus URLs reales de afiliado:

```html
<!-- Ejemplo: -->
<a class="course-card" href="https://pay.hotmart.com/XXXXX?ref=TU_ID_AFILIADO" ...>
```

Para encontrar tu link de afiliado en Hotmart:
1. Ve a Hotmart → **Mercado de afiliados**
2. Busca el producto → **Solicitar afiliación**
3. Una vez aprobado → copia tu link único

---

## 📁 Estructura
```
/
├── index.html      # Página principal
├── vercel.json     # Config de Vercel
└── README.md
```

---

## 💡 Próximos pasos sugeridos
- Agregar Google Analytics (`gtag`) para rastrear clics
- Crear páginas individuales para cada categoría
- Agregar un blog de contenido sobre IA para SEO
- Conectar un formulario de email con Mailchimp/ConvertKit
