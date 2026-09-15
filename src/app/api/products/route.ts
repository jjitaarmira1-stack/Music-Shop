import { NextResponse } from "next/server";
import { esquemaCrearProducto, esquemaFiltrosProducto } from "@/lib/validaciones";
import { buscarProductos, crearProducto } from "@/servicios/productos";
import { exigirAdmin } from "@/lib/auth";
import { manejarError, respuestaLimiteExcedido } from "@/lib/errores";
import { comprobarLimite, obtenerIp } from "@/lib/limitador";
import { verificarOrigen } from "@/lib/csrf";

export const dynamic = "force-dynamic";

/**
 * GET /api/products · Catálogo público (con filtros y paginación)
 *
 * Es el único endpoint abierto sin sesión, porque el catálogo es
 * público. Aun así se validan todos los parámetros de la URL: un
 * `page=-5` o un `perPage=999999` se rechazan con un 422.
 */
export async function GET(peticion: Request) {
  try {
    const { searchParams } = new URL(peticion.url);

    // Validamos los parámetros de consulta. Zod aplica los valores por
    // defecto (página 1, 24 por página) y los topes máximos.
    const filtros = esquemaFiltrosProducto.parse({
      category: searchParams.get("category") ?? undefined,
      subcategory: searchParams.get("subcategory") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      featured: searchParams.get("featured") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    });

    const resultado = await buscarProductos(filtros);

    return NextResponse.json(
      {
        products: resultado.productos,
        // Metadatos de paginación: el cliente sabe si hay más páginas.
        paginacion: {
          pagina: resultado.pagina,
          porPagina: resultado.porPagina,
          total: resultado.total,
          totalPaginas: resultado.totalPaginas,
        },
      },
      {
        headers: {
          // Caché corta en el navegador y en el CDN. `stale-while-revalidate`
          // permite servir la copia antigua mientras se refresca por detrás,
          // así el usuario nunca espera.
          "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    return manejarError(error, "products/GET");
  }
}

/**
 * POST /api/products · Crear un instrumento (SÓLO administradores)
 */
export async function POST(peticion: Request) {
  try {
    // 1. Origen de confianza.
    verificarOrigen(peticion);

    // 2. Autorización EN EL SERVIDOR. Que el botón esté oculto en el
    //    navegador no impide que alguien llame a la API directamente.
    await exigirAdmin();

    // 3. Límite de escritura: frena la creación masiva accidental o
    //    automatizada, incluso con una cuenta legítima.
    const limite = comprobarLimite(`productos:crear:${obtenerIp(peticion)}`, 30, 60);
    if (!limite.permitido) return respuestaLimiteExcedido(limite.segundosEspera);

    // 4. Validación estricta. Zod descarta cualquier campo que no esté
    //    en el esquema, lo que cierra el "mass assignment".
    const cuerpo = await peticion.json();
    const datos = esquemaCrearProducto.parse(cuerpo);

    // 5. Creación mediante el servicio.
    const producto = await crearProducto(datos);

    return NextResponse.json({ product: producto }, { status: 201 });
  } catch (error) {
    return manejarError(error, "products/POST");
  }
}
