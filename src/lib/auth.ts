import "server-only"; // Este módulo jamás debe empaquetarse para el navegador.
import { cookies } from "next/headers"; // Acceso a las cookies en el servidor.
import crypto from "node:crypto"; // Funciones criptográficas nativas.
import * as argon2 from "@node-rs/argon2"; // Hash de contraseñas Argon2id.
import { CONFIG } from "@/lib/env"; // Configuración validada del entorno.
import { registro } from "@/lib/registro"; // Registro de eventos de seguridad.
import type { Role } from "@/db/schema"; // Tipo de rol ("admin" | "customer").

// ═══════════════════════════════════════════════════════════════
//  AUTENTICACIÓN: CONTRASEÑAS Y SESIONES
// ═══════════════════════════════════════════════════════════════

// ─── 1. CONTRASEÑAS ────────────────────────────────────────────

/**
 * Parámetros de Argon2id.
 * Argon2id ganó la Password Hashing Competition y es el algoritmo
 * recomendado por OWASP. Sustituye al `scrypt` con parámetros por
 * defecto que usaba la versión anterior.
 *
 * Los valores siguen la "OWASP Password Storage Cheat Sheet":
 * 19 MiB de memoria, 2 iteraciones y 1 hilo.
 */
const OPCIONES_ARGON2 = {
  // Variante Argon2id (valor 2 del enumerado): resistente tanto a GPU
  // como a ataques de canal lateral. Se indica el número literal porque
  // `isolatedModules` de TypeScript no permite leer enumerados ambientales.
  algorithm: 2 as const,
  memoryCost: 19456, // 19 MiB de memoria por cálculo.
  timeCost: 2, // 2 pasadas.
  parallelism: 1, // 1 hilo.
} as const;

/**
 * Calcula el hash de una contraseña.
 * El resultado incluye la sal y los parámetros, así que no hace falta
 * guardarlos por separado.
 *
 * @param contrasena Contraseña en claro escrita por el usuario.
 * @returns Cadena con formato `$argon2id$v=19$m=...$...`.
 */
export async function hashearContrasena(contrasena: string): Promise<string> {
  return argon2.hash(contrasena, OPCIONES_ARGON2);
}

/**
 * Verificación del formato ANTIGUO (`scrypt`), con formato "sal:hash".
 * Se conserva únicamente para que los usuarios registrados antes de
 * esta mejora puedan seguir entrando. Al primer inicio de sesión
 * correcto su contraseña se vuelve a guardar con Argon2id.
 *
 * @param contrasena Contraseña en claro.
 * @param almacenado Hash guardado en la base de datos.
 */
function verificarScryptAntiguo(contrasena: string, almacenado: string): boolean {
  const [sal, hash] = almacenado.split(":"); // Formato antiguo: "sal:hash".
  if (!sal || !hash) return false; // No tiene el formato esperado.
  try {
    // Recalculamos el hash con la misma sal.
    const candidato = crypto.scryptSync(contrasena, sal, 64);
    const esperado = Buffer.from(hash, "hex");
    // Comparación en tiempo constante: evita ataques de temporización.
    return (
      candidato.length === esperado.length &&
      crypto.timingSafeEqual(candidato, esperado)
    );
  } catch {
    return false; // Hash corrupto en la base de datos.
  }
}

/** Resultado de comprobar una contraseña. */
export interface ResultadoVerificacion {
  /** `true` si la contraseña es correcta. */
  valida: boolean;
  /** `true` si el hash es del formato antiguo y conviene regenerarlo. */
  necesitaActualizar: boolean;
}

/**
 * Comprueba una contraseña contra el hash guardado.
 * Admite los dos formatos (Argon2id nuevo y scrypt antiguo).
 *
 * @param contrasena Contraseña en claro introducida.
 * @param almacenado Hash tal y como está en la base de datos.
 */
