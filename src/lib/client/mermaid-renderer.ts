import mermaid from 'mermaid';
import {
  brandTintedSurface,
  createSerialRunner,
  hexString,
  hexToRgb,
  isDarkTheme,
  mixRgb,
  readSource,
  resolveOpaqueColor,
  resolveRgb,
  resolveVar,
  rgbString,
  showDiagram,
  showDiagramError,
} from './diagram-theme';

// Config keys a diagram can't override through `%%{init}%%` directives or
// frontmatter `config:`. Mermaid's own defaults first, then everything that
// controls the look (theme, CSS, fonts, layout) so article content can't
// restyle the page or inject CSS through the diagram config.
const SECURE_KEYS = [
  'secure',
  'securityLevel',
  'startOnLoad',
  'maxTextSize',
  'suppressErrorRendering',
  'maxEdges',
  'theme',
  'themeVariables',
  'themeCSS',
  'darkMode',
  'fontFamily',
  'altFontFamily',
  'fontSize',
  'look',
  'handDrawnSeed',
  'layout',
  'htmlLabels',
  'flowchart',
  'dompurifyConfig',
];

// Categorical series palette (pie slices, chart series, git branches, venn
// sets), in fixed order. Validated with the dataviz palette checks (CVD
// separation, lightness band, chroma) against this site's light (#f8fafc) and
// dark (#1e293b) diagram surfaces; each mode has its own steps of the same
// eight hues.
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

function indexed(prefix: string, values: string[], count = values.length, from = 0): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`${prefix}${i + from}`, values[i % values.length]]),
  );
}

function buildThemeVariables() {
  const dark = isDarkTheme();
  const series = dark ? SERIES_DARK : SERIES_LIGHT;
  const surface = resolveRgb('--bg-secondary') ?? (dark ? hexToRgb('#1e293b') : hexToRgb('#f8fafc'));
  const surfaceHex = hexString(surface);
  const text = resolveVar('--text-primary');
  const muted = resolveVar('--text-secondary');
  const border = resolveVar('--border-color');
  const tinted = brandTintedSurface();

  // Section/branch fills (mindmap, timeline, kanban, treemap, journey):
  // each series hue softly tinted into the surface so labels keep the
  // regular text color in both themes.
  const sectionFills = series.map((hex) => hexString(mixRgb(hexToRgb(hex), surface, dark ? 0.35 : 0.2)));

  return {
    // Mermaid derives most secondary colors (ER attribute rows, chart
    // backgrounds, kanban cards, packet blocks...) from these two; without
    // them it falls back to a white canvas, unreadable in dark mode.
    darkMode: dark,
    background: surfaceHex,
    mainBkg: tinted ? rgbString(tinted) : surfaceHex,

    primaryColor: tinted ? rgbString(tinted) : resolveOpaqueColor('--bg-secondary'),
    primaryTextColor: text,
    primaryBorderColor: resolveVar('--color-brand-500'),
    secondaryTextColor: text,
    tertiaryTextColor: text,
    nodeTextColor: text,
    textColor: text,
    lineColor: muted,
    secondaryColor: surfaceHex,
    tertiaryColor: resolveVar('--bg-sidebar'),
    clusterBkg: surfaceHex,
    clusterBorder: border,
    // Same color as the diagram canvas (.diagram-wrapper background), so
    // edge-label chips blend in instead of showing as a darker patch.
    edgeLabelBackground: surfaceHex,
    titleColor: text,
    fontFamily: resolveVar('--font-sans'),
    // Matches the article's body text so diagrams read at the same scale
    // as the surrounding paragraphs.
    fontSize: '16px',

    // ER: alternate attribute rows on the surface instead of white.
    attributeBackgroundColorOdd: hexString(mixRgb(hexToRgb(series[0]), surface, dark ? 0.12 : 0.06)),
    attributeBackgroundColorEven: surfaceHex,

    // Sections and branches (cScale*), labels in the regular text color.
    ...indexed('cScale', sectionFills, 12),
    ...indexed('cScaleLabel', [text], 12),
    ...indexed('cScalePeer', series, 12),
    ...indexed('cScaleInv', series, 12),

    // Gantt: alternating section bands from the surface, grid in the
    // border color (defaults are light grays, glaring in dark mode).
    sectionBkgColor: hexString(mixRgb(hexToRgb(series[0]), surface, dark ? 0.14 : 0.07)),
    sectionBkgColor2: hexString(mixRgb(hexToRgb(series[0]), surface, dark ? 0.14 : 0.07)),
    altSectionBkgColor: surfaceHex,
    gridColor: border,

    // Pie: one series hue per slice, separated by surface-colored gaps.
    ...indexed('pie', series, 12, 1),
    pieOpacity: '1',
    pieStrokeColor: surfaceHex,
    pieStrokeWidth: '2px',
    pieOuterStrokeColor: border,
    pieOuterStrokeWidth: '1px',
    pieSectionTextColor: '#ffffff',
    pieTitleTextColor: text,
    pieLegendTextColor: text,

    // Git graph: branch lines/commits in series hues.
    ...indexed('git', series, 8),
    ...indexed('gitInv', series, 8),
    ...indexed('gitBranchLabel', ['#ffffff'], 8),
    commitLabelColor: text,
    commitLabelBackground: surfaceHex,
    tagLabelColor: text,
    tagLabelBackground: surfaceHex,
    tagLabelBorder: border,

    // Venn sets.
    ...indexed('venn', series, 8, 1),
    vennSetTextColor: text,
    vennTitleTextColor: text,

    xyChart: {
      backgroundColor: surfaceHex,
      titleColor: text,
      dataLabelColor: text,
      legendTextColor: text,
      xAxisTitleColor: muted,
      xAxisLabelColor: muted,
      xAxisTickColor: border,
      xAxisLineColor: border,
      yAxisTitleColor: muted,
      yAxisLabelColor: muted,
      yAxisTickColor: border,
      yAxisLineColor: border,
      plotColorPalette: series.join(','),
    },

    radar: {
      axisColor: muted,
      graticuleColor: border,
      graticuleOpacity: 1,
      curveOpacity: 0.35,
    },

    packet: {
      startByteColor: muted,
      endByteColor: muted,
      labelColor: text,
      titleColor: text,
      blockStrokeColor: border,
      blockFillColor: tinted ? rgbString(tinted) : surfaceHex,
    },
  };
}

