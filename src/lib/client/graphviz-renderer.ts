import DOMPurify from 'dompurify';
import { Graphviz } from '@hpcc-js/wasm-graphviz';
import {
  brandTintedSurface,
  createSerialRunner,
  hexString,
  readSource,
  resolveRgb,
  resolveVar,
  showDiagram,
  showDiagramError,
  type Rgb,
} from './diagram-theme';

// Graphviz layout is synchronous and runs on the main thread; cap the source
// size so a runaway diagram can't freeze the tab.
const MAX_SOURCE_LENGTH = 20_000;

const SVG_NS = 'http://www.w3.org/2000/svg';

const GRAPHVIZ_CLASSES = new Set(['graph', 'cluster', 'node', 'edge']);

// Graphviz sizes every box with its own built-in font metrics, which only
// cover a few core fonts. Lay out with Helvetica (Arial metrics), then draw
// the text in the site font via CSS — `fontScale()` compensates the width
// difference so labels never overflow their boxes.
const LAYOUT_FONT = 'Helvetica';
const FONT_SIZE = { graph: 14, node: 16, edge: 14 };

const SAMPLE_TEXT = '¿Número ya registrado en Meta? Selecciona el portafolio de negocios 0123456789';

// Ratio between the site font's width and the layout font's width for the
// same text. Never below 1: a narrower site font just leaves a bit of room.
function fontScale(fontFamily: string): number {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return 1.15;
  ctx.font = `16px ${LAYOUT_FONT}, Arial, sans-serif`;
  const layoutWidth = ctx.measureText(SAMPLE_TEXT).width;
  ctx.font = `16px ${fontFamily}, system-ui, sans-serif`;
  const siteWidth = ctx.measureText(SAMPLE_TEXT).width;
  if (!layoutWidth || !siteWidth) return 1.15;
  return Math.max(1, siteWidth / layoutWidth) * 1.04;
}

function color(rgb: Rgb | null, fallback: string): string {
  return rgb ? hexString(rgb) : fallback;
}

// Site-wide defaults, injected right after the graph's opening brace so any
// attribute the author writes later still overrides them. Clusters inherit
// the graph attributes (rounded border, left-aligned title).
function buildThemeDefaults(scale: number): string {
  const text = color(resolveRgb('--text-primary'), '#0f172a');
  const muted = color(resolveRgb('--text-secondary'), '#475569');
  const border = color(resolveRgb('--border-color'), '#e2e8f0');
  const brand = color(resolveRgb('--color-brand-500'), '#3b82f6');
  const fill = color(brandTintedSurface(), '#eff6ff');
  const size = (px: number) => (px * scale).toFixed(2);

  return [
    `graph [bgcolor="transparent", pad="0.1", nodesep="0.75", ranksep="0.45", splines="ortho",`,
    `  fontname="${LAYOUT_FONT}", fontsize="${size(FONT_SIZE.graph)}", fontcolor="${text}",`,
    `  labeljust="l", style="rounded", color="${border}", penwidth="1"];`,
    `node [shape="box", style="rounded,filled", fillcolor="${fill}", color="${brand}", penwidth="1.2",`,
    `  fontname="${LAYOUT_FONT}", fontsize="${size(FONT_SIZE.node)}", fontcolor="${text}",`,
    `  margin="0.2,0.08", height="0.42"];`,
    `edge [color="${muted}", penwidth="1.2", arrowsize="0.7",`,
    `  fontname="${LAYOUT_FONT}", fontsize="${size(FONT_SIZE.edge)}", fontcolor="${muted}"];`,
  ].join('\n');
}

function injectDefaults(source: string, defaults: string): string {
  const brace = source.indexOf('{');
  if (brace === -1) throw new Error('Graphviz source has no graph body ("{").');
  return `${source.slice(0, brace + 1)}\n${defaults}\n${source.slice(brace + 1)}`;
}

// DOT quoted IDs only treat `\"` as an escape; backslashes stay literal.
function quoteId(name: string): string {
  return `"${name.replace(/"/g, '\\"')}"`;
}

// Rounded corners trim a diamond's tips, leaving a visible gap exactly where
// the decision branches leave it. DOT has no per-shape defaults, so ask
// Graphviz which nodes are diamonds (parse only, no layout via the `nop`
// engine) and append a sharp-corner override for those at the end of the
// graph body, where it applies after the author's own declarations.
function sharpenDiamonds(graphviz: Graphviz, source: string): string {
  const parsed = JSON.parse(graphviz.layout(source, 'json', 'nop')) as {
    objects?: { name: string; shape?: string; nodes?: unknown }[];
  };
  const diamonds = (parsed.objects ?? []).filter((obj) => !obj.nodes && obj.shape === 'diamond');
  if (diamonds.length === 0) return source;

  const close = source.lastIndexOf('}');
  const overrides = diamonds.map((obj) => `${quoteId(obj.name)} [style="filled"];`).join('\n');
  return `${source.slice(0, close)}\n${overrides}\n${source.slice(close)}`;
}

