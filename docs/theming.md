# Sistema de temas

El portal no tiene colores, fuentes ni espaciados hardcodeados. Todo el sistema visual se lee de Strapi en cada request y se aplica como CSS custom properties.

## Cómo funciona

```
Strapi (documentation-space-settings)
  → getSpaceSettings()              [src/lib/strapi/client.ts]
  → buildThemeCss(settings)         [src/lib/utils/theme.ts]
  → <style> inline en <head>        [src/layouts/BaseLayout.astro]
  → CSS custom properties activas en todo el portal
```

## Variables CSS generadas

### Colores (modo claro y oscuro)

```css
:root {
  /* Marca */
  --color-brand-50:  #eff6ff;  /* fondos hover, highlights */
  --color-brand-500: #3b82f6;  /* color principal: links, elemento activo */
  --color-brand-900: #1e3a8a;  /* acento oscuro */

  /* Fondos */
  --bg-primary:      #ffffff;  /* fondo de la página */
  --bg-secondary:    #f8fafc;  /* cards, áreas secundarias */
  --bg-sidebar:      #f1f5f9;  /* fondo del sidebar */

  /* Texto */
  --text-primary:    #0f172a;  /* texto principal */
  --text-secondary:  #475569;  /* texto secundario */
  --text-muted:      #94a3b8;  /* fechas, etiquetas, labels */

  /* Bordes */
  --border-color:    #e2e8f0;

  /* Código */
  --code-bg:         #f1f5f9;
  --code-text:       #0f172a;

  /* Callouts / quotes */
  --callout-bg:      #eff6ff;
  --callout-border:  #3b82f6;
}

.dark {
  /* Mismas variables, valores para modo oscuro */
  --bg-primary:      #0f172a;
  /* ... */
}
```

### Tipografía

```css
:root {
  --font-sans:              'Inter';          /* fuente del texto general */
  --font-mono:              'JetBrains Mono'; /* fuente del código */
  --base-font-size:         16px;
  --base-line-height:       1.625;
  --heading-line-height:    1.25;
  --paragraph-spacing:      1rem;
  --list-spacing:           0.375rem;
  --heading-spacing-top:    2rem;
  --heading-spacing-bottom: 0.75rem;
}
```

### Espaciados y layout

```css
:root {
  --header-height:    3.5rem;
  --sidebar-width:    16rem;
  --content-padding-x: 1.5rem;
  --content-padding-y: 2rem;
  --max-content-width: 72rem;
  --toc-width:         14rem;
  --border-radius:     0.5rem;
  --code-border-radius: 0.5rem;
  --transition-duration: 0.2s;
}
```

## Configurar el tema en Strapi

En el Admin de Strapi: **Content Manager → Documentation Space Settings → [tu space] → colors / typography / spacing / layout**.

Todos los campos tienen valores por defecto. Solo sobrescribe los que necesitas cambiar.

## Dark mode

El toggle está en el Header (`ThemeToggle.astro`). Funciona así:

1. Al cargar la página, un script inline en `<head>` lee `localStorage('theme')`.
2. Si es `'dark'` (o si el sistema del usuario prefiere dark y no hay preferencia guardada), añade la clase `dark` al `<html>`.
3. El CSS de `.dark` reemplaza los valores de `:root` por los tokens oscuros de Strapi.
4. Al hacer clic en el toggle, se actualiza `localStorage` y se alterna la clase.

El script se ejecuta **antes** del primer paint para evitar el parpadeo de tema incorrecto.

## Usar las variables en componentes nuevos

En cualquier componente `.astro` o archivo CSS, usa las custom properties directamente:

```astro
<div style="background-color: var(--bg-secondary); color: var(--text-primary);">
  ...
</div>
```

O en Tailwind con valores arbitrarios:

```html
<div class="bg-[var(--bg-secondary)] text-[var(--text-primary)]">
  ...
</div>
```

> Prefiere `style=` para propiedades que provienen del tema. Reserva las clases de Tailwind para espaciados, flex, grid y otras propiedades estructurales que no cambian por tema.

## Valores por defecto

Si Strapi no tiene configurado algún token (o el campo está vacío), `buildThemeCss()` usa los valores por defecto definidos en `src/lib/utils/theme.ts`. El portal funciona correctamente sin ningún token configurado en Strapi.
