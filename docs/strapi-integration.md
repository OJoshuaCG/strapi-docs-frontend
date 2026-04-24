# Integración con Strapi

## Jerarquía de contenido

El CMS usa la siguiente jerarquía. El portal la refleja directamente en su estructura de URLs:

```
Documentation Space (1 por instancia del portal)
  └── Section         → ítem del navbar superior
        └── Category  → título de grupo en el sidebar
              └── Article → página de contenido
```

URL resultante:
```
/[locale]/[categorySlug]/[articleSlug]
```

Ejemplo: `/es/instalacion/instalacion-en-linux`

## Cliente HTTP (`src/lib/strapi/client.ts`)

Centraliza todas las llamadas a la API. Nunca uses `fetch` directo en páginas o componentes; usa siempre este cliente.

### Funciones disponibles

```typescript
// Configuración visual del space (colores, tipografía, logos, etc.)
getSpaceSettings(): Promise<DocumentationSpaceSetting | null>

// Secciones para el navbar
getSections(locale: string): Promise<DocumentationSection[]>

// Categorías con artículos anidados (para el sidebar)
getCategoriesWithArticles(locale, sectionSlug?): Promise<SidebarCategory[]>

// Artículo completo por slug (para renderizar la página)
getArticleBySlug(slug, locale, draft?): Promise<DocumentationArticle | null>

// Artículos de una categoría (para navegación prev/next)
getArticlesByCategory(categorySlug, locale): Promise<DocumentationArticle[]>

// Todos los slugs de artículos (útil para sitemap)
getAllArticleSlugs(locale): Promise<{slug, title, updatedAt}[]>
```

### Cómo añadir un nuevo endpoint

Agrega la función en `src/lib/strapi/client.ts` siguiendo el patrón existente:

```typescript
export async function getMiNuevoRecurso(locale: string): Promise<MiTipo[]> {
  const res = await strapiGet<StrapiListResponse<MiTipo>>(
    '/api/mi-endpoint',
    {
      params: {
        space: config.spaceSlug,
        locale,
        'pagination[pageSize]': 100,
      },
    }
  );
  return res.data;
}
```

Y define el tipo correspondiente en `src/lib/domain/types.ts`.

## El parámetro `?space`

Todos los endpoints (excepto `/api/documentation-spaces`) requieren `?space=<slug>`. El cliente lo añade automáticamente desde la variable de entorno `DOCUMENTATION_SPACE_SLUG`. Nunca hay que pasarlo manualmente.

## Locales

El parámetro `?locale=` se pasa explícitamente en cada función porque es necesario en runtime. Los campos localizados en Strapi v5 son:

- `Section`: `name`, `slug`, `description`
- `Category`: `name`, `slug`, `description`
- `Article`: `title`, `slug`, `content`, `excerpt`, `seoTitle`, `seoDescription`

Los campos **compartidos entre locales** (no cambian por idioma) son: `order`, `icon`, `version`, `ogImage`.

## Strapi v5 vs v4

En Strapi v5 los datos están **directamente** en el objeto (sin wrapper `attributes`). Ejemplo:

```json
// v4 (incorrecto para este proyecto)
{ "data": { "id": 1, "attributes": { "title": "..." } } }

// v5 (formato correcto)
{ "data": { "id": 1, "title": "..." } }
```

Los tipos en `src/lib/domain/types.ts` ya reflejan la estructura v5.

## Añadir un nuevo locale

1. Crear el locale en Strapi Admin → **Settings → Internationalization → Add a locale**.
2. Traducir el contenido en cada content type.
3. Publicar las traducciones.
4. Agregar el código del locale a `SUPPORTED_LOCALES` en `.env`:
   ```env
   SUPPORTED_LOCALES=es,en,fr
   ```
5. Reiniciar el servidor del portal.

No se requiere cambio de código.

## Errores frecuentes de la API

| Síntoma | Causa probable | Solución |
|---|---|---|
| `400 El parámetro space es obligatorio` | Bug en el cliente | Verificar que `config.spaceSlug` no está vacío |
| `400 El espacio no existe o está inactivo` | Slug incorrecto | Confirmar el slug exacto en Strapi |
| `data: []` aunque hay contenido | Artículo en Draft | Publicarlo en Strapi, o usar token + `?status=draft` |
| `data: []` para un locale | Traducción no publicada | Publicar el contenido en ese locale en Strapi |
| `403 Forbidden` | Permisos del rol Public | En Strapi: Settings → Users & Permissions → Public → habilitar `find` y `findOne` |
| Error 500 en el portal | Strapi inaccesible | Verificar que `STRAPI_URL` es correcta y el CMS está activo |
