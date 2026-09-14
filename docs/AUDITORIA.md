# Auditoría técnica — JPR Music Shop

> Documento de la **fase 1 (análisis)**. Los problemas se listan tal y como
> estaban en el código original, antes de aplicar ninguna corrección.
> La lista de cambios aplicados está en `docs/INFORME-FINAL.md`.

---

## 1. Arquitectura actual

| Capa | Tecnología real detectada |
| ---- | ------------------------- |
| Framework | Next.js 16.2.6 (App Router, React Server Components, Turbopack) |
| Lenguaje | TypeScript 5.9 en modo `strict` |
| UI | React 19.2, Tailwind CSS v4 (tokens en `@theme`), Framer Motion 13, Lenis |
| Backend | Route Handlers de Next (`src/app/api/**/route.ts`) — no hay servidor aparte |
| Base de datos | PostgreSQL + Drizzle ORM 0.45 sobre `pg` (node-postgres) |
| Sesiones | Cookie propia `nocturne_session` firmada con HMAC-SHA256 |
| Contraseñas | `crypto.scryptSync` con parámetros por defecto |
| Ficheros | Escritura directa en `public/img/products/` |
| Notificaciones | Sonner (toasts) |
| Iconos | Lucide |

**Flujo de datos.** Las páginas son Server Components que llaman a
`src/lib/data.ts` → Drizzle → Postgres. El cliente (Catálogo, Admin, Checkout,
Login) hace `fetch` contra `/api/*`. El carrito vive en `localStorage` y el
precio **sí** se recalcula en servidor al crear el pedido (bien).

**Comunicación front/back.** Todo con `fetch` relativo y cookie `httpOnly`.
No hay CORS configurado (no hace falta: mismo origen).

---

## 2. Problemas encontrados

### 🔴 CRÍTICO

**C-1 · Secretos reales versionados en el repositorio (`.env`)**
El archivo `.env` venía dentro del ZIP con credenciales reales:
`DATABASE_URL=postgresql://Shop:Musicshop123@localhost:5432/MusicShop` y
`SESSION_SECRET=soyelmejor123456789`. Además `.gitignore` era el de una
plantilla **Vite** y **no ignoraba `.env`**. Cualquiera con acceso al repo
obtiene la contraseña de la base de datos y la clave de firma de sesiones.
*Por qué es crítico:* con `SESSION_SECRET` se puede firmar una cookie de
administrador sin conocer ninguna contraseña.

**C-2 · Fallback silencioso del secreto de sesión**
`src/lib/auth.ts` hacía
`process.env.SESSION_SECRET ?? "nocturne-dev-secret-change-in-production"`.
Si la variable falta en producción, la app **arranca igualmente** y firma las
sesiones con una cadena que está publicada en el código fuente.
*Verificado:* se puede construir a mano una cookie `{role:"admin"}` válida.

**C-3 · Condición de carrera en el stock (oversell) — verificado**
`POST /api/orders` leía el stock (`SELECT`) y después lo descontaba
(`UPDATE ... stock - qty`) sin bloqueo. La comprobación y la escritura no son
atómicas, así que varias peticiones simultáneas pasan todas la validación.
*Prueba ejecutada:* stock = 1, 8 peticiones en paralelo → **4 pedidos creados
y stock final = −3**. Se vende inventario que no existe.

**C-4 · Subida de archivos sin validar el contenido real — verificado**
`POST /api/uploads` sólo miraba `path.extname(file.name)`. No comprobaba los
*magic bytes*, ni el MIME real, ni descodificaba la imagen.
*Prueba ejecutada:* se subió un archivo con contenido `<?php system(...) ?>`
renombrado a `.jpg` y el servidor respondió `201 Created`.
*Además:* escribe dentro de `public/`, que es el directorio servido como
estático — mezcla contenido subido por usuarios con los assets del build.

