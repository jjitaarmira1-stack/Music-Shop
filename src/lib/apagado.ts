import "server-only"; // Sólo servidor (runtime de Node.js).
import { cerrarPool } from "@/db"; // Cierre del pool de conexiones.
import { registro } from "@/lib/registro"; // Registro.

// ═══════════════════════════════════════════════════════════════
//  APAGADO ORDENADO (GRACEFUL SHUTDOWN)
//
//  Vive en su propio archivo, y no dentro de `instrumentation.ts`,
//  por un motivo concreto: Next analiza la instrumentación también
//  para el runtime Edge, donde `process.once` y `process.exit` no
//  existen, y eso generaba avisos en cada compilación. Al aislarlo
//  aquí y cargarlo con un import dinámico, sólo se evalúa en Node.
// ═══════════════════════════════════════════════════════════════

/** Evita registrar los manejadores dos veces con la recarga en caliente. */
let manejadoresRegistrados = false;

/**
 * Registra los manejadores de cierre.
 *
 * Al desplegar una versión nueva, el orquestador (Docker, Kubernetes,
 * systemd…) envía SIGTERM y espera unos segundos antes de matar el
 * proceso. Aprovechamos esa ventana para cerrar el pool, de modo que
 * las consultas en vuelo terminen en lugar de cortarse a la mitad.
 */
export function registrarApagadoOrdenado(): void {
  if (manejadoresRegistrados) return; // Ya estaban puestos.
  manejadoresRegistrados = true;

  /** Cierra los recursos y termina el proceso. */
  const apagar = async (senal: string) => {
    registro.info("apagado", `Señal ${senal} recibida: cerrando conexiones`);
    try {
      await cerrarPool(); // Espera a que se liberen las conexiones.
    } catch (error) {
      registro.error("apagado", "Fallo al cerrar el pool", error);
    }
    // Código 0 = salida correcta y voluntaria.
    process.exit(0);
  };

  // SIGTERM: la envían los orquestadores al desplegar o reescalar.
  process.once("SIGTERM", () => void apagar("SIGTERM"));
  // SIGINT: es el Ctrl+C del desarrollador en la terminal.
  process.once("SIGINT", () => void apagar("SIGINT"));
}
