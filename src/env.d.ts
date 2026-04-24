/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly STRAPI_URL: string;
  readonly DOCUMENTATION_SPACE_SLUG: string;
  readonly STRAPI_API_TOKEN: string;
  readonly SUPPORTED_LOCALES: string;
  readonly DEFAULT_LOCALE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
