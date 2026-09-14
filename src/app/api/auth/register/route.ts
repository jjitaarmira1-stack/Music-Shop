import { NextResponse } from "next/server";
import { esquemaRegistro } from "@/lib/validaciones";
import { establecerCookieSesion } from "@/lib/auth";
import { registrarUsuario } from "@/servicios/usuarios";
import { comprobarLimite, obtenerIp } from "@/lib/limitador";
import { manejarError, respuestaLimiteExcedido } from "@/lib/errores";
import { verificarOrigen } from "@/lib/csrf";
import { registro } from "@/lib/registro";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register · Crear una cuenta de cliente
 *
 * Medidas aplicadas:
 *  1. Verificación de origen (CSRF).
 *  2. Límite de altas por IP: evita el registro masivo automatizado.
 *  3. Validación con Zod, incluida una política de contraseña seria
 *     (mínimo 10 caracteres con letras y números; antes eran 6 a secas).
 *  4. El rol se fija a "customer" en el servicio: nadie puede
 *     autoproclamarse administrador enviando `role` en el cuerpo.
 */
export async function POST(peticion: Request) {
  try {
    // ─── 1. Origen ─────────────────────────────────────────────
    verificarOrigen(peticion);

    // ─── 2. Límite de altas por IP ─────────────────────────────
    // 5 cuentas por hora desde la misma IP es de sobra para un uso
    // normal, y corta en seco la creación masiva de cuentas.
    const ip = obtenerIp(peticion);
    const limite = comprobarLimite(`registro:ip:${ip}`, 5, 3600);
    if (!limite.permitido) {
      registro.seguridad("auth/register", "Límite de registro superado", { ip });
      return respuestaLimiteExcedido(limite.segundosEspera);
    }

    // ─── 3. Validación ─────────────────────────────────────────
    const cuerpo = await peticion.json();
    const datos = esquemaRegistro.parse(cuerpo);

    // ─── 4. Alta de la cuenta ──────────────────────────────────
    // El servicio lanza un 409 si el correo ya existe y siempre
    // asigna el rol "customer".
    const usuario = await registrarUsuario(datos);

    // ─── 5. Sesión automática ──────────────────────────────────
    // Se inicia sesión al registrarse, que es lo que ya hacía la
    // versión anterior y resulta cómodo para el usuario.
    const sesion = {
      uid: usuario.id,
      name: usuario.name,
      email: usuario.email,
      role: usuario.role,
    };
    await establecerCookieSesion(sesion);

    registro.info("auth/register", "Cuenta creada e iniciada sesión", {
      uid: usuario.id,
    });

    // 201 Created: es el código correcto al crear un recurso nuevo.
    return NextResponse.json({ user: sesion }, { status: 201 });
  } catch (error) {
    return manejarError(error, "auth/register");
  }
}
