// ── Strapi v5 — response wrappers ────────────────────────────────────────────

export type StrapiListResponse<T> = {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
};

export type StrapiSingleResponse<T> = {
  data: T;
  meta: Record<string, unknown>;
};

// ── Media ────────────────────────────────────────────────────────────────────

export type MediaObject = {
  url: string;
  alternativeText: string | null;
  width: number;
  height: number;
  formats?: Record<string, unknown>;
};

// ── Theme components ─────────────────────────────────────────────────────────

export type ThemeColors = {
  lightBgPrimary: string;
  lightBgSecondary: string;
  lightBgSidebar: string;
  lightTextPrimary: string;
  lightTextSecondary: string;
  lightTextMuted: string;
  lightBorderColor: string;
  lightCodeBg: string;
  lightCodeText: string;
  lightCalloutBg: string;
  lightCalloutBorder: string;
  darkBgPrimary: string;
  darkBgSecondary: string;
  darkBgSidebar: string;
  darkTextPrimary: string;
  darkTextSecondary: string;
  darkTextMuted: string;
  darkBorderColor: string;
  darkCodeBg: string;
  darkCodeText: string;
  darkCalloutBg: string;
  darkCalloutBorder: string;
  brand50: string;
  brand500: string;
  brand900: string;
};

export type ThemeTypography = {
  fontSans: string;
  fontMono: string;
  baseFontSize: string;
  baseLineHeight: string;
  headingLineHeight: string;
  paragraphSpacing: string;
  listSpacing: string;
  headingSpacingTop: string;
  headingSpacingBottom: string;
};

export type ThemeSpacing = {
  contentPaddingX: string;
  contentPaddingY: string;
  sectionGap: string;
  headerHeight: string;
  sidebarWidth: string;
};

export type ThemeLayout = {
  maxContentWidth: string;
  tocWidth: string;
  borderRadius: string;
  codeBorderRadius: string;
  transitionDuration: string;
  animationEasing: string;
};

// ── Content types ─────────────────────────────────────────────────────────────

export type DocumentationSpace = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DocumentationSection = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  icon: string | null;
  locale: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ArticleStub = {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  order: number;
};

export type DocumentationCategory = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  locale: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  articles?: ArticleStub[];
  documentation_section?: Pick<DocumentationSection, 'id' | 'documentId' | 'name' | 'slug'>;
};

// ── Content blocks ────────────────────────────────────────────────────────────

export type TextNode = {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
};

export type LinkNode = {
  type: 'link';
  url: string;
  children: TextNode[];
};

export type InlineNode = TextNode | LinkNode;

export type ParagraphBlock = {
  type: 'paragraph';
  children: InlineNode[];
};

export type HeadingBlock = {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
};

export type CodeBlock = {
  type: 'code';
  language: string | null;
  children: [{ type: 'text'; text: string }];
};

export type ImageBlock = {
  type: 'image';
  image: {
    url: string;
    alternativeText: string | null;
    width: number;
    height: number;
  };
};

export type ListItemBlock = {
  type: 'list-item';
  children: InlineNode[];
};

export type ListBlock = {
  type: 'list';
  format: 'ordered' | 'unordered';
  children: ListItemBlock[];
};

export type QuoteBlock = {
  type: 'quote';
  children: InlineNode[];
};

export type ContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | CodeBlock
  | ImageBlock
  | ListBlock
  | QuoteBlock;

// ── Article ───────────────────────────────────────────────────────────────────

export type DocumentationArticle = {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string | null;
  version: string | null;
  order: number;
  seoTitle: string | null;
  seoDescription: string | null;
  locale: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: number;
    documentId: string;
    name: string;
    slug: string;
    documentation_section?: {
      id: number;
      documentId: string;
      name: string;
      slug: string;
    };
  };
  ogImage?: MediaObject | null;
};

// ── Space Settings ────────────────────────────────────────────────────────────

export type DocumentationSpaceSetting = {
  id: number;
  documentId: string;
  siteName: string;
  siteDescription: string | null;
  headerLogoSize: 'sm' | 'md' | 'lg' | 'xl' | null;
  headerLinkText: string | null;
  headerLinkUrl: string | null;
  footerText: string | null;
  createdAt: string;
  updatedAt: string;
  favicon?: MediaObject | null;
  sidebarLogo?: MediaObject | null;
  ogDefaultImage?: MediaObject | null;
  colors?: ThemeColors;
  typography?: ThemeTypography;
  spacing?: ThemeSpacing;
  layout?: ThemeLayout;
};

// ── Composed types for UI ─────────────────────────────────────────────────────

export type SidebarCategory = DocumentationCategory & {
  articles: ArticleStub[];
};

export type TocEntry = {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  id: string;
};
