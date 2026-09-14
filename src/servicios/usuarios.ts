import "server-only"; // Sólo servidor.
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, type UsuarioPublico } from "@/db/schema";
import { hashearContrasena } from "@/lib/auth";
import { conflicto } from "@/lib/errores";
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
