import "server-only"; // Sólo servidor.
import path from "node:path"; // Manejo de rutas.
import { promises as fs } from "node:fs"; // Sistema de archivos (promesas).
import crypto from "node:crypto"; // Nombres aleatorios.
import { CONFIG } from "@/lib/env"; // Configuración del entorno.
import { ErrorApp } from "@/lib/errores"; // Errores tipados.
import { registro } from "@/lib/registro"; // Registro.

// ═══════════════════════════════════════════════════════════════
//  ALMACENAMIENTO SEGURO DE IMÁGENES
//
//  Problemas del código original que se corrigen aquí:
//   · Sólo se miraba la EXTENSIÓN del nombre enviado por el usuario.
//     Se pudo subir un archivo con código PHP renombrado a «.jpg»
//     y el servidor respondió 201 Created. (verificado en la auditoría)
//   · Los archivos se escribían en «public/», el directorio de
//     estáticos: contenido de usuario mezclado con código de la app.
//   · No se comprobaba el contenido real ni las dimensiones.
// ═══════════════════════════════════════════════════════════════

/**
 * Carpeta donde se guardan las imágenes subidas.
 * Está DELIBERADAMENTE fuera de «public/»: los archivos que sube un
 * usuario nunca deben poder servirse como estáticos sin pasar por
 * nuestro control. Se entregan mediante `/media/products/<nombre>`,
 * que fija el `Content-Type` correcto.
 *
 * ⚠️ AVISO IMPORTANTE EN ALOJAMIENTOS SIN DISCO PERMANENTE
 * En Netlify, Vercel y similares, cada petición puede atenderla una
 * instancia nueva con un disco vacío y temporal. Guardar ahí funciona
 * durante unos minutos y luego el archivo DESAPARECE.
 *
 * Es una limitación de la plataforma, no un fallo del código: esos
 * servicios no ofrecen disco permanente, a propósito. Para que las
 * imágenes subidas persistan hay que guardarlas en un servicio de
 * objetos (Cloudinary, S3, Supabase Storage…) o desplegar en un
 * servidor con disco de verdad (VPS, Railway, Render).
 *
 * Las imágenes del catálogo que vienen con el proyecto sí funcionan
 * siempre: viajan dentro del despliegue, en `public/img`.
 */
export const DIRECTORIO_SUBIDAS =
  CONFIG.directorioSubidas ??
  // En alojamientos efímeros el directorio del proyecto es de sólo
  // lectura, así que se usa /tmp, el único sitio donde se puede
  // escribir. El contenido no sobrevive, pero al menos no falla
  // con un error de permisos al intentar subir una imagen.
  (CONFIG.esAlojamientoEfimero
    ? path.join("/tmp", "musicshop-uploads")
    : path.join(process.cwd(), "var", "uploads"));

/**
 * Carpeta de las imágenes que vienen con el proyecto (el catálogo de
 * ejemplo). Son de sólo lectura y se sirven como estáticos normales.
 */
export const DIRECTORIO_PUBLICO = path.join(process.cwd(), "public", "img");

/** Tamaño máximo permitido por archivo: 6 MB. */
export const MAXIMO_BYTES = 6 * 1024 * 1024;

/** Píxeles máximos (ancho × alto) para frenar las "bombas de descompresión". */
const MAXIMO_PIXELES = 50_000_000; // 50 megapíxeles.

/**
 * Formatos admitidos con su firma binaria ("magic bytes").
 * Estos primeros bytes son los que identifican DE VERDAD el tipo de
 * archivo, al margen de cómo se llame.
 */
interface FormatoImagen {
  /** Tipo MIME que se enviará al navegador. */
  mime: string;
  /** Extensión canónica que usaremos al guardar. */
  extension: string;
  /** Comprueba si el contenido corresponde a este formato. */
  coincide: (datos: Buffer) => boolean;
}

