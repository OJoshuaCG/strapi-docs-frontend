import type { DocumentationSpaceSetting, ThemeColors, ThemeTypography, ThemeSpacing, ThemeLayout } from '@/lib/domain/types';

// Default fallback values matching Strapi defaults
const defaultColors: ThemeColors = {
  lightBgPrimary: '#ffffff',
  lightBgSecondary: '#f8fafc',
  lightBgSidebar: '#f1f5f9',
  lightTextPrimary: '#0f172a',
  lightTextSecondary: '#475569',
  lightTextMuted: '#94a3b8',
  lightBorderColor: '#e2e8f0',
  lightCodeBg: '#f1f5f9',
  lightCodeText: '#0f172a',
  lightCalloutBg: '#eff6ff',
  lightCalloutBorder: '#3b82f6',
  darkBgPrimary: '#0f172a',
  darkBgSecondary: '#1e293b',
  darkBgSidebar: '#1e293b',
  darkTextPrimary: '#f1f5f9',
  darkTextSecondary: '#94a3b8',
  darkTextMuted: '#475569',
  darkBorderColor: '#334155',
  darkCodeBg: '#1e293b',
  darkCodeText: '#e2e8f0',
  darkCalloutBg: '#1e3a8a',
  darkCalloutBorder: '#60a5fa',
  brand50: '#eff6ff',
  brand500: '#3b82f6',
  brand900: '#1e3a8a',
};

const defaultTypography: ThemeTypography = {
  fontSans: 'Inter',
  fontMono: 'JetBrains Mono',
  baseFontSize: '16px',
  baseLineHeight: '1.625',
  headingLineHeight: '1.25',
  paragraphSpacing: '1rem',
  listSpacing: '0.375rem',
  headingSpacingTop: '2rem',
  headingSpacingBottom: '0.75rem',
};

const defaultSpacing: ThemeSpacing = {
  contentPaddingX: '1.5rem',
  contentPaddingY: '2rem',
  sectionGap: '2rem',
  headerHeight: '3.5rem',
  sidebarWidth: '16rem',
};

const defaultLayout: ThemeLayout = {
  maxContentWidth: '72rem',
  tocWidth: '14rem',
  borderRadius: '0.5rem',
  codeBorderRadius: '0.5rem',
  transitionDuration: '0.2s',
  animationEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
};

export function buildThemeCss(settings: DocumentationSpaceSetting | null): string {
  const c = { ...defaultColors, ...settings?.colors };
  const t = { ...defaultTypography, ...settings?.typography };
  const s = { ...defaultSpacing, ...settings?.spacing };
  const l = { ...defaultLayout, ...settings?.layout };

  return `
    :root {
      /* Brand */
      --color-brand-50: ${c.brand50};
      --color-brand-500: ${c.brand500};
      --color-brand-900: ${c.brand900};

      /* Light mode colors */
      --bg-primary: ${c.lightBgPrimary};
      --bg-secondary: ${c.lightBgSecondary};
      --bg-sidebar: ${c.lightBgSidebar};
      --text-primary: ${c.lightTextPrimary};
      --text-secondary: ${c.lightTextSecondary};
      --text-muted: ${c.lightTextMuted};
      --border-color: ${c.lightBorderColor};
      --code-bg: ${c.lightCodeBg};
      --code-text: ${c.lightCodeText};
      --callout-bg: ${c.lightCalloutBg};
      --callout-border: ${c.lightCalloutBorder};

      /* Typography */
      --font-sans: '${t.fontSans}';
      --font-mono: '${t.fontMono}';
      --base-font-size: ${t.baseFontSize};
      --base-line-height: ${t.baseLineHeight};
      --heading-line-height: ${t.headingLineHeight};
      --paragraph-spacing: ${t.paragraphSpacing};
      --list-spacing: ${t.listSpacing};
      --heading-spacing-top: ${t.headingSpacingTop};
      --heading-spacing-bottom: ${t.headingSpacingBottom};

      /* Spacing */
      --content-padding-x: ${s.contentPaddingX};
      --content-padding-y: ${s.contentPaddingY};
      --section-gap: ${s.sectionGap};
      --header-height: ${s.headerHeight};
      --sidebar-width: ${s.sidebarWidth};

      /* Layout */
      --max-content-width: ${l.maxContentWidth};
      --toc-width: ${l.tocWidth};
      --border-radius: ${l.borderRadius};
      --code-border-radius: ${l.codeBorderRadius};
      --transition-duration: ${l.transitionDuration};
      --animation-easing: ${l.animationEasing};
    }

    .dark {
      --bg-primary: ${c.darkBgPrimary};
      --bg-secondary: ${c.darkBgSecondary};
      --bg-sidebar: ${c.darkBgSidebar};
      --text-primary: ${c.darkTextPrimary};
      --text-secondary: ${c.darkTextSecondary};
      --text-muted: ${c.darkTextMuted};
      --border-color: ${c.darkBorderColor};
      --code-bg: ${c.darkCodeBg};
      --code-text: ${c.darkCodeText};
      --callout-bg: ${c.darkCalloutBg};
      --callout-border: ${c.darkCalloutBorder};
    }
  `.trim();
}

export function buildGoogleFontsUrl(settings: DocumentationSpaceSetting | null): string {
  const t = { ...defaultTypography, ...settings?.typography };
  const families = [
    `family=${encodeURIComponent(t.fontSans)}:wght@400;500;600;700`,
    `family=${encodeURIComponent(t.fontMono)}:wght@400;500`,
  ].join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
