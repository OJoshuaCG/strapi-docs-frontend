// Shared helpers for the client-side diagram renderers (mermaid, graphviz):
// theme color resolution, serialized re-rendering and DOM output handling.

export type Rgb = [number, number, number];

export function resolveVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Resolves a CSS custom property to the concrete color the browser would
// paint it as. Uses a plain `var()` substitution (no color-mix()) so every
// browser serializes it as classic rgb()/rgba() — never the CSS Color 4
// `color(srgb ...)` function, which mermaid's color library (khroma) can't
// parse (verified against its source: it only accepts hex/rgb/hsl/keyword).
export function resolveOpaqueColor(varName: string): string {
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.backgroundColor = `var(${varName})`;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return resolved;
}

export function parseRgbChannels(rgb: string): Rgb | null {
  const match = rgb.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (!match) return null;
  return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
}

export function resolveRgb(varName: string): Rgb | null {
  return parseRgbChannels(resolveOpaqueColor(varName));
}

// Blends --color-brand-500 into --bg-secondary at `ratio` (0-1), computed
// manually in JS so no renderer is ever handed a color-mix() result — only
// the two unmixed base colors are resolved via the browser (always rgb()),
// and the actual mixing math happens here, independent of browser quirks.
export function brandTintedSurface(ratio = 0.12): Rgb | null {
  const brand = resolveRgb('--color-brand-500');
  const bg = resolveRgb('--bg-secondary');
  if (!brand || !bg) return bg;
  return brand.map((channel, i) => Math.round(channel * ratio + bg[i] * (1 - ratio))) as Rgb;
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Blends `color` into `base` at `ratio` (0-1 of `color`).
export function mixRgb(color: Rgb, base: Rgb, ratio: number): Rgb {
  return color.map((channel, i) => Math.round(channel * ratio + base[i] * (1 - ratio))) as Rgb;
}

export function isDarkTheme(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function rgbString([r, g, b]: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

// Graphviz only understands hex/named colors, not rgb().
export function hexString(rgb: Rgb): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

// Runs `task` serially: if it's already in flight (e.g. a rapid double-click
// on the theme toggle), queues at most one more pass right after it finishes
// instead of starting a second one in parallel.
export function createSerialRunner(task: () => Promise<void>): () => void {
  let running = false;
  let queued = false;

  async function run(): Promise<void> {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      await task();
    } finally {
      running = false;
      if (queued) {
        queued = false;
        void run();
      }
    }
  }

  return () => void run();
}

export function readSource(wrapper: HTMLElement): string {
  return wrapper.querySelector<HTMLElement>('.diagram-source')?.textContent ?? '';
}

function clearOutput(wrapper: HTMLElement): void {
  wrapper.querySelectorAll(':scope > svg, :scope > .diagram-error').forEach((el) => el.remove());
}

export function showDiagram(wrapper: HTMLElement, svg: string | SVGSVGElement): SVGSVGElement | null {
  clearOutput(wrapper);
  if (typeof svg === 'string') {
    wrapper.insertAdjacentHTML('beforeend', svg);
  } else {
    wrapper.appendChild(svg);
  }
  wrapper.dataset['rendered'] = 'true';
  const svgEl = wrapper.querySelector<SVGSVGElement>(':scope > svg');
  // Natural width, for the mobile rule that never scales a diagram up.
  const naturalWidth = svgEl?.viewBox.baseVal?.width;
  if (svgEl && naturalWidth) svgEl.style.setProperty('--diagram-width', `${naturalWidth}px`);
  return svgEl;
}

export function showDiagramError(wrapper: HTMLElement, engine: string, error: unknown): void {
  console.error(`${engine} diagram render failed:`, error);
  clearOutput(wrapper);
  const message = document.createElement('p');
  message.className = 'diagram-error';
  message.setAttribute('role', 'status');
  message.textContent = 'No se pudo mostrar el diagrama. Recarga la página; si el problema continúa, avisa al equipo de documentación.';
  wrapper.appendChild(message);
  wrapper.dataset['rendered'] = 'true';
}
