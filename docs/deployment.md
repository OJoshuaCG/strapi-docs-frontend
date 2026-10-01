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

### Variables de entorno: se fijan en el build

Astro 5 **inyecta en el código compilado** las variables privadas que el portal lee con `import.meta.env`. Su valor queda fijo en `dist/` en el momento de `npm run build`:

| Variable | Cuándo se lee | Si cambia en `.env`… |
|---|---|---|
| `SITE_URL` | Build (`astro.config.mjs`, vía `loadEnv`) | Recompilar |
| `STRAPI_URL` | Build | Recompilar |
| `DOCUMENTATION_SPACE_SLUG` | Build | Recompilar |
| `STRAPI_API_TOKEN` | Build | Recompilar |
| `SUPPORTED_LOCALES`, `DEFAULT_LOCALE` | Build | Recompilar |
| `PREVIEW_SECRET` | **Runtime** (lo carga `server.js` en `process.env`) | Reiniciar |

Consecuencias prácticas:

- **El `.env` debe existir y estar completo en el servidor antes de compilar.** Si una variable falta durante el build, el portal queda compilado sin ella aunque después se agregue. Por ejemplo, sin `STRAPI_API_TOKEN` el código que envía el token se elimina del bundle y el Live Preview responde `401`.
- **Cambiar el `.env` requiere recompilar** (volver a desplegar), no basta con reiniciar.
- Los valores quedan en `dist/server/` (código del servidor), **no** en el JavaScript que recibe el navegador. Aun así, trata `dist/` como sensible.

El pipeline `.cpanel.yml` valida las variables requeridas **antes** de compilar y aborta el despliegue si falta alguna (sin mostrar sus valores).

---

## Tabla de contenidos

