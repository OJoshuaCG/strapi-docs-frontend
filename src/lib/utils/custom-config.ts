import { appConfig } from './config';
import type { DocumentationSpaceSetting } from '@/lib/domain/types';

/**
 * `customConfig` es un JSON libre de la configuración del espacio en Strapi, con un bloque por
 * idioma porque esa configuración no se traduce:
 *
 *   { "es": { "hero": { "title": "…", "subtitle": "…" } }, "en": { … } }
 *
 * Todo es opcional y se valida aquí: lo que falta o no es texto usa el respaldo.
 */

/** `customTitle`: el título viene de customConfig (si no, es el nombre del espacio de respaldo). */
type Hero = { title: string; subtitle: string | null; customTitle: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function getHero(settings: DocumentationSpaceSetting | null, locale: string): Hero {
  const config = settings?.customConfig;
  const block = isRecord(config) && isRecord(config[locale]) ? config[locale] : {};
  const hero = isRecord(block.hero) ? block.hero : {};

  const customTitle = text(hero.title);
  return {
    title: customTitle ?? settings?.siteName ?? 'Docs',
    customTitle: customTitle !== null,
    // La descripción del espacio no se traduce: solo sirve de respaldo en el idioma por defecto,
    // para no mostrar un texto en español en la portada en inglés.
    subtitle:
      text(hero.subtitle) ??
      (locale === appConfig.defaultLocale ? text(settings?.siteDescription) : null),
  };
}
