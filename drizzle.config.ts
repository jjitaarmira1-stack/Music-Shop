// ═══════════════════════════════════════════════════════════════
//  CONFIGURACIÓN DE DRIZZLE KIT (migraciones y esquema)
//
//  Antes esto era un .json con la cadena de conexión ESCRITA DENTRO,
//  contraseña incluida. Un archivo JSON no puede leer variables de
//  entorno, así que el secreto acababa versionado en el repositorio.
//
//  Al pasarlo a TypeScript, la URL se lee del entorno en tiempo de
//  ejecución y el archivo deja de contener nada sensible.
// ═══════════════════════════════════════════════════════════════

import { defineConfig } from "drizzle-kit";
// Carga el archivo .env para que este script, que se ejecuta fuera de
// Next.js, también tenga acceso a las variables.
import "dotenv/config";

// Sin conexión no hay nada que hacer: fallamos pronto y con un mensaje
// claro, en vez de soltar un error críptico del driver más adelante.
const urlBaseDatos = process.env.DATABASE_URL;
if (!urlBaseDatos) {
  throw new Error(
    "Falta DATABASE_URL. Copia .env.example a .env y rellena la conexión.",
  );
}

export default defineConfig({
  // Motor de base de datos.
  dialect: "postgresql",
  // Archivo donde se declaran las tablas, índices y restricciones.
  schema: "./src/db/schema.ts",
  // Carpeta donde Drizzle escribe los archivos SQL de migración.
  out: "./drizzle",
  dbCredentials: {
    // La contraseña ya nunca viaja dentro del repositorio.
    url: urlBaseDatos,
  },
});
