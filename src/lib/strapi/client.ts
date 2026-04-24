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
        'populate[sidebarLogo][fields][0]': 'url',
        'populate[sidebarLogo][fields][1]': 'alternativeText',
        'populate[sidebarLogo][fields][2]': 'width',
        'populate[sidebarLogo][fields][3]': 'height',
        ...mediaPopulate('ogDefaultImage'),
      },
    }
  );
  return res.data[0] ?? null;
}

// ── Sections ──────────────────────────────────────────────────────────────────

import type { DocumentationSection } from '@/lib/domain/types';

export async function getSections(locale: string): Promise<DocumentationSection[]> {
  const res = await strapiGet<StrapiListResponse<DocumentationSection>>(
    '/api/documentation-sections',
    {
      params: {
        space: config.spaceSlug,
        locale,
        'sort': 'order:asc',
        'pagination[pageSize]': 100,
      },
    }
  );
  return res.data;
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
    'sort': 'order:asc',
    'pagination[pageSize]': 100,
    'populate[articles][fields][0]': 'title',
    'populate[articles][fields][1]': 'slug',
    'populate[articles][fields][2]': 'order',
    'populate[documentation_section][fields][0]': 'name',
    'populate[documentation_section][fields][1]': 'slug',
  };

  if (sectionSlug) {
    params['section'] = sectionSlug;
  }

  const res = await strapiGet<StrapiListResponse<DocumentationCategory>>(
    '/api/documentation-categories',
    { params }
  );

  return res.data.map((cat) => ({
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

export async function getArticlesByCategory(
  categorySlug: string,
  locale: string
): Promise<Pick<DocumentationArticle, 'id' | 'documentId' | 'title' | 'slug' | 'order'>[]> {
  const res = await strapiGet<StrapiListResponse<DocumentationArticle>>(
    '/api/documentation-articles',
    {
      params: {
        space: config.spaceSlug,
        locale,
        'filters[category][slug][$eq]': categorySlug,
        'sort': 'order:asc,title:asc',
        'pagination[pageSize]': 100,
        'fields[0]': 'title',
        'fields[1]': 'slug',
        'fields[2]': 'order',
      },
    }
  );
  return res.data;
}

export async function getAllArticleSlugs(locale: string): Promise<Pick<DocumentationArticle, 'slug' | 'title' | 'updatedAt'>[]> {
  const res = await strapiGet<StrapiListResponse<DocumentationArticle>>(
    '/api/documentation-articles',
    {
      params: {
        space: config.spaceSlug,
        locale,
        'pagination[pageSize]': 100,
        'fields[0]': 'slug',
        'fields[1]': 'title',
        'fields[2]': 'updatedAt',
      },
    }
  );
  return res.data;
}
