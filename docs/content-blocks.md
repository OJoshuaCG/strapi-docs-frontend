# Bloques de contenido

El campo `content` de un artículo en Strapi es un array de bloques. Cada bloque tiene un `type` que determina cómo se renderiza.

El componente `BlockRenderer.astro` recibe el array y despacha cada bloque al renderizador correcto.

## Bloques soportados

### `paragraph` — Párrafo

```json
{
  "type": "paragraph",
  "children": [
    { "type": "text", "text": "Texto normal." },
    { "type": "text", "text": "Negrita.", "bold": true },
    { "type": "text", "text": "Cursiva.", "italic": true },
    { "type": "text", "text": "Código inline.", "code": true },
    { "type": "link", "url": "https://ejemplo.com", "children": [{ "type": "text", "text": "Enlace" }] }
  ]
}
```

**Renderiza como:** `<p>` con soporte de `bold`, `italic`, `underline`, `strikethrough`, `code` y `link`.

---

### `heading` — Título

```json
{ "type": "heading", "level": 2, "children": [{ "type": "text", "text": "Título de sección" }] }
```

`level` acepta: `1`, `2`, `3`, `4`, `5`, `6`.

**Renderiza como:** `<h2 id="titulo-de-seccion">`. El `id` se genera automáticamente con `slugify()` para que el TOC y los enlaces de ancla funcionen.

Los headings de nivel 2 en adelante aparecen automáticamente en la **Tabla de Contenidos** del artículo.

---

### `code` — Bloque de código con syntax highlighting

```json
{
  "type": "code",
  "language": "typescript",
  "children": [{ "type": "text", "text": "const x: number = 42;" }]
}
```

**Renderiza como:** bloque con header (lenguaje + botón "Copy"), syntax highlighting en modo claro (github-light) y oscuro (github-dark).

Lenguajes reconocidos (y sus alias):
| Strapi `language` | Alias también válido |
|---|---|
| `javascript` | `js` |
| `typescript` | `ts` |
| `python` | `py` |
| `bash` | `sh`, `shell` |
| `yaml` | `yml` |
| `json` | — |
| `html`, `css`, `sql`, `java`, `go`, `rust`, `php`, `ruby`, `kotlin`, `swift` | — |
| `text` | `plain` (sin colores) |

Cualquier lenguaje no reconocido cae en `plaintext` sin error.

---

### `image` — Imagen embebida

```json
{
  "type": "image",
  "image": {
    "url": "https://cdn.ejemplo.com/uploads/foto.png",
    "alternativeText": "Descripción de la imagen",
    "width": 1200,
    "height": 630
  }
}
```

**Renderiza como:** `<figure>` con `<img>` con `loading="lazy"` y `<figcaption>` si hay `alternativeText`.

---

### `list` — Lista ordenada o no ordenada

```json
{
  "type": "list",
  "format": "unordered",
  "children": [
    { "type": "list-item", "children": [{ "type": "text", "text": "Primer ítem" }] },
    { "type": "list-item", "children": [{ "type": "text", "text": "Segundo ítem" }] }
  ]
}
```

`format`: `"ordered"` (numerada, `<ol>`) o `"unordered"` (viñetas, `<ul>`).

---

### `quote` — Cita / callout

```json
{
  "type": "quote",
  "children": [{ "type": "text", "text": "Mensaje importante a destacar." }]
}
```

**Renderiza como:** `<blockquote>` con borde izquierdo en `--callout-border` y fondo `--callout-bg` (configurables desde Strapi).

---

## Añadir un nuevo tipo de bloque

1. Definir el tipo en `src/lib/domain/types.ts`:
```typescript
export type MyBlock = {
  type: 'my-block';
  myField: string;
};

// Añadir al union:
export type ContentBlock = ParagraphBlock | HeadingBlock | ... | MyBlock;
```

2. Manejar el nuevo `type` en `src/components/blocks/BlockRenderer.astro`:
```astro
// Si el bloque no necesita componente propio, añadirlo al buffer de HTML:
if (block.type === 'my-block') {
  buffer += `<div class="my-block">${escapeHtml(block.myField)}</div>\n`;
  continue;
}

// Si necesita un componente Astro propio (por ejemplo, para usar Shiki o lógica compleja):
if (block.type === 'my-block') {
  flushBuffer();
  segments.push({ kind: 'my-block', ...block });
  continue;
}
```

## Cómo funciona el renderizador internamente

El `BlockRenderer` agrupa los bloques en segmentos para evitar limitaciones de Astro con tags dinámicos y `set:html`:

1. Los bloques de texto simple (`paragraph`, `heading`, `list`, `quote`) se acumulan como string HTML y se emiten juntos con `set:html`.
2. Los bloques que requieren componentes Astro complejos (`code`, `image`) interrumpen el buffer, lo emiten, y luego se renderizan como componentes independientes.

Esto permite mezclar HTML de texto y componentes interactivos (como el CodeBlock con botón de copiado) en el orden correcto.
