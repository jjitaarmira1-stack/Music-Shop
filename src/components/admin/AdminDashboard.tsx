"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Boxes,
  Euro,
  ImagePlus,
  Images,
  LayoutDashboard,
  Loader2,
  Package,
  Pencil,
  Plus,
  Star,
  Store,
  Trash2,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import GalleryManager from "@/components/admin/GalleryManager";
import GraficasResumen from "@/components/admin/GraficasResumen";
import GestionUsuarios from "@/components/admin/GestionUsuarios";
import { toast } from "sonner";
import type { Order, OrderStatus, Product } from "@/db/schema";
import type { DatosGraficas } from "@/servicios/productos";
import { CATEGORY_LABEL, cn, formatDate, formatPrice } from "@/lib/utils";
import { obtenerSubcategorias, ETIQUETA_SUBCATEGORIA } from "@/lib/taxonomia";
import CountUp from "@/components/bits/CountUp";
import SpotlightCard from "@/components/bits/SpotlightCard";
import StarBorder from "@/components/bits/StarBorder";
import StatusBadge from "@/components/site/StatusBadge";
import {
  useGestionCatalogo,
  IMAGENES_POR_DEFECTO,
  type EstadoFormulario,
} from "@/components/admin/useGestionCatalogo";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface Stats {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  revenueCents: number;
  recentOrders: Order[];
}

interface Props {
  stats: Stats;
  /** Series y desgloses ya agregados en el servidor, para las gráficas. */
  charts: DatosGraficas;
  initialProducts: Product[];
  initialOrders: Order[];
  adminName: string;
  /** Correo del administrador: sirve para marcar su propia fila. */
  adminEmail: string;
}

const TABS = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "productos", label: "Instrumentos", icon: Package },
  { id: "pedidos", label: "Pedidos", icon: Boxes },
  { id: "galeria", label: "Galería", icon: Images },
  { id: "usuarios", label: "Cuentas", icon: UsersRound },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Las constantes de imágenes y el tipo del formulario viven ahora en
// `useGestionCatalogo`, junto con la lógica que los usa.
const IMAGE_OPTIONS = IMAGENES_POR_DEFECTO;

const ORDER_STATUSES: OrderStatus[] = [
  "pendiente",
  "pagado",
  "enviado",
  "entregado",
  "cancelado",
];

/** Alias local para no tocar el resto del JSX, que ya usaba este nombre. */
type FormState = EstadoFormulario;

