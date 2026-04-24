// Runtime config — never compiled into client bundles

function optionalEnv(key: string, fallback: string): string {
  const value = import.meta.env[key as keyof ImportMetaEnv];
  return (value as string | undefined) ?? fallback;
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