**C-5 · Contraseñas demo triviales sembradas en la base**
`src/lib/business.ts` define la cuenta de administrador con la contraseña
literal `"admin"`, y `src/db/seed.ts` la inserta automáticamente. La página de
login **imprime en pantalla** las credenciales. En producción esto es una
cuenta de administrador abierta.

### 🟠 ALTO

**A-1 · Sin rate limiting en ningún endpoint — verificado**
12 intentos de login fallidos consecutivos → 12 × `401`, sin bloqueo ni
retardo. Permite fuerza bruta y *credential stuffing* contra `/api/auth/login`
y abuso de `/api/auth/register` y `/api/uploads`.

**A-2 · Sin cabeceras de seguridad HTTP — verificado**
La respuesta no incluía `Content-Security-Policy`, `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` ni
`Strict-Transport-Security`. Expone a *clickjacking*, *MIME sniffing* y fuga
de referrer. `poweredByHeader` activo delata el framework.

**A-3 · Sin protección CSRF en las mutaciones — verificado**
`DELETE /api/products/<id>` con la cookie y `Origin: https://sitio-malicioso`
devolvió `{"ok":true}`. `SameSite=Lax` mitiga bastante en navegadores
modernos, pero no hay ninguna comprobación de origen en el servidor.

**A-4 · Validación de entrada inconsistente y casi inexistente**
No hay ningún sistema de validación (ni Zod ni equivalente). Los handlers
hacen `String(body.x)` y confían en el resto:
- `customerEmail` acepta `"no-es-un-email"` — *verificado, pedido creado*.
- `category` acepta cualquier cadena — *verificado, se creó un producto con
  categoría `CATEGORIA-QUE-NO-EXISTE`* que luego no aparece en ningún filtro.
- `specs` se guarda como JSON sin validar su forma.
- `qty` no tiene tope superior → se puede pedir 999.999 unidades.
- Los `id` no se validan como UUID → llegan a la consulta y revientan en 500.

**A-5 · `ensureSeeded()` se ejecuta en cada consulta de lectura**
Todas las funciones de `src/lib/data.ts` empiezan con `await ensureSeeded()`.
Se cachea en una promesa de módulo, pero la lógica de siembra vive acoplada a
la capa de lectura. En serverless (varias instancias) puede haber inserciones
concurrentes, y mezcla responsabilidades: *leer* no debería *escribir*.

**A-6 · Sin restricciones de integridad en la base de datos**
El esquema no tiene ningún `CHECK`: `price_cents` y `stock` pueden ser
negativos (de hecho el oversell dejó `stock = -3`), `role` y `status` son
`text` libre sin restringir a los valores válidos. La base no se defiende sola
si un bug de la aplicación escribe basura.

**A-7 · Errores 500 sin distinción entorno / producción**
Todos los `catch` hacen `console.error(error)` y devuelven `"Error interno"`.
No hay identificador de correlación, ni distinción dev/prod, ni logger. Es
imposible diagnosticar un fallo en producción, y `console.error` de un error
de `pg` puede volcar la cadena de conexión a los logs.

### 🟡 MEDIO

**M-1 · Restos de otra plantilla (Vite) en el proyecto**
`index.html`, `vite.config.js` y `.oxlintrc.json` conviven con la config de
Next. `index.html` apunta a `/src/main.jsx`, que no existe. Confunde y añade
dependencias fantasma.

**M-2 · `AdminDashboard.tsx` tiene 831 líneas**
Un único componente cliente concentra: 4 pestañas, CRUD de productos, gestión
de pedidos, subida de fotos, modal de formulario y estadísticas. Difícil de
mantener y de probar, y todo su JS se descarga aunque sólo mires el resumen.

**M-3 · Lógica de `fetch` duplicada en ~12 sitios**
Cada componente repite el mismo bloque `fetch` + `res.json()` +
`toast.error`. Ninguno tiene **timeout** ni **reintentos**: si la red se
queda colgada, el spinner gira indefinidamente.

