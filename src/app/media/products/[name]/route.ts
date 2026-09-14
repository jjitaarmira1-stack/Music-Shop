import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DIRECTORIO_SUBIDAS,
  detectarMimeDeArchivo,
  resolverRutaSegura,
} from "@/lib/almacenamiento";
import { manejarError, noEncontrado } from "@/lib/errores";
import { registro } from "@/lib/registro";

/**
 * Las imágenes subidas son archivos en disco que cambian con el
 * tiempo: esta ruta debe ejecutarse siempre, no congelarse en el build.
 */
export const dynamic = "force-dynamic";

type Parametros = { params: Promise<{ name: string }> };

/**
 * GET /media/products/[name] · Servir una imagen subida
 *
 * ── POR QUÉ EXISTE ESTA RUTA ──────────────────────────────────
 * Las imágenes que sube el administrador se guardan FUERA de
 * `public/`, así que Next no las sirve como estáticos. Este handler
 * es la única puerta de entrada, y eso permite controlar exactamente
 * qué se entrega y con qué cabeceras.
 *
 * ── SEGURIDAD ─────────────────────────────────────────────────
 *  1. `resolverRutaSegura` valida el nombre y comprueba que la ruta
 *     resuelta siga dentro del directorio de subidas (path traversal).
 *  2. El `Content-Type` se decide leyendo los BYTES del archivo, no
 *     su extensión: aunque alguien lograse colar un archivo con
 *     contenido HTML, se serviría como imagen y no se ejecutaría.
 *  3. `X-Content-Type-Options: nosniff` impide que el navegador
 *     reinterprete el tipo por su cuenta.
 */
export async function GET(_peticion: Request, { params }: Parametros) {
  try {
    const { name } = await params;

    // 1. Ruta validada dentro del directorio permitido.
    //    Un nombre con "../" lanza aquí un 400.
    const rutaArchivo = resolverRutaSegura(DIRECTORIO_SUBIDAS, name);

    // 2. Tipo MIME REAL, deducido del contenido del archivo.
    let tipoMime: string | null;
    try {
      tipoMime = await detectarMimeDeArchivo(rutaArchivo);
    } catch (error) {
      // El archivo no existe: respuesta 404 normal.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw noEncontrado("La imagen");
      }
      throw error;
    }

    // 3. Si el contenido no es una imagen conocida, no lo servimos.
    //    Esto detendría en seco un archivo malicioso que hubiera
    //    llegado al disco por cualquier otra vía.
    if (!tipoMime) {
      registro.seguridad("media", "Archivo con contenido no válido", {
        nombre: path.basename(name),
      });
      throw noEncontrado("La imagen");
    }

    // 4. Lectura y entrega del archivo.
    const datos = await fs.readFile(rutaArchivo);

    return new NextResponse(new Uint8Array(datos), {
      headers: {
        // Tipo verificado por contenido.
        "Content-Type": tipoMime,
        // El navegador no puede reinterpretar el tipo.
        "X-Content-Type-Options": "nosniff",
        // Caché larga: el nombre incluye una parte aleatoria, así que
        // un archivo distinto tendrá siempre una URL distinta.
        "Cache-Control": "public, max-age=31536000, immutable",
        // Longitud explícita: permite mostrar el progreso de descarga.
        "Content-Length": String(datos.length),
      },
    });
  } catch (error) {
    return manejarError(error, "media/products/GET");
  }
}
