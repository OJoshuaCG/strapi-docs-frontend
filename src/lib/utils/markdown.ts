import { Marked, type Token, type Tokens } from 'marked';
import { codeToHtml } from 'shiki';
import { slugify } from './slugify';
import type { TocEntry } from '@/lib/domain/types';

const langMap: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  text: 'plaintext',
  plain: 'plaintext',
};

type DiagramEngine = 'mermaid' | 'graphviz';

// Fence languages rendered client-side as diagrams, mapped to their engine.
const diagramLangs: Record<string, DiagramEngine> = {
  mermaid: 'mermaid',
  dot: 'graphviz',
  graphviz: 'graphviz',
};

// Written out literally (not built from the engine name) so Tailwind's
// content scan finds them and keeps their styles in global.css.
const diagramWrapperClass: Record<DiagramEngine, string> = {
  mermaid: 'diagram-wrapper mermaid-wrapper',
  graphviz: 'diagram-wrapper graphviz-wrapper',
};

function diagramEngine(lang: string | undefined): DiagramEngine | undefined {
  return lang ? diagramLangs[lang.toLowerCase()] : undefined;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function buildCodeBlock(raw: string, lang: string): Promise<string> {
  const resolved = langMap[lang] ?? lang ?? 'plaintext';
  const displayLang = lang && lang !== 'text' && lang !== 'plain' ? lang : 'code';

  let lightHtml: string;
  let darkHtml: string;
  try {
    [lightHtml, darkHtml] = await Promise.all([
      codeToHtml(raw, { lang: resolved, theme: 'github-light' }),
      codeToHtml(raw, { lang: resolved, theme: 'github-dark' }),
    ]);
  } catch {
    [lightHtml, darkHtml] = await Promise.all([
      codeToHtml(raw, { lang: 'plaintext', theme: 'github-light' }),
      codeToHtml(raw, { lang: 'plaintext', theme: 'github-dark' }),
    ]);
  }

  return `<div class="code-block-wrapper" data-code-block>
  <div class="code-block-header">
    <span>${displayLang}</span>
    <button class="copy-btn" data-code="${escapeAttr(raw)}" type="button" aria-label="Copy code">Copy</button>
  </div>
  <div class="shiki-light dark:hidden">${lightHtml}</div>
  <div class="shiki-dark hidden dark:block">${darkHtml}</div>
</div>`;
}

// Pre-compute code blocks during walkTokens (async pass before rendering)
const codeCache = new WeakMap<object, string>();

export type RenderedMarkdown = {
  html: string;
  toc: TocEntry[];
};

export async function renderMarkdown(body: string): Promise<RenderedMarkdown> {
  // Per-render state: TOC entries and used heading ids (for unique anchors)
  const toc: TocEntry[] = [];
  const usedIds = new Set<string>();

  function uniqueId(base: string): string {
    const key = base || 'section';
    let id = key;
    for (let n = 2; usedIds.has(id); n++) id = `${key}-${n}`;
    usedIds.add(id);
    return id;
  }

  const marked = new Marked({
    async: true,
    gfm: true,
    breaks: false,
    walkTokens: async (token: Token) => {
      if (token.type === 'code' && diagramEngine(token.lang)) {
        // Diagrams are rendered client-side from their raw source; skip shiki
        // highlighting/caching for these tokens entirely.
        return;
      }
      if (token.type === 'code') {
        const html = await buildCodeBlock(token.text, token.lang ?? '');
        codeCache.set(token as object, html);
      }
    },
    renderer: {
      code(token: Tokens.Code) {
        const engine = diagramEngine(token.lang);
        if (engine) {
          // Focusable region so keyboard users can scroll a wide diagram.
          return `<div class="${diagramWrapperClass[engine]}" role="region" aria-label="Diagrama" tabindex="0" data-engine="${engine}" data-rendered="false">
  <pre class="diagram-source">${escapeAttr(token.text)}</pre>
</div>`;
        }
        return codeCache.get(token as object) ?? `<pre><code>${token.text}</code></pre>`;
      },
      heading({ tokens, depth }: Tokens.Heading) {
        const html = this.parser.parseInline(tokens);
        const text = stripHtml(this.parser.parseInline(tokens, this.parser.textRenderer)).trim();
        const id = uniqueId(slugify(text));
        if (depth >= 2) {
          toc.push({ level: depth as TocEntry['level'], text, id });
        }
        return `<h${depth} id="${id}">${html}</h${depth}>\n`;
      },
    },
  });

  const html = (await marked.parse(body)) as string;
  return { html, toc };
}
