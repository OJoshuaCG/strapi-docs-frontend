# Variables de entorno

Todas las variables viven en el archivo `.env` en la raíz del proyecto. Este archivo **nunca se sube al repositorio** (está en `.gitignore`).

Para configurar el entorno por primera vez:

```bash
cp .env.example .env
# Editar .env con los valores reales
```

## Variables disponibles

### `STRAPI_URL` — Obligatoria

URL base de la instancia de Strapi. Sin slash al final.

```env
# Local
STRAPI_URL=http://localhost:1337

# Producción
STRAPI_URL=https://strapi-admin.docs.cero208.mx
```

El portal hace todas las peticiones al CMS desde el servidor (SSR), por lo que esta URL nunca llega al navegador. No necesita el prefijo `PUBLIC_`.

---

### `DOCUMENTATION_SPACE_SLUG` — Obligatoria

Slug del `documentation-space` en Strapi que renderiza este portal. Un mismo CMS puede tener múltiples spaces; esta variable determina cuál consume el frontend.

```env
DOCUMENTATION_SPACE_SLUG=omnicanal
```

El slug se obtiene desde el admin de Strapi: **Content Manager → Documentation Space → campo `slug`**.

> Para desplegar el mismo frontend apuntando a diferentes spaces, solo cambia esta variable en cada instancia. No se modifica código.

---

### `STRAPI_API_TOKEN` — Opcional

Token de API de Strapi con permisos de solo lectura. Se usa únicamente para acceder a contenido en estado **Draft** (borradores).

```env
# Dejar vacío para producción (solo contenido publicado)
STRAPI_API_TOKEN=

# Con token para entorno de preview
STRAPI_API_TOKEN=abc123...
```

Para generar el token: **Strapi Admin → Settings → API Tokens → Create new API Token** (tipo: Read-only).

Si se deja vacío, el portal solo muestra contenido publicado, que es el comportamiento correcto para producción.

---

### `SUPPORTED_LOCALES` — Obligatoria

Lista de códigos de idioma soportados, separados por coma. Deben existir como locales configurados en Strapi.

```env
SUPPORTED_LOCALES=es,en
```

El primer valor aparecerá primero en el selector de idioma. Añadir más locales solo requiere agregarlos aquí y publicar el contenido en Strapi con esos locales.

> **Importante:** si un locale está en esta lista pero Strapi no tiene contenido publicado para él, la página cargará vacía (sin error).

---

### `DEFAULT_LOCALE` — Obligatoria

Locale al que se redirige cuando el usuario accede a la raíz `/`. Debe estar incluido en `SUPPORTED_LOCALES`.

```env
DEFAULT_LOCALE=es
```

---

## Ejemplo completo `.env`

```env
# CMS
STRAPI_URL=https://strapi-admin.docs.cero208.mx
DOCUMENTATION_SPACE_SLUG=omnicanal

# Token opcional (borrar o dejar vacío en producción)
STRAPI_API_TOKEN=

# Idiomas
SUPPORTED_LOCALES=es,en
DEFAULT_LOCALE=es
```

## Cambiar de entorno local a producción

El archivo `.env` es independiente por entorno. En cPanel, las variables se configuran directamente en el panel de Node.js App (o en el `.env` del servidor), no en el repositorio.

**Nunca subas `.env` al repositorio.** El archivo `.env.example` actúa como plantilla documentada.