1. [Requisitos previos](#1-requisitos-previos)
2. [Crear subdominio en cPanel](#2-crear-subdominio-en-cpanel)
3. [Conectar el repositorio con Git Version Control](#3-conectar-el-repositorio-con-git-version-control)
4. [Verificar la estructura en el servidor](#4-verificar-la-estructura-en-el-servidor)
5. [Crear el archivo .env en el servidor](#5-crear-el-archivo-env-en-el-servidor)
6. [Archivo de inicio (server.js)](#6-archivo-de-inicio-serverjs)
7. [Configurar la aplicación Node.js en cPanel](#7-configurar-la-aplicación-nodejs-en-cpanel)
8. [Desplegar con .cpanel.yml](#8-desplegar-con-cpanelyml)
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

## 3. Conectar el repositorio con Git Version Control

El código llega al servidor con **cPanel → Files → Git™ Version Control**. Cada despliegue ejecuta el pipeline definido en [`.cpanel.yml`](../.cpanel.yml).

1. En cPanel, ve a **Files** → **Git™ Version Control** → **Create**.
2. Configura:
   - **Clone URL:** la URL del repositorio (SSH recomendado; agrega la clave de despliegue del servidor en el proveedor Git).
   - **Repository Path:** `/home/tuusuario/docs.tudominio.com` (el mismo directorio del subdominio).
   - **Repository Name:** `strapi-docs-frontend`.
3. Haz clic en **Create**. cPanel clona el repositorio.
4. En **Manage** → **Basic Information**, selecciona la rama a desplegar (normalmente `main`).

> cPanel solo despliega si el working tree del servidor no tiene cambios **commiteables** pendientes. No edites archivos versionados directamente en el servidor; `.env`, `node_modules/`, `dist/` y `tmp/` están en `.gitignore` y no afectan.

---

## 4. Verificar la estructura en el servidor

Después de clonar, la estructura debe verse así:

```
docs.tudominio.com/
├── .cpanel.yml        ← pipeline de despliegue
├── server.js          ← archivo de inicio de Passenger (versionado)
├── src/
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

# Token de API Read-Only. Obligatorio para Live Preview: el backend exige
# Authorization para leer borradores (?status=draft → 401 sin token).
STRAPI_API_TOKEN=

# ─── Live Preview ─────────────────────────────────────────────────────────────
# Debe ser EXACTAMENTE el mismo valor que PREVIEW_SECRET en el .env del backend.
# Se lee en runtime: cambiarlo solo requiere reiniciar la app.
PREVIEW_SECRET=

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

> **Todas las variables salvo `PREVIEW_SECRET` se fijan en el build** (ver [Variables de entorno](#variables-de-entorno-se-fijan-en-el-build)). Crea el `.env` completo **antes** del primer despliegue.

---

## 6. Archivo de inicio (server.js)

Passenger (el gestor de Node.js de cPanel) no carga el archivo `.env` automáticamente. El repositorio incluye un [`server.js`](../server.js) que lo lee, carga las variables en `process.env` (sin pisar las que ya existan) y arranca `dist/server/entry.mjs`.

No hay que crearlo a mano: llega con el repositorio.

> **Migración desde la instalación manual:** si el servidor ya tenía un `server.js` creado a mano (sin versionar), **bórralo antes del primer despliegue con Git** (`rm ~/docs.tudominio.com/server.js`). Si no, git no puede escribir la versión del repositorio y el clon/actualización falla.

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

## 8. Desplegar con .cpanel.yml

En cPanel → **Git™ Version Control** → **Manage** → pestaña **Pull or Deploy**:

1. **Update from Remote** — trae los últimos commits de la rama.
2. **Deploy HEAD Commit** — ejecuta `.cpanel.yml`.

El pipeline hace, en orden:

| Paso | Qué hace | Si falla |
|---|---|---|
| Activar Node.js | Deriva el nodevenv de la ruta de la app: `~/nodevenv/<ruta>/22/bin/activate` | Crea la app en **Setup Node.js App** (paso 7) o ajusta `NODE_VERSION`/`NODE_ACTIVATE` en `.cpanel.yml` |
| Validar `.env` | Exige `SITE_URL`, `STRAPI_URL`, `DOCUMENTATION_SPACE_SLUG`; avisa si faltan `STRAPI_API_TOKEN` o `PREVIEW_SECRET` | Completa el `.env` (paso 5) y vuelve a desplegar |
| Dependencias | `npm install --omit=dev` | Revisa el log del despliegue |
| Build | Borra `dist/` y ejecuta `npm run build` | Revisa el log; verifica memoria disponible del plan |
| Reinicio | `touch tmp/restart.txt` (Passenger reinicia la app) | — |

El log de cada despliegue aparece en la misma pestaña. Debe terminar en `Despliegue completado exitosamente.`

> **Versión de Node.js:** el pipeline usa `NODE_VERSION="22"`. Si en **Setup Node.js App** elegiste otra versión, cámbiala en `.cpanel.yml`.

### ¿Por qué `--omit=dev`?

El único devDependency del proyecto es `typescript`. Astro incluye su propio compilador de TypeScript internamente, por lo que omitir las devDependencies no afecta el build.

### Despliegue manual (solo como respaldo)

Si el pipeline falla y necesitas compilar a mano, desde la **Terminal** de cPanel:

```bash
source /home/tuusuario/nodevenv/docs.tudominio.com/22/bin/activate && cd /home/tuusuario/docs.tudominio.com
npm install --omit=dev
rm -rf dist && npm run build
mkdir -p tmp && touch tmp/restart.txt
```

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
- [ ] `STRAPI_API_TOKEN` y `PREVIEW_SECRET` configurados (si se usa Live Preview; `PREVIEW_SECRET` igual al del backend)
- [ ] El último despliegue terminó en `Despliegue completado exitosamente.`
- [ ] `dist/server/entry.mjs` existe (compilación exitosa)
- [ ] El portal carga correctamente en el navegador
- [ ] El contenido de Strapi se muestra (artículos, categorías)
- [ ] Las imágenes de Strapi cargan correctamente
- [ ] El selector de idioma funciona (si hay más de un locale)
- [ ] La navegación entre artículos funciona

### Verificar conectividad con Strapi desde el servidor

Si el portal carga pero no muestra contenido, verifica que el servidor puede alcanzar a Strapi:

```bash
curl "https://cms.tudominio.com/api/documentation-categories?space=mi-espacio"
# Esperado: {"data":[...],"meta":{...}}
# Sin ?space= el backend responde 400 (el parámetro es obligatorio).
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

### 12.1 Cambios de código

1. Haz commit y push de los cambios a la rama que despliega cPanel.
2. En cPanel → **Git™ Version Control** → **Manage** → **Pull or Deploy**: **Update from Remote** y luego **Deploy HEAD Commit**.

El pipeline reinstala dependencias, recompila y reinicia la app.

### 12.2 Cambios en `.env`

| Variable modificada | Qué hacer |
|---|---|
| `PREVIEW_SECRET` | Reiniciar: cPanel → **Setup Node.js App** → **Restart** |
| Cualquier otra | **Deploy HEAD Commit** (recompila); reiniciar no basta |

> No es necesario redesplegar si el cambio es solo de contenido en Strapi: el portal es SSR y consulta la API en cada petición.

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
curl -s "https://cms.tudominio.com/api/documentation-categories?space=mi-espacio" | head -c 200
```

Si el resultado es vacío o un error de conexión:
- Verifica que `STRAPI_URL` en `.env` es correcto y sin trailing slash.
- Verifica que Strapi está corriendo.
- Verifica que no hay restricciones de firewall entre ambos servidores.

Después de corregir `.env`, vuelve a desplegar (**Deploy HEAD Commit**): `STRAPI_URL` se fija en el build y reiniciar no basta.

### Las imágenes de Strapi no cargan

Las URLs de imágenes vienen directamente de la API de Strapi. Si no cargan:
- Si Strapi usa almacenamiento local: verifica que `STRAPI_URL` en el portal apunta al dominio correcto donde las imágenes son accesibles.
- Si Strapi usa Wasabi/S3: verifica que el bucket es público y que las URLs están bien configuradas en Strapi.

### Un cambio en `.env` no tiene efecto

Todas las variables salvo `PREVIEW_SECRET` se fijan en el build. Vuelve a desplegar (**Deploy HEAD Commit**) para recompilar.

### El despliegue falla: `variables requeridas ausentes o vacías en .env`

El pipeline validó el `.env` antes de compilar y falta alguna de `SITE_URL`, `STRAPI_URL` o `DOCUMENTATION_SPACE_SLUG`. Complétala y vuelve a desplegar. El mensaje solo nombra la variable, nunca su valor.

### El despliegue falla: `entorno Node.js no encontrado`

La app no existe en **Setup Node.js App** o usa otra versión/ruta. Crea la app (paso 7) con *Application root* igual al directorio del repositorio, o ajusta `NODE_VERSION`/`NODE_ACTIVATE` en `.cpanel.yml`.

### El despliegue falla al clonar/actualizar: `untracked working tree files would be overwritten`

El servidor tiene un `server.js` creado a mano. Bórralo y vuelve a desplegar (ver [paso 6](#6-archivo-de-inicio-serverjs)).

### Live Preview: `401` al abrir un borrador

El portal se compiló sin `STRAPI_API_TOKEN`. Agrégalo al `.env` y vuelve a desplegar.

### Live Preview: `403`

`PREVIEW_SECRET` falta o no coincide con el del backend. Corrígelo y reinicia la app.

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
| Secrets en `.env` | App keys, JWT secrets, DB credentials | `STRAPI_API_TOKEN` (read-only) y `PREVIEW_SECRET` |
| Panel de admin | `/admin` (proteger por IP) | No aplica |
| Despliegue | Git Version Control + `.cpanel.yml` | Git Version Control + `.cpanel.yml` |
| Cambios en `.env` | Reiniciar | Recompilar (salvo `PREVIEW_SECRET`: reiniciar) |
