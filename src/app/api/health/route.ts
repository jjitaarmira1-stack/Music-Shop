import { NextResponse } from "next/server";
import { comprobarConexion } from "@/db";
import { CONFIG } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/health · Comprobación de estado
 *
 * Lo consultan los balanceadores de carga y los monitores para saber
 * si esta instancia puede recibir tráfico.
 *
 * Diseño deliberado: la respuesta NO revela versiones, rutas internas
 * ni detalles de la infraestructura. Un endpoint de salud demasiado
 * hablador es una fuente clásica de fuga de información.
 *
 * Códigos:
 *  · 200 → todo correcto,
 *  · 503 → la base de datos no responde (el balanceador debe retirar
 *          esta instancia del reparto de tráfico).
 */
export async function GET() {
  // Momento de la comprobación, útil para detectar respuestas cacheadas.
  const marca = new Date().toISOString();

  // Ping real a la base de datos.
  const baseDisponible = await comprobarConexion();

  // Cabeceras: un estado de salud nunca debe cachearse.
  const cabeceras = { "Cache-Control": "no-store, max-age=0" };

  if (!baseDisponible) {
    return NextResponse.json(
      {
        status: "degradado", // Estado global.
        db: "caida", // Componente afectado.
        marca,
      },
      { status: 503, headers: cabeceras },
    );
  }

  return NextResponse.json(
    {
      status: "ok",
      db: "activa",
      // El entorno lógico sí es útil para saber contra qué se apunta.
      entorno: CONFIG.entornoApp,
      marca,
    },
    { headers: cabeceras },
  );
}