**M-4 · Accesibilidad: formularios sin asociar**
En `login/page.tsx`, `checkout/page.tsx` y el modal del admin los `<label>` no
tienen `htmlFor` ni los `<input>` tienen `id`. Un lector de pantalla no sabe
qué etiqueta corresponde a qué campo. Faltan `aria-invalid`, `role="alert"` y
regiones `aria-live` para los errores.

**M-5 · Accesibilidad: modales sin gestión de foco ni tecla Escape**
El `CartDrawer`, el menú móvil y el modal de producto no atrapan el foco, no
se cierran con `Escape` y no devuelven el foco al elemento que los abrió.
El overlay de cierre es un `<div>` con `onClick`, inalcanzable por teclado.

**M-6 · Animaciones que ignoran `prefers-reduced-motion`**
Framer Motion, Lenis (scroll suave), el grano animado y el cursor
personalizado están siempre activos. Es un problema de accesibilidad real
para usuarios con sensibilidad vestibular.

**M-7 · Prevención de doble envío incompleta**
Los formularios ponen `disabled` en el botón, pero `saveProduct` y
`onSubmit` no comprueban el flag al entrar: un `Enter` repetido rápido puede
disparar dos peticiones antes del primer re-render.

**M-8 · `GET /api/products` devuelve la tabla entera**
Sin paginación, sin `limit`, sin ordenación configurable. Con 8 productos da
igual; con 5.000 la home tarda segundos y satura memoria.

**M-9 · Información innecesaria en las respuestas**
`GET /api/orders` devuelve el pedido completo con `address` y
`customerEmail`. El panel sólo necesita un subconjunto.

**M-10 · Cliente potencialmente desincronizado del stock**
El carrito guarda `stock` en `localStorage`. Si el stock cambia en el
servidor, el usuario sigue viendo el valor antiguo hasta recargar.

### 🔵 BAJO

- **B-1** · `formatPrice` usa `Intl` con **EUR** y `es-ES`, pero el negocio es
  de Guatemala (`+502`, Quetzaltenango). Probable incoherencia de moneda.
- **B-2** · `docs`/README documentan credenciales (`admin@nocturne.studio`)
  que ya no coinciden con `business.ts` (`admin@jpr.studio`).
- **B-3** · `BUSINESS.socials` tiene `href: "jprmusicshop@gmail.com"` sin
  `mailto:` → genera un enlace relativo roto.
- **B-4** · Erratas visibles al usuario: «Exepriencia unica»,
  «Garantía atelier años».
- **B-5** · `tsconfig` con `target: ES2017`, innecesariamente antiguo para
  Next 16.
- **B-6** · Sin ningún test automatizado.
- **B-7** · Sin `middleware.ts`: la protección de rutas se repite en cada
  página y handler.

---

## 3. Vulnerabilidades por categoría OWASP

| Vulnerabilidad | Estado original | Comentario |
| -------------- | --------------- | ---------- |
| SQL Injection | ✅ No explotable | Drizzle parametriza; `ilike` usa binding |
| XSS | ✅ Bajo riesgo | React escapa; no hay `dangerouslySetInnerHTML` |
| CSRF | ❌ **Vulnerable** | Sin comprobación de origen (verificado) |
| Path Traversal | ⚠️ Contenido | La regex `^[A-Za-z0-9._-]+$` bloquea `../` (verificado 400), pero no rechaza `..` a secas ni resuelve la ruta final |
| Broken Access Control | ✅ Correcto | Roles comprobados en servidor (verificado 403) |
| IDOR | ✅ Correcto | Los pedidos se filtran por `userId` (verificado) |
| Brute Force | ❌ **Vulnerable** | Sin rate limiting (verificado) |
| Malicious Upload | ❌ **Vulnerable** | Sin validar contenido real (verificado) |
| Clickjacking | ❌ **Vulnerable** | Sin `X-Frame-Options`/CSP (verificado) |
| MIME Spoofing | ❌ **Vulnerable** | Sin `X-Content-Type-Options` |
| Mass Assignment | ⚠️ Parcial | Hay lista blanca de campos, pero sin validar valores |
| Information Disclosure | ⚠️ Parcial | Sin stack traces al cliente, pero logs sin sanear |
| Session Fixation | ⚠️ Parcial | La cookie se reemplaza al entrar, pero sin `sid` ni revocación |
| Open Redirect | ⚠️ Potencial | `?next=` en login se pasa a `router.push` sin validar |
| SSRF | ✅ N/A | La app no hace peticiones salientes |
| Command Injection | ✅ N/A | No se ejecutan comandos |