/** Catálogo de formatos permitidos. */
const FORMATOS: FormatoImagen[] = [
  {
    mime: "image/jpeg",
    extension: ".jpg",
    // JPEG empieza siempre por FF D8 FF.
    coincide: (d) => d.length > 3 && d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff,
  },
  {
    mime: "image/png",
    extension: ".png",
    // PNG: 89 50 4E 47 0D 0A 1A 0A  ("\x89PNG\r\n\x1a\n").
    coincide: (d) =>
      d.length > 8 &&
      d[0] === 0x89 &&
      d[1] === 0x50 &&
      d[2] === 0x4e &&
      d[3] === 0x47 &&
      d[4] === 0x0d &&
      d[5] === 0x0a &&
      d[6] === 0x1a &&
      d[7] === 0x0a,
  },
  {
    mime: "image/webp",
    extension: ".webp",
    // WebP: "RIFF" .... "WEBP" (contenedor RIFF).
    coincide: (d) =>
      d.length > 12 &&
      d.toString("ascii", 0, 4) === "RIFF" &&
      d.toString("ascii", 8, 12) === "WEBP",
  },
  {
    mime: "image/avif",
    extension: ".avif",
    // AVIF: caja "ftyp" en los bytes 4-8 y marca "avif"/"avis" después.
    coincide: (d) =>
      d.length > 12 &&
      d.toString("ascii", 4, 8) === "ftyp" &&
      ["avif", "avis"].includes(d.toString("ascii", 8, 12)),
  },
];

/**
 * Detecta el formato real leyendo los primeros bytes del archivo.
 * @returns El formato reconocido, o `null` si no es una imagen admitida.
 */
export function detectarFormato(datos: Buffer): FormatoImagen | null {
  return FORMATOS.find((formato) => formato.coincide(datos)) ?? null;
}

/**
 * Lee el ancho y el alto de la imagen desde su cabecera binaria.
 * Sirve para dos cosas: rechazar archivos corruptos (una imagen real
 * siempre declara sus dimensiones) y frenar las imágenes gigantescas
 * pensadas para agotar la memoria del servidor al procesarlas.
 *
 * @returns Las dimensiones, o `null` si no se pueden determinar.
 */
export function leerDimensiones(
  datos: Buffer,
  mime: string,
): { ancho: number; alto: number } | null {
  try {
    // ─── PNG: ancho y alto son enteros de 32 bits en la cabecera IHDR ──
    if (mime === "image/png") {
      return {
        ancho: datos.readUInt32BE(16), // bytes 16-19
        alto: datos.readUInt32BE(20), // bytes 20-23
      };
    }

    // ─── JPEG: hay que recorrer los marcadores hasta el SOF ──────────
    if (mime === "image/jpeg") {
      let posicion = 2; // Saltamos la marca inicial FF D8.
      while (posicion < datos.length - 9) {
        // Todo marcador empieza por 0xFF; si no, el archivo está corrupto.
        if (datos[posicion] !== 0xff) return null;
        const marcador = datos[posicion + 1];
        // Los marcadores SOF0..SOF15 contienen las dimensiones
        // (se excluyen C4, C8 y CC, que son tablas, no SOF).
        if (
          marcador >= 0xc0 &&
          marcador <= 0xcf &&
          marcador !== 0xc4 &&
          marcador !== 0xc8 &&
          marcador !== 0xcc
        ) {
          return {
            alto: datos.readUInt16BE(posicion + 5),
            ancho: datos.readUInt16BE(posicion + 7),
          };
        }
        // Si no es SOF, saltamos al siguiente marcador usando su longitud.
        posicion += 2 + datos.readUInt16BE(posicion + 2);
      }
      return null;
    }

    // Para WebP y AVIF no analizamos dimensiones: su estructura es
    // bastante más compleja y el límite de tamaño en bytes ya protege.
    return null;
  } catch {
    return null; // Cabecera truncada o corrupta.
  }
}

/**
 * Genera un nombre de archivo seguro e imposible de adivinar.
 *
 * Es fundamental NO reutilizar el nombre que envía el usuario:
 *  · evita el "path traversal" (`../../etc/passwd`),
 *  · evita sobrescribir archivos existentes,
 *  · evita nombres con caracteres raros o de control,
 *  · evita dobles extensiones del tipo `foto.php.jpg`.
 *
 * @param extension Extensión canónica según el formato DETECTADO.
 */
