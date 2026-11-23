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
  return wrapper.querySelector<SVGSVGElement>(':scope > svg');
}

export function showDiagramError(wrapper: HTMLElement, engine: string, error: unknown): void {
  console.error(`${engine} diagram render failed:`, error);
  clearOutput(wrapper);
  const message = document.createElement('p');
  message.className = 'diagram-error';
  message.setAttribute('role', 'status');
  // El texto lo pone el servidor en el idioma de la página (render de Markdown).
  message.textContent = wrapper.dataset['errorMessage'] ?? 'No se pudo mostrar el diagrama.';
  wrapper.appendChild(message);
  wrapper.dataset['rendered'] = 'true';
}

// ── Tamaño en el artículo y visor «Ampliar» ──────────────────────────────────
// A lo ancho el diagrama se reduce lo que haga falta: nunca hay desplazamiento lateral. A lo alto se
// reduce hasta el 75 % como mucho, para que la letra se siga leyendo; si aun así pasa de la altura
// máxima, se corta con un desvanecido. Si quedó por debajo del 80 % o cortado, aparece «Ampliar», que
// lo abre a tamaño real en un visor con zoom. Los textos de los botones los pone el servidor en el
// contenedor (data-*), ya en el idioma de la página.

const MAX_HEIGHT_PX = 640;
const MAX_HEIGHT_VIEWPORT = 0.7;
const MIN_SCALE_FOR_HEIGHT = 0.75;
const EXPAND_BELOW = 0.8;

const refitters = new WeakMap<HTMLElement, () => void>();

function naturalSize(svgEl: SVGSVGElement): { width: number; height: number } | null {
  const box = svgEl.viewBox.baseVal;
  return box && box.width && box.height ? { width: box.width, height: box.height } : null;
}

function availableWidth(wrapper: HTMLElement): number {
  const style = getComputedStyle(wrapper);
  return wrapper.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
}

export function fitDiagram(wrapper: HTMLElement, svgEl: SVGSVGElement): void {
  const size = naturalSize(svgEl);
  if (!size) return;
  ensureExpandButton(wrapper);

  const fit = () => {
    const current = wrapper.querySelector<SVGSVGElement>(':scope > svg');
    const natural = current && naturalSize(current);
    if (!current || !natural) return;
    const maxHeight = Math.min(MAX_HEIGHT_PX, window.innerHeight * MAX_HEIGHT_VIEWPORT);
    const widthFit = Math.min(1, availableWidth(wrapper) / natural.width);
    const heightFit = Math.max(MIN_SCALE_FOR_HEIGHT, Math.min(1, maxHeight / natural.height));
    const scale = Math.min(widthFit, heightFit);
    const height = Math.floor(natural.height * scale);
    const cropped = height > maxHeight;
    current.setAttribute('width', String(Math.floor(natural.width * scale)));
    current.setAttribute('height', String(height));
    current.style.removeProperty('max-width');
    wrapper.dataset['expandable'] = scale < EXPAND_BELOW || cropped ? 'true' : 'false';
    wrapper.dataset['cropped'] = cropped ? 'true' : 'false';
    if (cropped) {
      // Alto visible = altura máxima del diagrama + el relleno del contenedor (incluye el del botón).
      const style = getComputedStyle(wrapper);
      wrapper.style.setProperty('--diagram-max-h', `${maxHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)}px`);
    }
  };

  fit();
  // Un solo observador por contenedor: al cambiar de tema se vuelve a dibujar y basta con reajustar.
  if (!refitters.has(wrapper)) {
    refitters.set(wrapper, fit);
    let lastWidth = wrapper.clientWidth;
    new ResizeObserver(() => {
      if (wrapper.clientWidth === lastWidth) return;
      lastWidth = wrapper.clientWidth;
      refitters.get(wrapper)?.();
    }).observe(wrapper);
  } else {
    refitters.set(wrapper, fit);
  }
}

const EXPAND_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';

