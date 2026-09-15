"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

// ═══════════════════════════════════════════════════════════════
//  UTILIDADES DE ACCESIBILIDAD
//
//  NOTA SOBRE LOS NOMBRES: el resto del proyecto está en castellano,
//  pero los hooks conservan el prefijo inglés `use`. No es un descuido:
//  tanto el analizador de React (`rules-of-hooks`) como el compilador
//  identifican los hooks POR ESE PREFIJO. Con `usar...` dejan de
//  reconocerlos y se pierden las comprobaciones y la optimización.
//  El resto del nombre sí va en castellano.
//  Reúnen el comportamiento que se repetía (o que faltaba) en los
//  modales, el carrito y el menú móvil.
// ═══════════════════════════════════════════════════════════════

/**
 * Indica si el usuario ha pedido reducir las animaciones.
 *
 * Quien activa "reducir movimiento" en su sistema operativo suele
 * hacerlo por un motivo médico: trastornos vestibulares, migrañas o
 * epilepsia fotosensible. Ignorar esa preferencia no es sólo una
 * cuestión de estilo, puede provocar mareo real.
 *
 * @returns `true` si procede desactivar las animaciones.
 */
/*
  AVISO: este hook NO SE USA actualmente en ningún componente.

  Se conserva a propósito. El propietario decidió que las animaciones
  se vean siempre igual, tenga el visitante activada o no la opción
  "reducir movimiento" de su sistema operativo.

  Si algún día se quiere respetar esa preferencia, el hook ya está
  listo y probado: basta con volver a consultarlo desde `Providers.tsx`
  (desplazamiento suave) y `CountUp.tsx` (contadores), y restaurar el
  bloque @media que quedó documentado en `globals.css`.

  Se deja aquí en lugar de borrarlo porque volver a escribirlo bien
  -- con `useSyncExternalStore`, sin parpadeo ni avisos de hidratación --
  cuesta bastante más que mantener treinta líneas sin uso.
*/
export function useMovimientoReducido(): boolean {
  // `useSyncExternalStore` es el hook pensado exactamente para esto:
  // leer un dato que vive FUERA de React (aquí, una preferencia del
  // sistema operativo). Frente a useState + useEffect evita el doble
  // render y el parpadeo, y React garantiza que servidor y cliente
  // queden sincronizados sin avisos de hidratación.

  /** Se suscribe a los cambios y devuelve la función para cancelar. */
  const suscribirse = useCallback((alCambiar: () => void) => {
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

  /** Valor actual en el navegador. */
  const leerEnCliente = useCallback(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  /**
   * Valor durante el render en servidor.
   * Devolvemos `false` porque en el servidor no hay forma de conocer la
   * preferencia; en cuanto el componente se hidrata, React lee el valor
   * real con `leerEnCliente`.
   */
  const leerEnServidor = useCallback(() => false, []);

  return useSyncExternalStore(suscribirse, leerEnCliente, leerEnServidor);
}

/**
 * Gestiona el foco de un panel modal (diálogo, carrito, menú).
 *
 * Implementa tres comportamientos que exige la guía WAI-ARIA y que
 * faltaban por completo en la versión anterior:
 *
 *  1. ATRAPAR EL FOCO: con el tabulador no se puede salir del panel
 *     hacia la página de detrás, que está oculta visualmente.
 *  2. CERRAR CON ESCAPE: comportamiento esperado en cualquier diálogo.
 *  3. DEVOLVER EL FOCO: al cerrar, el foco vuelve al botón que abrió
 *     el panel, para no perder el sitio al navegar con teclado.
 *
 * @param abierto  Si el panel está visible.
 * @param alCerrar Función que cierra el panel.
 * @returns `ref` que hay que colocar en el elemento contenedor.
 */
export function useFocoModal(abierto: boolean, alCerrar: () => void) {
  // Referencia al contenedor del panel.
  const refContenedor = useRef<HTMLDivElement>(null);
  // Elemento que tenía el foco antes de abrir.
  const refFocoAnterior = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!abierto) return;

    // ─── Guardar el foco actual para restaurarlo al cerrar ─────
    refFocoAnterior.current = document.activeElement as HTMLElement | null;

    /** Selector de todos los elementos que pueden recibir foco. */
    const SELECTOR_ENFOCABLES = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");

    /** Devuelve los elementos enfocables que hay dentro del panel. */
    const obtenerEnfocables = (): HTMLElement[] => {
      const contenedor = refContenedor.current;
      if (!contenedor) return [];
      return Array.from(
        contenedor.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLES),
      ).filter(
        // Descartamos los que están ocultos (no tienen caja de dibujo).
        (elemento) => elemento.offsetParent !== null,
      );
    };

    // ─── Mover el foco al primer elemento del panel ────────────
    // Se retrasa un fotograma para que la animación de entrada haya
    // colocado ya los elementos en el DOM.
    const temporizador = setTimeout(() => {
      const enfocables = obtenerEnfocables();
      enfocables[0]?.focus();
    }, 50);

    /** Gestiona Escape y el ciclo del tabulador. */
    const alPulsarTecla = (evento: KeyboardEvent) => {
      // ── Escape: cerrar ──
      if (evento.key === "Escape") {
        evento.preventDefault();
        alCerrar();
        return;
      }

      // ── Tab: mantener el foco dentro del panel ──
      if (evento.key !== "Tab") return;

      const enfocables = obtenerEnfocables();
      if (enfocables.length === 0) return;

      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];

      // Shift+Tab sobre el primero → saltar al último (ciclo hacia atrás).
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      }
      // Tab sobre el último → volver al primero (ciclo hacia delante).
      else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener("keydown", alPulsarTecla);

    // ─── Bloquear el desplazamiento del fondo ──────────────────
    // Sin esto, al hacer scroll dentro del panel se mueve la página de
    // detrás, que es uno de los defectos clásicos en móvil.
    const desbordamientoOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(temporizador);
      document.removeEventListener("keydown", alPulsarTecla);
      // Restauramos el desplazamiento.
      document.body.style.overflow = desbordamientoOriginal;
      // Devolvemos el foco a donde estaba antes de abrir.
      refFocoAnterior.current?.focus();
    };
  }, [abierto, alCerrar]);

  return refContenedor;
}
