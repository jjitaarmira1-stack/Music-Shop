# NOCTURNE — Atelier de instrumentos

Landing page **y** tienda en una sola experiencia, con **vistas por rol**
(visitante / cliente / administrador), estética oscura minimalista y un sistema
de animación artesanal inspirado en el catálogo de **reactbits.dev**.

```
            ╔══════════════════════════════════════╗
            ║   NOCTURNE · el sonido habita        ║
            ║   en la oscuridad                    ║
            ╚══════════════════════════════════════╝
```

## ✏️ Personalizar el negocio (1 archivo)

Todo el branding vive en **`src/lib/business.ts`**: nombre, sufijo del logo,
eslogan, descripción SEO, contacto, redes, titulares de cada sección,
estadísticas, ventajas del pie de página y prefijo de pedidos.
Edítalo y ejecuta `npm run build && npm run start`.

> Las antiguas `demoAccounts` (que publicaban un `admin`/`admin` a la vista de
> cualquiera) se eliminaron en la auditoría de seguridad. Ver
> [`HISTORIAL.md`](./HISTORIAL.md).

## Documentación

| Documento | Contenido |
|---|---|
| [`HISTORIAL.md`](./HISTORIAL.md) | Registro cronológico de cada mejora: qué cambió, por qué y qué riesgos quedan |
| [`docs/ACTUALIZAR.md`](./docs/ACTUALIZAR.md) | Cómo traer los cambios nuevos sin descargar ni descomprimir nada |
| [`docs/AUDITORIA.md`](./docs/AUDITORIA.md) | Diagnóstico inicial: problemas clasificados por gravedad |
| [`docs/INFORME-FINAL.md`](./docs/INFORME-FINAL.md) | Informe de la intervención, secciones A–J |

## Stack

| Capa        | Tecnología                                                    |
| ----------- | ------------------------------------------------------------- |
| Framework   | Next.js 16 (App Router, RSC, route handlers)                  |
| Lenguaje    | TypeScript estricto                                           |
| Base datos  | PostgreSQL + Drizzle ORM (consultas 100 % tipadas)            |
| Animación   | Framer Motion + Lenis (smooth scroll) + CSS con `@property`   |
| Estilos     | Tailwind CSS v4 (tokens en `@theme`)                          |
| Tipografías | Instrument Serif · Space Grotesk · JetBrains Mono             |
| Iconografía | Lucide                                                        |

## Puesta en marcha

```bash
npm install
cp .env.example .env        # define DATABASE_URL y SESSION_SECRET
npx drizzle-kit push        # crea las tablas
npm run dev                 # http://localhost:3000
```

La base se **siembra al arrancar** el servidor (8 instrumentos + la cuenta de
administración). No necesitas ejecutar seeds manualmente.

## Primer acceso como administrador

Ya **no hay credenciales escritas en el código**. Al sembrar la base por
primera vez ocurre una de estas dos cosas:

- **Si no defines `ADMIN_PASSWORD` en el `.env`**, se genera una contraseña
  aleatoria y se imprime **una sola vez** por consola, dentro de un recuadro.
  Cópiala en ese momento: no se vuelve a mostrar.
- **Si la defines**, se usa esa. Es lo cómodo en desarrollo.

```env
ADMIN_EMAIL=admin@jpr.studio
ADMIN_PASSWORD=tu-contrasena-segura
```

| Rol | Acceso |
| --- | --- |
| admin | `/admin` — catálogo, pedidos y galería |
| cliente | `/cuenta` — historial de pedidos propios |

Para crear una cuenta de cliente, regístrate desde la web: toda cuenta nueva
nace con rol `customer`, y el campo `role` del formulario se ignora (se
intentó como ataque y quedó cerrado en la auditoría).

> **¿Perdiste la contraseña de administración?** Borra el usuario con
> `DELETE FROM users WHERE role = 'admin';` y reinicia el servidor: se
> volverá a sembrar y a mostrar una contraseña nueva.

## Estructura del proyecto

