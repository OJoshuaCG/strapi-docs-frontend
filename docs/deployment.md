# Despliegue del Frontend en cPanel

Guía paso a paso para desplegar el portal de documentación (Astro 5 + TypeScript) en un servidor cPanel que ya tiene soporte para Node.js.

> Esta guía **no usa Docker**. Astro se ejecuta directamente sobre Node.js mediante el selector de aplicaciones de cPanel (Phusion Passenger).

### Qué tipo de aplicación es esta

Este portal usa Astro en modo **SSR (Server-Side Rendering)** con el adaptador `@astrojs/node` en modo `standalone`. Eso significa que:

- Cada página se renderiza en el servidor al momento de la petición (no es un sitio estático).
- El build genera un **servidor Node.js completo** listo para ejecutarse.
- No hay base de datos — el portal obtiene todo el contenido consultando la API REST de Strapi.

### Qué produce el build

Un solo comando compila todo:

| Comando | Qué produce | Dónde |
|---|---|---|
| `npm run build` | Servidor Node.js + assets del cliente | `dist/` |

La carpeta `dist/` resultante tiene esta estructura:

```
dist/
├── server/
│   └── entry.mjs    ← punto de entrada del servidor Node.js
└── client/
    └── _astro/      ← JS del cliente, CSS y otros assets
```

El servidor Astro sirve **tanto las páginas SSR como los assets estáticos** desde el mismo proceso Node.js. No se necesita configuración adicional de Apache para los assets.

### Variable de entorno en tiempo de compilación

`SITE_URL` es leída en `astro.config.mjs` durante el build para configurar la URL canónica del sitio. Debe estar disponible **antes** de ejecutar `npm run build`. El resto de las variables son de tiempo de ejecución (se leen al servir cada petición).

---

## Tabla de contenidos

