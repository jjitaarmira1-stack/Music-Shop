# Informe final de auditoría y mejora

**Proyecto:** JPR Music Shop (tienda de instrumentos, Next.js 16 + PostgreSQL)
**Fecha:** 14 de septiembre de 2026
**Rama:** `arena/01a0a1db-music-shop`
**Documento previo:** [`docs/AUDITORIA.md`](./AUDITORIA.md) (fase 1, diagnóstico sin tocar código)

---

## Resumen para quien tenga prisa

| Indicador | Antes | Después |
|---|---|---|
| Vulnerabilidades críticas | 5 | 0 |
| Vulnerabilidades altas | 9 | 0 |
| `npm audit` | 7 (1 crítica, 2 altas) | 4 moderadas, sólo de desarrollo |
| Contraseñas | scrypt con sal reutilizada | Argon2id |
| Cuenta por defecto | `admin` / `admin` en el código | Aleatoria, mostrada una sola vez |
| Venta por encima del stock | Sí (stock llegaba a −3) | Imposible (verificado con 8 peticiones a la vez) |
| Subida de archivos | Cualquier archivo renombrado a `.jpg` | Sólo imágenes reales, comprobadas byte a byte |
| Errores de TypeScript | — | 0 |
| Avisos de ESLint | 32 | 5 (heredados, documentados) |
| Compilación de producción | Correcta | Correcta (20 rutas) |

**Nota importante sobre el alcance:** no se ha añadido ninguna funcionalidad nueva, no se ha cambiado el diseño, ni los colores, ni la tipografía, ni la distribución. Todo el código nuevo está comentado línea a línea en castellano.

---

## A. Problemas encontrados

### A.1 Críticos

| # | Problema | Consecuencia real |
|---|---|---|
| **C-1** | Contraseñas con **scrypt y sal reutilizada**, comparadas con `===` | Dos usuarios con la misma contraseña producían el mismo hash. La comparación con `===` filtraba información por tiempo de respuesta. |
| **C-2** | **Sesión sin firmar**: la cookie guardaba el identificador del usuario en texto plano | Cualquiera podía editar la cookie a mano y entrar como administrador. Control de acceso roto por completo. |
| **C-3** | **Condición de carrera en el stock**: leer y luego escribir, sin transacción | Comprobado: con 8 pedidos simultáneos sobre 1 unidad se crearon 4 pedidos y el stock quedó en **−3**. Se vendía mercancía inexistente. |
| **C-4** | **Subida de archivos sin validar**: sólo se miraba la extensión | Comprobado: un archivo con código PHP renombrado a `.jpg` se guardaba en `public/` y devolvía `201 Created`. |
| **C-5** | **Credenciales `admin`/`admin` escritas en el código** y mostradas en la pantalla de acceso y en el pie de página | Acceso total de administración a la vista de cualquier visitante. |

### A.2 Altos

| # | Problema | Consecuencia real |
|---|---|---|
| A-1 | Sin protección CSRF | Una web ajena podía borrar productos en nombre del administrador. |
| A-2 | Sin límite de intentos de acceso | Comprobado: 12 intentos seguidos, 12 respuestas. Fuerza bruta sin freno. |
| A-3 | IDOR en `GET /api/orders` | Cualquiera podía leer los pedidos de todos: nombres, correos y direcciones. |
| A-4 | Asignación masiva en productos y registro | Se podía enviar `"role":"admin"` al registrarse. |
| A-5 | Sin cabeceras de seguridad | Sin CSP, sin protección contra incrustación en marcos, sin `nosniff`. |
| A-6 | Errores con traza técnica en la respuesta | Se filtraban rutas del servidor y mensajes internos de PostgreSQL. |
| A-7 | Validación sólo en el navegador | El servidor aceptaba precios negativos y correos inválidos. |
| A-8 | Redirección abierta en `/login?next=` | Servía para montar suplantaciones creíbles. |
| A-9 | Recorrido de rutas en la galería | `../../` en el nombre permitía salir de la carpeta prevista. |

### A.3 Medios y bajos (resumen)

