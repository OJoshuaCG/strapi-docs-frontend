import { Marked } from 'marked';
import { codeToHtml } from 'shiki';
import { slugify } from './slugify';

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
type MarkedToken = { type: string; text: string; lang?: string };
const codeCache = new WeakMap<object, string>();

export async function renderMarkdown(body: string): Promise<string> {
  const marked = new Marked({
    async: true,
    gfm: true,
    breaks: false,
    walkTokens: async (token: MarkedToken) => {
      if (token.type === 'code') {
        const html = await buildCodeBlock(token.text, token.lang ?? '');
        codeCache.set(token as object, html);
      }
    },
    renderer: {
      code(token: MarkedToken) {
        return codeCache.get(token as object) ?? `<pre><code>${token.text}</code></pre>`;
      },
      heading({ text, depth }: { text: string; depth: number }) {
        const id = slugify(stripHtml(text));
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
    },
  });

  return (await marked.parse(body)) as string;
}
