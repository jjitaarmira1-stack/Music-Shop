import "server-only"; // Sólo servidor.
import crypto from "node:crypto"; // Para generar contraseñas aleatorias.
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users, products, type NewProduct } from "@/db/schema";
import { hashearContrasena } from "@/lib/auth";
import { CONFIG } from "@/lib/env";
import { registro } from "@/lib/registro";

// ═══════════════════════════════════════════════════════════════
//  SIEMBRA INICIAL DE DATOS
//
//  ⚠️ CAMBIO DE SEGURIDAD IMPORTANTE (fallo crítico C-5)
//  Antes, la contraseña del administrador estaba escrita en el código
//  (`business.ts` → password: "admin") y la página de inicio de sesión
//  la mostraba en pantalla. Cualquiera que desplegara el proyecto
//  tenía una cuenta de administrador abierta.
//
//  Ahora:
//   · La contraseña se toma de la variable ADMIN_PASSWORD.
//   · Si no está definida, se GENERA una aleatoria y se muestra UNA
//     SOLA VEZ por consola, para que el dueño la guarde.
//   · La siembra sólo ocurre con SEED_DEMO_DATA=true y con la base
//     vacía; en producción se desactiva poniéndola a "false".
// ═══════════════════════════════════════════════════════════════

const CATALOGO_INICIAL: NewProduct[] = [
  {
    slug: "noir-vantage",
    name: "Noir Vantage",
    tagline: "Guitarra eléctrica de autor",
    description:
      "Cuerpo de caoba maciza con acabado satinado negro absoluto. Pastillas humbucker de bobinado manual, diapasón de ébano y un sustain que parece no terminar nunca. Construida para escenarios donde la luz apenas existe.",
    category: "cuerdas",
    subcategory: "guitarras-electricas", // Segundo nivel de clasificación.
    priceCents: 249900,
    stock: 7,
    image: "/img/products/guitarra-electrica.jpg",
    featured: true,
    specs: [
      { label: "Cuerpo", value: "Caoba maciza" },
      { label: "Mástil", value: "Arce tostado" },
      { label: "Pastillas", value: "2× Humbucker boutique" },
      { label: "Acabado", value: "Negro satinado" },
    ],
  },
  {
    slug: "atlas-folk",
    name: "Atlas Folk",
    tagline: "Guitarra acústica de nogal",
    description:
      "Tapa de pícea maciza y aros de nogal americano. Voz cálida, profunda y con una proyección que llena la habitación sin esfuerzo. Cada unidad se ajusta a mano durante seis horas antes de salir del taller.",
    category: "cuerdas",
    subcategory: "guitarras-acusticas", // Segundo nivel de clasificación.
    priceCents: 118900,
    stock: 12,
    image: "/img/products/guitarra-acustica.jpg",
    featured: false,
    specs: [
      { label: "Tapa", value: "Pícea maciza" },
      { label: "Aros y fondo", value: "Nogal americano" },
      { label: "Escala", value: "645 mm" },
      { label: "Incluye", value: "Estuche rígido" },
    ],
  },
  {
    slug: "pulse-a88",
    name: "Pulse A-88",
    tagline: "Sintetizador analógico",
    description:
      "Cuatro osciladores de voltaje real, filtro ladder de 24 dB y una matriz de modulación sin menús: todo está bajo tus dedos. El bruto analógico que define una época, con la estabilidad que exige un estudio moderno.",
    category: "teclas",
    subcategory: "sintetizadores", // Segundo nivel de clasificación.
    priceCents: 184900,
    stock: 5,
    image: "/img/products/sintetizador.jpg",
    featured: true,
    specs: [
      { label: "Osciladores", value: "4× VCO" },
      { label: "Filtro", value: "Ladder 24 dB/oct" },
      { label: "Teclas", value: "61 semi-contrapesadas" },
      { label: "Secuenciador", value: "64 pasos" },
    ],
  },
  {
    slug: "tundra-kit",
    name: "Tundra Kit",
    tagline: "Batería acústica 5 cuerpos",
    description:
      "Cascos de abedul báltico de 7 láminas y herrajes macizos. Bombo de 22″ con pegada seca, timbales que cantan y platillos de bronce B20 martilleados a mano. Lista para girar desde la primera caja.",
    category: "percusion",
    subcategory: "baterias-acusticas", // Segundo nivel de clasificación.
    priceCents: 209900,
    stock: 4,
    image: "/img/products/bateria.jpg",
    featured: false,
    specs: [
      { label: "Cascos", value: "Abedul 7 láminas" },
      { label: "Bombo", value: "22″ × 18″" },
      { label: "Platillos", value: "Bronce B20" },
      { label: "Herrajes", value: "Doble refuerzo" },
    ],
  },
  {
    slug: "vela-44",
    name: "Vela 4/4",
    tagline: "Violín de concierto",
    description:
      "Arce flameado de bosques centenarios y barniz al aceite aplicado en doce capas. Un instrumento de proyección noble y armónicos cristalinos, graduado a mano por un único lutier de principio a fin.",
    category: "cuerdas",
    subcategory: "violines", // Segundo nivel de clasificación.
    priceCents: 345000,
    stock: 3,
    image: "/img/products/violin.jpg",
    featured: true,
    specs: [
      { label: "Fondo", value: "Arce flameado" },
      { label: "Tapa", value: "Pícea de abeto Val di Fiemme" },
      { label: "Barniz", value: "Aceite, 12 capas" },
      { label: "Cuerdas", value: "Entorchado sintético" },
    ],
  },
  {
    slug: "bruma-alto",
    name: "Bruma Alto",
    tagline: "Saxofón alto en Mi♭",
    description:
      "Latón dorado con grabado artesanal y llaves de tacto nacarado. Registro grave aterciopelado, agudos que cortan sin estridencia. Afinación revisada instrumento a instrumento por nuestro atelier de viento.",
    category: "viento",
    subcategory: "madera", // Segundo nivel de clasificación.
    priceCents: 167500,
    stock: 6,
    image: "/img/products/saxofon.jpg",
    featured: true,
    specs: [
      { label: "Cuerpo", value: "Latón dorado" },
      { label: "Tono", value: "Mi bemol" },
      { label: "Llaves", value: "Hasta Fa♯ agudo" },
      { label: "Boquilla", value: "Ebonita tallada a mano" },
    ],
  },
  {
    slug: "orbe-jazz",
    name: "Orbe Jazz",
    tagline: "Bajo eléctrico de precisión",
    description:
      "Grave redondo, definido y siempre en su sitio. Cuerpo de aliso, mástil slim de perfil C y electrónica activa de 3 bandas para esculpir desde dub hasta fusión sin tocar el ampli.",
    category: "cuerdas",
    subcategory: "bajos", // Segundo nivel de clasificación.
    priceCents: 132000,
    stock: 9,
    image: "/img/products/bajo.jpg",
    featured: false,
    specs: [
      { label: "Cuerpo", value: "Aliso" },
      { label: "Trastes", value: "21 medium-jumbo" },
      { label: "Electrónica", value: "Activa 3 bandas" },
      { label: "Escala", value: "34″" },
    ],
  },
  {
    slug: "lumen-m1",
    name: "Lumen M-1",
    tagline: "Micrófono de condensador",
    description:
      "Cápsula de gran diafragma con baño de oro y electrónica discreta clase A. Capta el aire entre las notas: voces íntimas, guitarras con cuerpo y room drums con una sola toma.",
    category: "estudio",
    subcategory: "microfonos", // Segundo nivel de clasificación.
    priceCents: 48900,
    stock: 15,
    image: "/img/products/microfono.jpg",
    featured: false,
    specs: [
      { label: "Cápsula", value: "34 mm baño de oro" },
      { label: "Patrón", value: "Cardioide" },
      { label: "Circuito", value: "Clase A discreta" },
      { label: "Incluye", value: "Suspensión antishock" },
    ],
  },
];