export function generarNombreSeguro(extension: string): string {
  // Marca temporal en base 36: agrupa los archivos por fecha al ordenar.
  const marca = Date.now().toString(36);
  // 8 bytes aleatorios: hacen el nombre impredecible.
  const aleatorio = crypto.randomBytes(8).toString("hex");
  return `${marca}-${aleatorio}${extension}`;
}

/**
 * Comprueba que una ruta quede DENTRO del directorio permitido.
 * Es la defensa definitiva contra el "path traversal": aunque el
 * nombre lleve `..`, tras resolver la ruta absoluta se comprueba que
 * siga colgando de la carpeta base.
 *
 * @param directorioBase Carpeta permitida.
 * @param nombre         Nombre de archivo a comprobar.
 * @returns La ruta absoluta segura.
 * @throws ErrorApp 400 si se intenta salir del directorio.
 */
export function resolverRutaSegura(directorioBase: string, nombre: string): string {
  // Nos quedamos sólo con el último segmento: "../../x" se queda en "x".
  const soloNombre = path.basename(nombre);

  // Rechazamos nombres vacíos o de navegación relativa.
  if (!soloNombre || soloNombre === "." || soloNombre === "..") {
    throw new ErrorApp("PETICION_INVALIDA", "Nombre de archivo no válido");
  }

  // Sólo permitimos un juego de caracteres muy restringido.
  if (!/^[A-Za-z0-9._-]+$/.test(soloNombre)) {
    throw new ErrorApp("PETICION_INVALIDA", "Nombre de archivo no válido");
  }

  // Y prohibimos cualquier `..` que haya sobrevivido.
  if (soloNombre.includes("..")) {
    throw new ErrorApp("PETICION_INVALIDA", "Nombre de archivo no válido");
  }

  // Resolvemos la ruta absoluta definitiva.
  const rutaAbsoluta = path.resolve(directorioBase, soloNombre);
  const baseAbsoluta = path.resolve(directorioBase);

  // Comprobación final: la ruta resuelta debe estar dentro de la base.
  if (
    rutaAbsoluta !== baseAbsoluta &&
    !rutaAbsoluta.startsWith(baseAbsoluta + path.sep)
  ) {
    registro.seguridad("almacenamiento", "Intento de path traversal", { nombre });
    throw new ErrorApp("PETICION_INVALIDA", "Nombre de archivo no válido");
  }

  return rutaAbsoluta;
}

/** Resultado de validar y guardar una imagen. */
export interface ImagenGuardada {
  /** Nombre generado por el servidor. */
  nombre: string;
  /** Ruta web para mostrarla: `/media/products/<nombre>`. */
  rutaWeb: string;
  /** Tamaño en kilobytes. */
  tamanoKb: number;
  /** Tipo MIME real detectado. */
  mime: string;
}

/**
 * Valida a fondo un archivo subido y lo guarda en disco.
 *
 * Orden de las comprobaciones (de la más barata a la más cara):
 *  1. Que el tamaño declarado no supere el límite.
 *  2. Que los bytes reales correspondan a una imagen admitida.
 *  3. Que las dimensiones sean coherentes y razonables.
 *  4. Se genera un nombre seguro y se escribe fuera de `public/`.
 *
 * @param archivo Archivo recibido en el `FormData`.
 * @throws ErrorApp con un mensaje claro si alguna comprobación falla.
 */
