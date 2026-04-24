# Docs Portal

Portal de documentación técnica construido con Astro (SSR) + Tailwind CSS, consumiendo contenido de un CMS Strapi v5 headless.

## Requisitos previos

- Node.js 20 o superior
- npm 9 o superior
- Acceso a una instancia de Strapi v5 con el content type `documentation-space` configurado

## Inicio rápido

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd portal

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con los valores correctos (ver docs/env-variables.md)

# 4. Modo desarrollo
npm run dev
# → http://localhost:4321

# 5. Build de producción
npm run build

# 6. Ejecutar el servidor de producción (cPanel / VPS)
node dist/server/entry.mjs
```

## Variables de entorno obligatorias

| Variable | Descripción |
|---|---|
| `STRAPI_URL` | URL base de la API de Strapi sin slash final |
| `DOCUMENTATION_SPACE_SLUG` | Slug del space que renderiza este portal |
| `SUPPORTED_LOCALES` | Idiomas disponibles separados por coma (`es,en`) |
| `DEFAULT_LOCALE` | Locale por defecto (`es`) |

> La variable `STRAPI_API_TOKEN` es opcional; solo se necesita para acceder a contenido en borrador (Live Preview).

## Documentación completa

| Documento | Descripción |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Arquitectura general y decisiones de diseño |
| [docs/env-variables.md](docs/env-variables.md) | Todas las variables de entorno explicadas |
| [docs/strapi-integration.md](docs/strapi-integration.md) | Cómo se conecta el portal al CMS |
| [docs/theming.md](docs/theming.md) | Sistema de temas dinámico desde Strapi |
| [docs/content-blocks.md](docs/content-blocks.md) | Tipos de bloque de contenido soportados |
| [docs/deployment.md](docs/deployment.md) | Guía de despliegue en cPanel y otros entornos |
| [docs/adding-features.md](docs/adding-features.md) | Cómo extender el portal |

## Tecnologías

- **Astro 5** — Framework SSR
- **TypeScript** — `strict: true`
- **Tailwind CSS 3** — Estilos utilitarios
- **Shiki** — Syntax highlighting para bloques de código
- **@astrojs/node** — Adaptador para despliegue en Node.js
