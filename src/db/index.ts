import "server-only"; // Sólo servidor: nunca se empaqueta para el navegador.
import { drizzle } from "drizzle-orm/node-postgres"; // ORM tipado.
import { Pool } from "pg"; // Cliente de PostgreSQL con pool de conexiones.
import { CONFIG } from "@/lib/env"; // Configuración ya validada.
import { registro } from "@/lib/registro"; // Registro de eventos.

// ═══════════════════════════════════════════════════════════════
//  CONEXIÓN A POSTGRESQL
//  Antes el pool se creaba sin ningún parámetro: sin número máximo de
//  conexiones, sin tiempos de espera y sin manejar los errores de
//  conexiones inactivas (esos errores tumban el proceso de Node).
// ═══════════════════════════════════════════════════════════════

/**
 * Guardamos el pool en `globalThis` para que la recarga en caliente
 * del servidor de desarrollo no cree un pool nuevo en cada cambio
 * (acabaría agotando las conexiones de PostgreSQL).
 */
const almacenGlobal = globalThis as typeof globalThis & {
  __poolMusicShop?: Pool;
};

/**
 * ¿Hay que cifrar la conexión con este servidor?
 *
 * @param url Cadena de conexión.
 * @returns `true` si el servidor es remoto o la cadena pide TLS.
 */
function necesitaTLS(url: string): boolean {
  // Si la cadena lo dice explícitamente, se respeta.
  if (url.includes("sslmode=require")) return true;
  if (url.includes("sslmode=disable")) return false;

  try {
    const servidor = new URL(url).hostname;

    // Los servidores locales no usan cifrado: no hay red que espiar.
    const esLocal =
      servidor === "localhost" ||
      servidor === "127.0.0.1" ||
      servidor === "::1" ||
      servidor.endsWith(".local");

    // Cualquier otro servidor está al otro lado de internet: se cifra.
    return !esLocal;
  } catch {
    // Cadena rara: por precaución, se cifra.
    return true;
  }
}

/**
 * Crea el pool de conexiones con parámetros pensados para producción.
 */
function crearPool(): Pool {
  const pool = new Pool({
    // Cadena de conexión validada en lib/env.ts.
    connectionString: CONFIG.urlBaseDatos,

    // ─── Tamaño del pool ───────────────────────────────────────
    // Configurable con DB_POOL_MAX. Por defecto 10 en un servidor
    // normal y 3 en Netlify/Vercel, donde cada instancia abre su
    // propio pool y se agotarían las conexiones (ver lib/env.ts).
    max: CONFIG.maxConexionesPool,
    // Mínimo de conexiones en reserva: evita el coste de reconectar
    // continuamente cuando el tráfico es bajo. En alojamiento
    // efímero se deja en 0: mantener una conexión abierta en una
    // instancia que va a morir en segundos sólo gasta un hueco.
    min: CONFIG.esAlojamientoEfimero ? 0 : 1,

    // ─── Tiempos de espera ─────────────────────────────────────
    // Cierra las conexiones que lleven 30 s sin usarse.
    idleTimeoutMillis: 30_000,
    // Si en 10 s no se consigue conexión, se falla rápido en vez de
    // dejar la petición del usuario colgada indefinidamente.
    connectionTimeoutMillis: 10_000,
    // Una consulta no puede durar más de 30 s: frena las consultas
    // desbocadas que bloquearían el pool entero.
    statement_timeout: 30_000,
    // Lo mismo, pero medido desde el lado del cliente.
    query_timeout: 30_000,

    // ─── TLS ───────────────────────────────────────────────────
    // Se decide por la CADENA DE CONEXIÓN, no por NODE_ENV.
    //
    // Antes dependía de `esProduccion`, y eso fallaba en un caso muy
    // normal: conectarse desde tu ordenador a una base de datos en la
    // nube (por ejemplo para sembrarla o revisarla). Como en local
    // NODE_ENV no es "production", el cifrado quedaba desactivado y
    // Neon o Supabase rechazaban la conexión.
    //
    // Ahora se activa si la cadena lo pide (`sslmode=require`) o si el
    // servidor no es local. Un PostgreSQL en tu máquina sigue sin
    // cifrado, que es lo correcto.
    ssl: necesitaTLS(CONFIG.urlBaseDatos)
      ? // `rejectUnauthorized: false` acepta los certificados
        // intermedios que usan estos servicios gestionados.
        { rejectUnauthorized: false }
      : undefined,
  });

  /**
   * Manejador de errores de conexiones INACTIVAS.
   * Sin este `on("error")`, un corte de red mientras una conexión está
   * en reposo lanza una excepción no capturada que TUMBA el proceso.
   * Es uno de los fallos de estabilidad más frecuentes con node-postgres.
   */
  pool.on("error", (error) => {
    registro.error("db", "Error en una conexión inactiva del pool", error);
    // No relanzamos el error: `pg` retira esa conexión y abre otra.
  });

  // Traza útil al depurar el uso del pool en desarrollo.
  pool.on("connect", () => {
    registro.debug("db", "Nueva conexión establecida", {
      total: pool.totalCount,
      libres: pool.idleCount,
    });
  });

  return pool;
}

/** Pool único y compartido por toda la aplicación. */
export const pool = almacenGlobal.__poolMusicShop ?? crearPool();

// Sólo reutilizamos el pool entre recargas fuera de producción.
if (!CONFIG.esProduccion) {
  almacenGlobal.__poolMusicShop = pool;
}

/**
 * Instancia de Drizzle.
 * Todas las consultas pasan por aquí y se generan como sentencias
 * preparadas con parámetros, así que la inyección SQL no es posible.
 */
export const db = drizzle(pool);

/**
 * Comprueba que la base de datos responde.
 * La usa el endpoint `/api/health` para el monitor de disponibilidad.
 *
 * @returns `true` si la consulta de prueba funciona.
 */
export async function comprobarConexion(): Promise<boolean> {
  try {
    await pool.query("select 1"); // Consulta mínima de comprobación.
    return true;
  } catch (error) {
    registro.error("db", "Comprobación de conexión fallida", error);
    return false;
  }
}

/**
 * Cierra el pool de forma ordenada.
 * Se invoca al recibir SIGTERM/SIGINT para que las consultas en curso
 * terminen antes de que el proceso muera (apagado elegante).
 */
export async function cerrarPool(): Promise<void> {
  try {
    await pool.end(); // Espera a que se liberen las conexiones.
    registro.info("db", "Pool de conexiones cerrado correctamente");
  } catch (error) {
    registro.error("db", "Error al cerrar el pool", error);
  }
}