// Fixes for diagram types that hardcode light-theme colors (or pull the wrong
// palette) instead of reading themeVariables. Mermaid scopes themeCSS to the
// diagram's own id, after its generated rules, so these win without
// !important. `themeCSS` is in SECURE_KEYS: only this config can set it.
function buildThemeCss(): string {
  const dark = isDarkTheme();
  const series = dark ? SERIES_DARK : SERIES_LIGHT;
  const surface = resolveRgb('--bg-secondary') ?? hexToRgb(dark ? '#1e293b' : '#f8fafc');
  const surfaceHex = hexString(surface);
  const text = resolveVar('--text-primary');
  const muted = resolveVar('--text-secondary');
  const border = resolveVar('--border-color');
  const tinted = brandTintedSurface();
  const tintedHex = tinted ? hexString(tinted) : surfaceHex;

  const rules = [
    // Radar curves read the soft section tones (cScale); use the series hues.
    ...series.map((hex, i) => `.radarCurve-${i}, .radarLegendBox-${i} { fill: ${hex}; stroke: ${hex}; color: ${hex}; }`),
    // treeView: labels and connector lines are hardcoded black.
    `.treeView-node-label { fill: ${text}; }`,
    `.treeView-node-line { stroke: ${muted}; }`,
    // Railroad: terminals are hardcoded light yellow.
    `.railroad-terminal rect { fill: ${tintedHex}; stroke: ${border}; }`,
    `.railroad-comment ellipse { fill: ${surfaceHex}; stroke: ${border}; }`,
    // Event modeling: lanes and UI boxes are hardcoded white; the command,
    // event and read-model boxes keep their conventional light colors, so
    // their labels need dark ink in both themes.
    `.em-swimlane > rect { fill: ${surfaceHex}; stroke: ${border}; }`,
    `.em-box > rect[fill="white"] { fill: ${tintedHex}; }`,
    `.em-box:not(:has(> rect[fill="white"])) :is(text, div, span) { fill: #0f172a; color: #0f172a; }`,
  ];

  if (dark) {
    rules.push(
      // Cynefin domains/items use light pastel fills; let the dark canvas
      // show through so the white labels stay readable.
      `.cynefinDomain { fill-opacity: 0.14; }`,
      `.cynefinConfusion { fill-opacity: 0.18; }`,
      `.cynefinItem { fill-opacity: 0.22; }`,
      // Sankey links blend with `multiply`, which turns them black on a
      // dark canvas.
      `.link { mix-blend-mode: normal; stroke-opacity: 0.45; }`,
    );
  }
  return rules.join('\n');
}

// With `useMaxWidth` (mermaid's default for every type but the flowchart
// config we set), the SVG gets width="100%" plus an inline max-width; in
// Chromium our `min-width: fit-content` then wins and stretches small
// diagrams 2-3x. Pin every diagram to its natural size instead.
function useNaturalSize(svgEl: SVGSVGElement): void {
  // Gantt is laid out to the container width on purpose; keep it fluid.
  if (svgEl.getAttribute('aria-roledescription') === 'gantt') return;
  const box = svgEl.viewBox.baseVal;
  if (!box || !box.width || !box.height) return;
  svgEl.setAttribute('width', String(box.width));
  svgEl.setAttribute('height', String(box.height));
  svgEl.style.removeProperty('max-width');
}

