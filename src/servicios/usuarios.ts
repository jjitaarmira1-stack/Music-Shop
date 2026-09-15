import "server-only"; // Sólo servidor.
import crypto from "node:crypto"; // Generación de contraseñas aleatorias.
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, type Role, type UsuarioPublico } from "@/db/schema";
import { hashearContrasena } from "@/lib/auth";
import { conflicto, noEncontrado } from "@/lib/errores";
import { registro } from "@/lib/registro";

// ═══════════════════════════════════════════════════════════════
//  SERVICIO DE USUARIOS
//  Norma que se cumple sin excepción en todo el archivo: el campo
//  `passwordHash` NUNCA sale de aquí hacia una respuesta HTTP.
// ═══════════════════════════════════════════════════════════════

/**
 * Columnas públicas de un usuario.
 * Se enumeran de forma explícita en lugar de hacer `select()` completo:
 * así el hash de la contraseña no puede escaparse por descuido.
 */
const COLUMNAS_PUBLICAS = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
} as const;

/**
 * Busca un usuario por correo INCLUYENDO el hash.
 * Es de uso interno y exclusivo del inicio de sesión: es el único
 * momento en el que hace falta el hash.
 *
 * @param email Correo (se normaliza a minúsculas).
 */
export async function buscarUsuarioParaLogin(email: string) {
  const normalizado = email.toLowerCase().trim();
  const [usuario] = await db
    .select() // Aquí sí traemos todo, incluido el hash.
    .from(users)
    // Comparamos en minúsculas por si hubiera filas antiguas sin normalizar.
    .where(sql`lower(${users.email}) = ${normalizado}`)
    .limit(1);
  return usuario ?? null;
}

/**
 * Comprueba si ya existe una cuenta con ese correo.
 * Devuelve sólo un booleano: no filtra ningún dato del usuario.
 */