// Graphviz copies author attributes straight into the SVG (URL/href links,
// images, ids, classes), so its output is untrusted markup: sanitize it as
// SVG and drop everything a flowchart doesn't need.
function sanitizeSvg(svg: string): SVGSVGElement {
  const fragment = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true },
    FORBID_TAGS: ['a', 'image', 'use', 'foreignObject', 'style', 'script'],
    FORBID_ATTR: ['style', 'href', 'xlink:href', 'target'],
    RETURN_DOM_FRAGMENT: true,
  });
  const svgEl = fragment.querySelector('svg');
  if (!svgEl) throw new Error('Graphviz produced no SVG.');
  return svgEl;
}

function polishSvg(svgEl: SVGSVGElement, scale: number): void {
  // Graphviz sizes the SVG in pt (1pt = 1.33px), which renders every diagram
  // a third larger than its font sizes say. Use the viewBox units as px.
  const viewBox = svgEl.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite)) {
    svgEl.setAttribute('width', String(viewBox[2]));
    svgEl.setAttribute('height', String(viewBox[3]));
  }

  // Undo the layout-only font upscaling; the site font fills the box instead.
  svgEl.querySelectorAll('text').forEach((textEl) => {
    const px = parseFloat(textEl.getAttribute('font-size') ?? '');
    if (Number.isFinite(px)) textEl.setAttribute('font-size', (px / scale).toFixed(2));
  });
  svgEl.querySelectorAll('g.cluster > text').forEach((title) => title.setAttribute('font-weight', '600'));

  // <title> holds internal node ids ("inicio->requisitos") and shows as a
  // native tooltip; ids would also collide across diagrams on one page.
  svgEl.querySelectorAll('title').forEach((el) => el.remove());
  svgEl.querySelectorAll('[id]').forEach((el) => {
    if (!el.closest('defs')) el.removeAttribute('id');
  });
  // Graphviz appends author `class` values to its own; keep only its own so
  // an article can't hook into site styles or scripts.
  svgEl.querySelectorAll('[class]').forEach((el) => {
    const own = (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => GRAPHVIZ_CLASSES.has(c));
    if (own.length > 0) el.setAttribute('class', own.join(' '));
    else el.removeAttribute('class');
  });

  svgEl.setAttribute('role', 'group');
  svgEl.setAttribute('aria-label', 'Diagrama');
}

// Graphviz paints edges after cluster titles, so an edge entering a cluster
// can run straight through its title. Move the titles into a layer painted
// last, each over a chip in the canvas color (CSS) that hides the edge
// underneath. Needs the SVG in the DOM: getBBox() measures the real font.
function liftClusterTitles(svgEl: SVGSVGElement): void {
  const graph = svgEl.querySelector<SVGGElement>(':scope > g.graph');
  if (!graph) return;

  const layer = document.createElementNS(SVG_NS, 'g');
  layer.setAttribute('class', 'cluster-titles');

  graph.querySelectorAll<SVGTextElement>(':scope > g.cluster > text').forEach((title) => {
    const box = title.getBBox();
    const chip = document.createElementNS(SVG_NS, 'rect');
    chip.setAttribute('class', 'cluster-title-chip');
    chip.setAttribute('x', String(box.x - 4));
    chip.setAttribute('y', String(box.y));
    chip.setAttribute('width', String(box.width + 8));
    chip.setAttribute('height', String(box.height));
    chip.setAttribute('rx', '3');
    layer.append(chip, title);
  });

  if (layer.childNodes.length > 0) graph.appendChild(layer);
}

let graphvizPromise: Promise<Graphviz> | null = null;

function loadGraphviz(): Promise<Graphviz> {
  graphvizPromise ??= Graphviz.load().catch((error: unknown) => {
    graphvizPromise = null;
    throw error;
  });
  return graphvizPromise;
}

async function renderAllOnce(wrappers: HTMLElement[]): Promise<void> {
  // Text is measured for the layout; wait for the web font to be ready.
  await document.fonts.ready;

  let graphviz: Graphviz;
  try {
    graphviz = await loadGraphviz();
  } catch (error) {
    wrappers.forEach((wrapper) => showDiagramError(wrapper, 'Graphviz', error));
    return;
  }

  const scale = fontScale(resolveVar('--font-sans'));
  const defaults = buildThemeDefaults(scale);

  for (const wrapper of wrappers) {
    try {
      const source = readSource(wrapper);
      if (source.length > MAX_SOURCE_LENGTH) {
        throw new Error(`Graphviz source exceeds ${MAX_SOURCE_LENGTH} characters.`);
      }
      const themed = sharpenDiamonds(graphviz, injectDefaults(source, defaults));
      const svgEl = sanitizeSvg(graphviz.layout(themed, 'svg', 'dot'));
      polishSvg(svgEl, scale);
      showDiagram(wrapper, svgEl);
      liftClusterTitles(svgEl);
    } catch (error) {
      showDiagramError(wrapper, 'Graphviz', error);
    }
  }
}

export function mountGraphvizDiagrams(wrappers: HTMLElement[]): void {
  const renderAll = createSerialRunner(() => renderAllOnce(wrappers));
  renderAll();
  window.addEventListener('theme-change', renderAll);
}