// Subgraph titles are centered by mermaid, which is exactly where edges
// enter the subgraph, so the edge line crosses the title text. Left-align
// each title and move all of them into a layer painted after the edges;
// the CSS gives them a background matching the subgraph fill, so any edge
// that still passes underneath is hidden behind the title.
function polishClusterTitles(svgEl: SVGSVGElement): void {
  const root = svgEl.querySelector<SVGGElement>('g.root');
  if (!root) return;

  const titlesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  titlesLayer.setAttribute('class', 'cluster-titles');

  root.querySelectorAll<SVGGElement>('g.cluster').forEach((cluster) => {
    const rect = cluster.querySelector<SVGRectElement>(':scope > rect');
    const label = cluster.querySelector<SVGGElement>(':scope > g.cluster-label');
    if (!rect || !label) return;

    const match = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/.exec(label.getAttribute('transform') ?? '');
    const rectX = parseFloat(rect.getAttribute('x') ?? '');
    if (match && Number.isFinite(rectX)) {
      label.setAttribute('transform', `translate(${rectX + 12}, ${match[2]})`);
    }

    // Only re-parent when no group between the label and g.root carries
    // its own transform; otherwise moving it would shift its position.
    let ancestor: Element | null = label.parentElement;
    while (ancestor && ancestor !== root) {
      if (ancestor.hasAttribute('transform')) return;
      ancestor = ancestor.parentElement;
    }
    titlesLayer.appendChild(label);
  });

  if (titlesLayer.childNodes.length > 0) root.appendChild(titlesLayer);
}

// Width available for a diagram inside its wrapper (content box).
function contentWidth(wrapper: HTMLElement | undefined): number | undefined {
  if (!wrapper) return undefined;
  const style = getComputedStyle(wrapper);
  const width = wrapper.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  return width > 0 ? Math.floor(width) : undefined;
}

async function renderAllOnce(wrappers: HTMLElement[]): Promise<void> {
  // Mermaid measures label text to size each box. If the web font hasn't
  // loaded yet, it measures with the fallback font and the real (wider)
  // font then overflows and gets clipped. Wait for fonts first.
  await document.fonts.ready;

  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: buildThemeVariables(),
    themeCSS: buildThemeCss(),
    securityLevel: 'strict',
    secure: SECURE_KEYS,
    // dagre places a decision's branches side by side (one continues down,
    // the other veers off to its own column), the layout online mermaid
    // editors show. ELK — mermaid 12's default — stacks every branch below
    // the diamond, which reads as a straight line instead of a decision.
    layout: 'dagre',
    flowchart: {
      // Render at natural size: with useMaxWidth the SVG is stretched to
      // the container, which blows narrow diagrams up to oversized text.
      useMaxWidth: false,
      // Wider labels before wrapping: the default 200px made boxes tall
      // and narrow and clipped long words; diamonds stay compact too.
      wrappingWidth: 280,
      nodeSpacing: 50,
      rankSpacing: 50,
      padding: 12,
    },
    // Gantt spans the width it's given; by default mermaid measures the
    // page body (wider than the article column), so the chart got scaled
    // down to ~60% and its text became unreadable.
    gantt: {
      useWidth: contentWidth(wrappers[0]),
      fontSize: 14,
      sectionFontSize: 14,
      barHeight: 28,
      barGap: 6,
      topPadding: 56,
    },
    // 32 bits per row x 26px fits the article column without scaling the
    // text down.
    packet: {
      bitWidth: 26,
      rowHeight: 36,
    },
  });

  for (let i = 0; i < wrappers.length; i++) {
    const wrapper = wrappers[i];
    try {
      // mermaid.render() reuses this id across calls; the serial runner
      // guarantees two renders never race on it.
      const { svg, bindFunctions } = await mermaid.render(`mermaid-svg-${i}`, readSource(wrapper));
      const svgEl = showDiagram(wrapper, svg);
      if (svgEl) {
        useNaturalSize(svgEl);
        polishClusterTitles(svgEl);
      }
      bindFunctions?.(wrapper);
    } catch (error) {
      showDiagramError(wrapper, 'Mermaid', error);
    }
  }
}

export function mountMermaidDiagrams(wrappers: HTMLElement[]): void {
  const renderAll = createSerialRunner(() => renderAllOnce(wrappers));
  renderAll();
  window.addEventListener('theme-change', renderAll);
}