function ensureExpandButton(wrapper: HTMLElement): void {
  if (wrapper.querySelector(':scope > .diagram-expand')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'diagram-expand';
  button.innerHTML = EXPAND_ICON;
  const label = document.createElement('span');
  label.textContent = wrapper.dataset['expand'] ?? '';
  button.appendChild(label);
  button.addEventListener('click', () => openViewer(wrapper));
  wrapper.appendChild(button);
}

let viewer: HTMLDialogElement | null = null;

function openViewer(wrapper: HTMLElement): void {
  const source = wrapper.querySelector<SVGSVGElement>(':scope > svg');
  const natural = source && naturalSize(source);
  if (!source || !natural) return;
  const text = (key: string) => wrapper.dataset[key] ?? '';

  viewer?.remove();
  viewer = document.createElement('dialog');
  viewer.className = 'diagram-viewer';
  viewer.setAttribute('aria-label', wrapper.getAttribute('aria-label') ?? '');

  const bar = document.createElement('div');
  bar.className = 'diagram-viewer-bar';
  const title = document.createElement('span');
  title.className = 'diagram-viewer-title';
  title.textContent = wrapper.getAttribute('aria-label') ?? '';
  const percent = document.createElement('span');
  percent.className = 'diagram-viewer-percent';
  const makeButton = (label: string, content: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.textContent = content;
    return b;
  };
  const zoomOut = makeButton(text('zoomOut'), '−');
  const zoomIn = makeButton(text('zoomIn'), '+');
  const fitButton = makeButton(text('zoomFit'), text('zoomFit'));
  const close = makeButton(text('close'), '✕');
  bar.append(title, zoomOut, percent, zoomIn, fitButton, close);

  const canvas = document.createElement('div');
  // La clase del motor conserva los retoques de global.css (esquinas de nodos, títulos de grupo).
  const engineClass = wrapper.classList.contains('mermaid-wrapper') ? 'mermaid-wrapper' : 'graphviz-wrapper';
  canvas.className = `diagram-viewer-canvas ${engineClass}`;
  canvas.tabIndex = 0;
  enableDragToPan(canvas);
  const clone = source.cloneNode(true) as SVGSVGElement;
  canvas.appendChild(clone);
  viewer.append(bar, canvas);
  document.body.appendChild(viewer);

  let zoom = 1;
  const apply = () => {
    clone.setAttribute('width', String(Math.round(natural.width * zoom)));
    clone.setAttribute('height', String(Math.round(natural.height * zoom)));
    percent.textContent = `${Math.round(zoom * 100)} %`;
  };
  const setZoom = (value: number) => { zoom = Math.min(3, Math.max(0.25, value)); apply(); };
  zoomOut.addEventListener('click', () => setZoom(zoom - 0.25));
  zoomIn.addEventListener('click', () => setZoom(zoom + 0.25));
  fitButton.addEventListener('click', () => {
    const pad = 48;
    setZoom(Math.min(1, (canvas.clientWidth - pad) / natural.width, (canvas.clientHeight - pad) / natural.height));
  });
  close.addEventListener('click', () => viewer?.close());
  // Clic en el fondo oscuro (fuera del visor) también cierra.
  viewer.addEventListener('click', (event) => { if (event.target === viewer) viewer?.close(); });
  viewer.addEventListener('close', () => { viewer?.remove(); viewer = null; wrapper.querySelector<HTMLElement>('.diagram-expand')?.focus(); });

  apply();
  viewer.showModal();
}

/** Arrastrar con el botón izquierdo mueve el diagrama, como una mano. Solo con mouse: en pantallas
 *  táctiles el desplazamiento con el dedo ya lo hace el navegador. */
function enableDragToPan(canvas: HTMLElement): void {
  let start: { x: number; y: number; left: number; top: number } | null = null;

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    start = { x: event.clientX, y: event.clientY, left: canvas.scrollLeft, top: canvas.scrollTop };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('is-dragging');
    event.preventDefault(); // sin selección de texto mientras se arrastra
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!start) return;
    canvas.scrollLeft = start.left - (event.clientX - start.x);
    canvas.scrollTop = start.top - (event.clientY - start.y);
  });
  const stop = (event: PointerEvent) => {
    if (!start) return;
    start = null;
    canvas.classList.remove('is-dragging');
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
}
