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
 * Crea el pool de conexiones con parámetros pensados para producción.
 */
function crearPool(): Pool {
  const pool = new Pool({
    // Cadena de conexión validada en lib/env.ts.
    connectionString: CONFIG.urlBaseDatos,

    // ─── Tamaño del pool ───────────────────────────────────────
    // Máximo de conexiones simultáneas. PostgreSQL admite 100 por
    // defecto; dejamos margen para migraciones y otras herramientas.
    max: 10,
    // Mínimo de conexiones en reserva: evita el coste de reconectar
    // continuamente cuando el tráfico es bajo.
    min: 1,

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
    // En producción, la mayoría de proveedores gestionados (Neon,
    // Supabase, RDS) exigen TLS. `rejectUnauthorized: false` acepta
    // sus certificados intermedios, que es lo habitual en este tipo
    // de servicios. En local no se usa cifrado.
    ssl: CONFIG.esProduccion ? { rejectUnauthorized: false } : undefined,
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
