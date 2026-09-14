import { NextResponse } from "next/server";
import { esquemaActualizarProducto, esquemaUuid } from "@/lib/validaciones";
import { actualizarProducto, eliminarProducto } from "@/servicios/productos";
import { exigirAdmin } from "@/lib/auth";
import { manejarError } from "@/lib/errores";
import { verificarOrigen } from "@/lib/csrf";

export const dynamic = "force-dynamic";

/** En Next 16 los parámetros de ruta llegan como promesa. */
type Parametros = { params: Promise<{ id: string }> };

/**
 * PATCH /api/products/[id] · Modificar un instrumento (SÓLO admin)
 */
export async function PATCH(peticion: Request, { params }: Parametros) {
  try {
    // 1. Origen de confianza.
    verificarOrigen(peticion);

    // 2. Rol de administrador comprobado en el servidor.
    await exigirAdmin();

    // 3. El identificador debe ser un UUID válido.
    //    Antes se pasaba tal cual a la consulta: un `id` con formato
    //    incorrecto provocaba un error 500 de PostgreSQL. Ahora se
    //    devuelve un 422 limpio.
    const { id } = await params;
    const idValidado = esquemaUuid.parse(id);

    // 4. Validación del cuerpo. Todos los campos son opcionales, pero
    //    tiene que venir al menos uno.
    const cuerpo = await peticion.json();
    const cambios = esquemaActualizarProducto.parse(cuerpo);

    // 5. Actualización (lanza 404 si el producto no existe).
    const producto = await actualizarProducto(idValidado, cambios);

    return NextResponse.json({ product: producto });
  } catch (error) {
    return manejarError(error, "products/PATCH");
  }
}

/**
 * DELETE /api/products/[id] · Retirar un instrumento (SÓLO admin)
 */
export async function DELETE(peticion: Request, { params }: Parametros) {
  try {
    // 1. Origen de confianza.
    //    Esto es lo que corrige el fallo verificado en la auditoría:
    //    un DELETE con `Origin: https://sitio-malicioso` llegaba a
    //    ejecutarse y respondía {"ok":true}.
    verificarOrigen(peticion);

    // 2. Rol de administrador.
    await exigirAdmin();

    // 3. Identificador validado.
    const { id } = await params;
    const idValidado = esquemaUuid.parse(id);

    // 4. Borrado (lanza 404 si no existe, en vez de fingir éxito).
    const resultado = await eliminarProducto(idValidado);

    return NextResponse.json({ ok: true, nombre: resultado.nombre });
  } catch (error) {
    return manejarError(error, "products/DELETE");
  }
}
