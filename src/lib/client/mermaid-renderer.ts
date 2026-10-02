import mermaid from 'mermaid';
import {
  brandTintedSurface,
  createSerialRunner,
  readSource,
  resolveOpaqueColor,
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

function buildThemeVariables() {
  const tinted = brandTintedSurface();
  return {
    primaryColor: tinted ? rgbString(tinted) : resolveOpaqueColor('--bg-secondary'),
    primaryTextColor: resolveVar('--text-primary'),
    primaryBorderColor: resolveVar('--color-brand-500'),
    nodeTextColor: resolveVar('--text-primary'),
    lineColor: resolveVar('--text-secondary'),
    secondaryColor: resolveVar('--bg-secondary'),
    tertiaryColor: resolveVar('--bg-sidebar'),
    clusterBkg: resolveVar('--bg-secondary'),
    clusterBorder: resolveVar('--border-color'),
    // Same color as the diagram canvas (.diagram-wrapper background), so
    // edge-label chips blend in instead of showing as a darker patch.
    edgeLabelBackground: resolveVar('--bg-secondary'),
    titleColor: resolveVar('--text-primary'),
    fontFamily: resolveVar('--font-sans'),
    // Matches the article's body text so diagrams read at the same scale
    // as the surrounding paragraphs.
    fontSize: '16px',
  };
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

async function renderAllOnce(wrappers: HTMLElement[]): Promise<void> {
  // Mermaid measures label text to size each box. If the web font hasn't
  // loaded yet, it measures with the fallback font and the real (wider)
  // font then overflows and gets clipped. Wait for fonts first.
  await document.fonts.ready;

  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: buildThemeVariables(),
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
  });

  for (let i = 0; i < wrappers.length; i++) {
    const wrapper = wrappers[i];
    try {
      // mermaid.render() reuses this id across calls; the serial runner
      // guarantees two renders never race on it.
      const { svg, bindFunctions } = await mermaid.render(`mermaid-svg-${i}`, readSource(wrapper));
      const svgEl = showDiagram(wrapper, svg);
      if (svgEl) polishClusterTitles(svgEl);
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