1. [Requisitos previos](#1-requisitos-previos)
2. [Crear subdominio en cPanel](#2-crear-subdominio-en-cpanel)
3. [Preparar los archivos localmente](#3-preparar-los-archivos-localmente)
4. [Subir los archivos al servidor](#4-subir-los-archivos-al-servidor)
5. [Crear el archivo .env en el servidor](#5-crear-el-archivo-env-en-el-servidor)
6. [Crear el archivo de inicio (server.js)](#6-crear-el-archivo-de-inicio-serverjs)
7. [Configurar la aplicación Node.js en cPanel](#7-configurar-la-aplicación-nodejs-en-cpanel)
8. [Instalar dependencias y compilar](#8-instalar-dependencias-y-compilar)
9. [Iniciar la aplicación](#9-iniciar-la-aplicación)
10. [Verificación final](#10-verificación-final)
11. [Configurar Apache (.htaccess) — restricciones de acceso](#11-configurar-apache-htaccess--restricciones-de-acceso)
12. [Actualizar el frontend](#12-actualizar-el-frontend)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Requisitos previos

Verifica que tu hosting cPanel cumple con lo siguiente **antes de continuar**:

| Requisito | Valor requerido | Cómo verificarlo |
|---|---|---|
| Node.js disponible | Versión 20, 22 o 24 | cPanel → Software → Setup Node.js App |
| Espacio en disco | Mínimo 500 MB libres | cPanel → Files → Disk Usage |
| Acceso SSH o Terminal | Necesario para npm y compilación | cPanel → Advanced → Terminal |

> **Sin acceso SSH o Terminal**, no es posible ejecutar `npm install` ni compilar el proyecto. Si tu hosting no lo ofrece, contacta al soporte antes de continuar.

El backend de Strapi debe estar desplegado y accesible desde el servidor de cPanel antes de desplegar este portal. La URL del backend se configura en `STRAPI_URL`.

---

## 2. Crear subdominio en cPanel

El portal necesita un dominio o subdominio propio. Se recomienda un subdominio dedicado, por ejemplo `docs.tudominio.com`.

1. En cPanel, ve a **Domains** → **Subdomains** (o **Domains** → **Create A New Domain** en versiones recientes).
2. Crea el subdominio:
   - **Subdomain:** `docs`
   - **Domain:** `tudominio.com`
   - **Document Root:** `/home/tuusuario/docs.tudominio.com` (cPanel lo sugiere automáticamente)
3. Haz clic en **Create**.

> El directorio raíz del subdominio (`/home/tuusuario/docs.tudominio.com`) será donde vivirá el código del portal.

---

## 3. Preparar los archivos localmente

Antes de subir al servidor, prepara un paquete limpio del código fuente.

### 3.1 Archivos que se deben subir

Solo necesitas los archivos del repositorio. **No incluyas**:
- `node_modules/` (se instala en el servidor)
- `dist/` (se compila en el servidor)
- `.env` (se crea directamente en el servidor)

### 3.2 Crear el archivo comprimido con git

Usa `git archive` — incluye exactamente los archivos rastreados por git y omite automáticamente todo lo que está en `.gitignore` (`node_modules/`, `dist/`, `.env`, etc.):

```bash
# Desde la raíz del repositorio (funciona en Windows, Mac y Linux)
git archive HEAD --output=docs-portal.zip
```

El archivo `docs-portal.zip` se crea en la raíz del repositorio.

---

## 4. Subir los archivos al servidor

### Opción A — File Manager de cPanel

1. En cPanel, ve a **Files** → **File Manager**.
2. Navega a `/home/tuusuario/docs.tudominio.com/`.
3. Haz clic en **Upload** y sube el archivo `docs-portal.zip`.
4. Una vez subido, haz clic derecho sobre el zip → **Extract**. Extrae en la misma carpeta.
5. Borra el archivo zip después de extraer.

### Opción B — FTP/SFTP (recomendado)

Usa un cliente FTP como FileZilla o WinSCP:

- **Host:** `tudominio.com`
- **Usuario:** tu usuario cPanel
- **Contraseña:** tu contraseña cPanel
- **Puerto:** 22 (SFTP — más seguro) o 21 (FTP)
- **Directorio remoto:** `/home/tuusuario/docs.tudominio.com/`

### Verificar la estructura en el servidor

Después de subir, la estructura debe verse exactamente así:

```
docs.tudominio.com/
├── src/
│   ├── lib/
│   └── pages/
├── docs/
├── public/
├── astro.config.mjs
├── package.json
├── tailwind.config.mjs
└── tsconfig.json
```

---

## 5. Crear el archivo .env en el servidor

Abre la **Terminal** de cPanel (**Advanced** → **Terminal**) y ejecuta:

```bash
cd ~/docs.tudominio.com
nano .env
```

Pega y edita el siguiente contenido con tus valores reales:

```env
# ─── URL canónica del sitio (usada en tiempo de compilación) ──────────────────
# Sin trailing slash
SITE_URL=https://docs.tudominio.com

# ─── Conexión al backend Strapi ───────────────────────────────────────────────
# URL del CMS (sin trailing slash)
STRAPI_URL=https://cms.tudominio.com

# Slug del documentation-space que renderiza este portal
DOCUMENTATION_SPACE_SLUG=mi-espacio

# Token de API Read-Only (dejar vacío para contenido publicado)
# Solo necesario para Live Preview o acceso a borradores
STRAPI_API_TOKEN=

# ─── Localización ─────────────────────────────────────────────────────────────
# Locales disponibles, en el orden en que aparecen en el selector
SUPPORTED_LOCALES=es,en

# Locale por defecto (debe estar en SUPPORTED_LOCALES)
DEFAULT_LOCALE=es

# ─── Servidor (opcionales — Passenger los configura automáticamente) ──────────
# HOST=0.0.0.0
# PORT=4321
```

Guarda con `Ctrl+O`, `Enter`, `Ctrl+X`.

> **`SITE_URL`** es la única variable que Astro lee en tiempo de compilación (en `astro.config.mjs`). Debe tener el valor correcto antes de ejecutar `npm run build`.

---

## 6. Crear el archivo de inicio (server.js)

Passenger (el gestor de Node.js de cPanel) no carga el archivo `.env` automáticamente. Por eso se crea un `server.js` que lo lee antes de arrancar el servidor Astro.

Debido a que el proyecto tiene `"type": "module"` en `package.json`, este archivo es automáticamente tratado como ESM — no se necesita la extensión `.mjs`.

```bash
nano ~/docs.tudominio.com/server.js
```

Pega exactamente este contenido:

```js
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar .env antes de arrancar el servidor Astro.
// Passenger no lo carga automáticamente.
const envPath = resolve(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
} else {
  console.warn('[server.js] .env no encontrado en:', envPath);
}

// Iniciar el servidor Astro generado por el build
import('./dist/server/entry.mjs').catch((err) => {
  console.error('[server.js] Error al iniciar el portal Astro:', err);
  process.exit(1);
});
```

Guarda con `Ctrl+O`, `Enter`, `Ctrl+X`.

> Este archivo solo se ejecuta en producción en el servidor. No lo modifiques en el repositorio local — pertenece al servidor.

---

## 7. Configurar la aplicación Node.js en cPanel

1. En cPanel, ve a **Software** → **Setup Node.js App**.
2. Haz clic en **Create Application**.
3. Configura los campos:

| Campo | Valor |
|---|---|
| **Node.js version** | 22.x (o la versión 20/24 disponible en tu host) |
| **Application mode** | Production |
| **Application root** | `/home/tuusuario/docs.tudominio.com` |
| **Application URL** | `docs.tudominio.com` |
| **Application startup file** | `server.js` |

4. Haz clic en **Create**.

### Anotar el comando de entorno virtual

Tras crear la app, cPanel muestra un bloque como este:

```
source /home/tuusuario/nodevenv/docs.tudominio.com/22/bin/activate && cd /home/tuusuario/docs.tudominio.com
```

Copia ese comando exacto — lo necesitas en el siguiente paso.

---

## 8. Instalar dependencias y compilar

En la **Terminal de cPanel**, activa el entorno y ejecuta los comandos en orden:

```bash
# 1. Activar el entorno virtual (usa el comando copiado en el paso 7)
source /home/tuusuario/nodevenv/docs.tudominio.com/22/bin/activate && cd /home/tuusuario/docs.tudominio.com

# 2. Verificar versión de Node.js
node --version   # debe mostrar v22.x.x

# 3. Instalar dependencias
npm install --omit=dev

# 4. Compilar el portal → crea dist/
npm run build
```

La compilación puede tardar entre 30 segundos y 2 minutos dependiendo del servidor.

### ¿Por qué `--omit=dev`?

El único devDependency del proyecto es `typescript`. Astro incluye su propio compilador de TypeScript internamente, por lo que omitir las devDependencies no afecta el build.

### Verificar que la compilación fue exitosa

```bash
ls dist/server/
# Debe mostrar: entry.mjs  (y posiblemente otros archivos)

ls dist/client/
# Debe mostrar: _astro/  (assets del navegador)
```

Si `dist/server/entry.mjs` no existe, revisa la sección [Troubleshooting](#13-troubleshooting).

---

## 9. Iniciar la aplicación

En cPanel → **Setup Node.js App**, busca tu aplicación y haz clic en **Start** (▶).

Espera 15–30 segundos para que el servidor Astro termine de inicializar.

---

## 10. Verificación final

Abre el subdominio en tu navegador: `https://docs.tudominio.com`

**Checklist de producción:**

- [ ] `SITE_URL` tiene la URL exacta del portal (sin trailing slash)
- [ ] `STRAPI_URL` tiene la URL exacta del backend (sin trailing slash)
- [ ] `DOCUMENTATION_SPACE_SLUG` coincide con el slug del space en Strapi
- [ ] `SUPPORTED_LOCALES` y `DEFAULT_LOCALE` son correctos
- [ ] `dist/server/entry.mjs` existe (compilación exitosa)
- [ ] El portal carga correctamente en el navegador
- [ ] El contenido de Strapi se muestra (artículos, categorías)
- [ ] Las imágenes de Strapi cargan correctamente
- [ ] El selector de idioma funciona (si hay más de un locale)
- [ ] La navegación entre artículos funciona

### Verificar conectividad con Strapi desde el servidor

Si el portal carga pero no muestra contenido, verifica que el servidor puede alcanzar a Strapi:

```bash
curl https://cms.tudominio.com/api/documentation-categories
# Esperado: {"data":[...],"meta":{...}}
```

Si retorna un error de conexión, el servidor de cPanel no puede alcanzar al backend. Verifica que Strapi esté corriendo y que no haya restricciones de firewall.

---

## 11. Configurar Apache (.htaccess) — restricciones de acceso

### Cómo sirve Astro en cPanel

Con Passenger activo, Apache actúa como proxy inverso: todas las peticiones se redirigen al proceso Node.js (el servidor Astro). El servidor Astro sirve las páginas SSR y también los assets estáticos desde `dist/client/`.

Sin embargo, si Passenger se detiene inesperadamente, Apache podría servir archivos directamente desde el directorio de la aplicación. Las reglas de `.htaccess` son la segunda capa de defensa.

### Document root y estructura

```
docs.tudominio.com/          ← document root = app root
├── .htaccess                 ← aquí van las reglas de Apache
├── server.js
├── package.json
├── astro.config.mjs
├── src/                      ← bloqueado
├── dist/                     ← bloqueado (Astro lo sirve internamente)
├── node_modules/             ← bloqueado
└── public/                   ← archivos estáticos opcionales
```

### Análisis de acceso por ruta

| Ruta | ¿Quién accede? | Política |
|---|---|---|
| `/*` (páginas del portal) | Todos los visitantes | Abierto (gestionado por Astro) |
| `/_astro/*` | Navegadores (JS/CSS del cliente) | Abierto (gestionado por Astro) |
| **`.env`, `package.json`, etc.** | **Nadie** | **Bloqueado** |
| **`src/`, `dist/`, `node_modules/`** | **Nadie** | **Bloqueado** |

> A diferencia del backend Strapi, este portal no tiene un panel de administración que proteger por IP. Todos los visitantes pueden acceder a las rutas públicas.

### Crear o editar el .htaccess

cPanel coloca un `.htaccess` con la configuración de Passenger. **No lo borres** — agrega las reglas al principio del archivo.

```bash
nano ~/docs.tudominio.com/.htaccess
```

Agrega estas reglas **al principio**, antes de cualquier directiva `Passenger*`:

```apache
# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIONES DE SEGURIDAD — ANTES de las directivas Passenger
# ══════════════════════════════════════════════════════════════════════════════

RewriteEngine On

# ── 1. Proteger archivos sensibles en la raíz ─────────────────────────────────

<FilesMatch "^(\.(env|git.*|htpasswd)|package(-lock)?\.json|astro\.config\.(mjs|ts)|tailwind\.config\.(mjs|ts)|tsconfig\.json|server\.js|yarn\.lock)$">
    Require all denied
</FilesMatch>

# ── 2. Bloquear acceso directo a directorios de código fuente ─────────────────

RewriteCond %{REQUEST_URI} ^/(src|dist|node_modules|\.git|docs)(/|$)
RewriteRule ^ - [F,L]

# ── 3. Bloquear archivos ocultos (excepto .htaccess) ─────────────────────────

RewriteCond %{REQUEST_URI} /\.(?!htaccess)
RewriteRule ^ - [F,L]

# ══════════════════════════════════════════════════════════════════════════════
# FIN DE RESTRICCIONES — configuración de Passenger a continuación
# ══════════════════════════════════════════════════════════════════════════════
```

> La regla que bloquea `/docs` evita exponer los archivos markdown de documentación interna del proyecto (la carpeta `docs/` del repositorio con estas guías).

---

## 12. Actualizar el frontend

### 12.1 Subir los cambios

1. Modifica los archivos en tu máquina local dentro del repositorio.
2. Sube solo los archivos modificados al servidor vía FTP/SFTP o File Manager.
   - **No** sobreescribas `.env`, `node_modules/` ni `dist/`.
   - `server.js` solo existe en el servidor, no en el repositorio — no lo toques.

O bien, si el servidor tiene acceso git:

```bash
cd ~/docs.tudominio.com
git pull
```

### 12.2 Recompilar y reiniciar

En la Terminal de cPanel (con el entorno activado):

```bash
cd ~/docs.tudominio.com

# Solo si hay nuevas dependencias en package.json
npm install --omit=dev

# Recompilar siempre que haya cambios en src/ o astro.config.mjs
npm run build
```

Luego reinicia desde cPanel → **Setup Node.js App** → **Restart**.

> No es necesario reiniciar si el cambio es solo de contenido en Strapi — el portal es SSR y sirve contenido fresco en cada petición.

---

## 13. Troubleshooting

### El portal muestra una página en blanco o error 500

**Causas frecuentes y cómo diagnosticarlas:**

```bash
# Verificar que el build existe
ls dist/server/entry.mjs

# Si no existe, recompilar:
npm run build
```

Revisa los logs de Passenger en cPanel → **Logs** → **Errors** o accede al archivo de log del dominio.

### Error: `Cannot find module` al iniciar

El servidor no encuentra alguna dependencia. Verifica que `node_modules/` está instalado:

```bash
ls node_modules/ | head -5
# Si está vacío o no existe:
npm install --omit=dev
```

### `dist/` desaparece o queda incompleto

`dist/` es el resultado de la compilación — no se regenera automáticamente al reiniciar. Si la carpeta se pierde o queda corrupta, vuelve a compilar:

```bash
rm -rf dist/
npm run build
```

### El portal carga pero no muestra contenido de Strapi

El servidor Astro no puede conectarse al backend. Verifica desde el servidor:

```bash
curl -s https://cms.tudominio.com/api/documentation-categories | head -c 200
```

Si el resultado es vacío o un error de conexión:
- Verifica que `STRAPI_URL` en `.env` es correcto y sin trailing slash.
- Verifica que Strapi está corriendo.
- Verifica que no hay restricciones de firewall entre ambos servidores.

Después de corregir `.env`, recompila y reinicia:
```bash
npm run build
# Luego Restart en cPanel → Setup Node.js App
```

### Las imágenes de Strapi no cargan

Las URLs de imágenes vienen directamente de la API de Strapi. Si no cargan:
- Si Strapi usa almacenamiento local: verifica que `STRAPI_URL` en el portal apunta al dominio correcto donde las imágenes son accesibles.
- Si Strapi usa Wasabi/S3: verifica que el bucket es público y que las URLs están bien configuradas en Strapi.

### Error: `SITE_URL` no tiene efecto

`SITE_URL` se lee en `astro.config.mjs` solo en tiempo de compilación. Si cambias esta variable en `.env` después del build, debes volver a compilar para que tenga efecto:

```bash
npm run build
# Luego Restart en cPanel → Setup Node.js App
```

### `server.js` reporta que `.env` no fue encontrado

El archivo `.env` debe estar en la raíz de la aplicación. En el File Manager de cPanel, activa **Show Hidden Files** para verlo. Si no existe, créalo:

```bash
nano ~/docs.tudominio.com/.env
# Pega el contenido del paso 5 y guarda.
```

### La terminal de cPanel no tiene el `node` correcto

```bash
# Activar el entorno virtual de la aplicación
source /home/tuusuario/nodevenv/docs.tudominio.com/22/bin/activate
node --version  # debe mostrar v22.x.x
```

### El selector de idioma no funciona o aparecen rutas incorrectas

Verifica que `SUPPORTED_LOCALES` y `DEFAULT_LOCALE` en `.env` coinciden exactamente con los locales configurados en Strapi (Settings → Internationalization).

---

## Notas adicionales

### Puerto del servidor Astro con Passenger

Passenger asigna automáticamente el puerto a través de la variable de entorno `PORT`. El servidor Astro la lee al arrancar. No necesitas configurar el puerto manualmente ni exponer ningún puerto externamente.

### Caché y actualizaciones de contenido

El portal es SSR puro: cada petición renderiza la página desde cero consultando la API de Strapi. No hay caché en el servidor. Si un cambio en Strapi no se refleja, es caché del navegador — usa `Ctrl+Shift+R` para hacer un hard refresh.

### Diferencia con el despliegue de Strapi

| Aspecto | Strapi (backend) | Astro (frontend) |
|---|---|---|
| Base de datos | MySQL de cPanel | No aplica |
| Entry point | `server.js` → `dist/` | `server.js` → `dist/server/entry.mjs` |
| Assets estáticos | `public/uploads/` | Servidos por Astro desde `dist/client/` |
| Secrets en `.env` | App keys, JWT secrets, DB credentials | Solo URLs y configuración de contenido |
| Panel de admin | `/admin` (proteger por IP) | No aplica |
| Reiniciar cuando... | Cambios en código o `.env` | Cambios en código o `.env` (no necesario para cambios de contenido en Strapi) |