// ─── Estado de la siembra ──────────────────────────────────────

/**
 * Promesa única de la siembra.
 * Al guardarla, varias peticiones simultáneas durante el arranque
 * comparten la MISMA ejecución en lugar de sembrar cada una por su lado.
 */
let promesaSiembra: Promise<void> | null = null;

/**
 * Crea el usuario administrador inicial.
 * Devuelve la contraseña en claro SÓLO si se ha generado al azar,
 * para poder mostrarla una vez por consola.
 */
async function crearAdministradorInicial(): Promise<{
  email: string;
  contrasenaGenerada: string | null;
}> {
  // Correo: el del entorno o uno por defecto razonable.
  const email = (CONFIG.correoAdmin ?? "admin@jpr.studio").toLowerCase();

  // Contraseña: la del entorno, o una aleatoria fuerte si no hay.
  const contrasenaDelEntorno = CONFIG.contrasenaAdmin;
  const contrasenaGenerada = contrasenaDelEntorno
    ? null // Si viene del entorno, no hay que mostrar nada.
    : crypto.randomBytes(18).toString("base64url"); // 24 caracteres aleatorios.

  const contrasenaFinal = contrasenaDelEntorno ?? contrasenaGenerada!;

  // Insertamos la cuenta con el hash Argon2id.
  await db.insert(users).values({
    name: "Administración",
    email,
    passwordHash: await hashearContrasena(contrasenaFinal),
    role: "admin",
  });

  return { email, contrasenaGenerada };
}

