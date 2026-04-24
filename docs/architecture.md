# Arquitectura del portal

## Visión general

El portal es una aplicación **SSR (Server-Side Rendering)** construida con Astro. Cada request al servidor genera la página en tiempo real consultando el CMS Strapi. No hay caché de datos en el frontend; Strapi es la fuente de verdad.

```
Browser → Node.js (Astro SSR) → Strapi API → Response HTML
```

## Por qué SSR y no SSG

El portal es SSR (no generación estática) porque:

1. El contenido puede actualizarse en Strapi en cualquier momento y debe verse reflejado de inmediato sin rebuild.
2. El tema visual (colores, tipografía, espaciados) se lee de la API en cada request y se inyecta como CSS custom properties.
3. Las rutas son dinámicas: no se conocen todos los slugs en tiempo de compilación.

## Estructura de directorios

```
portal/
├── src/
│   ├── components/
│   │   ├── blocks/          # Renderizado de bloques de contenido de Strapi
│   │   │   ├── BlockRenderer.astro   # Dispatcher principal
│   │   │   └── CodeBlock.astro       # Syntax highlighting con Shiki
│   │   ├── layout/          # Componentes estructurales de la página
│   │   │   ├── Header.astro          # Navbar con secciones y controles
│   │   │   ├── Sidebar.astro         # Navegación lateral
│   │   │   ├── TableOfContents.astro # TOC derivado del contenido del artículo
│   │   │   └── Footer.astro          # Pie de página
│   │   └── ui/              # Componentes genéricos reutilizables
│   │       ├── ArticleNav.astro      # Navegación anterior/siguiente
│   │       ├── Breadcrumbs.astro     # Migas de pan
│   │       ├── LanguageSwitcher.astro# Selector de idioma
│   │       └── ThemeToggle.astro     # Toggle dark/light mode
│   │
│   ├── layouts/
│   │   ├── BaseLayout.astro   # Shell HTML + inyección del tema + meta tags
│   │   └── DocsLayout.astro   # Layout completo: Header + Sidebar + TOC + Footer
│   │
│   ├── pages/               # File-based routing de Astro
│   │   ├── index.astro                              # Redirect a /[defaultLocale]
│   │   ├── 500.astro                                # Página de error personalizada
│   │   └── [locale]/
│   │       ├── index.astro                          # Home: hero + grid de categorías
│   │       └── [categorySlug]/
│   │           └── [articleSlug].astro              # Página de artículo
│   │
│   ├── lib/
│   │   ├── strapi/
│   │   │   └── client.ts      # Cliente HTTP para la API de Strapi
│   │   ├── domain/
│   │   │   └── types.ts       # Tipos TypeScript de todos los content types
│   │   └── utils/
│   │       ├── config.ts      # Lee variables de entorno (locales, defaultLocale)
│   │       ├── page-data.ts   # Carga los datos comunes de cada página
│   │       ├── theme.ts       # Convierte tokens de Strapi a CSS custom properties
│   │       ├── toc.ts         # Extrae headings del content[] para el TOC
│   │       └── slugify.ts     # Genera IDs de ancla desde texto de headings
│   │
│   ├── styles/
│   │   └── global.css         # Tailwind base + estilos de prose-docs + code blocks
│   └── env.d.ts               # Tipos de variables de entorno para TypeScript
│
├── docs/                      # Esta documentación
├── .env                       # Variables locales (no se sube al repo)
├── .env.example               # Plantilla de variables de entorno
├── astro.config.mjs           # Configuración de Astro (output: server, node adapter)
├── tailwind.config.mjs        # Tailwind con CSS custom properties como tokens
└── tsconfig.json              # TypeScript strict mode + alias @/*
```

## Flujo de datos por página

### Página de artículo (`/[locale]/[categorySlug]/[articleSlug]`)

```
1. Recibir request con locale, categorySlug, articleSlug
2. Validar que el locale existe en SUPPORTED_LOCALES
3. getArticleBySlug(slug, locale)       → obtener artículo + categoría + sección
4. loadCommonData(locale, sectionSlug)  → en paralelo:
     - getSpaceSettings()               → tema visual
     - getSections(locale)              → items del navbar
     - getCategoriesWithArticles(locale, section) → sidebar
5. getArticlesByCategory(categorySlug)  → artículos hermanos para prev/next
6. extractToc(article.content)          → tabla de contenidos
7. Renderizar DocsLayout con todos los datos
```

### Página de inicio (`/[locale]`)

```
1. Recibir locale (+ ?section= opcional)
2. loadCommonData(locale, sectionSlug)
3. Si hay sección activa: usar categorías del sidebar
   Si no: cargar todas las categorías agrupadas por sección
4. Renderizar hero + grid de categorías
```

## Decisiones de arquitectura

### CSS custom properties para el tema

El tema no usa clases de Tailwind hardcodeadas sino variables CSS generadas en runtime desde los tokens de Strapi. Esto permite que el backend controle 100% la apariencia sin rebuild del frontend.

```
Strapi (theme.colors, theme.typography, ...) 
  → buildThemeCss() en src/lib/utils/theme.ts
  → <style> inline en <head> de BaseLayout
  → CSS custom properties: --bg-primary, --text-primary, etc.
  → Tailwind usa esas variables mediante su config extendida
```

### Dark mode sin flash

El toggle de dark/light mode se implementa con `class="dark"` en el `<html>`. Para evitar el parpadeo (flash of incorrect theme) al cargar, hay un script inline en el `<head>` (antes de que se pinte nada) que lee `localStorage` y aplica la clase antes del primer render.

### Syntax highlighting servidor

Shiki corre **en el servidor** durante el render SSR, no en el cliente. Genera HTML pre-coloreado para tema claro y oscuro. El CSS muestra uno u otro según la clase `.dark`. Cero JavaScript de highlighting en el cliente.

### Separación de concerns

- Las páginas en `src/pages/` solo orquestan: reciben params, llaman a `loadCommonData`, pasan datos a layouts.
- Los layouts manejan la estructura visual.
- `src/lib/` contiene toda la lógica: acceso a datos, transformaciones, utilidades.
- Los componentes reciben datos tipados por props; no hacen fetch propio.