Sin índices en la base de datos ni restricciones `CHECK`; siembra de datos ejecutada dentro de cada lectura; peticiones `fetch` sin tiempo máximo de espera (indicadores de carga infinitos); sin reintentos; registro con `console.log` incluyendo datos personales; `AdminDashboard.tsx` de 831 líneas mezclando tres responsabilidades; sin enlace de salto al contenido; sin foco visible al navegar con teclado; el carrito no se podía cerrar con teclado; animaciones que ignoraban `prefers-reduced-motion`; restos de Vite (`index.html`, `vite.config.js`) sin uso.

---

## B. Cambios realizados

### B.1 Autenticación y sesiones

- **Argon2id** (`memoryCost=19456`, `timeCost=2`, `parallelism=1`), ganador del Password Hashing Competition y recomendación actual de OWASP.
- **Migración transparente**: los hashes antiguos de scrypt se siguen aceptando y se reescriben a Argon2id en el primer acceso correcto. *Nadie pierde su contraseña.*
- **Cookie firmada** con HMAC-SHA256: `base64url(contenido).firma`. Modificar un solo byte invalida la sesión.
- **Identificador de sesión nuevo en cada acceso** (evita la fijación de sesión).
- Cookie `httpOnly` + `sameSite=lax` + `secure` en producción, caducidad de 7 días.
- **Tiempo de respuesta constante**: si el correo no existe se verifica igualmente un hash señuelo, para que no se pueda averiguar qué correos están registrados midiendo el tiempo.

### B.2 Límite de peticiones

Cinco intentos de acceso por ventana de 15 minutos y por combinación IP + correo; 20 subidas cada 300 segundos. Respuesta `429` con cabecera `Retry-After`.

### B.3 Concurrencia y stock

Los pedidos se crean dentro de una **transacción** con `SELECT ... FOR UPDATE`, que bloquea las filas de los productos implicados hasta confirmar. Como red de seguridad final, la base de datos tiene una restricción `CHECK (stock >= 0)`: aunque un fallo futuro de la aplicación lo intentara, PostgreSQL lo rechazaría.

### B.4 Subida de archivos

Cinco controles encadenados: extensión permitida → tamaño máximo (6 MB, rechazado antes de leer el cuerpo) → **firma binaria real** (los primeros bytes deben corresponder a JPG, PNG, WebP o AVIF) → límite de 50 megapíxeles (evita las «bombas de descompresión») → nombre nuevo generado por el servidor (`base36(fecha)-8 bytes aleatorios.ext`), descartando por completo el nombre original.

Los archivos se guardan en **`var/uploads`, fuera de `public/`**, y se sirven por la ruta `/media/products/<nombre>`, que devuelve el tipo MIME detectado por contenido junto con `nosniff`. Aunque alguien lograse colar un archivo con código, nunca se serviría como algo ejecutable. Borrar una imagen en uso devuelve `409` en lugar de dejar productos sin foto.

### B.5 Validación y errores

Esquemas **Zod** compartidos por navegador y servidor: una única definición, dos puntos de aplicación. El manejador central traduce cada tipo de error al código HTTP correcto (`400/401/403/404/409/422/429/500`) con un cuerpo uniforme `{ error, codigo, detalles }`. **En producción nunca se devuelve la traza técnica**; se registra en el servidor con un identificador que el usuario puede citar al pedir ayuda.

### B.6 Base de datos

7 restricciones `CHECK` (estado y total de pedidos, categoría, precio y stock de productos, formato de correo y rol de usuarios) y **13 índices**, incluidos los compuestos `orders_user_fecha_idx` y `orders_fecha_idx`, que son los que sostienen el listado paginado.

### B.7 Cliente HTTP unificado

`src/lib/cliente-http.ts` sustituye las catorce llamadas `fetch` sueltas que había repartidas. Aporta tiempo máximo de espera de 15 segundos (se acabaron los indicadores girando eternamente), **reintentos finitos** (2 como máximo, con espera creciente y aleatoria) y **sólo en fallos pasajeros** (408, 429, 5xx) — nunca en errores del cliente ni en operaciones que puedan duplicar algo: crear un pedido, subir una foto o dar de alta un producto van con cero reintentos a propósito.

### B.8 Accesibilidad