export async function verificarContrasena(
  contrasena: string,
  almacenado: string,
): Promise<ResultadoVerificacion> {
  // Los hashes de Argon2 siempre empiezan por "$argon2".
  if (almacenado.startsWith("$argon2")) {
    try {
      const valida = await argon2.verify(almacenado, contrasena);
      return { valida, necesitaActualizar: false };
    } catch {
      // Hash mal formado: lo tratamos como contraseña incorrecta.
      return { valida: false, necesitaActualizar: false };
    }
  }

  // Si no, probamos con el formato antiguo de scrypt.
  const valida = verificarScryptAntiguo(contrasena, almacenado);
  // Si acierta con el formato viejo, marcamos que hay que migrarlo.
  return { valida, necesitaActualizar: valida };
}

/**
 * Consume tiempo de CPU similar al de una verificación real.
 * Se llama cuando el correo NO existe, para que la respuesta tarde lo
 * mismo que con un correo válido. Sin esto, un atacante puede deducir
 * qué correos están registrados midiendo el tiempo de respuesta
 * (ataque de enumeración de usuarios por temporización).
 */
export async function simularVerificacion(): Promise<void> {
  // Hash de la palabra "inexistente" generado una sola vez al arrancar.
  await argon2.hash("contrasena-señuelo-para-igualar-tiempos", OPCIONES_ARGON2);
}

// ─── 2. SESIONES ───────────────────────────────────────────────

/** Nombre de la cookie de sesión. */
const NOMBRE_COOKIE = "musicshop_session";

/** Duración de la sesión: 7 días expresados en segundos. */
const DURACION_SEGUNDOS = 60 * 60 * 24 * 7;

/** Datos que viajan dentro de la cookie de sesión. */
export interface UsuarioSesion {
  /** Identificador del usuario (UUID). */
  uid: string;
  /** Nombre visible. */
  name: string;
  /** Correo electrónico. */
  email: string;
  /** Rol: determina los permisos. */
  role: Role;
}

/** Estructura interna del token, con los campos de control añadidos. */
interface CargaUtil extends UsuarioSesion {
  /** Momento de caducidad (milisegundos desde 1970). */
  exp: number;
  /** Momento de emisión. */
  iat: number;
  /** Identificador único de ESTA sesión (contra fijación de sesión). */
  sid: string;
}

/**
 * Firma un texto con HMAC-SHA256 usando el secreto del entorno.
 * @param texto Contenido a firmar (la carga útil codificada).
 */
function firmar(texto: string): string {
  return crypto
    .createHmac("sha256", CONFIG.secretoSesion) // Clave secreta validada.
    .update(texto)
    .digest("base64url"); // Codificación segura para cookies.
}

/**
 * Crea el token de sesión: `<carga>.<firma>`.
 * Genera siempre un `sid` nuevo, de modo que iniciar sesión invalida
 * cualquier identificador anterior (previene *session fixation*).
 */
export function codificarSesion(usuario: UsuarioSesion): string {
  const ahora = Date.now(); // Momento actual.
  const carga: CargaUtil = {
    ...usuario, // Datos del usuario.
    iat: ahora, // Emitido ahora.
    exp: ahora + DURACION_SEGUNDOS * 1000, // Caduca en 7 días.
    sid: crypto.randomUUID(), // Identificador único de sesión.
  };
  // Codificamos la carga en base64url y la firmamos.
  const codificada = Buffer.from(JSON.stringify(carga)).toString("base64url");
  return `${codificada}.${firmar(codificada)}`;
}

/**
 * Valida y descodifica un token de sesión.
 * Devuelve `null` ante cualquier anomalía: firma inválida, caducado,
 * formato incorrecto o campos que no cuadran.
 */
