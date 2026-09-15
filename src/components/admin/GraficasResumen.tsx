"use client";

import { motion } from "framer-motion";
import { formatPrice } from "@/lib/utils";
import { CATEGORY_LABEL } from "@/lib/utils";
import type { DatosGraficas } from "@/servicios/productos";

// ═══════════════════════════════════════════════════════════════
//  GRÁFICAS DEL PANEL DE ADMINISTRACIÓN
//
//  POR QUÉ SVG A MANO Y NO UNA LIBRERÍA
//  Recharts o Chart.js pesan entre 100 y 200 KB comprimidos y
//  arrastran sus propias dependencias. Para cuatro gráficas sencillas
//  es un coste desproporcionado: se descargaría en CADA carga del
//  panel. SVG nativo pesa cero, se adapta solo a cualquier tamaño de
//  pantalla, se puede colorear con las variables de la marca y es
//  accesible con etiquetas normales. Si algún día hicieran falta
//  gráficas interactivas complejas, entonces sí compensaría la
//  librería.
//
//  El diseño respeta la identidad existente: ámbar (`ember`) para lo
//  destacado, `panel` de fondo, `line` para los bordes y `fog` para el
//  texto secundario. No se introduce ningún color nuevo.
// ═══════════════════════════════════════════════════════════════

/** Colores de la paleta ya existente, reutilizados en los tramos. */
const COLORES = [
  "#e8a33d", // ember: el color principal de la marca.
  "#c4822c", // ámbar más apagado.
  "#8f6b3a", // tierra.
  "#5f5443", // piedra.
  "#3b342a", // casi el color del panel.
] as const;

/** Nombres legibles de los estados de pedido. */
const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

interface Props {
  /** Datos ya agregados en el servidor. */
  datos: DatosGraficas;
}

/**
 * Bloque completo de gráficas del resumen.
 * Recibe los datos ya calculados: este componente sólo dibuja.
 */
export default function GraficasResumen({ datos }: Props) {
  return (
    <section className="mt-14" aria-labelledby="titulo-graficas">
      <h2 id="titulo-graficas" className="font-display text-2xl">
        Cómo va la tienda
      </h2>
      <p className="mt-2 text-sm text-fog">
        Un vistazo rápido a los últimos 30 días y al estado del catálogo.
      </p>

      {/* Dos columnas en escritorio, una sola en móvil. */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <GraficaVentasDiarias puntos={datos.ventasDiarias} />
        <GraficaEstados tramos={datos.pedidosPorEstado} />
        <GraficaCategorias tramos={datos.productosPorCategoria} />
        <PanelStockYVentas
          stockCritico={datos.stockCritico}
          masVendidos={datos.masVendidos}
        />
      </div>
    </section>
  );
}

// ─── 1. EVOLUCIÓN DE VENTAS ────────────────────────────────────

/**
 * Gráfica de área con los ingresos de los últimos 30 días.
 *
 * Se dibuja con `viewBox` y `preserveAspectRatio="none"`: el SVG se
 * estira al ancho disponible sin deformar los textos, que van fuera.
 */
function GraficaVentasDiarias({ puntos }: { puntos: DatosGraficas["ventasDiarias"] }) {
  // Total del periodo, para la cifra grande de la cabecera.
  const totalIngresos = puntos.reduce((suma, p) => suma + p.ingresosCents, 0);
  const totalPedidos = puntos.reduce((suma, p) => suma + p.pedidos, 0);

  // Valor máximo: fija la escala vertical. El `|| 1` evita dividir
  // entre cero cuando todavía no hay ninguna venta.
  const maximo = Math.max(...puntos.map((p) => p.ingresosCents), 1);

  // Lienzo interno en unidades arbitrarias; el navegador lo escala.
  const ANCHO = 300;
  const ALTO = 90;

  // Convertimos cada punto a coordenadas. El eje Y va invertido en
  // SVG (0 arriba), de ahí la resta.
  const coordenadas = puntos.map((p, i) => {
    const x = (i / Math.max(puntos.length - 1, 1)) * ANCHO;
    const y = ALTO - (p.ingresosCents / maximo) * ALTO;
    return { x, y, ...p };
  });

  // Línea superior del área.
  const trazo = coordenadas.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  // El área es la misma línea cerrada por abajo.
  const area = `0,${ALTO} ${trazo} ${ANCHO},${ALTO}`;

  return (
    <TarjetaGrafica
      titulo="Ingresos por día"
      descripcion="Últimos 30 días, sin contar pedidos cancelados"
    >
      {/* Resumen numérico: útil cuando la gráfica está plana. */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="font-display text-3xl text-cream">
          {formatPrice(totalIngresos)}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-fog">
          {totalPedidos} {totalPedidos === 1 ? "pedido" : "pedidos"}
        </p>
      </div>

      {totalPedidos === 0 ? (
        <VacioGrafica texto="Todavía no hay ventas en este periodo." />
      ) : (
        <>
          <svg
            viewBox={`0 0 ${ANCHO} ${ALTO}`}
            preserveAspectRatio="none"
            className="mt-5 h-32 w-full"
            role="img"
            aria-label={`Evolución de ingresos: ${formatPrice(totalIngresos)} en 30 días`}
          >
            {/* Degradado del relleno, de ámbar a transparente. */}
            <defs>
              <linearGradient id="grad-ventas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e8a33d" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#e8a33d" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Tres líneas de referencia horizontales muy tenues. */}
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1="0"
                y1={ALTO * f}
                x2={ANCHO}
                y2={ALTO * f}
                stroke="#2b251d"
                strokeWidth="0.5"
              />
            ))}

            {/* Relleno bajo la curva. */}
            <motion.polygon
              points={area}
              fill="url(#grad-ventas)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
            />

            {/* Línea del contorno, dibujándose de izquierda a derecha. */}
            <motion.polyline
              points={trazo}
              fill="none"
              stroke="#e8a33d"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
            />
          </svg>

          {/* Extremos del eje temporal. */}
          <div className="mt-2 flex justify-between font-mono text-[10px] text-fog">
            <span>{formatarDiaCorto(puntos[0]?.fecha)}</span>
            <span>{formatarDiaCorto(puntos[puntos.length - 1]?.fecha)}</span>
          </div>
        </>
      )}
    </TarjetaGrafica>
  );
}

