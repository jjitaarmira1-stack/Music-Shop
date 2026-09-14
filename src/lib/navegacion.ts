// ═══════════════════════════════════════════════════════════════
//  AYUDAS DE NAVEGACIÓN SEGURA
// ═══════════════════════════════════════════════════════════════

/**
 * Comprueba que una ruta de redirección sea INTERNA.
 *
 * ── El problema (Open Redirect) ────────────────────────────────
 * La página de acceso lee `?next=` y redirige ahí tras entrar. Si no
 * se valida, un atacante puede repartir este enlace:
 *
 *     https://tutienda.com/login?next=https://tutienda-falsa.com
 *
 * La víctima ve un dominio legítimo, inicia sesión de verdad y acaba
 * en una copia falsa que le pide "confirmar" la contraseña. Es una
 * técnica de suplantación muy habitual.
 *
 * ── La solución ────────────────────────────────────────────────
 * Sólo se admiten rutas que empiecen por una única barra. Se rechaza
 * cualquier cosa con esquema (`https:`), con dominio (`//otro.com`) o
 * con caracteres de control.
 *
 * @param ruta Valor recibido del parámetro de la URL.
 * @returns La ruta si es segura, o `null` si no lo es.
 */
export function rutaInternaSegura(ruta: string | null | undefined): string | null {
  // Sin valor: no hay redirección que validar.
  if (!ruta) return null;

  // Debe empezar por barra: así es una ruta relativa a nuestro dominio.
  if (!ruta.startsWith("/")) return null;

  // Se rechaza "//dominio.com" y "/\dominio.com": el navegador las
  // interpreta como URL absolutas hacia OTRO servidor.
  if (ruta.startsWith("//") || ruta.startsWith("/\\")) return null;

  // Se rechazan los caracteres de control (saltos de línea, tabuladores…),
  // que se usan para inyectar cabeceras o despistar a los filtros.
  if (/[\u0000-\u001f\u007f]/.test(ruta)) return null;

  // Se rechaza cualquier esquema disfrazado, como "javascript:" o "data:".
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(ruta)) return null;

  return ruta;
}
