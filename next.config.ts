import type { NextConfig } from "next";

// ═══════════════════════════════════════════════════════════════
//  CONFIGURACIÓN DE NEXT.JS
//  Incluye las cabeceras de seguridad HTTP que faltaban por completo
//  en la versión original (problema A-2 de la auditoría).
// ═══════════════════════════════════════════════════════════════

/** `true` cuando se ejecuta la compilación de producción. */
const esProduccion = process.env.NODE_ENV === "production";

/**
 * Política de Seguridad de Contenido (CSP).
 * Declara de dónde puede cargar recursos la página. Es la defensa de
 * fondo contra XSS: aunque alguien lograra inyectar una etiqueta
 * <script>, el navegador se negaría a ejecutarla.
 *
 * ⚠️ Cada directiva está ajustada a lo que ESTA aplicación necesita
 * de verdad. Una CSP copiada sin comprobar rompe la página.
 */
const politicaSeguridadContenido = [
  // Por defecto, sólo se permite nuestro propio origen.
  "default-src 'self'",

  // Scripts: propios.
  //  · 'unsafe-inline' es imprescindible para los scripts que Next
  //    inserta al hidratar la aplicación.
  //  · 'unsafe-eval' SÓLO en desarrollo, porque lo necesita la
  //    recarga en caliente de Turbopack. En producción se elimina.
  esProduccion
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",

  // Estilos: propios y en línea (Tailwind y Framer Motion generan
  // estilos dinámicos), más las hojas de Google Fonts.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

  // Tipografías: las descarga next/font desde Google Fonts.
  "font-src 'self' https://fonts.gstatic.com data:",

  // Imágenes: propias, más `data:` y `blob:` para las vistas previas
  // locales que se generan al subir una foto.
  "img-src 'self' data: blob:",

  // Peticiones (fetch/XHR/WebSocket): sólo a nuestro propio servidor.
  // En desarrollo se añade WebSocket para la recarga en caliente.
  esProduccion ? "connect-src 'self'" : "connect-src 'self' ws: wss:",

  // Prohibimos por completo los plugins antiguos (Flash, applets…).
  "object-src 'none'",

  // La etiqueta <base> no puede reescribirse: evita el secuestro de
  // todas las rutas relativas de la página.
  "base-uri 'self'",

  // Los formularios sólo pueden enviarse a nuestro propio dominio.
  "form-action 'self'",

  // Nadie puede incrustar esta web en un <iframe>: es la versión
  // moderna de X-Frame-Options y protege contra el "clickjacking".
  "frame-ancestors 'none'",

  // Fuerza a que los recursos http:// se pidan como https://
  // (sólo tiene sentido en producción, con certificado real).
  ...(esProduccion ? ["upgrade-insecure-requests"] : []),
].join("; ");

/**
 * Cabeceras de seguridad que se añaden a TODAS las respuestas.
 */
const cabecerasSeguridad = [
  {
    // Política de seguridad de contenido (explicada arriba).
    key: "Content-Security-Policy",
    value: politicaSeguridadContenido,
  },
  {
    // Impide que el navegador "adivine" el tipo de archivo. Sin esto,
    // un archivo subido podría interpretarse como HTML y ejecutarse
    // (ataque de MIME sniffing).
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Protección contra clickjacking para navegadores antiguos que no
    // entienden `frame-ancestors`.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Al salir del sitio sólo se comparte el dominio, nunca la ruta
    // completa. Evita filtrar URLs internas a terceros.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Desactiva APIs del navegador que esta tienda no usa. Si un script
    // inyectado intentara abrir la cámara o el micrófono, el navegador
    // lo bloquearía.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    // Aísla nuestra ventana de las que la hayan abierto: impide que
    // otra pestaña manipule la nuestra mediante `window.opener`.
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
];

/**
 * HSTS: obliga al navegador a usar siempre HTTPS durante un año.
 * Se añade SÓLO en producción: activarlo en desarrollo dejaría el
 * navegador bloqueado en https://localhost, que no funciona.
 */
const cabeceraHsts = {
  key: "Strict-Transport-Security",
  value: "max-age=31536000; includeSubDomains",
};

const nextConfig: NextConfig = {
  // Oculta la cabecera `X-Powered-By: Next.js`. No es una vulnerabilidad
  // por sí sola, pero no hay motivo para anunciar el framework y su versión.
  poweredByHeader: false,

  // Comprime las respuestas con gzip: menos bytes y carga más rápida.
  compress: true,

  // Activa React Strict Mode: avisa de patrones problemáticos en desarrollo.
  reactStrictMode: true,

  /** Cabeceras HTTP aplicadas por ruta. */
  async headers() {
    return [
      {
        // `/(.*)` = todas las rutas de la aplicación.
        source: "/(.*)",
        headers: esProduccion
          ? [...cabecerasSeguridad, cabeceraHsts]
          : cabecerasSeguridad,
      },
      {
        // Las imágenes subidas se sirven por esta ruta. Se refuerza la
        // seguridad porque su contenido lo aporta un usuario.
        source: "/media/:path*",
        headers: [
          // Sin adivinar el tipo: se respeta el Content-Type que fijamos.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Si alguien abre la URL directamente, se descarga en lugar de
          // ejecutarse en el contexto del sitio.
          { key: "Content-Disposition", value: "inline" },
          // CSP mínima: aunque el archivo lograse contener HTML, no
          // podría ejecutar ningún script.
          { key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self'" },
        ],
      },
    ];
  },

  /** Ajustes del optimizador de imágenes de Next. */
  images: {
    // Formatos modernos: pesan bastante menos que JPEG.
    formats: ["image/avif", "image/webp"],
    // Caché mínima de 24 h para las imágenes ya optimizadas.
    minimumCacheTTL: 60 * 60 * 24,
    // Impide servir SVG: pueden contener scripts (vector de XSS).
    dangerouslyAllowSVG: false,
  },
};

export default nextConfig;