export function decodificarSesion(token: string | undefined): UsuarioSesion | null {
  if (!token) return null; // No hay cookie.

  // El token debe tener exactamente dos partes separadas por un punto.
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [codificada, firmaRecibida] = partes;
  if (!codificada || !firmaRecibida) return null;

  // Recalculamos la firma esperada con nuestro secreto.
  const firmaEsperada = firmar(codificada);
  const bufRecibida = Buffer.from(firmaRecibida);
  const bufEsperada = Buffer.from(firmaEsperada);

  // Comparación en tiempo constante (evita ataques de temporización).
  if (
    bufRecibida.length !== bufEsperada.length ||
    !crypto.timingSafeEqual(bufRecibida, bufEsperada)
  ) {
    // Firma inválida: o la cookie está corrupta, o alguien la manipuló.
    registro.seguridad("auth", "Firma de sesión inválida");
    return null;
  }

  try {
    // La firma es correcta: ya podemos confiar en el contenido.
    const datos = JSON.parse(
      Buffer.from(codificada, "base64url").toString(),
    ) as Partial<CargaUtil>;

    // Comprobamos la caducidad.
    if (typeof datos.exp !== "number" || datos.exp < Date.now()) return null;

    // Comprobamos que estén todos los campos obligatorios y con el tipo correcto.
    if (
      typeof datos.uid !== "string" ||
      typeof datos.name !== "string" ||
      typeof datos.email !== "string" ||
      (datos.role !== "admin" && datos.role !== "customer")
    ) {
      return null;
    }

    // Devolvemos SOLO los campos públicos, nunca la carga completa.
    return {
      uid: datos.uid,
      name: datos.name,
      email: datos.email,
      role: datos.role,
    };
  } catch {
    return null; // JSON corrupto.
  }
}

/**
 * Lee la sesión de la petición actual.
 * @returns Los datos del usuario, o `null` si no hay sesión válida.
 */
export async function obtenerSesion(): Promise<UsuarioSesion | null> {
  const almacen = await cookies(); // Cookies de la petición en curso.
  return decodificarSesion(almacen.get(NOMBRE_COOKIE)?.value);
}

/**
 * Escribe la cookie de sesión con todos los atributos de seguridad.
 */
export async function establecerCookieSesion(usuario: UsuarioSesion) {
  const almacen = await cookies();
  almacen.set(NOMBRE_COOKIE, codificarSesion(usuario), {
    // httpOnly: JavaScript del navegador NO puede leerla. Es la defensa
    // principal contra el robo de sesión mediante XSS.
    httpOnly: true,
    // sameSite "lax": la cookie no viaja en peticiones POST desde otros
    // sitios, lo que corta la mayoría de los ataques CSRF.
    sameSite: "lax",
    // secure: sólo se envía por HTTPS. Se activa en producción (en
    // desarrollo se usa http://localhost, donde rompería el inicio de sesión).
    secure: CONFIG.esProduccion,
    // Caducidad de la cookie, alineada con la del token.
    maxAge: DURACION_SEGUNDOS,
    // Disponible en toda la aplicación.
    path: "/",
  });
}

/** Borra la cookie de sesión (cierre de sesión). */
export async function limpiarCookieSesion() {
  const almacen = await cookies();
  // Se borra indicando el mismo `path` con el que se creó.
  almacen.delete({ name: NOMBRE_COOKIE, path: "/" });
}

// ─── 3. AYUDAS DE AUTORIZACIÓN ─────────────────────────────────
// Centralizan la comprobación de permisos para no repetirla en cada
// endpoint. Devuelven la sesión o lanzan el error correspondiente.

/**
 * Exige que haya una sesión iniciada.
 * @throws ErrorApp 401 si no hay sesión.
 */
export async function exigirSesion(): Promise<UsuarioSesion> {
  const sesion = await obtenerSesion();
  if (!sesion) {
    // Import diferido para evitar una dependencia circular entre módulos.
    const { noAutenticado } = await import("@/lib/errores");
    throw noAutenticado();
  }
  return sesion;
}

/**
 * Exige que la sesión sea de un administrador.
 * Esta comprobación vive en el SERVIDOR: ocultar un botón en el
 * navegador no es una medida de seguridad.
 *
 * @throws ErrorApp 401 si no hay sesión, 403 si el rol no es admin.
 */
export async function exigirAdmin(): Promise<UsuarioSesion> {
  const sesion = await exigirSesion(); // Primero, que esté identificado.
  if (sesion.role !== "admin") {
    // Registramos el intento: es información valiosa para detectar abusos.
    registro.seguridad("auth", "Acceso de administrador denegado", {
      uid: sesion.uid,
      rol: sesion.role,
    });
    const { noAutorizado } = await import("@/lib/errores");
    throw noAutorizado();
  }
  return sesion;
}
