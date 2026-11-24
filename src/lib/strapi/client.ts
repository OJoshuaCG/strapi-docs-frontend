import type { StrapiListResponse } from '@/lib/domain/types';

// Validate at module load — fail loudly if misconfigured
const STRAPI_URL = import.meta.env.STRAPI_URL;
const SPACE_SLUG = import.meta.env.DOCUMENTATION_SPACE_SLUG;
const API_TOKEN = import.meta.env.STRAPI_API_TOKEN;

if (!STRAPI_URL) throw new Error('Missing env: STRAPI_URL');
if (!SPACE_SLUG) throw new Error('Missing env: DOCUMENTATION_SPACE_SLUG');

export const config = {
  strapiUrl: STRAPI_URL.replace(/\/$/, ''),
  spaceSlug: SPACE_SLUG,
  apiToken: API_TOKEN ?? '',
} as const;

// ── HTTP core ─────────────────────────────────────────────────────────────────

type FetchOptions = {
  params?: Record<string, string | number | boolean | undefined>;
  withToken?: boolean;
};

function buildUrl(path: string, params: Record<string, string | number | boolean | undefined> = {}): string {
  const url = new URL(`${config.strapiUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function strapiGet<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params = {}, withToken = false } = options;
  const url = buildUrl(path, params);

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (withToken && config.apiToken) {
    headers['Authorization'] = `Bearer ${config.apiToken}`;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch { /* ignore */ }
    throw new Error(`Strapi ${res.status} on ${url}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// Strapi devuelve como mucho 100 resultados por consulta (`rest.maxLimit` del back). Para listas que
// crecen con la documentación (secciones, categorías, artículos de una categoría) se piden todas las
// páginas; si no, a partir del resultado 101 desaparecen sin error.
const PAGE_SIZE = 100;

async function strapiGetAll<T>(path: string, options: FetchOptions = {}): Promise<T[]> {
  const page = (n: number) =>
    strapiGet<StrapiListResponse<T>>(path, {
      ...options,
      params: { ...options.params, 'pagination[page]': n, 'pagination[pageSize]': PAGE_SIZE },
    });

  const first = await page(1);
  const pageCount = first.meta.pagination?.pageCount ?? 1;
  if (pageCount <= 1) return first.data;
  const rest = await Promise.all(Array.from({ length: pageCount - 1 }, (_, i) => page(i + 2)));
  return first.data.concat(...rest.map((res) => res.data));
}

// ── Populate helpers ─────────────────────────────────────────────────────────

function mediaPopulate(prefix: string): Record<string, string> {
  return {
    [`populate[${prefix}][fields][0]`]: 'url',
    [`populate[${prefix}][fields][1]`]: 'alternativeText',
    [`populate[${prefix}][fields][2]`]: 'width',
    [`populate[${prefix}][fields][3]`]: 'height',
  };
}

// ── Space Settings ────────────────────────────────────────────────────────────

import type { DocumentationSpaceSetting } from '@/lib/domain/types';

export async function getSpaceSettings(): Promise<DocumentationSpaceSetting | null> {
  const res = await strapiGet<StrapiListResponse<DocumentationSpaceSetting>>(
    '/api/documentation-space-settings',
    {
      params: {
        space: config.spaceSlug,
        'populate[colors]': 'true',
        'populate[typography]': 'true',
        'populate[spacing]': 'true',
        'populate[layout]': 'true',
        ...mediaPopulate('favicon'),
        ...mediaPopulate('sidebarLogo'),
        ...mediaPopulate('logoLightMode'),
        ...mediaPopulate('ogDefaultImage'),
      },
    }
  );
  return res.data[0] ?? null;
}

// ── Sections ──────────────────────────────────────────────────────────────────

import type { DocumentationSection } from '@/lib/domain/types';

export async function getSections(locale: string): Promise<DocumentationSection[]> {
  return strapiGetAll<DocumentationSection>('/api/documentation-sections', {
    params: {
      space: config.spaceSlug,
      locale,
      // `id` desempata: con el mismo `order` en dos páginas, uno podría repetirse y otro faltar.
      'sort': 'order:asc,id:asc',
    },
  });
}

// ── Categories ────────────────────────────────────────────────────────────────

import type { DocumentationCategory, SidebarCategory } from '@/lib/domain/types';

export async function getCategoriesWithArticles(
  locale: string,
  sectionSlug?: string
): Promise<SidebarCategory[]> {
  const params: Record<string, string | number | boolean | undefined> = {
    space: config.spaceSlug,
    locale,
    'sort': 'order:asc,id:asc',
    'populate[articles][fields][0]': 'title',
    'populate[articles][fields][1]': 'slug',
    'populate[articles][fields][2]': 'order',
    'populate[documentation_section][fields][0]': 'name',
    'populate[documentation_section][fields][1]': 'slug',
  };

  if (sectionSlug) {
    params['section'] = sectionSlug;
  }

  const categories = await strapiGetAll<DocumentationCategory>('/api/documentation-categories', { params });

  return categories.map((cat) => ({
    ...cat,
    articles: (cat.articles ?? []).toSorted((a, b) => a.order - b.order),
  }));
}

export async function getCategoryBySlug(
  slug: string,
  locale: string
): Promise<DocumentationCategory | null> {
  const res = await strapiGet<StrapiListResponse<DocumentationCategory>>(
    '/api/documentation-categories',
    {
      params: {
        space: config.spaceSlug,
        locale,
        'filters[slug][$eq]': slug,
        'populate[documentation_section][fields][0]': 'name',
        'populate[documentation_section][fields][1]': 'slug',
      },
    }
  );
  return res.data[0] ?? null;
}

// ── Articles ──────────────────────────────────────────────────────────────────

import type { DocumentationArticle } from '@/lib/domain/types';

const articleFullPopulate: Record<string, string> = {
  'populate[category][fields][0]': 'name',
  'populate[category][fields][1]': 'slug',
  'populate[category][populate][documentation_section][fields][0]': 'name',
  'populate[category][populate][documentation_section][fields][1]': 'slug',
  'populate[ogImage][fields][0]': 'url',
  'populate[ogImage][fields][1]': 'alternativeText',
  'populate[ogImage][fields][2]': 'width',
  'populate[ogImage][fields][3]': 'height',
};

export async function getArticleBySlug(
  slug: string,
  locale: string,
  draft = false
): Promise<DocumentationArticle | null> {
  const res = await strapiGet<StrapiListResponse<DocumentationArticle>>(
    '/api/documentation-articles',
    {
      params: {
        space: config.spaceSlug,
        locale,
        'filters[slug][$eq]': slug,
        ...articleFullPopulate,
        ...(draft ? { status: 'draft' } : {}),
      },
      withToken: draft,
    }
  );
  return res.data[0] ?? null;
}

/** Artículo por documentId para Live Preview. Siempre envía el token:
 *  el backend exige `Authorization: Bearer` para `status=draft`. */
export async function getArticleByDocumentId(
  documentId: string,
  locale: string,
  status: 'draft' | 'published' = 'draft'
): Promise<DocumentationArticle | null> {
  const res = await strapiGet<StrapiListResponse<DocumentationArticle>>(
    '/api/documentation-articles',
    {
      params: {
        space: config.spaceSlug,
        locale,
        'filters[documentId][$eq]': documentId,
        ...articleFullPopulate,
        status,
      },
      withToken: true,
    }
  );
  return res.data[0] ?? null;
}

export async function getArticlesByCategory(
  categorySlug: string,
  locale: string
): Promise<Pick<DocumentationArticle, 'id' | 'documentId' | 'title' | 'slug' | 'order'>[]> {
  return strapiGetAll<DocumentationArticle>('/api/documentation-articles', {
    params: {
      space: config.spaceSlug,
      locale,
      'filters[category][slug][$eq]': categorySlug,
      'sort': 'order:asc,title:asc,id:asc',
      'fields[0]': 'title',
      'fields[1]': 'slug',
      'fields[2]': 'order',
    },
  });
}