export default function AdminDashboard({
  stats,
  charts,
  initialProducts,
  initialOrders,
  adminName,
  adminEmail,
}: Props) {
  // Pestaña activa del panel.
  const [tab, setTab] = useState<TabId>("resumen");

  // ─── Toda la lógica (estado + red) vive en el hook ───────────
  // El componente se queda únicamente con el dibujado, que es lo que
  // de verdad le corresponde. Antes este archivo mezclaba ambas cosas
  // a lo largo de 831 líneas.
  const {
    productos: products,
    pedidos: orders,
    formulario: form,
    setFormulario: setForm,
    editando: editing,
    modalAbierto: modalOpen,
    guardando: saving,
    abrirCreacion: openCreate,
    abrirEdicion: openEdit,
    cerrarModal: closeModal,
    guardarProducto: saveProduct,
    opcionesImagen: imageOptions,
    sincronizarImagenes: syncImageOptions,
    subiendoFoto: uploadingPhoto,
    subirFoto: uploadPhoto,
    alternarDestacado: toggleFeatured,
    eliminarProducto: deleteProduct,
    cambiarEstadoPedido: updateStatus,
  } = useGestionCatalogo({
    productosIniciales: initialProducts,
    pedidosIniciales: initialOrders,
  });

  // Referencia al <input type="file"> oculto del formulario.
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Subcategorías de la categoría seleccionada en el formulario.
  // Se recalcula en cada render: es una búsqueda en un array de cinco
  // elementos, no merece memorizarse.
  const subcategoriasDisponibles = obtenerSubcategorias(form.category);

  const statCards = useMemo(
    () => [
      {
        icon: Euro,
        label: "Ingresos",
        value: Math.round(stats.revenueCents / 100),
        suffix: " €",
      },
      { icon: Boxes, label: "Pedidos", value: stats.totalOrders, suffix: "" },
      {
        icon: Package,
        label: "Instrumentos",
        value: products.length,
        suffix: "",
      },
      {
        icon: Users,
        label: "Cuentas",
        value: stats.totalCustomers,
        suffix: "",
      },
    ],
    [stats, products.length],
  );

  return (
    <div className="mx-auto min-h-svh max-w-7xl px-5 pb-24 pt-28 md:px-10 md:pt-32">
      {/* Cabecera */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-ember">
            Vista de administrador
          </p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,4.5rem)] leading-none">
            Cuarto de máquinas
          </h1>
          <p className="mt-3 text-sm text-fog">
            Sesión de <span className="text-cream">{adminName}</span> · control
            total del catálogo y los pedidos.
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm text-fog transition-colors hover:border-ember/50 hover:text-cream"
        >
          <Store className="h-4 w-4" />
          Ver la tienda
        </Link>
      </div>

      {/* Tabs */}
      <div className="mt-10 inline-flex rounded-full border border-line p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "relative flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-colors",
              tab === id ? "text-ink" : "text-fog hover:text-cream",
            )}
          >
            {tab === id && (
              <motion.span
                layoutId="admin-tab"
                className="absolute inset-0 rounded-full bg-ember"
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
              />
            )}
            <Icon className="relative z-10 h-4 w-4" />
            <span className="relative z-10 hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ─── RESUMEN ─── */}
      {tab === "resumen" && (
        <motion.div
          key="resumen"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-10"
        >
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {statCards.map(({ icon: Icon, label, value, suffix }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <SpotlightCard className="rounded-3xl border border-line bg-panel/50 p-6">
                  <Icon className="h-5 w-5 text-ember" />
                  <CountUp
                    to={value}
                    suffix={suffix}
                    className="mt-4 block font-display text-4xl text-cream"
                  />
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                    {label}
                  </p>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>

          {/* Gráficas: evolución de ventas, estados, catálogo y stock.
              Se dibujan con SVG nativo, sin librerías externas. */}
          <GraficasResumen datos={charts} />

          <h2 className="mt-14 font-display text-2xl">Pedidos recientes</h2>
          {stats.recentOrders.length === 0 ? (
            <p className="mt-6 rounded-3xl border border-line bg-panel/40 px-6 py-10 text-center text-sm text-fog">
              Aún no entran pedidos. Comparte la tienda y vigila este panel.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {stats.recentOrders.map((order) => (
                <li
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel/40 px-5 py-4"
                >
                  <div>
                    <p className="font-mono text-sm text-ember">{order.code}</p>
                    <p className="text-xs text-fog">{order.customerName}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={order.status} />
                    <span className="font-mono text-sm">
                      {formatPrice(order.totalCents)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}

      {/* ─── PRODUCTOS ─── */}
      {tab === "productos" && (
        <motion.div
          key="productos"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-10"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-2xl">
              Catálogo{" "}
              <span className="font-mono text-sm text-fog">{products.length}</span>
            </h2>
            <StarBorder onClick={openCreate} innerClassName="px-5 py-2.5 text-xs">
              <Plus className="h-4 w-4" />
              Nuevo instrumento
            </StarBorder>
          </div>

          <div className="mt-6 space-y-3">
            <AnimatePresence initial={false}>
              {products.map((product) => (
                <motion.article
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-panel/40 p-4 transition-colors hover:border-ember/30"
                >
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </span>
                  <div className="min-w-[160px] flex-1">
                    <p className="font-display text-lg leading-tight">
                      {product.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog">
                      {CATEGORY_LABEL[product.category] ?? product.category}
                      {/* Migas de pan: «Cuerdas › Bajos». */}
                      {product.subcategory && (
                        <>
                          {" › "}
                          {ETIQUETA_SUBCATEGORIA[product.subcategory] ??
                            product.subcategory}
                        </>
                      )}{" "}
                      ·
                      stock {product.stock}
                    </p>
                  </div>
                  <p className="font-mono text-sm text-ember">
                    {formatPrice(product.priceCents)}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleFeatured(product)}
                      aria-label="Destacar"
                      title="Destacar en la portada"
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-full border transition-colors",
                        product.featured
                          ? "border-ember/60 bg-ember/15 text-ember"
                          : "border-line text-fog hover:text-ember",
                      )}
                    >
                      <Star
                        className="h-4 w-4"
                        fill={product.featured ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      onClick={() => openEdit(product)}
                      aria-label="Editar"
                      className="grid h-9 w-9 place-items-center rounded-full border border-line text-fog transition-colors hover:border-ember/50 hover:text-cream"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteProduct(product)}
                      aria-label="Eliminar"
                      className="grid h-9 w-9 place-items-center rounded-full border border-line text-fog transition-colors hover:border-red-400/60 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* ─── PEDIDOS ─── */}
      {tab === "pedidos" && (
        <motion.div
          key="pedidos"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-10"
        >
          <h2 className="font-display text-2xl">
            Pedidos{" "}
            <span className="font-mono text-sm text-fog">{orders.length}</span>
          </h2>
          {orders.length === 0 ? (
            <p className="mt-6 rounded-3xl border border-line bg-panel/40 px-6 py-10 text-center text-sm text-fog">
              Sin pedidos todavía. Los verás aparecer aquí en tiempo real.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {orders.map((order) => (
                <article
                  key={order.id}
                  className="rounded-2xl border border-line bg-panel/40 p-5 transition-colors hover:border-ember/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-sm text-ember">{order.code}</p>
                      <p className="mt-1 text-xs text-fog">
                        {order.customerName} · {order.customerEmail}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        value={order.status}
                        onChange={(e) =>
                          updateStatus(order, e.target.value as OrderStatus)
                        }
                        className="rounded-full border border-line bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-cream outline-none transition-colors focus:border-ember/60"
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <span className="font-display text-xl">
                        {formatPrice(order.totalCents)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog">
                      {formatDate(order.createdAt)}
                    </span>
                    <span className="text-fog">·</span>
                    {order.items.map((item) => (
                      <span
                        key={item.productId}
                        className="rounded-full border border-line bg-ink/50 px-3 py-1 text-xs text-cream/80"
                      >
                        {item.name} ×{item.qty}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ─── GALERÍA ─── */}
      {tab === "galeria" && (
        <motion.div
          key="galeria"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-10"
        >
          <GalleryManager onChange={syncImageOptions} />
        </motion.div>
      )}

      {/* ─── CUENTAS ─── */}
      {tab === "usuarios" && (
        <motion.div
          key="usuarios"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* La lista se pide al montar, no en el servidor: así el
              panel abre igual de rápido aunque haya muchas cuentas. */}
          <GestionUsuarios emailAdminActual={adminEmail} />
        </motion.div>
      )}

      {/* ─── MODAL PRODUCTO ─── */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 z-[80] bg-ink/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="fixed left-1/2 top-1/2 z-[90] max-h-[88vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-line bg-coal p-7 md:p-9"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl">
                  {editing ? "Editar pieza" : "Nueva pieza"}
                </h3>
                <button
                  onClick={closeModal}
                  aria-label="Cerrar"
                  className="grid h-9 w-9 place-items-center rounded-full border border-line text-fog hover:text-cream"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={saveProduct} className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                    Nombre
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    className="w-full rounded-2xl border border-line bg-ink/60 px-4 py-3 text-sm outline-none focus:border-ember/60"
                  />
                </div>
                <div>
                  <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                    Eslogan
                  </label>
                  <input
                    value={form.tagline}
                    onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                    required
                    className="w-full rounded-2xl border border-line bg-ink/60 px-4 py-3 text-sm outline-none focus:border-ember/60"
                  />
                </div>
                {/*
                  ─── CLASIFICACIÓN EN DOS PASOS ──────────────────────
                  Primero el grupo, después el estante concreto. Se
                  agrupan en un bloque con borde propio para que se lea
                  como UNA decisión en dos pasos y no como dos campos
                  sueltos perdidos entre el precio y el stock.

                  La asignación es MANUAL a propósito: la decide quien
                  da de alta el producto, no un automatismo que acabaría
                  colocando un bajo entre las guitarras.
                */}
                <div className="rounded-2xl border border-line/70 bg-ink/30 p-4">
                  <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                    Clasificación en el catálogo
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Paso 1 · familia */}
                    <div>
                      <label
                        htmlFor="campo-categoria"
                        className="mb-2 block text-xs text-fog"
                      >
                        <span className="text-ember">1.</span> Familia
                      </label>
                      <select
                        id="campo-categoria"
                        value={form.category}
                        onChange={(e) =>
                          // Al cambiar de familia se VACÍA la subcategoría:
                          // las de la anterior ya no son válidas y el
                          // servidor rechazaría la pareja incoherente.
                          setForm({
                            ...form,
                            category: e.target.value,
                            subcategory: "",
                          })
                        }
                        className="w-full rounded-2xl border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-ember/60"
                      >
                        {Object.entries(CATEGORY_LABEL)
                          .filter(([id]) => id !== "todos")
                          .map(([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Paso 2 · estante dentro de esa familia */}
                    <div>
                      <label
                        htmlFor="campo-subcategoria"
                        className="mb-2 block text-xs text-fog"
                      >
                        <span className="text-ember">2.</span> Tipo dentro de{" "}
                        <span className="text-cream">
                          {CATEGORY_LABEL[form.category] ?? form.category}
                        </span>
                      </label>
                      <select
                        id="campo-subcategoria"
                        value={form.subcategory}
                        onChange={(e) =>
                          setForm({ ...form, subcategory: e.target.value })
                        }
                        className={cn(
                          "w-full rounded-2xl border bg-ink px-4 py-3 text-sm outline-none focus:border-ember/60",
                          // Sin clasificar se marca en ámbar tenue: es
                          // válido, pero conviene que llame la atención.
                          form.subcategory
                            ? "border-line"
                            : "border-ember/40 text-fog",
                        )}
                      >
                        {/* Cadena vacía = sin clasificar. Se guarda como NULL. */}
                        <option value="">Sin clasificar</option>
                        {subcategoriasDisponibles.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/*
                    Vista previa de dónde acabará el producto. Confirma
                    la decisión antes de guardar, que es justo cuando
                    sirve de algo.
                  */}
                  <p className="mt-3 text-xs text-fog">
                    Se guardará en{" "}
                    <span className="text-cream">
                      {CATEGORY_LABEL[form.category] ?? form.category}
                    </span>
                    {form.subcategory ? (
                      <>
                        {" › "}
                        <span className="text-ember">
                          {ETIQUETA_SUBCATEGORIA[form.subcategory]}
                        </span>
                      </>
                    ) : (
                      <span className="text-fog/70">
                        {" "}
                        (sin tipo: aparecerá sólo al filtrar por la familia)
                      </span>
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                      Precio (€)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      required
                      className="w-full rounded-2xl border border-line bg-ink/60 px-4 py-3 text-sm outline-none focus:border-ember/60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                      Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.stock}
                      onChange={(e) => setForm({ ...form, stock: e.target.value })}
                      required
                      className="w-full rounded-2xl border border-line bg-ink/60 px-4 py-3 text-sm outline-none focus:border-ember/60"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                      Fotografía
                    </label>
                    <div className="flex items-center gap-3">
                      <select
                        value={form.image}
                        onChange={(e) =>
                          setForm({ ...form, image: e.target.value })
                        }
                        className="w-full rounded-2xl border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-ember/60"
                      >
                        {/*
                          `.filter(Boolean)` es una red de seguridad: si la
                          API devolviera algún elemento vacío o con otro
                          nombre de campo, antes se caía toda la pantalla
                          de administración con «Cannot read properties of
                          undefined». Es preferible mostrar una opción de
                          menos que dejar al administrador sin panel.
                        */}
                        {imageOptions.filter(Boolean).map((src) => (
                          <option key={src} value={src}>
                            {src
                              .replace("/img/products/", "")
                              .replace("/img/", "★ ")}
                          </option>
                        ))}
                        {!imageOptions.includes(form.image) && (
                          <option value={form.image}>{form.image}</option>
                        )}
                      </select>
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-line bg-ink">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          // La ruta se usa TAL CUAL: `/img/products/…`
                          // son las imágenes que trae el proyecto y
                          // `/media/products/…` las que sube el
                          // administrador. Cambiar una por otra, como
                          // se hacía antes, provocaba errores 404.
                          //
                          // `?? ""`: si el formulario se quedara sin
                          // imagen, el src vacío deja un hueco pero no
                          // rompe el render.
                          src={form.image ?? ""}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-line bg-ink/30 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="flex items-center gap-2 rounded-full border border-ember/50 bg-ember/10 px-4 py-2 text-xs font-medium text-ember transition-colors hover:bg-ember hover:text-ink disabled:opacity-60"
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    {uploadingPhoto
                      ? "Subiendo…"
                      : "Subir foto desde tu dispositivo"}
                  </button>
                  <p className="text-[11px] leading-snug text-fog/70">
                    Desde el PC o la cámara del móvil. Se publica en la galería y
                    se asigna a esta pieza al instante.
                  </p>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif,image/*"
                    hidden
                    onChange={(e) => {
                      void uploadPhoto(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>

                <div>
                  <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                    Descripción
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-line bg-ink/60 px-4 py-3 text-sm outline-none focus:border-ember/60"
                  />
                </div>
                <label className="flex items-center gap-3 rounded-2xl border border-line bg-ink/40 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                    className="h-4 w-4 accent-[#e8a33d]"
                  />
                  <span className="text-sm text-cream/80">
                    Destacar en la colección de portada
                  </span>
                </label>
                <div className="pt-2">
                  <StarBorder
                    type="submit"
                    disabled={saving}
                    className="w-full"
                    innerClassName="w-full py-3.5"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {editing ? "Guardar cambios" : "Publicar en el catálogo"}
                  </StarBorder>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
