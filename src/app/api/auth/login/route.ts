import { NextResponse } from "next/server";
import { esquemaLogin } from "@/lib/validaciones";
import {
  establecerCookieSesion,
  hashearContrasena,
  simularVerificacion,
  verificarContrasena,
} from "@/lib/auth";
import {
  buscarUsuarioParaLogin,
  actualizarHashContrasena,
} from "@/servicios/usuarios";
import { comprobarLimite, obtenerIp, reiniciarLimite } from "@/lib/limitador";
import { manejarError, respuestaLimiteExcedido, ErrorApp } from "@/lib/errores";
import { verificarOrigen } from "@/lib/csrf";
import { registro } from "@/lib/registro";
import { CONFIG } from "@/lib/env";

// Este endpoint usa cookies y base de datos: debe ejecutarse siempre.
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login · Inicio de sesión
 *
 * Medidas de seguridad aplicadas:
 *  1. Verificación de origen (CSRF).
 *  2. Límite de intentos por IP y por cuenta (fuerza bruta).
 *  3. Validación estricta del cuerpo con Zod.
 *  4. Respuesta de tiempo constante (evita enumerar correos).
 *  5. Mensaje de error genérico: no se revela si el correo existe.
 *  6. Migración transparente de los hashes antiguos a Argon2id.
 */
export async function POST(peticion: Request) {
  try {
    // ─── 1. Origen de la petición ──────────────────────────────
    verificarOrigen(peticion);

    // ─── 2. Límite por IP ──────────────────────────────────────
    // Frena el barrido de muchas cuentas desde una misma máquina.
    const ip = obtenerIp(peticion);
    const limitePorIp = comprobarLimite(
      `login:ip:${ip}`,
      CONFIG.limitePeticiones.maxIntentosLogin * 4, // Margen para redes compartidas.
      CONFIG.limitePeticiones.ventanaLoginSegundos,
    );
    if (!limitePorIp.permitido) {
      registro.seguridad("auth/login", "Límite por IP superado", { ip });
      return respuestaLimiteExcedido(limitePorIp.segundosEspera);
    }

    // ─── 3. Validación del cuerpo ──────────────────────────────
    // `parse` lanza ZodError si algo no encaja; lo traduce `manejarError`.
    const cuerpo = await peticion.json();
    const { email, password } = esquemaLogin.parse(cuerpo);

    // ─── 4. Límite por cuenta ──────────────────────────────────
    // Impide machacar una cuenta concreta desde muchas IP distintas.
    const claveCuenta = `login:cuenta:${email}`;
    const limitePorCuenta = comprobarLimite(
      claveCuenta,
      CONFIG.limitePeticiones.maxIntentosLogin,
      CONFIG.limitePeticiones.ventanaLoginSegundos,
    );
    if (!limitePorCuenta.permitido) {
      registro.seguridad("auth/login", "Límite por cuenta superado", { email });
      return respuestaLimiteExcedido(limitePorCuenta.segundosEspera);
    }

    // ─── 5. Buscar al usuario ──────────────────────────────────
    const usuario = await buscarUsuarioParaLogin(email);

    // Si el correo no existe, gastamos el mismo tiempo de CPU que si
    // existiera. Sin esto, la diferencia de milisegundos permite
    // averiguar qué correos están registrados.
    if (!usuario) {
      await simularVerificacion();
      registro.seguridad("auth/login", "Intento con correo inexistente", { ip });
      // Mensaje IDÉNTICO al de contraseña incorrecta, a propósito.
      throw new ErrorApp("NO_AUTENTICADO", "Correo o contraseña incorrectos");
    }

    // ─── 6. Verificar la contraseña ────────────────────────────
    const { valida, necesitaActualizar } = await verificarContrasena(
      password,
      usuario.passwordHash,
    );

    if (!valida) {
      registro.seguridad("auth/login", "Contraseña incorrecta", {
        uid: usuario.id,
        ip,
      });
      throw new ErrorApp("NO_AUTENTICADO", "Correo o contraseña incorrectos");
    }

    // ─── 7. Migrar el hash antiguo si procede ──────────────────
    // Si el usuario venía con scrypt, ahora que conocemos su
    // contraseña correcta la volvemos a guardar con Argon2id.
    if (necesitaActualizar) {
      try {
        await actualizarHashContrasena(
          usuario.id,
          await hashearContrasena(password),
        );
      } catch (error) {
        // Que falle la migración no debe impedir entrar.
        registro.error("auth/login", "No se pudo migrar el hash", error);
      }
    }

    // ─── 8. Crear la sesión ────────────────────────────────────
    // Al acertar, el contador de intentos fallidos se pone a cero.
    reiniciarLimite(claveCuenta);

    // Datos mínimos en la sesión: nunca el hash ni nada sensible.
    const sesion = {
      uid: usuario.id,
      name: usuario.name,
      email: usuario.email,
      role: usuario.role,
    };

    // `establecerCookieSesion` genera un identificador de sesión nuevo,
    // lo que invalida cualquier anterior (previene session fixation).
    await establecerCookieSesion(sesion);

    registro.info("auth/login", "Sesión iniciada", {
      uid: usuario.id,
      rol: usuario.role,
    });

    return NextResponse.json({ user: sesion });
  } catch (error) {
    // Traductor central: decide el código HTTP y limpia el mensaje.
    return manejarError(error, "auth/login");
  }
}