export async function existeUsuarioConEmail(email: string): Promise<boolean> {
  const normalizado = email.toLowerCase().trim();
  const [fila] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizado}`)
    .limit(1);
  return Boolean(fila);
}

/**
 * Crea una cuenta de cliente.
 *
 * El rol se fija SIEMPRE a "customer" dentro de esta función: aunque
 * alguien enviara `role: "admin"` en el cuerpo de la petición, jamás
 * llegaría hasta aquí (escalada de privilegios por mass assignment).
 *
 * @throws ErrorApp 409 si el correo ya está registrado.
 */
export async function registrarUsuario(datos: {
  name: string;
  email: string;
  password: string;
}): Promise<UsuarioPublico> {
  // Comprobación previa: permite devolver un 409 con mensaje claro.
  if (await existeUsuarioConEmail(datos.email)) {
    throw conflicto("Ya existe una cuenta con este correo electrónico");
  }

  // Hash Argon2id. La contraseña en claro no se guarda ni se registra.
  const hash = await hashearContrasena(datos.password);

  try {
    const [creado] = await db
      .insert(users)
      .values({
        name: datos.name,
        email: datos.email.toLowerCase().trim(),
        passwordHash: hash,
        role: "customer", // Rol fijo: nunca se toma de la petición.
      })
      .returning(COLUMNAS_PUBLICAS); // Sólo columnas públicas.

    registro.info("usuarios", "Cuenta creada", { uid: creado.id });
    return creado;
  } catch (error) {
    // Defensa frente a la condición de carrera: si dos peticiones
    // simultáneas pasan la comprobación previa, el índice único de la
    // base de datos rechaza la segunda con el código 23505.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw conflicto("Ya existe una cuenta con este correo electrónico");
    }
    throw error; // Cualquier otro error sube al manejador central.
  }
}

/**
 * Sustituye el hash de la contraseña de un usuario.
 * Se usa para migrar de forma transparente los hashes antiguos de
 * scrypt a Argon2id la primera vez que el usuario entra correctamente.
 */
export async function actualizarHashContrasena(
  usuarioId: string,
  nuevoHash: string,
): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash: nuevoHash })
    .where(eq(users.id, usuarioId));

  registro.info("usuarios", "Hash de contraseña migrado a Argon2id", {
    uid: usuarioId,
  });
}

/**
 * Obtiene el perfil público de un usuario.
 * @returns El perfil sin el hash, o `null` si no existe.
 */
export async function obtenerPerfil(
  usuarioId: string,
): Promise<UsuarioPublico | null> {
  const [usuario] = await db
    .select(COLUMNAS_PUBLICAS) // Nunca el hash.
    .from(users)
    .where(eq(users.id, usuarioId))
    .limit(1);
  return usuario ?? null;
}

// ═══════════════════════════════════════════════════════════════
//  OPERACIONES DE ADMINISTRACIÓN
//
//  Todo lo que sigue sólo puede invocarse desde endpoints que ya han
//  comprobado que quien pide es administrador (`exigirAdmin`). El
//  servicio no vuelve a comprobarlo: su responsabilidad es la regla de
//  negocio, no el control de acceso.
// ═══════════════════════════════════════════════════════════════

/** Usuario con el recuento de pedidos, para la tabla del panel. */
export interface UsuarioAdmin extends UsuarioPublico {
  /** Cuántos pedidos ha hecho. Sirve para saber a quién no conviene borrar. */
  totalPedidos: number;
}

/**
 * Lista todas las cuentas con su número de pedidos.
 *
 * Usa un LEFT JOIN y no una subconsulta por fila: con una subconsulta,
 * cien usuarios serían cien consultas (el clásico problema N+1).
 */
export async function listarUsuarios(): Promise<UsuarioAdmin[]> {
  const { orders } = await import("@/db/schema");

  const filas = await db
    .select({
      ...COLUMNAS_PUBLICAS, // Nunca el hash.
      totalPedidos: sql<number>`count(${orders.id})::int`,
    })
    .from(users)
    // LEFT JOIN para que también aparezcan quienes no han pedido nada.
    .leftJoin(orders, eq(orders.userId, users.id))
    .groupBy(users.id)
    // Los más recientes primero: es lo que interesa vigilar.
    .orderBy(sql`${users.createdAt} desc`);

  return filas;
}

/**
 * Cambia el rol de una cuenta.
 *
 * @param usuarioId      Cuenta a modificar.
 * @param nuevoRol       "admin" o "customer".
 * @param idAdminActual  Quién ejecuta la acción, para dos protecciones.
 * @throws ErrorApp 404 si no existe, 409 si la operación es peligrosa.
 */
export async function cambiarRolUsuario(
  usuarioId: string,
  nuevoRol: Role,
  idAdminActual: string,
): Promise<UsuarioPublico> {
  // ─── Protección 1: no quitarse los permisos a uno mismo ──────
  // Es el error más fácil de cometer y el más molesto: te quedas
  // fuera del panel y hay que arreglarlo por base de datos.
  if (usuarioId === idAdminActual && nuevoRol !== "admin") {
    throw conflicto(
      "No puedes quitarte a ti mismo el rol de administrador. " +
        "Pídeselo a otra persona con permisos.",
    );
  }

  // ─── Protección 2: que no se quede la tienda sin administrador ──
  if (nuevoRol !== "admin") {
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "admin"));

    // Si sólo queda uno y es justo al que se quiere degradar, se aborta.
    if (total <= 1) {
      throw conflicto(
        "Es la única cuenta de administración que queda. " +
          "Crea otra antes de cambiarle el rol.",
      );
    }
  }

  const [actualizado] = await db
    .update(users)
    .set({
      role: nuevoRol,
      // Invalida las sesiones abiertas: sin esto, quien acaba de ser
      // degradado conservaría el rol antiguo dentro de su cookie
      // durante los 7 días que dura, y seguiría entrando al panel.
      sessionsValidFrom: new Date(),
    })
    .where(eq(users.id, usuarioId))
    .returning(COLUMNAS_PUBLICAS);

  if (!actualizado) throw noEncontrado("Usuario no encontrado");

  // Se registra el cambio: es una acción sensible y debe quedar traza.
  registro.info("usuarios", "Rol modificado por un administrador", {
    uid: usuarioId,
    nuevoRol,
    porAdmin: idAdminActual,
  });

  return actualizado;
}

/**
 * Restablece la contraseña de una cuenta y devuelve la nueva.
 *
 * POR QUÉ SE GENERA EN EL SERVIDOR Y NO LA ESCRIBE EL ADMINISTRADOR:
 * si el administrador la eligiera, tendería a poner algo memorizable
 * ("Musicshop2026") y además la conocería de antemano, pudiendo entrar
 * en la cuenta ajena sin dejar rastro. Generada al azar y mostrada una
 * sola vez, el usuario puede cambiarla y el administrador no la retiene.
 *
 * Lo correcto de verdad sería enviar un enlace de un solo uso por
 * correo, pero eso exige un servicio de email que el proyecto no tiene.
 * Esta es la mejor opción disponible sin añadir infraestructura.
 *
 * @returns La contraseña en claro. Se muestra UNA VEZ y no se guarda.
 */
export async function restablecerContrasenaUsuario(
  usuarioId: string,
  idAdminActual: string,
): Promise<{ usuario: UsuarioPublico; contrasenaTemporal: string }> {
  // Comprobamos que existe antes de generar nada.
  const perfil = await obtenerPerfil(usuarioId);
  if (!perfil) throw noEncontrado("Usuario no encontrado");

  // 18 bytes aleatorios -> 24 caracteres en base64url. Muy por encima
  // de lo que puede adivinarse por fuerza bruta, y aún transcribible.
  const contrasenaTemporal = crypto.randomBytes(18).toString("base64url");

  // Se guarda el hash Argon2id, nunca la contraseña en claro.
  const hash = await hashearContrasena(contrasenaTemporal);

  await db
    .update(users)
    .set({
      passwordHash: hash,
      // Cierra las sesiones abiertas. Es imprescindible: si la cuenta
      // estaba comprometida, cambiar la contraseña sin esto dejaría al
      // intruso dentro con su cookie todavía válida.
      sessionsValidFrom: new Date(),
    })
    .where(eq(users.id, usuarioId));

  // Se registra el hecho, JAMÁS la contraseña.
  registro.info("usuarios", "Contraseña restablecida por un administrador", {
    uid: usuarioId,
    porAdmin: idAdminActual,
  });

  return { usuario: perfil, contrasenaTemporal };
}

/**
 * Comprueba si una sesión sigue siendo válida para su usuario.
 *
 * Se llama en cada petición autenticada. Compara el momento de emisión
 * del token con `sessionsValidFrom`: si la cuenta se modificó después
 * de emitirse la cookie, la sesión se considera caducada.
 *
 * @param usuarioId  Usuario de la sesión.
 * @param emitidaEn  Marca `iat` del token, en milisegundos.
 * @returns `true` si la sesión sigue valiendo.
 */
export async function sesionSigueVigente(
  usuarioId: string,
  emitidaEn: number,
): Promise<boolean> {
  const [fila] = await db
    .select({ validasDesde: users.sessionsValidFrom })
    .from(users)
    .where(eq(users.id, usuarioId))
    .limit(1);

  // Si la cuenta ya no existe, la sesión no vale.
  if (!fila) return false;

  // Margen de 1 segundo: la cookie se emite y la fila se escribe con
  // milisegundos de diferencia, y sin margen un inicio de sesión
  // legítimo podría invalidarse a sí mismo.
  return emitidaEn + 1000 >= fila.validasDesde.getTime();
}
