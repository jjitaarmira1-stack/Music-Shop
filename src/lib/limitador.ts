import "server-only"; // Sólo servidor.
import { registro } from "@/lib/registro"; // Para dejar constancia de los bloqueos.

// ═══════════════════════════════════════════════════════════════
//  LIMITADOR DE FRECUENCIA (RATE LIMITING)
//  Defensa contra fuerza bruta, "credential stuffing" y abuso de
//  endpoints costosos (subida de archivos, registro de cuentas).
//
//  ⚠️ LIMITACIÓN CONOCIDA E IMPORTANTE:
//  El contador vive en la MEMORIA de este proceso. Funciona muy bien
//  con una sola instancia (que es el caso hoy), pero si algún día se
//  despliegan varias réplicas o se usa un entorno "serverless", cada
//  una tendrá su propio contador y el límite real se multiplicará.
//  En ese momento hay que mover el contador a Redis: la interfaz de
//  `comprobarLimite()` está pensada para que el cambio sea interno.
// ═══════════════════════════════════════════════════════════════

/** Estado que guardamos de cada clave vigilada. */
interface Contador {
  /** Número de intentos acumulados en la ventana actual. */
  intentos: number;
  /** Momento (epoch ms) en el que la ventana se reinicia. */
  reinicioEn: number;
}

/**
 * Almacén en memoria: clave → contador.
 * Se cuelga de `globalThis` para sobrevivir a las recargas en caliente
 * del servidor de desarrollo de Next (si no, se vaciaría a cada cambio).
 */
const almacenGlobal = globalThis as typeof globalThis & {
  __limitadorMusicShop?: Map<string, Contador>;
};

/** Mapa único de contadores. */
const contadores: Map<string, Contador> =
  almacenGlobal.__limitadorMusicShop ?? new Map();

// Guardamos la referencia para reutilizarla tras una recarga.
almacenGlobal.__limitadorMusicShop = contadores;

/**
 * Límite de entradas del mapa.
 * Sin este tope, un atacante que rote la IP en cada petición podría
 * hacer crecer el mapa sin fin hasta agotar la memoria del servidor.
 */
const MAXIMO_ENTRADAS = 10_000;

/**
 * Elimina los contadores ya caducados.
 * Se ejecuta de forma oportunista en cada comprobación: así no hace
 * falta un temporizador de fondo que mantenga vivo el proceso.
 */
function limpiarCaducados() {
  const ahora = Date.now();
  for (const [clave, contador] of contadores) {
    if (contador.reinicioEn <= ahora) contadores.delete(clave);
  }
  // Si aun así seguimos por encima del tope, vaciamos del todo.
  // Es una medida drástica pero segura: en el peor caso, unos usuarios
  // legítimos recuperan sus intentos antes de tiempo.
  if (contadores.size > MAXIMO_ENTRADAS) {
    registro.warn("limitador", "Mapa de contadores lleno: se vacía por completo", {
      tamano: contadores.size,
    });
    contadores.clear();
  }
}

/** Resultado de consultar el limitador. */
export interface ResultadoLimite {
  /** `true` si la petición puede continuar. */
  permitido: boolean;
  /** Intentos que quedan antes de bloquear. */
  restantes: number;
  /** Segundos que faltan para que se reinicie la ventana. */
  segundosEspera: number;
}

/**
 * Comprueba y consume un intento para la clave indicada.
 *
 * @param clave    Identificador de lo que se limita. Conviene combinar
 *                 acción e IP, por ejemplo `login:203.0.113.5`.
 * @param maximo   Intentos permitidos dentro de la ventana.
 * @param ventanaSegundos Duración de la ventana en segundos.
 */
export function comprobarLimite(
  clave: string,
  maximo: number,
  ventanaSegundos: number,
): ResultadoLimite {
  limpiarCaducados(); // Mantenimiento oportunista.

  const ahora = Date.now();
  const existente = contadores.get(clave);

  // Caso 1: no hay contador, o el anterior ya caducó → ventana nueva.
  if (!existente || existente.reinicioEn <= ahora) {
    contadores.set(clave, {
      intentos: 1, // Esta misma petición cuenta como el primer intento.
      reinicioEn: ahora + ventanaSegundos * 1000,
    });
    return {
      permitido: true,
      restantes: maximo - 1,
      segundosEspera: ventanaSegundos,
    };
  }

  // Caso 2: ya se alcanzó el máximo → bloqueamos.
  if (existente.intentos >= maximo) {
    const segundosEspera = Math.ceil((existente.reinicioEn - ahora) / 1000);
    return { permitido: false, restantes: 0, segundosEspera };
  }

  // Caso 3: dentro del límite → sumamos un intento y dejamos pasar.
  existente.intentos += 1;
  return {
    permitido: true,
    restantes: maximo - existente.intentos,
    segundosEspera: Math.ceil((existente.reinicioEn - ahora) / 1000),
  };
}

/**
 * Reinicia el contador de una clave.
 * Se llama tras un inicio de sesión CORRECTO: quien acierta la
 * contraseña no debe arrastrar los intentos fallidos anteriores.
 */
export function reiniciarLimite(clave: string) {
  contadores.delete(clave);
}

/**
 * Deduce la IP del cliente a partir de las cabeceras de la petición.
 *
 * ⚠️ Estas cabeceras las puede falsificar el cliente SI la aplicación
 * está expuesta directamente a internet. Son fiables sólo cuando hay
 * delante un proxy de confianza (Vercel, Nginx, Cloudflare) que las
 * reescribe. Como red de seguridad, si no hay ninguna cabecera
 * devolvemos una constante: peor es no limitar nada.
 */
export function obtenerIp(peticion: Request): string {
  const cabeceras = peticion.headers;

  // `x-forwarded-for` puede traer una lista: "cliente, proxy1, proxy2".
  // La primera entrada es la IP original del cliente.
  const reenviada = cabeceras.get("x-forwarded-for");
  if (reenviada) {
    const primera = reenviada.split(",")[0]?.trim();
    if (primera) return primera;
  }

  // Cabecera que usa Cloudflare.
  const cloudflare = cabeceras.get("cf-connecting-ip");
  if (cloudflare) return cloudflare;

  // Cabecera estándar de algunos proxys.
  const real = cabeceras.get("x-real-ip");
  if (real) return real;

  // Sin información: todos comparten cubo. Es conservador pero seguro.
  return "desconocida";
}
