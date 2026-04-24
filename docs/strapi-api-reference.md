# Referencia Completa de la API REST — Strapi Docs Platform

> **Versión del CMS:** Strapi v5
> **Base URL local:** `http://localhost:1337`
> **Base URL producción:** según variable `STRAPI_API_URL` configurada en el frontend

---

## Índice

1. [Contexto del proyecto](#1-contexto-del-proyecto)
2. [Jerarquía de Content Types](#2-jerarquía-de-content-types)
3. [Autenticación](#3-autenticación)
4. [Convenciones globales de la API](#4-convenciones-globales-de-la-api)
5. [Endpoints — Referencia completa](#5-endpoints--referencia-completa)
   - [GET /api/documentation-spaces](#get-apidocumentation-spaces)
   - [GET /api/documentation-sections](#get-apidocumentation-sections)
   - [GET /api/documentation-categories](#get-apidocumentation-categories)
   - [GET /api/documentation-articles](#get-apidocumentation-articles)
   - [GET /api/documentation-space-settings](#get-apidocumentation-space-settings)
6. [Componentes del tema (theme.\*)](#6-componentes-del-tema-theme)
7. [Formato de bloques (`content`)](#7-formato-de-bloques-content)
8. [Personalización mediante slugs](#8-personalización-mediante-slugs)
9. [Flujo de datos completo](#9-flujo-de-datos-completo)
10. [Propuestas de diseño por jerarquía](#10-propuestas-de-diseño-por-jerarquía)
11. [Errores comunes](#11-errores-comunes)

---

## 1. Contexto del proyecto

Este backend expone un CMS headless diseñado para servir **múltiples portales de documentación técnica** de forma completamente independiente desde una sola instancia de Strapi. Cada portal se llama **Documentation Space** y tiene su propio contenido, estructura de navegación y configuración visual.

El sistema soporta:

- **Multi-espacio**: múltiples portales desde la misma instancia de Strapi.
- **Multidioma**: contenido en español (`es`) e inglés (`en`) por separado.
- **Draft & Publish**: los artículos pueden estar en borrador (solo visibles con token) o publicados (visibles al público).
- **Configuración visual por espacio**: colores, tipografía, logos, SEO y layout completamente personalizables por espacio.

---

## 2. Jerarquía de Content Types

```
documentation-space                     ← Raíz. Cada portal independiente.
  └── documentation-section             ← Ítem de navegación (navbar)
        └── documentation-category      ← Grupo en el sidebar
              └── documentation-article ← Página de contenido

documentation-space-setting             ← Config visual ligada 1:1 a un space
```

### Relaciones entre Content Types

| Tipo | Relación | Target |
|---|---|---|
| `documentation-section` | `manyToOne` → | `documentation-space` |
| `documentation-category` | `manyToOne` → | `documentation-section` |
| `documentation-article` | `manyToOne` → | `documentation-category` |
| `documentation-space-setting` | `oneToOne` → | `documentation-space` |

El **espacio no está referenciado directamente** en `documentation-category` ni en `documentation-article`. Se obtiene a través de la cadena:

```
article → category → section → space
```

El middleware `global::documentation-space-filter` resuelve esta cadena automáticamente cuando el frontend envía `?space=<slug>`.

---

## 3. Autenticación

### Endpoints públicos (sin token)

Todos los endpoints listados en esta documentación son **públicos**. No requieren cabecera de autenticación. Los permisos se auto-configuran en el bootstrap del CMS.

Restricciones del rol público:
- Solo retorna entradas con `publishedAt != null` (publicadas).
- Solo permite operaciones `find` y `findOne`.
- No permite ver borradores.

```bash
# Ejemplo: petición pública (sin token)
curl "http://localhost:1337/api/documentation-categories?space=mi-portal&locale=es"
```

### Endpoints autenticados (con token Read-only)

Para acceder a contenido en estado **Draft** (borradores), por ejemplo para Live Preview:

```bash
curl -H "Authorization: Bearer TU_API_TOKEN_AQUI" \
  "http://localhost:1337/api/documentation-articles?space=mi-portal&locale=es&status=draft"
```

El token Read-only se genera en: **Settings → API Tokens → Create new API Token** (tipo: Read-only).

---

## 4. Convenciones globales de la API

### 4.1 Formato de respuesta (Strapi v5)

En Strapi v5 los campos están **directamente** en el objeto. No existe wrapper `attributes` como en v4.

```json
{
  "data": [
    {
      "id": 1,
      "documentId": "abc123xyz",
      "title": "Mi artículo",
      "slug": "mi-articulo",
      "locale": "es",
      "publishedAt": "2026-01-15T10:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 4,
      "total": 87
    }
  }
}
```

### 4.2 Identificadores

| Campo | Tipo | Uso correcto |
|---|---|---|
| `id` | entero | ID interno de base de datos. No usar en URLs públicas. |
| `documentId` | string | ID estable del documento. Usar en rutas `GET /api/recurso/:documentId`. |

### 4.3 Parámetro `?space=<slug>` — Obligatorio en 4 de 5 endpoints

El middleware intercepta todas las peticiones GET a secciones, categorías, artículos y configuración de espacio. **Si no se envía `?space=<slug>`, la API devuelve HTTP 400**.

| Endpoint | `?space` requerido |
|---|---|
| `GET /api/documentation-spaces` | **No** |
| `GET /api/documentation-sections` | **Sí** |
| `GET /api/documentation-categories` | **Sí** |
| `GET /api/documentation-articles` | **Sí** |
| `GET /api/documentation-space-settings` | **Sí** |

### 4.4 Parámetro `?locale=<code>`

Strapi i18n. Valores válidos: `es` (español), `en` (inglés).

Si no se especifica, Strapi retorna el locale por defecto configurado en el admin.

### 4.5 Parámetro `?section=<slug>` — Filtro opcional

Disponible en categorías y artículos. Filtra el contenido por sección dentro del espacio.

### 4.6 Paginación

| Parámetro | Tipo | Default | Máximo |
|---|---|---|---|
| `pagination[page]` | entero | 1 | — |
| `pagination[pageSize]` | entero | 25 | 100 |

Para obtener todos los registros de una sola vez: `pagination[pageSize]=100`.

### 4.7 Filtros

Sintaxis: `filters[campo][$operador]=valor`

| Operador | Significado |
|---|---|
| `$eq` | Igual a |
| `$ne` | Distinto de |
| `$contains` | Contiene (texto, case-insensitive) |
| `$in` | En lista de valores |
| `$null` | Es nulo |

Filtros anidados en relaciones: `filters[relacion][campo][$eq]=valor`

### 4.8 Ordenamiento

```
sort=campo:asc
sort=campo1:asc,campo2:desc
```

### 4.9 Populate

Por defecto Strapi **no retorna relaciones ni medios**. Deben solicitarse explícitamente:

```
# Una relación completa
populate[category]=true

# Solo campos específicos de una relación
populate[category][fields][0]=name
populate[category][fields][1]=slug

# Relaciones anidadas
populate[category][populate][documentation_section][fields][0]=name

# Media (imágenes)
populate[favicon][fields][0]=url
populate[favicon][fields][1]=alternativeText
populate[favicon][fields][2]=width
populate[favicon][fields][3]=height
```

---

## 5. Endpoints — Referencia completa

---

### GET /api/documentation-spaces

Lista todos los espacios de documentación activos.

**Autenticación:** Pública
**Requiere `?space`:** No
**i18n:** No
**draftAndPublish:** No

#### Parámetros disponibles

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `filters[slug][$eq]` | string | No | Filtrar por slug exacto |
| `filters[is_active][$eq]` | boolean | No | Filtrar por estado activo |
| `pagination[page]` | entero | No | Página |
| `pagination[pageSize]` | entero | No | Registros por página (máx 100) |

#### Ejemplos cURL

```bash
# Listar todos los espacios activos
curl "http://localhost:1337/api/documentation-spaces"

# Obtener un espacio específico por slug
curl "http://localhost:1337/api/documentation-spaces?filters[slug][\$eq]=mi-portal"

# Obtener detalle por documentId
curl "http://localhost:1337/api/documentation-spaces/abc123documentId"
```

#### Respuesta exitosa

```json
{
  "data": [
    {
      "id": 1,
      "documentId": "tyz789uvw",
      "name": "Portal Principal",
      "slug": "portal-principal",
      "description": "Documentación técnica del sistema principal.",
      "is_active": true,
      "createdAt": "2026-01-10T08:00:00.000Z",
      "updatedAt": "2026-03-15T14:30:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 1,
      "total": 2
    }
  }
}
```

#### Tipo de datos: `DocumentationSpace`

```
DocumentationSpace {
  id:          number
  documentId:  string
  name:        string           // Requerido, único
  slug:        string           // Auto-generado desde name
  description: string | null
  is_active:   boolean          // Default: true
  createdAt:   string           // ISO 8601
  updatedAt:   string           // ISO 8601
}
```

---

### GET /api/documentation-sections

Lista las secciones de navegación (ítems del navbar) de un espacio.

**Autenticación:** Pública
**Requiere `?space`:** **Sí**
**i18n:** Sí (`name`, `slug`, `description` varían por locale)
**draftAndPublish:** Sí

#### Parámetros disponibles

| Parámetro | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `space` | string | **Sí** | — | Slug del espacio |
| `locale` | string | No | `es` | Idioma (`es` o `en`) |
| `sort` | string | No | — | Ej: `order:asc` |
| `pagination[pageSize]` | entero | No | 25 | Máx 100 |
| `populate[documentation_space]` | mixed | No | — | Incluir datos del espacio padre |
| `filters[slug][$eq]` | string | No | — | Filtrar por slug |

#### Ejemplos cURL

```bash
# Listar secciones del navbar ordenadas
curl "http://localhost:1337/api/documentation-sections?space=portal-principal&locale=es&sort=order:asc"

# Con paginación completa (todas las secciones de una vez)
curl "http://localhost:1337/api/documentation-sections?space=portal-principal&locale=es&sort=order:asc&pagination[pageSize]=100"

# Obtener sección por documentId
curl "http://localhost:1337/api/documentation-sections/sec456documentId?locale=es"

# Obtener sección por slug
curl "http://localhost:1337/api/documentation-sections?space=portal-principal&locale=es&filters[slug][\$eq]=guia-de-inicio"

# Versión en inglés
curl "http://localhost:1337/api/documentation-sections?space=portal-principal&locale=en&sort=order:asc"
```

#### Respuesta exitosa

```json
{
  "data": [
    {
      "id": 1,
      "documentId": "sec456documentId",
      "name": "Guía de Inicio",
      "slug": "guia-de-inicio",
      "description": "Todo lo necesario para comenzar.",
      "order": 1,
      "icon": "book",
      "locale": "es",
      "publishedAt": "2026-01-15T10:00:00.000Z",
      "createdAt": "2026-01-12T08:00:00.000Z",
      "updatedAt": "2026-03-20T12:00:00.000Z"
    },
    {
      "id": 2,
      "documentId": "sec789documentId",
      "name": "Referencia API",
      "slug": "referencia-api",
      "description": null,
      "order": 2,
      "icon": "api",
      "locale": "es",
      "publishedAt": "2026-01-15T10:00:00.000Z",
      "createdAt": "2026-01-12T08:00:00.000Z",
      "updatedAt": "2026-03-20T12:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": { "page": 1, "pageSize": 25, "pageCount": 1, "total": 2 }
  }
}
```

#### Tipo de datos: `DocumentationSection`

```
DocumentationSection {
  id:           number
  documentId:   string
  name:         string        // LOCALIZADO — varía por locale
  slug:         string        // LOCALIZADO — varía por locale
  description:  string | null // LOCALIZADO
  order:        number        // Compartido entre locales
  icon:         string | null // Compartido entre locales — identificador de ícono
  locale:       string        // "es" | "en"
  publishedAt:  string | null // null = borrador
  createdAt:    string
  updatedAt:    string
}
```

**Nota sobre `icon`:** El campo almacena un identificador de texto libre (ej: `"book"`, `"api"`, `"settings"`, `"rocket"`). El frontend decide cómo renderizarlo.

---

### GET /api/documentation-categories

Lista las categorías (grupos del sidebar) de un espacio, opcionalmente filtradas por sección.

**Autenticación:** Pública
**Requiere `?space`:** **Sí**
**i18n:** Sí (`name`, `slug`, `description` varían por locale)
**draftAndPublish:** Sí

#### Parámetros disponibles

| Parámetro | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `space` | string | **Sí** | — | Slug del espacio |
| `locale` | string | No | `es` | Idioma |
| `section` | string | No | — | Slug de sección para filtrar |
| `sort` | string | No | — | Ej: `order:asc` |
| `pagination[pageSize]` | entero | No | 25 | Máx 100 |
| `populate[articles]` | mixed | No | — | Incluir artículos de cada categoría |
| `populate[documentation_section]` | mixed | No | — | Incluir datos de la sección padre |
| `filters[slug][$eq]` | string | No | — | Filtrar por slug |

#### Ejemplos cURL

```bash
# Todas las categorías de un espacio
curl "http://localhost:1337/api/documentation-categories?space=portal-principal&locale=es&sort=order:asc"

# Categorías de una sección específica (sidebar al seleccionar sección)
curl "http://localhost:1337/api/documentation-categories?space=portal-principal&section=guia-de-inicio&locale=es&sort=order:asc"

# Categorías con sus artículos (solo campos necesarios para navegación)
curl "http://localhost:1337/api/documentation-categories?\
space=portal-principal\
&section=guia-de-inicio\
&locale=es\
&sort=order:asc\
&pagination[pageSize]=100\
&populate[articles][fields][0]=title\
&populate[articles][fields][1]=slug\
&populate[articles][fields][2]=order"

# Incluir la sección padre en la respuesta
curl "http://localhost:1337/api/documentation-categories?\
space=portal-principal\
&locale=es\
&populate[documentation_section][fields][0]=name\
&populate[documentation_section][fields][1]=slug"

# Obtener categoría por slug
curl "http://localhost:1337/api/documentation-categories?\
space=portal-principal\
&locale=es\
&filters[slug][\$eq]=instalacion"
```

#### Respuesta exitosa (con artículos populados)

```json
{
  "data": [
    {
      "id": 3,
      "documentId": "cat123documentId",
      "name": "Instalación",
      "slug": "instalacion",
      "description": "Pasos para instalar y configurar el sistema.",
      "order": 1,
      "locale": "es",
      "publishedAt": "2026-01-15T10:00:00.000Z",
      "createdAt": "2026-01-12T09:00:00.000Z",
      "updatedAt": "2026-03-20T12:00:00.000Z",
      "articles": [
        {
          "id": 10,
          "documentId": "art001documentId",
          "title": "Requisitos del sistema",
          "slug": "requisitos-del-sistema",
          "order": 1
        },
        {
          "id": 11,
          "documentId": "art002documentId",
          "title": "Instalación en Linux",
          "slug": "instalacion-en-linux",
          "order": 2
        }
      ]
    }
  ],
  "meta": {
    "pagination": { "page": 1, "pageSize": 25, "pageCount": 1, "total": 3 }
  }
}
```

#### Tipo de datos: `DocumentationCategory`

```
DocumentationCategory {
  id:                    number
  documentId:            string
  name:                  string        // LOCALIZADO
  slug:                  string        // LOCALIZADO
  description:           string | null // LOCALIZADO
  order:                 number        // Compartido entre locales
  locale:                string
  publishedAt:           string | null
  createdAt:             string
  updatedAt:             string
  articles?:             Article[]     // Solo si populate[articles]=true
  documentation_section?: Section     // Solo si populate[documentation_section]=true
}
```

---

### GET /api/documentation-articles

Lista o busca artículos de documentación.

**Autenticación:** Pública
**Requiere `?space`:** **Sí**
**i18n:** Sí (`title`, `slug`, `content`, `excerpt`, `seoTitle`, `seoDescription` varían por locale)
**draftAndPublish:** Sí

#### Parámetros disponibles

| Parámetro | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `space` | string | **Sí** | — | Slug del espacio |
| `locale` | string | No | `es` | Idioma |
| `section` | string | No | — | Filtrar por sección |
| `sort` | string | No | — | Ej: `order:asc,title:asc` |
| `pagination[page]` | entero | No | 1 | Página |
| `pagination[pageSize]` | entero | No | 25 | Máx 100 |
| `filters[slug][$eq]` | string | No | — | Buscar por slug exacto |
| `filters[category][slug][$eq]` | string | No | — | Filtrar por categoría |
| `populate[category]` | mixed | No | — | Datos de la categoría padre |
| `populate[ogImage]` | mixed | No | — | Imagen OG del artículo |
| `status` | string | No | — | `draft` (requiere token) |

#### Ejemplos cURL

```bash
# Artículos de una sección específica
curl "http://localhost:1337/api/documentation-articles?\
space=portal-principal\
&section=guia-de-inicio\
&locale=es\
&sort=order:asc,title:asc"

# Artículos de una categoría específica
curl "http://localhost:1337/api/documentation-articles?\
space=portal-principal\
&locale=es\
&filters[category][slug][\$eq]=instalacion\
&sort=order:asc"

# Obtener artículo por slug (para renderizar la página)
curl "http://localhost:1337/api/documentation-articles?\
space=portal-principal\
&locale=es\
&filters[slug][\$eq]=instalacion-en-linux\
&populate[category][fields][0]=name\
&populate[category][fields][1]=slug\
&populate[category][populate][documentation_section][fields][0]=name\
&populate[category][populate][documentation_section][fields][1]=slug\
&populate[ogImage][fields][0]=url\
&populate[ogImage][fields][1]=alternativeText\
&populate[ogImage][fields][2]=width\
&populate[ogImage][fields][3]=height"

# Obtener artículo por documentId (si ya se tiene)
curl "http://localhost:1337/api/documentation-articles/art001documentId?locale=es"

# Buscar borradores con token (Live Preview)
curl -H "Authorization: Bearer TU_API_TOKEN" \
  "http://localhost:1337/api/documentation-articles?\
space=portal-principal\
&locale=es\
&filters[slug][\$eq]=mi-borrador\
&status=draft"

# Listar todos los artículos para generar sitemap
curl "http://localhost:1337/api/documentation-articles?\
space=portal-principal\
&locale=es\
&pagination[pageSize]=100\
&fields[0]=slug\
&fields[1]=title\
&fields[2]=updatedAt"
```

#### Respuesta exitosa (artículo completo por slug)

```json
{
  "data": [
    {
      "id": 11,
      "documentId": "art002documentId",
      "title": "Instalación en Linux",
      "slug": "instalacion-en-linux",
      "excerpt": "Guía paso a paso para instalar el sistema en distribuciones basadas en Debian y Red Hat.",
      "content": [
        {
          "type": "paragraph",
          "children": [{ "type": "text", "text": "Este artículo cubre la instalación en Ubuntu 22.04 y CentOS 9." }]
        },
        {
          "type": "heading",
          "level": 2,
          "children": [{ "type": "text", "text": "Requisitos previos" }]
        },
        {
          "type": "list",
          "format": "unordered",
          "children": [
            { "type": "list-item", "children": [{ "type": "text", "text": "Node.js 20 o superior" }] },
            { "type": "list-item", "children": [{ "type": "text", "text": "Docker 24+" }] }
          ]
        },
        {
          "type": "code",
          "language": "bash",
          "children": [{ "type": "text", "text": "npm install && npm run build" }]
        }
      ],
      "version": "1.2",
      "order": 2,
      "seoTitle": "Instalar en Linux — Guía Completa",
      "seoDescription": "Aprende a instalar el sistema en Ubuntu y CentOS paso a paso en menos de 10 minutos.",
      "locale": "es",
      "publishedAt": "2026-02-01T10:00:00.000Z",
      "createdAt": "2026-01-20T09:00:00.000Z",
      "updatedAt": "2026-03-25T15:00:00.000Z",
      "category": {
        "id": 3,
        "documentId": "cat123documentId",
        "name": "Instalación",
        "slug": "instalacion",
        "documentation_section": {
          "id": 1,
          "documentId": "sec456documentId",
          "name": "Guía de Inicio",
          "slug": "guia-de-inicio"
        }
      },
      "ogImage": {
        "url": "https://tu-bucket.wasabi.com/uploads/linux-install-cover.png",
        "alternativeText": "Instalación en Linux",
        "width": 1200,
        "height": 630
      }
    }
  ],
  "meta": {
    "pagination": { "page": 1, "pageSize": 25, "pageCount": 1, "total": 1 }
  }
}
```

#### Tipo de datos: `DocumentationArticle`

```
DocumentationArticle {
  id:             number
  documentId:     string
  title:          string        // LOCALIZADO
  slug:           string        // LOCALIZADO
  content:        Block[]       // LOCALIZADO — array de bloques (ver Sección 7)
  excerpt:        string | null // LOCALIZADO — máx 300 chars
  version:        string | null // Compartido entre locales
  order:          number        // Compartido entre locales — default: 0
  seoTitle:       string | null // LOCALIZADO
  seoDescription: string | null // LOCALIZADO — máx 160 chars
  locale:         string
  publishedAt:    string | null
  createdAt:      string
  updatedAt:      string
  category?:      Category      // Solo si populate[category]=true
  ogImage?:       MediaObject   // Solo si populate[ogImage]=true — Compartido entre locales
}

MediaObject {
  url:              string
  alternativeText:  string | null
  width:            number
  height:           number
  formats?:         object       // thumbnails generados por Strapi (si se popula)
}
```

---

### GET /api/documentation-space-settings

Retorna la configuración visual completa de un espacio: nombre del sitio, logos, colores, tipografía, SEO y footer.

**Autenticación:** Pública
**Requiere `?space`:** **Sí**
**i18n:** No
**draftAndPublish:** No

#### Parámetros disponibles

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `space` | string | **Sí** | Slug del espacio |
| `populate[favicon]` | mixed | No | Favicon del sitio |
| `populate[sidebarLogo]` | mixed | No | Logo del sidebar |
| `populate[ogDefaultImage]` | mixed | No | Imagen OG por defecto |
| `populate[colors]` | boolean | No | Paleta de colores completa |
| `populate[typography]` | boolean | No | Configuración tipográfica |
| `populate[spacing]` | boolean | No | Tokens de espaciado |
| `populate[layout]` | boolean | No | Configuración de layout |

#### Ejemplos cURL

```bash
# Configuración básica del espacio (sin media)
curl "http://localhost:1337/api/documentation-space-settings?space=portal-principal"

# Configuración completa con tema y medios (carga inicial del portal)
curl "http://localhost:1337/api/documentation-space-settings?\
space=portal-principal\
&populate[favicon][fields][0]=url\
&populate[favicon][fields][1]=alternativeText\
&populate[sidebarLogo][fields][0]=url\
&populate[sidebarLogo][fields][1]=alternativeText\
&populate[sidebarLogo][fields][2]=width\
&populate[sidebarLogo][fields][3]=height\
&populate[ogDefaultImage][fields][0]=url\
&populate[ogDefaultImage][fields][1]=width\
&populate[ogDefaultImage][fields][2]=height\
&populate[colors]=true\
&populate[typography]=true\
&populate[spacing]=true\
&populate[layout]=true"
```

#### Respuesta exitosa (configuración completa)

```json
{
  "data": [
    {
      "id": 1,
      "documentId": "set001documentId",
      "siteName": "Portal Principal",
      "siteDescription": "Documentación técnica oficial del sistema.",
      "headerLogoSize": "md",
      "headerLinkText": "Volver al sitio",
      "headerLinkUrl": "https://misitioweb.com",
      "footerText": "© 2026 Mi Empresa. Todos los derechos reservados.",
      "createdAt": "2026-01-10T08:00:00.000Z",
      "updatedAt": "2026-03-30T10:00:00.000Z",
      "favicon": {
        "url": "https://tu-bucket.wasabi.com/uploads/favicon.ico",
        "alternativeText": "Logo"
      },
      "sidebarLogo": {
        "url": "https://tu-bucket.wasabi.com/uploads/logo-sidebar.svg",
        "alternativeText": "Mi Empresa Docs",
        "width": 160,
        "height": 40
      },
      "ogDefaultImage": {
        "url": "https://tu-bucket.wasabi.com/uploads/og-default.png",
        "width": 1200,
        "height": 630
      },
      "colors": {
        "lightBgPrimary": "#ffffff",
        "lightBgSecondary": "#f8fafc",
        "lightBgSidebar": "#f1f5f9",
        "lightTextPrimary": "#0f172a",
        "lightTextSecondary": "#475569",
        "lightTextMuted": "#94a3b8",
        "lightBorderColor": "#e2e8f0",
        "lightCodeBg": "#f1f5f9",
        "lightCodeText": "#0f172a",
        "lightCalloutBg": "#eff6ff",
        "lightCalloutBorder": "#3b82f6",
        "darkBgPrimary": "#0f172a",
        "darkBgSecondary": "#1e293b",
        "darkBgSidebar": "#1e293b",
        "darkTextPrimary": "#f1f5f9",
        "darkTextSecondary": "#94a3b8",
        "darkTextMuted": "#475569",
        "darkBorderColor": "#334155",
        "darkCodeBg": "#1e293b",
        "darkCodeText": "#e2e8f0",
        "darkCalloutBg": "#1e3a8a",
        "darkCalloutBorder": "#60a5fa",
        "brand50": "#eff6ff",
        "brand500": "#3b82f6",
        "brand900": "#1e3a8a"
      },
      "typography": {
        "fontSans": "Inter",
        "fontMono": "JetBrains Mono",
        "baseFontSize": "16px",
        "baseLineHeight": "1.625",
        "headingLineHeight": "1.25",
        "paragraphSpacing": "1rem",
        "listSpacing": "0.375rem",
        "headingSpacingTop": "2rem",
        "headingSpacingBottom": "0.75rem"
      },
      "spacing": {
        "contentPaddingX": "1.5rem",
        "contentPaddingY": "2rem",
        "sectionGap": "2rem",
        "headerHeight": "3.5rem",
        "sidebarWidth": "16rem"
      },
      "layout": {
        "maxContentWidth": "72rem",
        "tocWidth": "14rem",
        "borderRadius": "0.5rem",
        "codeBorderRadius": "0.5rem",
        "transitionDuration": "0.2s",
        "animationEasing": "cubic-bezier(0.4, 0, 0.2, 1)"
      }
    }
  ],
  "meta": { "pagination": { "page": 1, "pageSize": 25, "pageCount": 1, "total": 1 } }
}
```

#### Tipo de datos: `DocumentationSpaceSetting`

```
DocumentationSpaceSetting {
  id:                number
  documentId:        string
  siteName:          string            // Requerido, default: "Documentation Portal"
  siteDescription:   string | null
  headerLogoSize:    "sm" | "md" | "lg" | "xl" | null
  headerLinkText:    string | null     // máx 50 chars
  headerLinkUrl:     string | null
  footerText:        string | null
  createdAt:         string
  updatedAt:         string
  favicon?:          MediaObject | null
  sidebarLogo?:      MediaObject | null
  ogDefaultImage?:   MediaObject | null
  colors?:           ThemeColors
  typography?:       ThemeTypography
  spacing?:          ThemeSpacing
  layout?:           ThemeLayout
}
```

---

## 6. Componentes del tema (theme.\*)

El `documentation-space-setting` incluye 4 componentes reutilizables que definen la apariencia visual del portal. Todos son opcionales y tienen valores por defecto.

### theme.colors — Paleta de colores

25 tokens de color. Cubre modo claro, modo oscuro y colores de marca.

| Campo | Default | Descripción |
|---|---|---|
| `lightBgPrimary` | `#ffffff` | Fondo principal (modo claro) |
| `lightBgSecondary` | `#f8fafc` | Fondo de elementos secundarios (modo claro) |
| `lightBgSidebar` | `#f1f5f9` | Fondo del sidebar (modo claro) |
| `lightTextPrimary` | `#0f172a` | Texto principal (modo claro) |
| `lightTextSecondary` | `#475569` | Texto secundario (modo claro) |
| `lightTextMuted` | `#94a3b8` | Texto tenue: fechas, metadatos (modo claro) |
| `lightBorderColor` | `#e2e8f0` | Bordes y divisores (modo claro) |
| `lightCodeBg` | `#f1f5f9` | Fondo de bloques de código (modo claro) |
| `lightCodeText` | `#0f172a` | Texto en bloques de código (modo claro) |
| `lightCalloutBg` | `#eff6ff` | Fondo de callouts/notas (modo claro) |
| `lightCalloutBorder` | `#3b82f6` | Borde lateral de callouts (modo claro) |
| `darkBgPrimary` | `#0f172a` | Fondo principal (modo oscuro) |
| `darkBgSecondary` | `#1e293b` | Fondo secundario (modo oscuro) |
| `darkBgSidebar` | `#1e293b` | Fondo del sidebar (modo oscuro) |
| `darkTextPrimary` | `#f1f5f9` | Texto principal (modo oscuro) |
| `darkTextSecondary` | `#94a3b8` | Texto secundario (modo oscuro) |
| `darkTextMuted` | `#475569` | Texto tenue (modo oscuro) |
| `darkBorderColor` | `#334155` | Bordes (modo oscuro) |
| `darkCodeBg` | `#1e293b` | Fondo de código (modo oscuro) |
| `darkCodeText` | `#e2e8f0` | Texto de código (modo oscuro) |
| `darkCalloutBg` | `#1e3a8a` | Fondo de callouts (modo oscuro) |
| `darkCalloutBorder` | `#60a5fa` | Borde de callouts (modo oscuro) |
| `brand50` | `#eff6ff` | Tono muy claro de marca (hover, highlights) |
| `brand500` | `#3b82f6` | Color principal de marca (links, activos) |
| `brand900` | `#1e3a8a` | Tono oscuro de marca (acentos en dark mode) |

### theme.typography — Tipografía

| Campo | Default | Descripción |
|---|---|---|
| `fontSans` | `Inter` | Fuente para texto general |
| `fontMono` | `JetBrains Mono` | Fuente para bloques de código |
| `baseFontSize` | `16px` | Tamaño de fuente base |
| `baseLineHeight` | `1.625` | Interlineado general |
| `headingLineHeight` | `1.25` | Interlineado de títulos |
| `paragraphSpacing` | `1rem` | Margen entre párrafos |
| `listSpacing` | `0.375rem` | Espacio entre ítems de lista |
| `headingSpacingTop` | `2rem` | Margen superior de headings |
| `headingSpacingBottom` | `0.75rem` | Margen inferior de headings |

### theme.spacing — Espaciados

| Campo | Default | Descripción |
|---|---|---|
| `contentPaddingX` | `1.5rem` | Padding horizontal del área de contenido |
| `contentPaddingY` | `2rem` | Padding vertical del área de contenido |
| `sectionGap` | `2rem` | Espacio entre secciones |
| `headerHeight` | `3.5rem` | Alto del header |
| `sidebarWidth` | `16rem` | Ancho del sidebar |

### theme.layout — Layout

| Campo | Default | Descripción |
|---|---|---|
| `maxContentWidth` | `72rem` | Ancho máximo del contenido |
| `tocWidth` | `14rem` | Ancho del panel de tabla de contenidos |
| `borderRadius` | `0.5rem` | Radio de bordes general |
| `codeBorderRadius` | `0.5rem` | Radio de bordes en bloques de código |
| `transitionDuration` | `0.2s` | Duración de transiciones CSS |
| `animationEasing` | `cubic-bezier(0.4, 0, 0.2, 1)` | Curva de animación |

---

## 7. Formato de bloques (`content`)

El campo `content` de los artículos es un **array de bloques**. Cada bloque se discrimina por el campo `type`.

### Tipos de bloque disponibles

#### `paragraph` — Párrafo de texto

```json
{
  "type": "paragraph",
  "children": [
    { "type": "text", "text": "Texto normal del párrafo." },
    { "type": "text", "text": "Texto en negrita.", "bold": true },
    { "type": "text", "text": "Texto en cursiva.", "italic": true },
    { "type": "text", "text": "Código inline.", "code": true },
    { "type": "link", "url": "https://ejemplo.com", "children": [{ "type": "text", "text": "Enlace" }] }
  ]
}
```

Modificadores de texto disponibles: `bold`, `italic`, `underline`, `strikethrough`, `code`.

#### `heading` — Título (h1–h6)

```json
{
  "type": "heading",
  "level": 2,
  "children": [{ "type": "text", "text": "Título de sección" }]
}
```

`level` puede ser `1`, `2`, `3`, `4`, `5` o `6`.

#### `code` — Bloque de código

```json
{
  "type": "code",
  "language": "typescript",
  "children": [{ "type": "text", "text": "const saludo: string = 'Hola mundo';\nconsole.log(saludo);" }]
}
```

`language` puede ser cualquier lenguaje soportado por el editor (ej: `bash`, `javascript`, `typescript`, `python`, `json`, `yaml`, `sql`, `html`, `css`).

#### `image` — Imagen

```json
{
  "type": "image",
  "image": {
    "url": "https://tu-bucket.wasabi.com/uploads/diagrama.png",
    "alternativeText": "Diagrama de arquitectura",
    "width": 1200,
    "height": 600
  }
}
```

#### `list` — Lista ordenada o no ordenada

```json
{
  "type": "list",
  "format": "unordered",
  "children": [
    {
      "type": "list-item",
      "children": [{ "type": "text", "text": "Primer ítem" }]
    },
    {
      "type": "list-item",
      "children": [{ "type": "text", "text": "Segundo ítem con " }, { "type": "text", "text": "negrita", "bold": true }]
    }
  ]
}
```

`format` puede ser `"ordered"` (numerada) o `"unordered"` (con viñetas).

#### `quote` — Cita o callout

```json
{
  "type": "quote",
  "children": [{ "type": "text", "text": "Este es un mensaje importante destacado." }]
}
```

### Resumen de tipos de bloque

| `type` | Campos extra | Uso |
|---|---|---|
| `paragraph` | `children` | Párrafo de texto con inline formatting |
| `heading` | `level` (1–6), `children` | Títulos jerárquicos |
| `code` | `language`, `children` | Bloques de código con resaltado de sintaxis |
| `image` | `image` (objeto con url, alt, w, h) | Imagen embebida |
| `list` | `format` (ordered/unordered), `children` | Listas numeradas o con viñetas |
| `quote` | `children` | Cita destacada / callout |

---

## 8. Personalización mediante slugs

Los **slugs** son identificadores URL-friendly únicos que permiten construir URLs limpias y predecibles en el frontend. Son la clave para la personalización y la navegación.

### Cómo se generan los slugs

Todos los slugs se generan automáticamente desde el campo de texto principal (`name` en secciones y categorías, `title` en artículos). Por ejemplo:

- `"Guía de Inicio"` → `guia-de-inicio`
- `"Instalación en Linux"` → `instalacion-en-linux`
- `"API Reference v2"` → `api-reference-v2`

Los slugs son **localizados** en secciones, categorías y artículos, lo que significa que pueden diferir entre idiomas:

| Campo | Español | Inglés |
|---|---|---|
| Sección | `guia-de-inicio` | `getting-started` |
| Categoría | `instalacion` | `installation` |
| Artículo | `instalacion-en-linux` | `linux-installation` |

### Slugs que identifican el espacio

El slug del **documentation-space** es el más importante: identifica el portal completo y debe enviarse en cada petición como `?space=<slug>`. Se configura al crear el espacio y no cambia.

```bash
# Mismo contenido, diferente portal
curl "http://localhost:1337/api/documentation-articles?space=portal-api&locale=es"
curl "http://localhost:1337/api/documentation-articles?space=portal-marketing&locale=es"
```

### Patrón de URL recomendado para el frontend

Construir las URLs del frontend usando los slugs de cada nivel:

```
/<locale>/<categorySlug>/<articleSlug>

Ejemplos:
/es/instalacion/instalacion-en-linux
/en/installation/linux-installation
/es/referencia-api/autenticacion
```

Para obtener el artículo correspondiente:

```bash
curl "http://localhost:1337/api/documentation-articles?\
space=portal-principal\
&locale=es\
&filters[slug][\$eq]=instalacion-en-linux"
```

### Cambiar slugs sin romper URLs

Si se cambia el `name` o `title` de un registro en Strapi, el slug se re-genera automáticamente, lo que **rompe las URLs** que lo usaban. Para prevenir esto:

1. Deshabilitar la auto-generación del slug en el editor de Strapi antes de editar el título.
2. Mantener el slug original manualmente.
3. Alternativamente, configurar redirects en el frontend o en el servidor web.

### Slug del espacio como variable de entorno

El frontend debe configurar `DOCUMENTATION_SPACE_SLUG` en su `.env` para identificar qué portal consume:

```env
DOCUMENTATION_SPACE_SLUG=portal-principal
```

Este valor se usa en cada petición a la API. Para desplegar múltiples instancias del mismo frontend apuntando a distintos espacios, basta con cambiar esta variable sin modificar código.

---

## 9. Flujo de datos completo

### Carga inicial del portal

```
1. Obtener configuración visual del espacio:
   GET /api/documentation-space-settings
     ?space=portal-principal
     &populate[colors]=true
     &populate[typography]=true
     &populate[spacing]=true
     &populate[layout]=true
     &populate[favicon][fields][0]=url
     &populate[sidebarLogo][fields][0]=url
     &populate[sidebarLogo][fields][1]=width
     &populate[sidebarLogo][fields][2]=height
     &populate[ogDefaultImage][fields][0]=url

2. Obtener secciones para el navbar:
   GET /api/documentation-sections
     ?space=portal-principal
     &locale=es
     &sort=order:asc
     &pagination[pageSize]=100

3. Obtener todas las categorías con sus artículos (para el sidebar completo):
   GET /api/documentation-categories
     ?space=portal-principal
     &locale=es
     &sort=order:asc
     &pagination[pageSize]=100
     &populate[articles][fields][0]=title
     &populate[articles][fields][1]=slug
     &populate[articles][fields][2]=order

   → Los artículos dentro de cada categoría se ordenan por:
     sort=order:asc,title:asc en la siguiente petición
```

### Renderizar un artículo

```
4. Obtener el artículo completo por slug:
   GET /api/documentation-articles
     ?space=portal-principal
     &locale=es
     &filters[slug][$eq]=instalacion-en-linux
     &populate[category][fields][0]=name
     &populate[category][fields][1]=slug
     &populate[category][populate][documentation_section][fields][0]=name
     &populate[category][populate][documentation_section][fields][1]=slug
     &populate[ogImage][fields][0]=url
     &populate[ogImage][fields][1]=alternativeText
     &populate[ogImage][fields][2]=width
     &populate[ogImage][fields][3]=height

   → data[0] es el artículo
   → data[0].content es el array de bloques para renderizar
   → data[0].category.name + data[0].category.documentation_section.name → breadcrumbs
   → data[0].seoTitle ?? data[0].title → <title>
   → data[0].seoDescription → <meta name="description">
   → data[0].ogImage ?? settings.ogDefaultImage → og:image
```

### Cambio de idioma

```
5. Al cambiar locale, repetir las peticiones con el nuevo locale:
   Los campos localizados (name, slug, title, content, etc.) llegan en el idioma solicitado.
   Los campos compartidos (order, icon, version, ogImage) son idénticos en todos los locales.
```

### Live Preview de borrador

```
6. Con token de autenticación, obtener el borrador:
   GET /api/documentation-articles
     ?space=portal-principal
     &locale=es
     &filters[slug][$eq]=nuevo-articulo-borrador
     &status=draft
     &populate[...]...
   Headers: Authorization: Bearer TU_API_TOKEN_READ_ONLY
```

### Caché recomendado

| Endpoint | Volatilidad | TTL sugerido |
|---|---|---|
| `documentation-space-settings` | Baja | 24 horas |
| `documentation-sections` | Baja | 1 hora |
| `documentation-categories` (con artículos) | Media | 30 minutos |
| `documentation-articles` (individual) | Alta | 5 minutos o sin caché |

---

## 10. Propuestas de diseño por jerarquía

Las siguientes propuestas describen estructuras de UI alineadas con la jerarquía del modelo de datos. Son orientativas y no prescriben tecnología ni framework.

### Estructura de layout general

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER (height: spacing.headerHeight)                       │
│  [Logo/siteName] [Secciones del navbar] [Toggle dark mode]  │
└─────────────────────────────────────────────────────────────┘
┌──────────────────┬──────────────────────────┬───────────────┐
│                  │                          │               │
│  SIDEBAR         │   CONTENIDO PRINCIPAL    │  TABLA DE     │
│  (Categorías +   │   (Artículo o grid de    │  CONTENIDOS   │
│   artículos de   │    categorías)           │  (headings    │
│   la sección     │                          │   del artículo│
│   activa)        │   max-width: layout.     │   activo)     │
│                  │   maxContentWidth        │               │
│  width:          │                          │  width: layout│
│  spacing.sidebar │                          │  .tocWidth    │
│  Width           │                          │               │
└──────────────────┴──────────────────────────┴───────────────┘
┌─────────────────────────────────────────────────────────────┐
│  FOOTER  (footerText del space-setting)                      │
└─────────────────────────────────────────────────────────────┘
```

---

### Vista 1: Navbar (Header)

**Origen de datos:** `GET /api/documentation-sections`
**Datos a mostrar:**

| Dato | Campo API | Comportamiento |
|---|---|---|
| Nombre de la sección | `section.name` | Texto del ítem del menú |
| Ícono (opcional) | `section.icon` | Ícono previo al nombre (si hay valor) |
| Estado activo | URL actual | Resaltar la sección cuyo slug coincide con la ruta actual |
| Logo del portal | `setting.sidebarLogo.url` | Imagen a la izquierda del menú |
| Nombre del sitio | `setting.siteName` | Alternativa si no hay logo |
| Link externo | `setting.headerLinkText` + `setting.headerLinkUrl` | Botón CTA en el header |

**Interacción:** Al seleccionar una sección → cargar sus categorías en el sidebar y navegar a la primera categoría.

**Estado vacío:** Spinner de carga → ocultar navbar hasta tener los datos.

---

### Vista 2: Sidebar (Navegación lateral)

**Origen de datos:** `GET /api/documentation-categories` con `?section=<slug>` + artículos populados.
**Estructura de datos → UI:**

```
Sección activa: "Guía de Inicio"
├── Categoría: Instalación        (category.name, filtrar por category.order)
│   ├── Requisitos del sistema    (article.title, filtrar por article.order)
│   └── Instalación en Linux      ← artículo activo (resaltado con brand500)
├── Categoría: Configuración
│   ├── Variables de entorno
│   └── Configuración de base de datos
└── Categoría: Primeros pasos
    └── Tu primera petición API
```

**Datos a mostrar por ítem:**

| Elemento | Campo API | Notas |
|---|---|---|
| Título de categoría | `category.name` | Texto de grupo, no clickeable |
| Título de artículo | `article.title` | Clickeable → navegar a `/locale/categorySlug/articleSlug` |
| Artículo activo | URL actual | Resaltar con `colors.brand500` |

**Comportamiento al cargar:** Scroll automático al artículo activo en el sidebar.

---

### Vista 3: Página de artículo

**Origen de datos:** `GET /api/documentation-articles?filters[slug][$eq]=...`
**Layout interno:**

```
┌─────────────────────────────────────────┐
│ BREADCRUMBS                              │
│ Guía de Inicio > Instalación > Linux     │
├─────────────────────────────────────────┤
│ TÍTULO DEL ARTÍCULO                      │
│ article.title                            │
│                                          │
│ VERSION BADGE (si article.version)       │
├─────────────────────────────────────────┤
│                                          │
│  RENDERIZADO DE BLOQUES (content[])      │
│  • paragraph → <p>                       │
│  • heading (level 2) → <h2>              │
│  • code → bloque con syntax highlight    │
│  • image → <img> con alt y dimensiones   │
│  • list (ordered) → <ol>                 │
│  • list (unordered) → <ul>               │
│  • quote → <blockquote> con borde lateral│
│                                          │
└─────────────────────────────────────────┘
│ NAVEGACIÓN ENTRE ARTÍCULOS               │
│ ← Artículo anterior | Artículo siguiente →│
```

**SEO automático:**

```
<title>: article.seoTitle ?? article.title + " — " + setting.siteName
<meta name="description">: article.seoDescription ?? article.excerpt
<meta property="og:image">: article.ogImage.url ?? setting.ogDefaultImage.url
<link rel="canonical">: URL completa del artículo
```

---

### Vista 4: Página de inicio del portal (`/[locale]`)

**Origen de datos:** `GET /api/documentation-categories` (todas las del espacio) + `setting`
**Estructura:**

```
┌──────────────────────────────────────────────────────────┐
│  HERO SECTION                                             │
│  setting.siteName                                        │
│  setting.siteDescription                                 │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│  GRID DE CATEGORÍAS (por sección)                        │
│                                                          │
│  ── Guía de Inicio ──                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │Instalación│ │Configurac│ │Primeros  │                 │
│  │           │ │ión       │ │Pasos     │                 │
│  │descripción│ │descripción│ │descripción│               │
│  │ N artíc.  │ │ N artíc. │ │ N artíc. │                 │
│  └──────────┘ └──────────┘ └──────────┘                 │
│                                                          │
│  ── Referencia API ──                                    │
│  ┌──────────┐ ┌──────────┐                              │
│  │Endpoints │ │Errores   │                              │
│  └──────────┘ └──────────┘                              │
└──────────────────────────────────────────────────────────┘
```

**Datos por card de categoría:**

| Dato | Campo API |
|---|---|
| Nombre | `category.name` |
| Descripción | `category.description` |
| Número de artículos | `category.articles.length` (si se popula) |
| Enlace | `/[locale]/[category.slug]` |

---

### Vista 5: Tabla de contenidos (TOC)

**Origen de datos:** Derivado de los bloques `heading` del `content` del artículo.
**Algoritmo:** Recorrer `content[]` y filtrar los bloques con `type === "heading"`. Usar `block.level` para la indentación.

```
TABLA DE CONTENIDOS

  Introducción                    (level 2)
  Requisitos previos              (level 2)
    Sistema operativo               (level 3)
    Dependencias                    (level 3)
  Proceso de instalación          (level 2)
    Ubuntu y Debian                 (level 3)
    CentOS y Red Hat                (level 3)
  Verificación                    (level 2)
```

**IDs de ancla:** Generar los IDs a partir del texto del heading usando `slugify()`:
- `"Requisitos previos"` → `#requisitos-previos`
- `"Ubuntu y Debian"` → `#ubuntu-y-debian`

**Comportamiento:** Resaltar el ítem activo según la posición de scroll (Intersection Observer).

---

### Vista 6: Selector de idioma

**Origen de datos:** Lista fija de locales soportados (`es`, `en`).
**Comportamiento:** Al cambiar locale → recargar todas las peticiones con el nuevo `?locale=`.

El `slug` puede diferir entre locales (es localizado). La navegación debe resolverse:
1. Obtener el artículo actual por `documentId`.
2. El mismo `documentId` tiene slug diferente en el otro locale.
3. Navegar a la URL con el nuevo slug en el nuevo locale.

---

## 11. Errores comunes

| HTTP | Mensaje | Causa | Solución |
|---|---|---|---|
| `400` | `El parámetro space es obligatorio.` | No se envió `?space=` | Agregar `?space=<slug>` a la petición |
| `400` | `El espacio de documentación no existe o está inactivo.` | El slug no existe o `is_active: false` | Verificar el slug exacto en el CMS |
| `403` | Forbidden | El rol Public no tiene permisos | Reiniciar Strapi para re-ejecutar el bootstrap |
| `404` | Not found | El `documentId` o ruta no existe | Verificar que el registro existe y está publicado |
| `[]` en `data` con contenido publicado | — | El locale solicitado no tiene traducción | Publicar la traducción en el locale pedido |
| `[]` en `data` aunque hay artículos | — | El artículo está en estado Draft | Publicar el artículo, o usar `?status=draft` + token |
| Artículos de otro espacio aparecen | — | Middleware no registrado | Verificar `config/middlewares.ts` y reiniciar |
| `[]` al filtrar por `?section=` | — | La sección pertenece a otro espacio | Verificar que la sección y las categorías están en el mismo espacio |

---

*Última actualización: 2026-04-22*
