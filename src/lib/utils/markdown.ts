import { Marked, Renderer, type Token, type Tokens } from 'marked';
import { codeToHtml } from 'shiki';
import { slugify } from './slugify';
import { iconSvg } from './icons';
import { getUi, type UiDictionary } from '@/lib/i18n/ui';
import type { TocEntry } from '@/lib/domain/types';

// Recuadros con la sintaxis de GitHub (`> [!NOTE]`, `> [!WARNING]`…). Se reducen a dos tipos:
// la nota sigue los colores del tema; la advertencia es ámbar fijo para que siempre se reconozca.
type CalloutKind = 'note' | 'warning';
const calloutKinds: Record<string, CalloutKind> = {
  NOTE: 'note',
  TIP: 'note',
  IMPORTANT: 'warning',
  WARNING: 'warning',
  CAUTION: 'warning',
};
const calloutMarker = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i;
const calloutIcon: Record<CalloutKind, string> = { note: 'info', warning: 'triangle-alert' };

/** Si la cita empieza con un marcador, lo quita de su primer párrafo y devuelve el tipo. */
function takeCalloutKind(token: Tokens.Blockquote): CalloutKind | null {
  const paragraph = token.tokens[0];
  if (paragraph?.type !== 'paragraph') return null;
  const para = paragraph as Tokens.Paragraph;
  const first = para.tokens[0];
  if (first?.type !== 'text') return null;
  const text = first as Tokens.Text;
  const match = text.text.match(calloutMarker);
  if (!match) return null;

  const strip = (s: string) => s.replace(calloutMarker, '');
  text.text = strip(text.text);
  text.raw = strip(text.raw);
  para.text = strip(para.text);
  para.raw = strip(para.raw);
  if (text.text.trim() === '') para.tokens.shift();
  // `> [!WARNING]` solo en su línea y el texto en el párrafo siguiente.
  if (para.tokens.length === 0) token.tokens.shift();
  return calloutKinds[match[1]!.toUpperCase()] ?? null;
}

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

async function buildCodeBlock(raw: string, lang: string, ui: UiDictionary): Promise<string> {
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
    <button class="copy-btn" data-code="${escapeAttr(raw)}" data-label="${escapeAttr(ui.copy)}" data-copied="${escapeAttr(ui.copied)}" data-error="${escapeAttr(ui.copyError)}" type="button" aria-label="${escapeAttr(ui.copyCode)}">${escapeAttr(ui.copy)}</button>
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

export async function renderMarkdown(body: string, locale: string): Promise<RenderedMarkdown> {
  const ui = getUi(locale);
  const calloutCache = new WeakMap<object, CalloutKind>();
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
      // Antes de cualquier await: marked recorre los hijos de la cita justo después de esta llamada.
      if (token.type === 'blockquote') {
        const kind = takeCalloutKind(token as Tokens.Blockquote);
        if (kind) calloutCache.set(token as object, kind);
        return;
      }
      if (token.type === 'code') {
        const html = await buildCodeBlock(token.text, token.lang ?? '', ui);
        codeCache.set(token as object, html);
      }
    },
    renderer: {
      code(token: Tokens.Code) {
        const engine = diagramEngine(token.lang);
        if (engine) {
          // Focusable region so keyboard users can scroll a wide diagram.
          return `<div class="${diagramWrapperClass[engine]}" role="region" aria-label="${escapeAttr(ui.diagram)}" data-error-message="${escapeAttr(ui.diagramError)}" data-expand="${escapeAttr(ui.expand)}" data-zoom-in="${escapeAttr(ui.zoomIn)}" data-zoom-out="${escapeAttr(ui.zoomOut)}" data-zoom-fit="${escapeAttr(ui.zoomFit)}" data-close="${escapeAttr(ui.close)}" tabindex="0" data-engine="${engine}" data-rendered="false">
  <pre class="diagram-source">${escapeAttr(token.text)}</pre>
</div>`;
        }
        return codeCache.get(token as object) ?? `<pre><code>${token.text}</code></pre>`;
      },
      table(token: Tokens.Table) {
        // Contenedor para el borde redondeado y el desplazamiento lateral en celular.
        return `<div class="table-wrapper">${Renderer.prototype.table.call(this, token)}</div>\n`;
      },
      blockquote(token: Tokens.Blockquote) {
        const body = this.parser.parse(token.tokens);
        // En la ayuda una cita (`>`) siempre es una nota: se ve igual que `> [!NOTE]`.
        const kind = calloutCache.get(token as object) ?? 'note';
        // «Importante:» va al inicio del primer párrafo, como en el diseño.
        const lead = `<strong class="callout-label">${escapeAttr(ui.important)}</strong>`;
        const content =
          kind === 'warning'
            ? body.startsWith('<p>') ? body.replace('<p>', `<p>${lead} `) : `<p>${lead}</p>${body}`
            : body;
        const label = kind === 'warning' ? ui.important.replace(/:$/, '') : ui.note;
        return `<div class="callout callout-${kind}" role="note" aria-label="${escapeAttr(label)}">${iconSvg(calloutIcon[kind], 20, 'callout-icon')}<div class="callout-body">${content}</div></div>\n`;
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
