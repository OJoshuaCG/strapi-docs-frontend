# Diagramas en artículos

El cuerpo de un artículo (Markdown) admite dos motores de diagramas. Ambos se renderizan en el navegador, con los colores del tema (claro y oscuro) y la fuente del sitio; el bloque se carga solo en las páginas que tienen un diagrama.

| Bloque | Motor | Úsalo para |
|---|---|---|
| ` ```dot ` (o ` ```graphviz `) | Graphviz | **Diagramas de flujo clásicos**: rombos de decisión con el "Sí" hacia abajo y el "No" saliendo por un lado. |
| ` ```mermaid ` | Mermaid 12 | Secuencia, estados, clases, entidad-relación, Gantt, línea de tiempo, mapas mentales, etc. |

> Mermaid no permite fijar por qué lado sale cada rama de un rombo; por eso los diagramas de flujo de procedimientos van en Graphviz.

## Plantilla de diagrama de flujo (Graphviz)

```dot
digraph flujo {
  // 1. Nodos. group=principal mantiene el camino principal en una línea recta.
  inicio   [group=principal, label="Inicio", shape=oval];
  paso     [group=principal, label="Haz el primer paso"];
  decision [group=principal, label="¿Se cumple\nla condición?", shape=diamond];
  corregir [label="Corrige el problema"];
  union1   [group=principal, shape=point, width=0.01, height=0.01];
  fin      [group=principal, label="Fin", shape=oval];

  // 2. La rama lateral queda a la altura del rombo.
  { rank=same; decision; corregir; }

  // 3. Conexiones.
  inicio -> paso -> decision;
  decision -> union1 [taillabel="Sí", arrowhead=none];
  decision:e -> corregir:w [taillabel="No"];
  corregir -> union1 [arrowhead=none];
  union1 -> fin;
}
```

## Reglas

1. **Camino principal:** pon `group=principal` en todos los nodos del camino "feliz" (incluidos los puntos de unión). Así las flechas entran y salen por las puntas de los rombos.
2. **Rama lateral:** declara el nodo de la rama en la misma fila que el rombo con `{ rank=same; rombo; rama; }` y conéctalo con `rombo:e -> rama:w`.
3. **Etiquetas de las ramas:** usa `taillabel="Sí"` en las flechas que salen de un rombo: la etiqueta queda junto a la punta del rombo. Para otras flechas, `xlabel="…"`. Nunca uses `label=`: las líneas son ortogonales y Graphviz no la coloca.
4. **Unir ramas:** cuando dos caminos se juntan antes de un nodo, usa un punto de unión (`shape=point, width=0.01, height=0.01`) y conecta las ramas a él con `arrowhead=none`. No apuntes varias flechas directamente a un rombo: con líneas ortogonales la flecha puede quedar flotando junto al rombo.
5. **Bucles (volver a intentar):** se resuelven igual, con un punto de unión antes del paso al que se vuelve. Ejemplo: `recarga -> union2 [arrowhead=none]`, con `cierra -> union2 [arrowhead=none]; union2 -> aparece;`.
6. **Saltos de línea:** Graphviz no ajusta el texto solo. Corta las líneas con `\n`. En los rombos, usa 2–3 líneas cortas (de unas 12–18 letras): el rombo crece el doble que su texto.
7. **Agrupar por pantalla o actor:** usa `subgraph cluster_nombre { label="En Cirox"; ... }`. El nombre debe empezar con `cluster_`. Declara dentro del cluster todos sus nodos, incluidos los puntos de unión.
8. **Formas:** `shape=oval` para inicio y fin, `shape=diamond` para decisiones; los pasos no llevan `shape`.
9. **No pongas colores, fuentes ni estilos** (`color`, `fillcolor`, `fontname`, `style`…): el portal aplica los del tema y los adapta al modo oscuro. Los rombos se dibujan con puntas rectas automáticamente para que las líneas toquen el vértice.
10. **Dirección:** usa la dirección por defecto (de arriba hacia abajo). No uses `rankdir=LR` en diagramas con bucles: las líneas de retorno atraviesan los nodos.
11. **Resumen en texto:** acompaña cada diagrama de flujo con los pasos en una lista numerada o un párrafo. Los lectores de pantalla no siguen el orden del diagrama, y el texto también sirve para buscar.

## Qué se bloquea por seguridad

- **Graphviz:** el SVG se sanitiza con DOMPurify. Se eliminan los enlaces (`URL`, `href`), las imágenes (`image`), los estilos, los `id` y las clases (`class`). El código fuente tiene un máximo de 20 000 caracteres.
- **Mermaid:** se renderiza con `securityLevel: 'strict'`. Las directivas `%%{init}%%` y el `config:` del frontmatter no pueden cambiar el tema, el CSS, la fuente ni el layout.
- Si un diagrama tiene un error de sintaxis, se muestra "No se pudo renderizar el diagrama." y el detalle queda en la consola del navegador.

## Ejemplo completo: conectar un número de WhatsApp

```dot
digraph conectar_whatsapp {
  inicio [group=principal, label="Inicio", shape=oval];
  requisitos [group=principal, label="Verifica los requisitos previos:\nMeta Business Manager con rol de administrador,\nsitio web activo, número de teléfono y moneda en USD"];

  subgraph cluster_cirox1 {
    label="En Cirox";
    menu [group=principal, label="Menú WhatsApp → Números"];
    conectar [group=principal, label="Clic en Conectar con Facebook"];
  }

  subgraph cluster_meta {
    label="En la ventana emergente de Meta";
    sesion [group=principal, label="¿Tienes sesión\niniciada\nen Facebook?", shape=diamond];
    login [label="Ingresa correo y contraseña\ny haz clic en Iniciar sesión"];
    portafolio [group=principal, label="Selecciona el portafolio\nde negocios de Meta"];
    tipo [group=principal, label="¿Qué número\nvas a conectar?", shape=diamond];
    alta [label="Da de alta el número siguiendo\nlas instrucciones en pantalla"];
    activo [group=principal, label="¿Está activo\nen la app de\nWhatsApp?", shape=diamond];
    migra [label="Migra el número a\nWhatsApp Business\n(Meta te guía)"];
    codigo [group=principal, label="Elige cómo recibir el código:\nllamada telefónica o SMS"];
    verifica [group=principal, label="Ingresa el código de verificación"];
    exito [group=principal, label="Meta muestra el mensaje de éxito"];
    union1 [group=principal, shape=point, width=0.01, height=0.01];
    { rank=same; sesion; login; }
    { rank=same; tipo; alta; }
    { rank=same; activo; migra; }
  }

  subgraph cluster_cirox2 {
    label="De vuelta en Cirox";
    cierra [group=principal, label="Cierra la ventana y regresa a Cirox"];
    aparece [group=principal, label="¿Aparece\nel número en\nla lista?", shape=diamond];
    recarga [label="Recarga la página"];
    union2 [group=principal, shape=point, width=0.01, height=0.01];
    { rank=same; aparece; recarga; }
  }

  listo [group=principal, label="Número listo para usarse", shape=oval];

  inicio -> requisitos -> menu -> conectar -> sesion;
  sesion:s -> portafolio [taillabel="Sí"];
  sesion:e -> login:w [taillabel="No"];
  login:s -> portafolio;
  portafolio -> tipo;
  tipo -> union1 [taillabel="Ya registrado", arrowhead=none];
  union1 -> activo;
  tipo:e -> alta:w [taillabel="Nuevo"];
  alta -> union1 [arrowhead=none];
  activo:s -> codigo [taillabel="No"];
  activo:e -> migra:w [taillabel="Sí"];
  migra:s -> codigo;
  codigo -> verifica -> exito -> cierra;
  cierra -> union2 [arrowhead=none];
  union2 -> aparece;
  aparece:s -> listo [taillabel="Sí"];
  aparece:e -> recarga:w [taillabel="No"];
  recarga -> union2 [arrowhead=none];
}
```

## Probar un diagrama antes de publicarlo

- Graphviz: [Graphviz Online](https://dreampuf.github.io/GraphvizOnline/). Agrega `graph [splines=ortho];` al principio para ver las líneas como en el portal.
- Mermaid: [Mermaid Live Editor](https://mermaid.live/).

Los colores y la fuente finales son los del portal; los editores online solo validan la estructura.

## Implementación

- `src/lib/utils/markdown.ts`: convierte los bloques `mermaid`, `dot` y `graphviz` en `<div class="diagram-wrapper" data-engine="…">` con el código fuente oculto.
- `src/components/pages/ArticlePage.astro`: carga bajo demanda el renderizador de cada motor.
- `src/lib/client/graphviz-renderer.ts`: inyecta los estilos del tema en el DOT, ejecuta Graphviz (WASM, `@hpcc-js/wasm-graphviz`), sanitiza el SVG y compensa el ancho de la fuente del sitio.
- `src/lib/client/mermaid-renderer.ts`: configura Mermaid con el tema y bloquea las directivas.
- `src/lib/client/diagram-theme.ts`: lectura de colores del tema, re-render serializado al cambiar de tema y salida en el DOM.
- `src/styles/global.css`: sección "Diagrams".