/**
 * Siembra la base de datos si está vacía.
 *
 * Es idempotente: comprueba antes de insertar, así que se puede llamar
 * tantas veces como haga falta sin duplicar nada.
 */
async function sembrar(): Promise<void> {
  // Si la siembra está desactivada, no hacemos nada.
  if (!CONFIG.sembrarDatosDemo) {
    registro.debug("siembra", "Siembra desactivada (SEED_DEMO_DATA=false)");
    return;
  }

  // ─── Usuarios ────────────────────────────────────────────────
  const [{ total: totalUsuarios }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users);

  if (totalUsuarios === 0) {
    const { email, contrasenaGenerada } = await crearAdministradorInicial();

    if (contrasenaGenerada) {
      // Se muestra UNA sola vez, por consola del servidor, nunca en el
      // navegador y nunca en el registro estructurado (que va a disco).
      console.warn(
        "\n" +
          "═".repeat(68) + "\n" +
          "  CUENTA DE ADMINISTRACIÓN CREADA\n" +
          `  Correo:     ${email}\n` +
          `  Contraseña: ${contrasenaGenerada}\n` +
          "  Guárdala ahora: no se volverá a mostrar.\n" +
          "  Para fijarla tú mismo, define ADMIN_PASSWORD en el .env\n" +
          "═".repeat(68) + "\n",
      );
    } else {
      registro.info("siembra", "Administrador creado con ADMIN_PASSWORD", { email });
    }
  }

  // ─── Catálogo ────────────────────────────────────────────────
  const [{ total: totalProductos }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products);

  if (totalProductos === 0) {
    await db.insert(products).values(CATALOGO_INICIAL);
    registro.info("siembra", "Catálogo inicial insertado", {
      cantidad: CATALOGO_INICIAL.length,
    });
  }
}

/**
 * Punto de entrada de la siembra.
 *
 * ⚠️ NOTA DE ARQUITECTURA
 * En la versión anterior, esta función se llamaba al principio de CADA
 * consulta de lectura (`getProducts`, `findUserByEmail`…). Mezclaba
 * responsabilidades: leer no debe escribir. Ahora se invoca una única
 * vez desde `instrumentation.ts`, cuando arranca el servidor.
 */
export function asegurarSiembra(): Promise<void> {
  promesaSiembra ??= sembrar().catch((error) => {
    // Si falla (p. ej. la base aún no está lista), soltamos la promesa
    // para poder reintentar en el siguiente arranque.
    promesaSiembra = null;
    registro.error("siembra", "La siembra inicial ha fallado", error);
  });
  return promesaSiembra;
}
