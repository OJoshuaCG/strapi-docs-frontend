import iconNodes from 'lucide-static/icon-nodes.json';

/** Elementos de un icono de Lucide: `[etiqueta, atributos]`. */
export type IconNode = [string, Record<string, string>][];

const nodes = iconNodes as unknown as Record<string, IconNode>;

/** Elementos del icono de Lucide con ese nombre (`mic`, `key-round`…), o `null` si no existe.
 *  Strapi guarda solo el nombre; un valor que no es de Lucide (un emoji, un error) se ignora. */
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