Enlace «Saltar al contenido»; foco visible y uniforme con `:focus-visible`; el carrito es un diálogo modal de verdad (atrapa el foco, se cierra con `Escape`, devuelve el foco al botón de origen y bloquea el desplazamiento del fondo); el fondo oscurecido pasó de `<div onClick>` a `<button>` accesible con teclado; etiquetas descriptivas en los botones de cantidad; `aria-busy` y `role="status"` en el catálogo; y respeto a `prefers-reduced-motion` tanto en CSS global como en JavaScript (se desactiva el desplazamiento suave de Lenis).

### B.9 Estructura del código

`AdminDashboard.tsx` pasa de **831 a 649 líneas**: la lógica de estado y de red se traslada a `useGestionCatalogo.ts`. El componente dibuja, el hook gestiona. Sin capas artificiales de por medio.

> **Detalle a tener en cuenta:** los hooks conservan el prefijo inglés `use` (`useGestionCatalogo`, `useFocoModal`) aunque el resto del proyecto esté en castellano. No es un descuido: React identifica los hooks *por ese prefijo*. Con `usar...` el analizador y el compilador dejan de reconocerlos — lo comprobamos, y aparecieron 25 errores de `rules-of-hooks`. El resto del nombre sí va en castellano.

---

## C. Seguridad: vectores mitigados

Todo lo que sigue se ha **verificado atacando la aplicación en marcha**, no sólo leyendo el código.

| Vector | Antes | Después | Verificación |
|---|---|---|---|
| Contraseñas | scrypt, sal fija | Argon2id | Hash en base de datos: `$argon2id$v=…` |
| Robo de sesión | Cookie editable | Firmada con HMAC | Alterar un byte invalida |
| Fijación de sesión | Identificador conservado | Nuevo en cada acceso | — |
| **Fuerza bruta** | 12 intentos → 12 respuestas | Bloqueo al 6.º | `401×5`, luego `429` |
| **CSRF** | Sin protección | Origen verificado | Origen externo → `403` |
| **IDOR** (pedidos) | Se veían todos | Sólo los propios | Cliente ve los suyos; administración, todos |
| **Escalada de privilegios** | `"role":"admin"` aceptado | Campo ignorado | Registro con `role:admin` → rol real `customer` |
| **Asignación masiva** | Campos libres | Lista blanca Zod | `id` y `role` inyectados → descartados |
| **Subida maliciosa** | PHP como `.jpg` → `201` | Rechazado | → `400 DATOS_INVALIDOS` |
| **Suplantación de MIME** | Servido según extensión | Tipo detectado + `nosniff` | `content-type: image/png` real |
| **Recorrido de rutas** | `../` funcionaba | Ruta canonizada | `..%2F..%2F.env` → `400` |
| **Venta sin stock** | Stock a −3 | Imposible | 8 simultáneas → 1 pedido, stock 0, 7×`409` |
| **Inyección SQL** | — | Consultas parametrizadas (Drizzle) | Sin concatenación de cadenas |
| **XSS** | Riesgo | React escapa + CSP | Sin `dangerouslySetInnerHTML` |
| **Clickjacking** | Posible | `frame-ancestors 'none'` + `X-Frame-Options: DENY` | Cabeceras presentes |
| **Redirección abierta** | `?next=//malo.com` | `rutaInternaSegura()` | Sólo rutas internas |
| **Divulgación de información** | Trazas y versiones | Mensajes neutros | Sin `X-Powered-By` |

**Cabeceras activas** (comprobadas con `curl`): `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`. HSTS se activa sólo en producción (con HTTPS), porque en desarrollo sobre HTTP dejaría el navegador con una redirección fijada difícil de revertir.

> **Sobre la CSP:** incluye `'unsafe-inline'` y `'unsafe-eval'` en `script-src`. No es lo ideal, pero es lo que exige Next.js con Turbopack en desarrollo. Endurecerla con *nonces* es la primera recomendación de la sección J.

---

## D. Rendimiento

