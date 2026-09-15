// ═══════════════════════════════════════════════════════════════
//  COMPROBADOR DE ESQUEMA
//
//  Avisa ANTES de arrancar si la base de datos no tiene la estructura
//  que el código espera.
//
//  POR QUÉ EXISTE ESTE ARCHIVO
//  Al añadir la gestión de cuentas se creó la columna
//  `sessions_valid_from`. Quien se bajó el código sin ejecutar
//  `npx drizzle-kit push` se encontró con que el LOGIN devolvía un
//  error 500 con un volcado de SQL incomprensible. El fallo no estaba
//  en el login: estaba en que faltaba aplicar la migración.
//
//  Este script convierte ese misterio en un aviso claro al arrancar.
//  No modifica nada: sólo mira y avisa.
// ═══════════════════════════════════════════════════════════════

import "dotenv/config"; // Carga el .env, porque esto corre fuera de Next.
import pg from "pg"; // Cliente de PostgreSQL.

/**
 * Columnas que el código da por hechas.
 * Cuando se añada una columna nueva al esquema, se apunta aquí para
 * que el comprobador la vigile.
 */
const COLUMNAS_ESPERADAS = [
  { tabla: "users", columna: "sessions_valid_from", desde: "gestión de cuentas" },
  { tabla: "products", columna: "subcategory", desde: "subcategorías del catálogo" },
];

// Colores para que el aviso destaque en la terminal.
const ROJO = "\x1b[31m";
const AMARILLO = "\x1b[33m";
const VERDE = "\x1b[32m";
const FIN = "\x1b[0m";

async function comprobar() {
  const url = process.env.DATABASE_URL;

  // Sin conexión configurada no hay nada que comprobar. No es un error
  // de este script: ya avisa la propia aplicación al arrancar.
  if (!url) {
    console.log(
      `${AMARILLO}⚠ No hay DATABASE_URL configurada; me salto la comprobación del esquema.${FIN}`,
    );
    return;
  }

  const cliente = new pg.Client({ connectionString: url });

  try {
    await cliente.connect();

    // Una sola consulta al catálogo del sistema para todas las columnas.
    const { rows } = await cliente.query(
      `select table_name, column_name
         from information_schema.columns
        where table_schema = 'public'`,
    );

    // Conjunto "tabla.columna" para buscar rápido.
    const existentes = new Set(
      rows.map((f) => `${f.table_name}.${f.column_name}`),
    );

    // Qué falta.
    const faltantes = COLUMNAS_ESPERADAS.filter(
      (c) => !existentes.has(`${c.tabla}.${c.columna}`),
    );

    if (faltantes.length === 0) {
      console.log(`${VERDE}✔ La base de datos está al día.${FIN}`);
      return;
    }

    // ─── Aviso bien visible ────────────────────────────────────
    console.log("");
    console.log(`${ROJO}${"━".repeat(64)}${FIN}`);
    console.log(`${ROJO}  LA BASE DE DATOS ESTÁ DESACTUALIZADA${FIN}`);
    console.log(`${ROJO}${"━".repeat(64)}${FIN}`);
    console.log("");
    console.log("  Al código le faltan estas columnas en la base de datos:");
    console.log("");

    for (const c of faltantes) {
      console.log(`    · ${c.tabla}.${c.columna}  ${AMARILLO}(${c.desde})${FIN}`);
    }

    console.log("");
    console.log(`  Si arrancas así, ${ROJO}el inicio de sesión fallará${FIN} con un error 500.`);
    console.log("");
    console.log(`  ${VERDE}Solución — ejecuta esto una vez:${FIN}`);
    console.log("");
    console.log(`      ${VERDE}npx drizzle-kit push${FIN}`);
    console.log("");
    console.log("  Es seguro: las columnas nuevas tienen valor por defecto y");
    console.log("  no se pierde ningún dato existente.");
    console.log("");
    console.log(`${ROJO}${"━".repeat(64)}${FIN}`);
    console.log("");
  } catch (error) {
    // Si no se puede conectar, no bloqueamos el arranque: puede que la
    // base de datos todavía se esté levantando (típico con Docker).
    console.log(
      `${AMARILLO}⚠ No se pudo comprobar el esquema: ${error.message}${FIN}`,
    );
  } finally {
    // Cerramos siempre, haya ido bien o mal.
    await cliente.end().catch(() => {});
  }
}

// El script NUNCA detiene el arranque (no hace `process.exit(1)`):
// sólo informa. Bloquear `npm run dev` por esto sería más molesto que
// útil, y en producción el arranque no debe depender de un aviso.
comprobar();
