# Despliegue

## Arquitectura de despliegue

El portal usa `output: 'server'` con el adaptador `@astrojs/node`. El build genera:

```
dist/
├── server/
│   └── entry.mjs    ← punto de entrada del servidor Node.js
└── client/
    └── _astro/      ← assets estáticos (JS del cliente, CSS)
```

El comando para iniciar el servidor es:
```bash
node dist/server/entry.mjs
```

Por defecto escucha en el puerto `4321`. Se puede cambiar con la variable de entorno `PORT` y `HOST`.

---

## Despliegue en cPanel (recomendado)

### Prerrequisitos

- cPanel con soporte de **Node.js** (Phusion Passenger o similar)
- Node.js 20+ disponible en el servidor

### Pasos

**1. Subir el código al servidor**

Opción A — Git:
```bash
# En el servidor, clonar el repositorio
git clone <url-del-repo> portal
cd portal
```

Opción B — FTP/SFTP: subir todos los archivos excepto `node_modules/` y `dist/`.

**2. Instalar dependencias**

```bash
npm install --production=false
```

**3. Crear el archivo `.env`**

```bash
cp .env.example .env
nano .env   # Editar con los valores reales
```

Variables mínimas:
```env
STRAPI_URL=https://strapi-admin.docs.cero208.mx
DOCUMENTATION_SPACE_SLUG=omnicanal
SUPPORTED_LOCALES=es,en
DEFAULT_LOCALE=es
```

**4. Compilar el proyecto**

```bash
npm run build
```

Esto genera la carpeta `dist/` con el servidor listo.

**5. Configurar la Node.js App en cPanel**

En cPanel → **Setup Node.js App**:

| Campo | Valor |
|---|---|
| Node.js version | 20 (o superior) |
| Application mode | Production |
| Application root | `/home/usuario/portal` (ruta absoluta) |
| Application URL | El dominio o subdominio del portal |
| Application startup file | `dist/server/entry.mjs` |

Guardar y hacer clic en **Run NPM Install** si aparece la opción.

**6. Variables de entorno en cPanel**

En la misma pantalla de Setup Node.js App, hay una sección **Environment variables**. Añadir las mismas variables del `.env`:

```
STRAPI_URL = https://strapi-admin.docs.cero208.mx
DOCUMENTATION_SPACE_SLUG = omnicanal
SUPPORTED_LOCALES = es,en
DEFAULT_LOCALE = es
```

> También es válido mantener el archivo `.env` en el servidor en lugar de usar el panel. Ambos métodos funcionan.

**7. Iniciar la aplicación**

Clic en **Start App** en cPanel. El portal estará disponible en el dominio configurado.

### Actualizar el portal en cPanel

Cuando hay cambios en el código:

```bash
# 1. Actualizar el código (git pull o subir archivos)
git pull

# 2. Instalar nuevas dependencias (si las hay)
npm install

# 3. Recompilar
npm run build

# 4. Reiniciar la app en cPanel → Node.js App → Restart
```

---

## Variables de entorno en producción

| Variable | Valor producción |
|---|---|
| `STRAPI_URL` | URL del Strapi de producción |
| `DOCUMENTATION_SPACE_SLUG` | Slug real del space |
| `STRAPI_API_TOKEN` | Dejar vacío (no se necesita para contenido publicado) |
| `SUPPORTED_LOCALES` | `es,en` (o los que tenga el space) |
| `DEFAULT_LOCALE` | `es` |
| `PORT` | Opcional. Por defecto `4321`. cPanel puede sobrescribirlo. |
| `HOST` | Opcional. Por defecto `0.0.0.0`. |

---

## Despliegue en otros entornos

### VPS / servidor propio (con PM2)

```bash
npm install
npm run build

# Instalar PM2 globalmente
npm install -g pm2

# Iniciar con PM2
pm2 start dist/server/entry.mjs --name docs-portal

# Reiniciar automáticamente al reiniciar el servidor
pm2 startup
pm2 save
```

### Vercel

Cambiar el adaptador en `astro.config.mjs`:

```bash
npm install @astrojs/vercel
```

```javascript
// astro.config.mjs
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  // ...
});
```

Las variables de entorno se configuran en el dashboard de Vercel.

### Cloudflare Pages

```bash
npm install @astrojs/cloudflare
```

```javascript
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  // ...
});
```

---

## Problemas frecuentes en producción

**El portal muestra error 500 en todas las páginas**
- Verificar que `STRAPI_URL` es accesible desde el servidor (no desde tu PC local).
- Revisar los logs del servidor: `pm2 logs docs-portal` o los logs de cPanel.

**Las imágenes no cargan**
- Las URLs de imágenes vienen de Strapi. Si Strapi usa un bucket externo (S3, Wasabi), verificar que el bucket es público.

**El tema no se aplica correctamente**
- Verificar que el space en Strapi tiene configurado `documentation-space-settings` con los tokens de color.
- Si no hay settings configurados, se usan los valores por defecto (azul/slate, fuente Inter).

**Cambios en Strapi no se reflejan**
- El portal es SSR: cada request es fresco. Si el cambio no aparece, puede ser caché del navegador. Hard refresh (`Ctrl+Shift+R`).