| Mejora | Efecto |
|---|---|
| Siembra movida a `instrumentation.ts` | Antes cada lectura comprobaba si había que sembrar. Se elimina una consulta por petición. |
| 13 índices | El listado de pedidos pasa de recorrer la tabla entera a usar índice. |
| Paginación real (`limit`/`offset` con tope) | Antes se enviaba la tabla completa al navegador. |
| Galería en 3 lecturas paralelas | Eran secuenciales. |
| `Cache-Control: immutable` en imágenes | El navegador deja de volver a pedirlas (nombre único por archivo). |
| Pool de conexiones configurado | Se reutilizan; antes se abría una por petición. |
| `syncImageOptions` compara contenido | Evita redibujar el selector sin motivo. |
| Cancelación con `AbortController` | Las búsquedas obsoletas se abortan al seguir escribiendo. |

Compilación de producción: **correcta, 20 rutas**, 5 páginas prerenderizadas.

---

## E. Arquitectura

```
src/
├── proxy.ts              ← antes middleware.ts (Next 16 lo renombró)
├── instrumentation.ts    ← arranque: comprobar BD + sembrar
├── lib/                  ← núcleo transversal
│   ├── env.ts            ← valida las variables al arrancar
│   ├── auth.ts           ← Argon2id + sesiones firmadas
│   ├── csrf.ts           ├─ seguridad
│   ├── limitador.ts      │
│   ├── almacenamiento.ts ← subidas validadas
│   ├── validaciones.ts   ← esquemas Zod compartidos
│   ├── errores.ts        ← errores centralizados
│   ├── registro.ts       ← registro sin datos personales
│   ├── cliente-http.ts   ← fetch con espera máxima y reintentos
│   ├── navegacion.ts     ← contra redirección abierta
│   ├── accesibilidad.ts  ← hooks de foco y movimiento reducido
│   └── apagado.ts        ← cierre ordenado (aislado por el runtime Edge)
├── servicios/            ← reglas de negocio (transacciones)
├── db/                   ← esquema, conexión, siembra
├── app/api/              ← endpoints: validan, delegan, responden
└── components/           ← presentación
```

Tres capas: **endpoint** (valida entrada y traduce la salida) → **servicio** (regla de negocio y transacciones) → **datos**. Los componentes no hablan nunca con la base de datos.

Se ha resistido la tentación de sobrearquitecturar: no hay inyección de dependencias, ni repositorios genéricos, ni CQRS. Es una tienda pequeña y el código debe seguir siendo legible por alguien que empieza.

---

## F. Archivos modificados

### Creados

| Archivo | Contenido |
|---|---|
| `src/lib/env.ts` | Valida las variables de entorno al arrancar; falla pronto y claro |
| `src/lib/auth.ts` | Argon2id, sesiones firmadas, migración desde scrypt |
| `src/lib/csrf.ts` | Verificación de origen |
| `src/lib/limitador.ts` | Límite de peticiones en memoria |
| `src/lib/almacenamiento.ts` | Validación de imágenes por firma binaria |
| `src/lib/validaciones.ts` | Esquemas Zod compartidos |
| `src/lib/errores.ts` | Errores tipados y traducción a HTTP |
| `src/lib/registro.ts` | Registro estructurado sin datos personales |
| `src/lib/cliente-http.ts` | Cliente con espera máxima y reintentos finitos |
| `src/lib/navegacion.ts` | `rutaInternaSegura()` |
| `src/lib/accesibilidad.ts` | `useMovimientoReducido`, `useFocoModal` |
| `src/lib/apagado.ts` | Cierre ordenado ante SIGTERM/SIGINT |
| `src/servicios/{productos,pedidos,usuarios}.ts` | Reglas de negocio y transacciones |
| `src/app/media/products/[name]/route.ts` | Sirve imágenes con MIME real |
| `src/app/api/health/route.ts` | Comprobación de estado |
| `src/components/admin/useGestionCatalogo.ts` | Lógica extraída del panel |
| `.env.example`, `.gitignore`, `docs/AUDITORIA.md`, `docs/INFORME-FINAL.md` | Documentación y configuración |

### Modificados