// ─── 2. PEDIDOS POR ESTADO ─────────────────────────────────────

/**
 * Barras horizontales con el reparto de pedidos por estado.
 * Se eligen barras y no un gráfico circular porque comparar longitudes
 * es mucho más fácil para el ojo que comparar ángulos.
 */
function GraficaEstados({ tramos }: { tramos: DatosGraficas["pedidosPorEstado"] }) {
  const total = tramos.reduce((suma, t) => suma + t.total, 0);

  return (
    <TarjetaGrafica
      titulo="Pedidos por estado"
      descripcion="En qué punto está cada pedido"
    >
      {total === 0 ? (
        <VacioGrafica texto="Aún no hay pedidos que clasificar." />
      ) : (
        <ul className="mt-4 space-y-3">
          {tramos.map((t, i) => {
            // Porcentaje sobre el total, para el ancho de la barra.
            const porcentaje = (t.total / total) * 100;

            return (
              <li key={t.etiqueta}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-cream">
                    {ETIQUETA_ESTADO[t.etiqueta] ?? t.etiqueta}
                  </span>
                  <span className="font-mono text-xs text-fog">
                    {t.total} · {porcentaje.toFixed(0)}%
                  </span>
                </div>

                {/* Carril de fondo + barra animada encima. */}
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: COLORES[i % COLORES.length] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${porcentaje}%` }}
                    transition={{ duration: 0.7, delay: i * 0.08 }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </TarjetaGrafica>
  );
}

// ─── 3. PRODUCTOS POR FAMILIA ──────────────────────────────────

/** Reparto del catálogo entre las cinco familias de instrumentos. */
function GraficaCategorias({
  tramos,
}: {
  tramos: DatosGraficas["productosPorCategoria"];
}) {
  const total = tramos.reduce((suma, t) => suma + t.total, 0);

  // Escala relativa al tramo mayor: así la familia más numerosa llena
  // la barra y el resto se compara con ella de un vistazo.
  const mayor = Math.max(...tramos.map((t) => t.total), 1);

  return (
    <TarjetaGrafica
      titulo="Catálogo por familia"
      descripcion={`${total} ${total === 1 ? "instrumento" : "instrumentos"} en total`}
    >
      {total === 0 ? (
        <VacioGrafica texto="El catálogo está vacío." />
      ) : (
        <ul className="mt-4 space-y-3">
          {tramos.map((t, i) => (
            <li key={t.etiqueta}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-cream">
                  {/* Nombre bonito si lo conocemos; si no, el id tal cual. */}
                  {CATEGORY_LABEL[t.etiqueta as keyof typeof CATEGORY_LABEL] ??
                    t.etiqueta}
                </span>
                <span className="font-mono text-xs text-fog">{t.total}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: COLORES[i % COLORES.length] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(t.total / mayor) * 100}%` }}
                  transition={{ duration: 0.7, delay: i * 0.08 }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </TarjetaGrafica>
  );
}

// ─── 4. STOCK CRÍTICO Y MÁS VENDIDOS ───────────────────────────

/**
 * Dos listas cortas en una sola tarjeta: qué hay que reponer y qué se
 * vende. Son las dos preguntas que se hace a diario quien lleva la
 * tienda, y juntas ocupan lo mismo que una gráfica.
 */
function PanelStockYVentas({
  stockCritico,
  masVendidos,
}: {
  stockCritico: DatosGraficas["stockCritico"];
  masVendidos: DatosGraficas["masVendidos"];
}) {
  return (
    <TarjetaGrafica
      titulo="Reposición y éxitos"
      descripcion="Lo que se acaba y lo que más sale"
    >
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {/* ── Existencias bajas ── */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
            Menos existencias
          </p>
          {stockCritico.length === 0 ? (
            <p className="mt-3 text-sm text-fog">Sin datos.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {stockCritico.map((p) => (
                <li
                  key={p.nombre}
                  className="flex items-baseline justify-between gap-2 text-sm"
                >
                  <span className="truncate text-cream">{p.nombre}</span>
                  {/* Rojo si se ha agotado, ámbar si quedan pocas. */}
                  <span
                    className={
                      p.stock === 0
                        ? "shrink-0 font-mono text-xs text-red-300"
                        : p.stock <= 3
                          ? "shrink-0 font-mono text-xs text-ember"
                          : "shrink-0 font-mono text-xs text-fog"
                    }
                  >
                    {p.stock === 0 ? "agotado" : `${p.stock} ud.`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Más vendidos ── */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
            Más vendidos
          </p>
          {masVendidos.length === 0 ? (
            <p className="mt-3 text-sm text-fog">Sin ventas todavía.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {masVendidos.map((p) => (
                <li
                  key={p.nombre}
                  className="flex items-baseline justify-between gap-2 text-sm"
                >
                  <span className="truncate text-cream">{p.nombre}</span>
                  <span className="shrink-0 font-mono text-xs text-ember">
                    {p.unidades} ud.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </TarjetaGrafica>
  );
}

// ─── PIEZAS COMPARTIDAS ────────────────────────────────────────

/** Marco común de todas las gráficas: mismo borde, fondo y tipografía. */
function TarjetaGrafica({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-line bg-panel/50 p-6">
      <h3 className="font-display text-lg text-cream">{titulo}</h3>
      <p className="mt-1 mb-4 text-xs text-fog">{descripcion}</p>
      {children}
    </div>
  );
}

/** Mensaje para cuando todavía no hay datos que dibujar. */
function VacioGrafica({ texto }: { texto: string }) {
  return (
    <p className="mt-6 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-fog">
      {texto}
    </p>
  );
}

/**
 * Convierte "2026-09-15" en "15 sep".
 * Se parte la cadena a mano en lugar de usar `new Date(texto)`: al
 * interpretarse como UTC, en zonas horarias al oeste (como Guatemala)
 * la fecha se mostraría con un día de menos.
 */
function formatarDiaCorto(fecha?: string): string {
  if (!fecha) return "";
  const [, mes, dia] = fecha.split("-").map(Number);
  const MESES = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  return `${dia} ${MESES[mes - 1] ?? ""}`;
}