```
├── public/
│   ├── img/                        # Fotografía de autor generada (dark studio)
│   │   ├── hero.jpg
│   │   ├── atelier.jpg
│   │   └── products/               # 8 instrumentos
│   └── nocturne-source.zip         # Este código, comprimido y descargable
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Fuentes, providers, navbar, footer, cursor
│   │   ├── globals.css             # Design tokens + keyframes + utilidades
│   │   ├── page.tsx                # LANDING + TIENDA (misma experiencia)
│   │   ├── icon.svg
│   │   ├── not-found.tsx           # 404 cinematográfico
│   │   ├── producto/[slug]/        # Ficha de instrumento (SSG-dinámica)
│   │   ├── login/                  # Auth por rol (login / registro)
│   │   ├── checkout/               # Pedido real (transacción + stock)
│   │   ├── cuenta/                 # Vista cliente: perfil + pedidos
│   │   ├── admin/                  # Vista admin: protegida en servidor
│   │   └── api/
│   │       ├── health/             # Healthcheck (app + DB)
│   │       ├── auth/               # login · register · logout · me
│   │       ├── products/           # GET público · POST/PATCH/DELETE admin
│   │       └── orders/             # GET por rol · POST transaccional
│   ├── components/
│   │   ├── bits/                   # ⭐ Sistema cinético estilo reactbits.dev
│   │   │   ├── SplitText.tsx       # Titulares letra a letra
│   │   │   ├── StarBorder.tsx      # Borde con luz orbital (conic-gradient)
│   │   │   ├── SpotlightCard.tsx   # Foco radial que sigue al ratón
│   │   │   ├── TiltedCard.tsx      # Tarjeta 3D con físicas de muelle
│   │   │   ├── Magnetic.tsx        # Botones que gravitan al puntero
│   │   │   ├── Marquee.tsx         # Cintas infinitas tipográficas
│   │   │   ├── Aurora.tsx          # Masas de luz ámbar en deriva
│   │   │   ├── AnimatedImage.tsx   # Fotos animadas: parallax + zoom
│   │   │   ├── CountUp.tsx         # Contadores al entrar en viewport
│   │   │   ├── Reveal.tsx          # Revelado blur→focus
│   │   │   ├── RollingText.tsx     # Enlaces rodantes al hover
│   │   │   └── Cursor.tsx          # Cursor doble mix-blend-difference
│   │   ├── sections/               # Hero, Featured, Catalog, Craft, CTA…
│   │   ├── site/                   # Navbar, Footer, CartDrawer, Providers
│   │   └── admin/AdminDashboard.tsx# Panel con tabs (resumen/CRUD/pedidos)
│   ├── db/
│   │   ├── index.ts                # Pool pg + Drizzle
│   │   ├── schema.ts               # users · products · orders (tipado)
│   │   └── seed.ts                 # Auto-seed idempotente
│   └── lib/
│       ├── auth.ts                 # Sesiones HMAC-SHA256 + scrypt
│       ├── data.ts                 # Consultas de dominio
│       ├── cart.tsx                # Carrito (context + localStorage)
│       ├── session.tsx             # Sesión en cliente
│       └── utils.ts                # cn, precios, fechas, categorías
├── drizzle.config.json
└── package.json
```

## Decisiones de arquitectura

- **Vistas por rol sin middleware pesado**: la sesión vive en una cookie firmada
  (HMAC-SHA256) y cada ruta sensible la valida en servidor (`/admin` redirige
  si no eres admin). Las APIs duplican esa validación: la UI nunca es la frontera.
- **Precios recalculados en servidor**: el checkout envía solo `productId` +
  `qty`; `/api/orders` re-lee precios y stock en una **transacción**,
  descuenta inventario y emite un código `NOC-2026-XXXXXX`.
- **Auto-seed idempotente**: `ensureSeeded()` memoriza su promesa y reintenta
  si la DB aún no está lista; seguro en serverless y en primer arranque.
- **Detalle de rendimiento**: auroras y grano de película son CSS puro
  (sin canvas/WebGL), imágenes con `next/image` y parallax por springs.

## Por qué PostgreSQL/Drizzle y no Firebase (nota del equipo)

El entorno de entrega ya incluía PostgreSQL local cableado, lo que permite un
preview funcional al instante, tipado extremo a extremo y transacciones reales
para el inventario. **¿Quieres Firebase igualmente?** La migración es sencilla:

1. Crea el proyecto en Firebase Console y activa Firestore + Auth.
2. Sustituye `src/db/index.ts` por el admin SDK de Firestore y replica las
   colecciones `users`, `products`, `orders` con los mismos campos de
   `src/db/schema.ts` (ya son documentales por diseño).
3. Cambia las funciones de `src/lib/data.ts` por consultas Firestore —
   el resto de la app (UI, animaciones, APIs) no se toca, porque toda la
   capa de datos está encapsulada en `src/lib/data.ts` y `src/db/*`.
4. Las reglas de seguridad deberían replicar los checks de rol que ya hacen
   las route handlers (`role === "admin"`).

## Licencia

Demo de portafolio — úsala, rómpela y vuelve a montarla.
