// ═══════════════════════════════════════════════════════════════
//  INSTRUMENTACIÓN · Código que se ejecuta AL ARRANCAR el servidor
//
//  Next.js llama a `register()` una sola vez, antes de atender la
//  primera petición.
//
//  Aquí se resuelve un problema de arquitectura de la versión
//  anterior: la siembra de datos se disparaba dentro de CADA consulta
//  de lectura (`await ensureSeeded()` al principio de cada función).
//  Leer no debe escribir; ahora ocurre donde corresponde.
// ═══════════════════════════════════════════════════════════════

export async function register() {
  // `NEXT_RUNTIME` indica el entorno de ejecución. Sólo actuamos en
  // Node.js: en el runtime Edge no hay driver de PostgreSQL ni disco.
  // Esta comprobación evita además los avisos de compilación por usar
  // APIs de Node que en Edge no existen.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Importaciones dinámicas: estos módulos no se cargan en Edge.
  const { registro } = await import("@/lib/registro");
  const { CONFIG } = await import("@/lib/env");
  const { comprobarConexion } = await import("@/db");
  const { asegurarSiembra } = await import("@/db/seed");
  const { registrarApagadoOrdenado } = await import("@/lib/apagado");

  registro.info("arranque", "Iniciando la aplicación", {
    entorno: CONFIG.entornoApp,
  });

  // ─── Avisos propios del alojamiento sin disco permanente ─────
  // En Netlify y Vercel conviene dejarlo escrito en el registro del
  // despliegue: son limitaciones de la plataforma que conviene tener
  // presentes, y buscarlas a ciegas cuesta mucho tiempo.
  if (CONFIG.esAlojamientoEfimero) {
    registro.warn(
      "arranque",
      "Alojamiento sin disco permanente. Dos consecuencias: " +
        "(1) las imágenes que suba el administrador NO se conservarán, " +
        "hay que usar un servicio de objetos como Cloudinary o S3; " +
        "(2) el limitador de intentos de acceso cuenta por instancia, " +
        "así que el límite real se multiplica por el número de " +
        "instancias activas. Para resolverlo haría falta Redis.",
    );
  }

  // ─── 1. Apagado ordenado ─────────────────────────────────────
  // Se registra lo primero: si el proceso recibe una señal durante el
  // arranque, igualmente cerraremos las conexiones como es debido.
  registrarApagadoOrdenado();

  // ─── 2. Comprobar que la base de datos responde ──────────────
  const baseDisponible = await comprobarConexion();
  if (!baseDisponible) {
    // No abortamos: la web puede seguir sirviendo páginas y el
    // endpoint /api/health informará del estado degradado.
    registro.error(
      "arranque",
      "La base de datos no responde. La aplicación arranca en modo degradado.",
    );
    return;
  }

  // ─── 3. Sembrar los datos iniciales si hace falta ────────────
  await asegurarSiembra();

  registro.info("arranque", "Aplicación lista");
}
