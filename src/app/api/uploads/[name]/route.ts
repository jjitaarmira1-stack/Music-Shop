import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { exigirAdmin } from "@/lib/auth";
import { manejarError, conflicto, noEncontrado } from "@/lib/errores";
import { verificarOrigen } from "@/lib/csrf";
import { DIRECTORIO_SUBIDAS, resolverRutaSegura } from "@/lib/almacenamiento";
import { registro } from "@/lib/registro";

export const dynamic = "force-dynamic";

type Parametros = { params: Promise<{ name: string }> };

/**
 * DELETE /api/uploads/[name] · Borrar una imagen subida (SÓLO admin)
 *
 * Dos salvaguardas:
 *  1. `resolverRutaSegura` impide salir del directorio de subidas
 *     (protección definitiva contra path traversal).
 *  2. No se borra una imagen que esté en uso en el catálogo: se
 *     responde 409 en lugar de dejar productos con la foto rota.
 *
 * Sólo se pueden borrar las imágenes SUBIDAS. Las que vienen con el
 * proyecto (`public/img`) son de sólo lectura y no se tocan.
 */
export async function DELETE(peticion: Request, { params }: Parametros) {
  try {
    // 1. Origen de confianza.
    verificarOrigen(peticion);

    // 2. Sólo administradores.
    await exigirAdmin();

    // 3. Nombre validado y ruta resuelta dentro del directorio permitido.
    //    Si el nombre lleva "../", esta llamada lanza un 400.
    const { name } = await params;
    const rutaArchivo = resolverRutaSegura(DIRECTORIO_SUBIDAS, name);

    // 4. ¿Hay algún producto usando esta imagen?
    //    Se comprueban las dos formas de ruta por compatibilidad con
    //    los datos que ya existieran.
    const rutaMedia = `/media/products/${name}`;
    const rutaImg = `/img/products/${name}`;

    const [enUso] = await db
      .select({ id: products.id, nombre: products.name })
      .from(products)
      .where(or(eq(products.image, rutaMedia), eq(products.image, rutaImg)))
      .limit(1);

    if (enUso) {
      throw conflicto(
        `No se puede borrar: «${enUso.nombre}» está usando esta imagen`,
      );
    }

    // 5. Borrado del archivo.
    try {
      await fs.unlink(rutaArchivo);
    } catch (error) {
      // ENOENT = el archivo ya no existe. Es un 404, no un error interno.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw noEncontrado("La imagen");
      }
      throw error; // Cualquier otro fallo sube al manejador central.
    }

    registro.info("uploads/DELETE", "Imagen eliminada", { nombre: name });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return manejarError(error, "uploads/DELETE");
  }
}