---

## 4. Dependencias — `npm audit` (7 vulnerabilidades)

| Paquete | Actual | Recomendado | Severidad | Motivo |
| ------- | ------ | ----------- | --------- | ------ |
| `next` | 16.2.6 | **16.3.5** | 🔴 Crítica | 11 CVE: RCE en Image Optimization (AVIF), SSRF en rewrites, DoS, *cache confusion*. Es un **patch dentro de la misma major** → riesgo de rotura muy bajo |
| `postcss` | <8.5.22 | 8.5.22+ | 🟠 Alta | Path traversal vía `sourceMappingURL`. Entra transitivamente con Next |
| `sharp` | <0.35.4 | 0.35.4+ | 🟠 Alta | CVE heredados de libvips/libheif. Transitiva de Next |
| `esbuild` | <=0.24.2 | — | 🟡 Moderada | Sólo afecta al *dev server* de `drizzle-kit`. El fix obligaría a bajar `drizzle-kit` a 0.18 (**breaking**). Recomendación: **no tocar**, es una dependencia de desarrollo |

Dependencias **innecesarias** detectadas: ninguna en `package.json`, pero
`vite.config.js` sugiere `@vitejs/plugin-react` que no está instalado.

---

## 5. Rendimiento

- **Positivo:** imágenes con `next/image`, animaciones en CSS cuando es
  posible (`Aurora`, `Marquee`), `AbortController` en el buscador del catálogo.
- `export const dynamic = "force-dynamic"` en todas las páginas: se renuncia a
  cualquier caché, incluso en la portada, que cambia poco.
- El pool de `pg` se crea sin `max`, `idleTimeoutMillis` ni
  `connectionTimeoutMillis` → en producción puede agotar las conexiones.
- `getProducts()` se llama **dos veces** en la portada (todos + destacados):
  dos viajes a la base para datos que se solapan.
- `AdminDashboard` (831 líneas) y `GalleryManager` se cargan juntos aunque el
  admin sólo abra la pestaña «Resumen».
- El efecto `grain` anima un pseudo-elemento a pantalla completa de forma
  permanente: coste de GPU constante.

---

## 6. Escalabilidad y mantenimiento

- Sin `middleware.ts`, la autorización se repite en 8 handlers distintos:
  añadir un rol nuevo obliga a tocar los 8.
- Sin capa de servicios: la lógica de negocio (calcular totales, descontar
  stock) vive dentro del handler HTTP, así que no se puede reutilizar ni
  testear sin levantar un servidor.
- El rate limiting en memoria (que hay que añadir) no funcionará con varias
  instancias: hará falta Redis. Se documenta como riesgo asumido.
- Sin migraciones versionadas: se usa `drizzle-kit push`, que compara y aplica
  directamente. Para producción hacen falta migraciones en git.

---

## 7. Resumen de prioridades

| Prioridad | Cantidad | Acción |
| --------- | -------- | ------ |
| 🔴 Crítico | 5 | Corregir de inmediato antes de cualquier despliegue |
| 🟠 Alto | 7 | Corregir en esta misma iteración |
| 🟡 Medio | 10 | Corregir sin alterar el diseño visual |
| 🔵 Bajo | 7 | Corregir o documentar |
