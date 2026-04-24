import { appConfig, isValidLocale } from './config';
import { getSpaceSettings, getSections, getCategoriesWithArticles } from '@/lib/strapi/client';
import type {
  DocumentationSpaceSetting,
  DocumentationSection,
  SidebarCategory,
} from '@/lib/domain/types';

export type CommonPageData = {
  locale: string;
  settings: DocumentationSpaceSetting | null;
  sections: DocumentationSection[];
  sidebarCategories: SidebarCategory[];
  supportedLocales: string[];
};

export async function loadCommonData(
  rawLocale: string,
  activeSectionSlug?: string
): Promise<CommonPageData> {
  const locale = isValidLocale(rawLocale) ? rawLocale : appConfig.defaultLocale;

  const [settings, sections] = await Promise.all([
    getSpaceSettings(),
    getSections(locale),
  ]);

  // Sidebar: load categories for the active section (or first section as default)
  const targetSection =
    activeSectionSlug ??
    sections[0]?.slug;

  const sidebarCategories = targetSection
    ? await getCategoriesWithArticles(locale, targetSection)
    : [];

  return {
    locale,
    settings,
    sections,
    sidebarCategories,
    supportedLocales: appConfig.supportedLocales,
  };
}