| Archivo | Qué cambió |
|---|---|
| `src/proxy.ts` | **Renombrado** desde `middleware.ts` (Next 16 lo exige). Cabeceras de seguridad y protección de rutas |
| `next.config.ts` | Cabeceras, `poweredByHeader: false` |
| `src/db/schema.ts` | 7 restricciones `CHECK`, 13 índices |
| `src/db/index.ts` | Pool configurado y cierre ordenado |
| `src/db/seed.ts` | Contraseña de administración aleatoria; sin credenciales en el código |
| `src/instrumentation.ts` | Arranque; importaciones dinámicas para no romper el runtime Edge |
| `src/app/api/auth/*` | Los 4 endpoints reescritos: límite, CSRF, Zod, tiempo constante |
| `src/app/api/products{,/[id]}` | Paginación, orden, lista blanca, sólo administración para escribir |
| `src/app/api/orders{,/[id]}` | **Transacción con bloqueo**, IDOR corregido, estados cerrados |
| `src/app/api/uploads{,/[name]}` | Validación completa; `409` si la imagen está en uso |
| `src/app/login/page.tsx` | Sin credenciales visibles; etiquetas, `aria-invalid`, antidoble-envío |
| `src/app/layout.tsx` | Enlace de salto y `<main>` identificado |
| `src/app/globals.css` | Foco visible, enlace de salto, `prefers-reduced-motion` |
| `src/app/checkout/page.tsx` | Cliente HTTP, cero reintentos, errores del servidor visibles |
| `src/lib/session.tsx` | Cliente HTTP; ante fallo asume «no autenticado» |
| `src/lib/business.ts` | **Eliminado `demoAccounts`**; `mailto:` corregido; erratas |
| `src/components/site/Footer.tsx` | «Acceso demo» → «Contacto» |
| `src/components/site/CartDrawer.tsx` | Diálogo accesible completo |
| `src/components/site/Providers.tsx` | Desplazamiento suave desactivable |
| `src/components/sections/Catalog.tsx` | Aviso de error, `aria-busy`, cancelación |
| `src/components/admin/AdminDashboard.tsx` | 831 → 649 líneas |
| `src/components/admin/GalleryManager.tsx` | Cliente HTTP; errores concretos por archivo |

### Eliminados

`index.html`, `vite.config.js`, `.oxlintrc.json` — restos de Vite en un proyecto Next.js. No los usaba nada.

---

## G. Dependencias

### Añadidas

| Paquete | Versión | Motivo |
|---|---|---|
| `@node-rs/argon2` | ^2.2.1 | Argon2id nativo. Alternativa considerada: `bcrypt`, descartada por ser inferior frente a ataques con GPU |
| `zod` | ^4.6.5 | Validación compartida entre navegador y servidor |
| `server-only` | ^0.0.1 | Marca módulos que jamás deben llegar al navegador. Si alguien los importa por error, **falla la compilación** en vez de filtrar secretos |

### Actualizadas

| Paquete | De | A | Motivo |
|---|---|---|---|
| `next` | 16.2.6 | 16.3.5 | **11 avisos de seguridad**: ejecución remota vía AVIF, ejecución remota en Windows, SSRF en Server Actions y reescrituras, confusión de caché, denegación de servicio, elusión del middleware, exposición de funciones de servidor |
| `postcss` | 8.4.x | ^8.5.28 | XSS y recorrido de rutas |
| `sharp` | — | por arrastre | CVE en libvips/libheif |

### Estado de `npm audit`

De **7 vulnerabilidades (1 crítica, 2 altas)** a **4 moderadas**, todas en la cadena `drizzle-kit` → `@esbuild-kit/*` → `esbuild` (GHSA-67mh-4wv8-2f99).

**Riesgo aceptado conscientemente.** Corregirlas obligaría a bajar a `drizzle-kit@0.18.1`, un cambio con rupturas. Son dependencias **exclusivas de desarrollo**: `esbuild` no llega jamás al servidor de producción, y el fallo sólo afecta a su servidor local de desarrollo. Preferimos dejarlo documentado antes que romper las migraciones.

### Eliminadas

Restos de Vite: `vite`, `@vitejs/plugin-react`, `oxlint`.

---

## H. Variables de entorno

Plantilla completa y comentada en **`.env.example`**. Resumen:

| Variable | ¿Obligatoria? | Descripción |
|---|---|---|
| `DATABASE_URL` | **Sí** | Cadena de conexión a PostgreSQL. Añada `?sslmode=require` en producción |
| `SESSION_SECRET` | **Sí** | Clave de firma, mínimo 32 caracteres. **La aplicación no arranca en producción sin ella.** Si cambia, se cierran todas las sesiones |
| `APP_ENV` | No | `development` \| `staging` \| `production`. Controla el detalle de errores y registros |
| `UPLOADS_DIR` | No | Carpeta de imágenes. Por defecto `var/uploads`, **fuera de `public/`** |
| `SEED_DEMO_DATA` | No | Siembra el catálogo de ejemplo. **`false` en producción** |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | No | Sólo en la primera siembra. Si no se definen, se genera una contraseña aleatoria mostrada **una única vez** por consola |
| `RATE_LIMIT_LOGIN_MAX` | No | Intentos permitidos (5 por defecto) |
| `RATE_LIMIT_LOGIN_WINDOW` | No | Ventana en segundos (900 por defecto) |

Genere la clave con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`.gitignore` excluye `.env`, `.env.*` (salvo `.env.example`) y `var/uploads`. **Verificado con `git check-ignore`.**

---

## I. Pruebas a ejecutar

### Comprobaciones automáticas

```bash
npx tsc --noEmit    # 0 errores
npm run lint        # 5 avisos heredados (ver sección J)
npm run build       # correcto, 20 rutas
npm audit           # 4 moderadas, sólo desarrollo
```

### Pruebas de seguridad (todas ejecutadas y superadas)

```bash
# 1. Fuerza bruta → 401×5, luego 429
for i in $(seq 1 9); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/auth/login \
    -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
    -d '{"email":"admin@jpr.studio","password":"incorrecta"}'
done

# 2. CSRF → 403
curl -X POST localhost:3000/api/auth/login -H 'Origin: https://sitio-malicioso.example' \
  -H 'Content-Type: application/json' -d '{"email":"a@b.com","password":"x"}'

# 3. Subida maliciosa → 400
printf '<?php system($_GET["c"]); ?>' > evil.jpg
curl -b cookies.txt -X POST localhost:3000/api/uploads -F "file=@evil.jpg"

# 4. Venta por encima del stock → 1 pedido, stock 0, resto 409
#    (poner stock=1 y lanzar 8 peticiones en paralelo)

# 5. Escalada de privilegios → rol real "customer"
curl -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -d '{"name":"Test","email":"t@e.com","password":"clave123456","role":"admin"}'

# 6. Recorrido de rutas → 400
curl "localhost:3000/media/products/..%2F..%2F..%2F.env"

# 7. Cabeceras
curl -D - -o /dev/null localhost:3000/
```

### Pruebas manuales recomendadas

Acceso correcto e incorrecto · cierre de sesión (la cookie debe desaparecer) · persistencia al recargar · un cliente no ve pedidos ajenos · `/admin` con cuenta de cliente → redirección · pedido completo de principio a fin · doble clic en «Confirmar» → **un solo pedido** · navegación completa con teclado (abrir y cerrar el carrito con `Escape`) · activar «reducir movimiento» en el sistema y comprobar que se detienen las animaciones · diseño adaptable a 320, 768 y 1440 píxeles.

### Sobre las pruebas automatizadas

**No se ha instalado ningún marco de pruebas.** Sería añadir infraestructura (Vitest, Playwright, base de datos de pruebas, integración continua) que nadie pidió y que en un proyecto de este tamaño puede quedar abandonada. La recomendación, si se decide dar el paso, es empezar por Vitest cubriendo `src/lib/` (validaciones, autenticación, almacenamiento) y una prueba de extremo a extremo del pedido completo. Se deja anotado como riesgo en la sección J.

---

## J. Riesgos restantes

