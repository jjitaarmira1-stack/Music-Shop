// ═══════════════════════════════════════════════════════════════════════
//  ✏️  TU NEGOCIO — ÚNICO archivo que necesitas editar para personalizar
//      nombre, textos, contacto, estadísticas, cuentas demo y pedidos.
//      Después de cambiarlo:  npm run build && npm run start
// ═══════════════════════════════════════════════════════════════════════

export const BUSINESS = {
  // ─── Identidad ─────────────────────────────────────────────────────
  /** Nombre comercial: logo, pestaña del navegador, pie de página, 404… */
  name: "JPR",
  /** Etiqueta pequeña junto al logo (Atelier, Store, Records, Guitars…) */
  suffix: "Music Shop",
  /** Frase corta para el título de la pestaña del navegador */
  tagline: "Tu mejor opción en instrumentos",
  /** Descripción SEO (buscadores y vista previa al compartir) */
  description:
    "Instrumentos musicales de autor, curados en la penumbra. Guitarras, sintetizadores, percusión y viento con acabado boutique.",

  // ─── Contacto visible ──────────────────────────────────────────────
  contact: {
    email: "jprmusicshop@gmail.com",
    phone: "+502 4025-2117",
    address: "Quiche",
    city: "Quetzaltenango",
    coords: "40.4168° N",
  },

  // ─── Redes/enlaces del pie de página (icono: globe | mail | radio) ─
  socials: [
    { icon: "globe", label: "Web", href: "#" },
    { icon: "mail", label: "Email", href: "mailto:jprmusicshop@gmail.com" },
    { icon: "radio", label: "Podcast", href: "#" },
  ],

  // ─── Portada (hero) ────────────────────────────────────────────────
  hero: {
    kicker: "· Venta de instrumentos ·",
    titleA: "El sonido habita", // primera línea del titular
    titleB: "en la oscuridad", // segunda línea
    /** Palabra del título que se pinta en ámbar itálico */
    accentWord: "oscuridad",
    description:
      "Instrumentos de autor, afinados y fotografiados en penumbra. Madera, latón y voltaje convertidos en pequeñas arquitecturas sonoras.",
    stats: [
      { value: 100, suffix: "+", label: "Piezas curadas" },
      { value: 4, suffix: "", label: "Luthiers aliados" },
      { value: 24, suffix: "", label: "Países de envío" },
    ],
    ctaPrimary: "Explorar el catálogo",
    ctaSecondary: "Conocer el atelier",
  },

  // ─── Cinta infinita de categorías ──────────────────────────────────
  manifestoWords: [
    "Guitarras",
    "Sintetizadores",
    "Percusión",
    "Viento",
    "Estudio",
    "Cuerdas",
    "Pedales",
    "Calidad",
  ],

  // ─── Sección Colección ─────────────────────────────────────────────
  featured: {
    kicker: "01 — Colección",
    titleA: "Piezas que piden",
    titleB: "escenario",
    accentWord: "escenario",
    blurb:
      "Una selección rotativa del atelier: instrumentos que llevamos meses esperando y que se van en cuestión de días.",
  },

  // ─── Sección Tienda ────────────────────────────────────────────────
  catalog: {
    kicker: "02 — Tienda",
    title: "Todo el catálogo",
    accentWord: "catálogo",
    searchPlaceholder: "Buscar instrumento…",
  },

  // ─── Sección Atelier / Artesanía ───────────────────────────────────
  craft: {
    kicker: "03 — El atelier",
    titleA: "Afinado a mano,",
    titleB: "pieza a pieza",
    accentWords: ["pieza", "a"],
    body: "No somos un almacén: somos una habitación con luz baja donde cada instrumento espera su turno sobre el banco. Se ajustan cejuelas, se nivelan trastes, se calibran osciladores. Solo sale de la tienda lo que tocaríamos nosotros mismos.",
    stats: [
      { value: 6, suffix: "h", label: "de ajuste por instrumento" },
      { value: 12, suffix: "", label: "capas de barniz al aceite" },
      { value: 100, suffix: "%", label: "revisado a oído" },
    ],
  },

  // ─── Llamada final ─────────────────────────────────────────────────
  cta: {
    kicker: "Última llamada del escenario",
    titleA: "Tu próximo instrumento",
    titleB: "ya respira",
    accentWord: "respira",
    description:
      "Envoltorio negro, certificado del atelier y la promesa de que nada llegará a tus manos sin haber sido escuchado antes.",
    buttonLabel: "Entrar al catálogo",
  },

  // ─── Ventajas de la cinta del pie de página ────────────────────────
  perks: [
    "Envío asegurado",
    "Garantía del atelier",
    "Experiencia única",
    "Devolución 30 días",
    "Pago contra entrega",
  ],

  // ─── Prefijo de los códigos de pedido (NOC-2026-ABC123) ────────────
  orderPrefix: "JPR",

  // ─── Cuentas de demostración ───────────────────────────────────────
  // ⚠️ AVISO DE SEGURIDAD (corrige el fallo crítico C-5 de la auditoría)
  // Aquí había contraseñas escritas en claro (admin / "admin") que además
  // se mostraban en la pantalla de inicio de sesión. Se han eliminado.
  //
  // La cuenta de administración se crea ahora en la primera siembra:
  //   · con la contraseña de la variable ADMIN_PASSWORD del .env, o
  //   · con una contraseña aleatoria que se muestra UNA vez por consola.
  //
  // Para ver las credenciales generadas, revisa la salida del servidor
  // la primera vez que arranca contra una base de datos vacía.
  mostrarCredencialesDemo: false,

} as const;

export type Business = typeof BUSINESS;