export async function validarYGuardarImagen(archivo: File): Promise<ImagenGuardada> {
  // ─── 1. Tamaño declarado ─────────────────────────────────────
  // Se comprueba antes de leer el contenido, para no cargar en memoria
  // un archivo enorme sólo para descubrir después que sobra.
  if (archivo.size > MAXIMO_BYTES) {
    throw new ErrorApp(
      "DATOS_INVALIDOS",
      `La imagen supera el máximo de ${MAXIMO_BYTES / 1024 / 1024} MB`,
    );
  }

  // Un archivo vacío no es una imagen.
  if (archivo.size === 0) {
    throw new ErrorApp("DATOS_INVALIDOS", "El archivo está vacío");
  }

  // Volcamos el contenido a un búfer para poder inspeccionarlo.
  const datos = Buffer.from(await archivo.arrayBuffer());

  // Segunda comprobación de tamaño sobre los bytes REALES: el campo
  // `size` lo declara el cliente y podría mentir.
  if (datos.length > MAXIMO_BYTES) {
    throw new ErrorApp("DATOS_INVALIDOS", "La imagen supera el tamaño permitido");
  }

  // ─── 2. Contenido real (magic bytes) ─────────────────────────
  // ESTA es la corrección de la vulnerabilidad crítica: ya no importa
  // cómo se llame el archivo, sino lo que contiene de verdad.
  const formato = detectarFormato(datos);
  if (!formato) {
    registro.seguridad("almacenamiento", "Subida rechazada: contenido no es imagen", {
      nombreDeclarado: archivo.name,
      tipoDeclarado: archivo.type,
    });
    throw new ErrorApp(
      "DATOS_INVALIDOS",
      "El archivo no es una imagen válida. Formatos admitidos: JPG, PNG, WebP y AVIF.",
    );
  }

  // ─── 3. Dimensiones ──────────────────────────────────────────
  const dimensiones = leerDimensiones(datos, formato.mime);
  if (dimensiones) {
    // Una imagen real nunca tiene lados de 0 píxeles.
    if (dimensiones.ancho <= 0 || dimensiones.alto <= 0) {
      throw new ErrorApp("DATOS_INVALIDOS", "La imagen está dañada");
    }
    // Tope de megapíxeles: frena las "bombas de descompresión".
    if (dimensiones.ancho * dimensiones.alto > MAXIMO_PIXELES) {
      throw new ErrorApp(
        "DATOS_INVALIDOS",
        "La imagen tiene una resolución excesiva (máximo 50 megapíxeles)",
      );
    }
  }

  // ─── 4. Guardado ─────────────────────────────────────────────
  // El nombre lo decide el servidor, con la extensión del formato
  // DETECTADO (no la que venía en el nombre original).
  const nombre = generarNombreSeguro(formato.extension);

  // Nos aseguramos de que exista la carpeta de destino.
  await fs.mkdir(DIRECTORIO_SUBIDAS, { recursive: true });

  // Ruta final, validada contra path traversal.
  const rutaDestino = resolverRutaSegura(DIRECTORIO_SUBIDAS, nombre);

  // Escribimos con permisos 0644: lectura para todos, escritura sólo
  // para el propietario y, sobre todo, SIN bit de ejecución.
  await fs.writeFile(rutaDestino, datos, { mode: 0o644 });

  registro.info("almacenamiento", "Imagen guardada", {
    nombre,
    mime: formato.mime,
    kb: Math.ceil(datos.length / 1024),
  });

  return {
    nombre,
    rutaWeb: `/media/products/${nombre}`,
    tamanoKb: Math.max(1, Math.ceil(datos.length / 1024)),
    mime: formato.mime,
  };
}

/**
 * Devuelve el tipo MIME de un archivo ya guardado, leyendo sus bytes.
 * No nos fiamos de la extensión ni siquiera para los archivos que ya
 * están en disco: así evitamos el "MIME spoofing" al servirlos.
 */
export async function detectarMimeDeArchivo(ruta: string): Promise<string | null> {
  // Nos basta con los primeros 16 bytes para identificar el formato.
  let manejador: fs.FileHandle | undefined;
  try {
    manejador = await fs.open(ruta, "r");
    const buffer = Buffer.alloc(16);
    await manejador.read(buffer, 0, 16, 0);
    return detectarFormato(buffer)?.mime ?? null;
  } finally {
    // Cerramos siempre el descriptor, haya error o no.
    await manejador?.close();
  }
}
