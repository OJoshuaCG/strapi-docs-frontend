# Cómo extender el portal

## Añadir una nueva página

Las páginas siguen el file-based routing de Astro. El archivo define la ruta.

**Ejemplo: página `/[locale]/changelog`**

```astro
---
// src/pages/[locale]/changelog.astro
import DocsLayout from '@/layouts/DocsLayout.astro';
import { loadCommonData } from '@/lib/utils/page-data';
import { isValidLocale, appConfig } from '@/lib/utils/config';

const { locale } = Astro.params;
if (!locale || !isValidLocale(locale)) {
  return Astro.redirect(`/${appConfig.defaultLocale}`, 302);
}

const common = await loadCommonData(locale);
---

<DocsLayout
  title="Changelog"
  settings={common.settings}
  sections={common.sections}
  sidebarCategories={common.sidebarCategories}
  locale={locale}
  supportedLocales={common.supportedLocales}
>
  <h1>Changelog</h1>
  <!-- tu contenido -->
</DocsLayout>
```

## Añadir un componente UI

Crear el archivo en `src/components/ui/MiComponente.astro`. Define los props con la interfaz `Props`:

```astro
---
interface Props {
  label: string;
  variant?: 'primary' | 'secondary';
}

const { label, variant = 'primary' } = Astro.props;
---

<span
  class="inline-flex items-center px-2 py-0.5 rounded text-sm font-medium"
  style={variant === 'primary'
    ? 'background-color: var(--color-brand-50); color: var(--color-brand-500);'
    : 'background-color: var(--bg-secondary); color: var(--text-secondary);'
  }
>
  {label}
</span>
```

## Añadir un endpoint de API

Los endpoints van en `src/pages/api/`. Se accede como `/api/mi-endpoint`.

```typescript
// src/pages/api/search.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q') ?? '';

  // lógica de búsqueda...

  return new Response(JSON.stringify({ results: [] }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

## Añadir un campo nuevo de Strapi

Cuando Strapi agrega un campo nuevo a un content type existente:

1. Actualizar el tipo en `src/lib/domain/types.ts`:
```typescript
export type DocumentationArticle = {
  // ... campos existentes ...
  newField: string | null;  // nuevo campo
};
```

2. Si el campo requiere `populate`, añadirlo en `src/lib/strapi/client.ts` en los params correspondientes.

3. Usarlo en el componente o página que lo necesite.

## Añadir una integración de UI framework (React, Vue, Svelte)

Solo si se necesita estado complejo o un ecosistema específico de componentes. Para la mayoría de interactividad simple, el JavaScript vanilla en `<script>` de Astro es suficiente.

```bash
# Instalar la integración
npx astro add react
```

```astro
---
// Componente React hidratado solo cuando es visible
import MiComponenteReact from '@/components/MiComponente.tsx';
---

<MiComponenteReact client:visible />
```

Directivas disponibles:
- `client:load` — hidrata inmediatamente (usar para formularios críticos)
- `client:idle` — hidrata cuando el navegador está libre
- `client:visible` — hidrata cuando entra al viewport

## Modificar el layout

El layout principal es `src/layouts/DocsLayout.astro`. Recibe:

| Prop | Tipo | Descripción |
|---|---|---|
| `settings` | `DocumentationSpaceSetting \| null` | Tema y configuración |
| `sections` | `DocumentationSection[]` | Items del navbar |
| `sidebarCategories` | `SidebarCategory[]` | Categorías + artículos del sidebar |
| `activeSectionSlug` | `string?` | Sección resaltada en el navbar |
| `activeCategorySlug` | `string?` | Categoría resaltada en el sidebar |
| `activeArticleSlug` | `string?` | Artículo resaltado en el sidebar |
| `toc` | `TocEntry[]` | Entradas de la tabla de contenidos |
| `locale` | `string` | Locale actual |
| `supportedLocales` | `string[]` | Para el selector de idioma |

## Estructura de los estilos

El archivo `src/styles/global.css` tiene tres capas:

```css
@tailwind base;      /* reset de Tailwind */
@tailwind components; /* clases de componentes: .prose-docs, .code-block-wrapper */
@tailwind utilities;  /* clases utilitarias de Tailwind */
```

Para añadir estilos de componentes (que se usan como clases en el markup):
```css
@layer components {
  .mi-componente {
    background-color: var(--bg-secondary);
    /* ... */
  }
}
```

## Caché y rendimiento

El portal es SSR puro: no hay caché en el frontend. Si necesitas reducir la carga en Strapi, considera añadir caché en el servidor.

Ejemplo simple con `Map` en memoria (se resetea al reiniciar):

```typescript
// src/lib/utils/cache.ts
const store = new Map<string, { data: unknown; expiresAt: number }>();

export function cached<T>(key: string, ttlMs: number, fetch: () => Promise<T>): Promise<T> {
  const entry = store.get(key);
  if (entry && entry.expiresAt > Date.now()) return Promise.resolve(entry.data as T);

  return fetch().then((data) => {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}
```

Uso:
```typescript
const settings = await cached('space-settings', 24 * 60 * 60 * 1000, getSpaceSettings);
```

Para caché distribuida en producción, considera Redis o similar.
