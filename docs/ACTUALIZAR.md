# Cómo actualizar tu copia sin descargar el ZIP

Guía para traer los cambios nuevos a `C:\Apps_React\Proyecto_Taller\MusicShop\MusicShop`
sin descomprimir nada ni copiar archivos a mano.

**Lo primero, para quitar el miedo:** estos archivos tuyos **nunca se tocan**
al actualizar, porque están en `.gitignore`:

| Archivo / carpeta | Qué contiene |
|---|---|
| `.env` | Tus contraseñas y la clave de sesión |
| `node_modules/` | Las dependencias instaladas |
| `var/uploads/` | Las fotos que hayas subido desde el panel |
| `.next/` | La caché de compilación |

---

## Opción 1 · Git (la recomendada)

La forma normal de trabajar. Una vez configurada, actualizar es **un comando**.

### Preparación (solo la primera vez)

Comprueba si tu carpeta ya es un repositorio git:

```powershell
cd C:\Apps_React\Proyecto_Taller\MusicShop\MusicShop
git status
```

**Si responde algo con `On branch...`** → ya está listo, salta al día a día.

**Si dice `not a git repository`** → tu carpeta salió del ZIP y no tiene
historial. Conéctala:

```powershell
git init
git remote add origin https://github.com/jjitaarmira1-stack/Music-Shop.git
git fetch origin arena/01a0a1db-music-shop
git checkout -b arena/01a0a1db-music-shop --track origin/arena/01a0a1db-music-shop
```

Si el último comando se queja de que hay archivos que sobrescribiría, es
porque tienes copias locales de los mismos archivos. Como el contenido del ZIP
es idéntico al del repositorio, puedes forzarlo sin perder nada propio:

```powershell
git fetch origin arena/01a0a1db-music-shop
git reset --hard origin/arena/01a0a1db-music-shop
```

> `reset --hard` descarta cambios locales en archivos **versionados**. Tu
> `.env` y tus subidas no se ven afectados: git ni los mira.

### El día a día

```powershell
git pull
```

Eso es todo. Y después, solo si hace falta:

```powershell
npm install        # únicamente si cambió package.json
npm run dev
```

### ¿Cómo sé si tengo que ejecutar `npm install`?

```powershell
git pull
git diff --name-only HEAD@{1} HEAD
```

Si en esa lista aparece `package.json` o `package-lock.json`, ejecuta
`npm install`. Si no, arranca directamente.

Regla práctica: se necesita cuando se añade o actualiza una librería. En todo
este proyecto ha pasado **una sola vez** (al añadir Argon2id y Zod).

### Ver qué ha cambiado antes de aceptarlo

```powershell
git fetch                      # descarga pero NO aplica
git log --oneline HEAD..origin/arena/01a0a1db-music-shop
git diff HEAD..origin/arena/01a0a1db-music-shop
git pull                       # ahora sí, aplicar
```

### Si `git pull` da conflicto

Ocurre si editaste el mismo archivo que yo. Para descartar tus cambios locales
y quedarte con la versión del repositorio:

```powershell
git fetch origin arena/01a0a1db-music-shop
git reset --hard origin/arena/01a0a1db-music-shop
```

Para guardar tus cambios primero y recuperarlos después:

```powershell
git stash            # los aparta
git pull
git stash pop        # los devuelve
```

---

## Opción 2 · GitHub Desktop (sin terminal)

Si prefieres botones a comandos:

1. Descarga [GitHub Desktop](https://desktop.github.com/).
2. **File → Clone repository → URL**
3. Pega `https://github.com/jjitaarmira1-stack/Music-Shop`
4. Elige la carpeta destino.
5. Arriba, en **Current branch**, selecciona `arena/01a0a1db-music-shop`.

A partir de ahí, actualizar es pulsar **Fetch origin** y luego **Pull origin**.
Verás además, en una lista visual, exactamente qué líneas cambiaron en cada
archivo.

---

## Opción 3 · Desde tu editor

**VS Code** trae git integrado. Con la carpeta abierta:

- Icono de ramas (barra lateral izquierda) → **⋯** → **Pull**
- O el contador de sincronización en la barra inferior azul.

**Cursor, WebStorm y Visual Studio** funcionan igual: todos tienen un botón de
*Pull* o *Sync*.

---

## Opción 4 · Traer un solo archivo

Útil para una corrección puntual, sin actualizar el resto:

```powershell
git fetch origin arena/01a0a1db-music-shop
git checkout origin/arena/01a0a1db-music-shop -- src/app/globals.css
```

O varios de golpe:

```powershell
git checkout origin/arena/01a0a1db-music-shop -- src/app/globals.css src/components/bits/CountUp.tsx
```

---

## Comparativa rápida

| Método | Esfuerzo por actualización | Ves qué cambió | Conserva tu `.env` |
|---|---|---|---|
| **Git (`git pull`)** | 1 comando | Sí | Sí |
| **GitHub Desktop** | 2 clics | Sí, visual | Sí |
| **Editor** | 1 clic | Sí | Sí |
| **Archivo suelto** | 1 comando | Sí | Sí |
| ~~ZIP a mano~~ | Descargar, descomprimir, copiar | No | **Riesgo de pisarlo** |

El problema real del ZIP no es la incomodidad: es que al copiar carpetas
encima **no se borran los archivos que yo elimino**. Cuando `middleware.ts`
pasó a `proxy.ts`, una copia manual te habría dejado **los dos**, y Next.js
habría cargado el antiguo. Git gestiona los borrados y renombrados solo.

---

## Preguntas frecuentes

**¿Y si tengo cambios míos que quiero conservar?**
Commítalos antes de actualizar:

```powershell
git add .
git commit -m "Mis ajustes"
git pull
```

Git fusionará ambos. Solo pedirá intervención si tocasteis las mismas líneas.

**¿Puedo volver a una versión anterior si algo se rompe?**

```powershell
git log --oneline          # localiza el commit
git checkout 295b993       # vuelve a ese punto
git checkout arena/01a0a1db-music-shop   # regresa al día
```

**¿Tengo que actualizar la base de datos?**
Solo si cambió `src/db/schema.ts`:

```powershell
npx drizzle-kit push
```

**¿Hace falta reiniciar el servidor?**
Next.js recarga en caliente casi todo. Reinícialo si cambiaron `.env`,
`next.config.ts`, `src/proxy.ts`, `src/instrumentation.ts` o `globals.css`.
