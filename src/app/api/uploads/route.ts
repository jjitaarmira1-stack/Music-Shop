import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { exigirAdmin } from "@/lib/auth";
import { manejarError, respuestaLimiteExcedido, ErrorApp } from "@/lib/errores";
import { comprobarLimite, obtenerIp } from "@/lib/limitador";
import { verificarOrigen } from "@/lib/csrf";
import {
  DIRECTORIO_PUBLICO,
  DIRECTORIO_SUBIDAS,
  MAXIMO_BYTES,
  validarYGuardarImagen,
} from "@/lib/almacenamiento";

export const dynamic = "force-dynamic";

/** Extensiones que se listan en la galería. */
const EXTENSIONES_GALERIA = [".jpg", ".jpeg", ".png", ".webp", ".avif"];

/**
 * Estructura de una imagen en la galería.
 *
 * OJO CON LOS NOMBRES DE LOS CAMPOS: van en inglés (`name`, `path`…)
 * aunque el resto del proyecto esté en castellano. No es un descuido.
 *
 * Son el CONTRATO PÚBLICO de la API, y el POST de este mismo endpoint
 * ya devolvía `name`/`path`. Al traducir sólo el GET a `nombre`/`ruta`
 * quedaron dos idiomas en la misma API: el cliente leía `img.path`,
 * recibía `undefined` y la interfaz de administración se rompía con
 * «Cannot read properties of undefined (reading 'replace')».
 *
 * Regla para lo sucesivo: los nombres de campo que cruzan la red se
 * mantienen en inglés y no se traducen; los comentarios, mensajes de
 * error y nombres internos, en castellano.
 */
export interface ImagenGaleria {
  name: string;
  path: string; // Ruta web para mostrarla.
  folder: string; // "subidas" o "catálogo".
  sizeKb: number;
  editable: boolean; // Si se puede borrar (las del catálogo no).
}

/**
 * Recorre un directorio y devuelve sus imágenes.
 * No es recursivo a propósito: evita recorridos costosos y no hay
 * necesidad funcional de subcarpetas.
 */
async function listarDirectorio(
  directorio: string,
  prefijoWeb: string,
  etiquetaCarpeta: string,
  editable: boolean,
): Promise<ImagenGaleria[]> {
  const imagenes: ImagenGaleria[] = [];

  let entradas;
  try {
    entradas = await fs.readdir(directorio, { withFileTypes: true });
  } catch {
    return imagenes; // La carpeta aún no existe: lista vacía.
  }

  for (const entrada of entradas) {
    if (!entrada.isFile()) continue; // Ignoramos subcarpetas.

    // Sólo extensiones de imagen conocidas.
    const extension = path.extname(entrada.name).toLowerCase();
    if (!EXTENSIONES_GALERIA.includes(extension)) continue;

    // Tamaño del archivo para mostrarlo en la interfaz.
    const info = await fs.stat(path.join(directorio, entrada.name));

    imagenes.push({
      name: entrada.name,
      path: `${prefijoWeb}${entrada.name}`,
      folder: etiquetaCarpeta,
      sizeKb: Math.max(1, Math.ceil(info.size / 1024)),
      editable,
    });
  }

  return imagenes;
}

/**
 * GET /api/uploads · Listar la galería (SÓLO administradores)
 *
 * Devuelve dos grupos:
 *  · las imágenes subidas (en `var/uploads`, borrables),
 *  · las del catálogo original (en `public/img`, de sólo lectura).
 */
export async function GET() {
  try {
    await exigirAdmin(); // Autorización en el servidor.

    // Las dos lecturas de disco, en paralelo.
    const [subidas, catalogo, catalogoProductos] = await Promise.all([
      listarDirectorio(DIRECTORIO_SUBIDAS, "/media/products/", "subidas", true),
      listarDirectorio(DIRECTORIO_PUBLICO, "/img/", "catálogo", false),
      listarDirectorio(
        path.join(DIRECTORIO_PUBLICO, "products"),
        "/img/products/",
        "catálogo",
        false,
      ),
    ]);

    // Las subidas primero: son las que el administrador acaba de usar.
    const imagenes = [...subidas, ...catalogoProductos, ...catalogo];

    return NextResponse.json(
      { images: imagenes },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    return manejarError(error, "uploads/GET");
  }
}

/**
 * POST /api/uploads · Subir una imagen (SÓLO administradores)
 *
 * Aquí se corrige la vulnerabilidad crítica C-4 verificada en la
 * auditoría: se subió un archivo con código PHP renombrado a «.jpg»
 * y el servidor respondió 201 Created.
 *
 * Ahora `validarYGuardarImagen` comprueba los BYTES REALES del
 * archivo (magic bytes), valida las dimensiones, genera un nombre
 * aleatorio del lado del servidor y lo escribe FUERA de `public/`.
 */
export async function POST(peticion: Request) {
  try {
    // 1. Origen de confianza.
    verificarOrigen(peticion);

    // 2. Sólo administradores.
    await exigirAdmin();

    // 3. Límite de subidas: 20 archivos cada 5 minutos por IP. Evita
    //    que se llene el disco, aunque la cuenta sea legítima.
    const limite = comprobarLimite(`subidas:${obtenerIp(peticion)}`, 20, 300);
    if (!limite.permitido) return respuestaLimiteExcedido(limite.segundosEspera);

    // 4. Comprobación previa del tamaño por la cabecera. Permite
    //    rechazar un archivo enorme ANTES de leerlo en memoria.
    const tamanoDeclarado = Number(peticion.headers.get("content-length") ?? 0);
    if (tamanoDeclarado > MAXIMO_BYTES * 1.1) {
      throw new ErrorApp(
        "DATOS_INVALIDOS",
        `La imagen supera el máximo de ${MAXIMO_BYTES / 1024 / 1024} MB`,
      );
    }

    // 5. Extraemos el archivo del formulario.
    const formulario = await peticion.formData();
    const archivo = formulario.get("file");

    if (!(archivo instanceof File)) {
      throw new ErrorApp(
        "DATOS_INVALIDOS",
        "Adjunta la imagen en el campo «file»",
      );
    }

    // 6. Validación profunda y guardado seguro.
    const guardada = await validarYGuardarImagen(archivo);

    return NextResponse.json(
      {
        name: guardada.nombre,
        path: guardada.rutaWeb,
        sizeKb: guardada.tamanoKb,
        mime: guardada.mime,
      },
      { status: 201 },
    );
  } catch (error) {
    return manejarError(error, "uploads/POST");
  }
}
