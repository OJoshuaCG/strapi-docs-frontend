import iconNodes from 'lucide-static/icon-nodes.json';

/** Elementos de un icono de Lucide: `[etiqueta, atributos]`. */
export type IconNode = [string, Record<string, string>][];

/** Logos de marca que Lucide no trae, dibujados igual que Lucide (24×24, solo trazo de 2, color del texto).
 *  `whatsapp`: «brand-whatsapp» de Tabler Icons (licencia MIT), que sigue esa misma rejilla y trazo. */
const brandNodes: Record<string, IconNode> = {
  whatsapp: [
    ['path', { d: 'M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9' }],
    ['path', { d: 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1' }],
  ],
};

const nodes = { ...(iconNodes as unknown as Record<string, IconNode>), ...brandNodes };

/** Elementos del icono con ese nombre (Lucide: `mic`, `key-round`…; o un logo de `brandNodes`), o `null`.
 *  Strapi guarda solo el nombre; un valor desconocido (un emoji, un error) se ignora. */
export function getIconNodes(name: string | null | undefined): IconNode | null {
  if (!name || !Object.hasOwn(nodes, name)) return null;
  return nodes[name] ?? null;
}

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** El icono como texto SVG, para el HTML que arma el render de Markdown. Vacío si no existe. */
export function iconSvg(name: string, size = 20, className = ''): string {
  const icon = getIconNodes(name);
  if (!icon) return '';
  const children = icon
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${escapeAttr(v)}"`).join(' ')}/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${className ? ` class="${escapeAttr(className)}"` : ''}>${children}</svg>`;
}

/** Primer nombre válido de la lista (p. ej. el de la categoría y luego el de su sección).
 *  Nunca se elige un icono por el nombre de la categoría: sin dato, no hay icono. */
export function firstIconName(...names: (string | null | undefined)[]): string | null {
  return names.find((name) => getIconNodes(name) !== null) ?? null;
}
