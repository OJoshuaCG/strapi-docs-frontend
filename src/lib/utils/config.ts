// Runtime config — never compiled into client bundles

function optionalEnv(key: string, fallback: string): string {
  const value = import.meta.env[key as keyof ImportMetaEnv];
  return (value as string | undefined) ?? fallback;
}

const STRAPI_BASE = (import.meta.env.STRAPI_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/** Convierte una URL de media de Strapi en URL absoluta.
 *  Las URLs relativas (p.ej. /uploads/foo.png) se prefijan con STRAPI_URL. */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return url;
  return `${STRAPI_BASE}${url}`;
}

export const appConfig = {
  supportedLocales: optionalEnv('SUPPORTED_LOCALES', 'es,en')
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean),
  defaultLocale: optionalEnv('DEFAULT_LOCALE', 'es'),
} as const;

export function isValidLocale(locale: string): boolean {
  return appConfig.supportedLocales.includes(locale);
}