| # | Riesgo | Gravedad | Detalle y solución recomendada |
|---|---|---|---|
| **J-1** | **Límite de peticiones en memoria** | Media | Funciona con una sola instancia. Con varias réplicas o en entorno *serverless*, cada una lleva su propia cuenta y el límite efectivo se multiplica. **Solución:** Redis con `INCR` + `EXPIRE`, conservando la firma de `comprobarLimite()` — el cambio queda contenido en un archivo |
| **J-2** | **CSP con `unsafe-inline` y `unsafe-eval`** | Media | Reduce la protección contra XSS. Lo exige Next.js con Turbopack. **Solución:** *nonces* por petición generados en `proxy.ts`; requiere comprobar que framer-motion y Lenis siguen funcionando |
| **J-3** | **Sin pruebas automatizadas** | Media | Toda la verificación ha sido manual. Una regresión futura pasaría inadvertida. **Solución:** Vitest sobre `src/lib/` como primer paso |
| **J-4** | **4 vulnerabilidades moderadas en `drizzle-kit`** | Baja | Sólo desarrollo; `esbuild` no llega a producción. Corregirlo exige bajar a una versión con rupturas. **Solución:** esperar a que `drizzle-kit` actualice `esbuild` |
| **J-5** | **Sin recuperación de contraseña** | Media | Si el administrador la pierde, hay que restablecerla por base de datos. No se ha implementado porque exige servicio de correo, y el encargo era **no añadir funcionalidades**. **Solución:** tabla de testigos de un solo uso con caducidad de 1 hora + proveedor de correo |
| **J-6** | **Sin verificación de correo** | Baja | Se puede registrar con una dirección ajena. Mismo motivo y misma solución que J-5 |
| **J-7** | **Copias de seguridad no configuradas** | **Alta en producción** | **No se ha implementado nada**: montar un simulacro de copias sería peor que no tenerlas, porque da falsa tranquilidad. **Solución:** `pg_dump` diario a almacenamiento externo con cifrado y retención de 30 días, **más una prueba de restauración mensual** — una copia que nunca se ha restaurado no es una copia |
| **J-8** | **5 avisos de ESLint heredados** | Baja | `setState` dentro de `useEffect` en el carrito, el cursor, el pago y la sesión. Son patrones del código original: leen `localStorage` o consultan al servidor al montar. Funcionan correctamente; el compilador de React sólo advierte de que provocan un render extra. **No se han tocado** para no arriesgar la hidratación del carrito sin necesidad |
| **J-9** | **Registro sólo por consola** | Baja | Sin agregación centralizada. **Solución:** enviar el JSON a un recolector (Loki, Datadog) — el formato ya es estructurado |
| **J-10** | **Imágenes en disco local** | Media | No sobreviven a un despliegue con contenedores efímeros ni se comparten entre réplicas. **Solución:** almacenamiento compatible con S3, o un volumen persistente |

### Sobre la PWA (se pidió evaluarla antes de implementarla)

**Recomendación: no implementarla.** Una tienda que se visita de forma puntual no se beneficia de un service worker: nadie va a instalar en su pantalla de inicio una web de instrumentos que consulta cada varios meses. El modo sin conexión tendría poco sentido (no se puede comprar sin red) y añadiría un problema real: la caché del service worker es una fuente conocida de «veo precios y stock antiguos», justo lo contrario de lo que necesita un catálogo con inventario limitado. Las notificaciones push en comercio pequeño tienen tasas de aceptación bajísimas. **Si algún día se quiere velocidad percibida, el camino correcto es afinar el almacenamiento en caché HTTP y las imágenes, no una PWA.**

### Escalabilidad

El cuello de botella con el diseño actual está en **J-1** (límite de peticiones) y **J-10** (imágenes locales): son las dos cosas que impiden pasar de una instancia a varias. La base de datos aguanta bien — tiene índices y pool configurado — y la aplicación no guarda estado en memoria salvo el contador del limitador. Resueltos esos dos puntos, escalar horizontalmente es directo.

---

## Cierre

La aplicación pasa de tener **cinco vulnerabilidades críticas explotables** — incluidas credenciales de administración escritas en el código y a la vista, y venta de mercancía inexistente — a superar todas las comprobaciones de seguridad realizadas contra la aplicación en funcionamiento.

No se ha añadido ni una sola funcionalidad nueva. No se ha movido un color, una tipografía ni un elemento de sitio. Todo el código nuevo está comentado en castellano, línea a línea, con el porqué de cada decisión y no sólo el qué — que era, al fin y al cabo, el objetivo principal del encargo.

Los riesgos que quedan están **documentados y priorizados**, no escondidos. Los tres primeros que atender antes de abrir al público son: **J-7** (copias de seguridad), **J-1** (limitador en Redis si habrá más de una instancia) y **J-5** (recuperación de contraseña).
