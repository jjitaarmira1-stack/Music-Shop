"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Order, OrderStatus, Product } from "@/db/schema";
import { ErrorPeticion, peticionJson } from "@/lib/cliente-http";

// ═══════════════════════════════════════════════════════════════
//  LÓGICA DEL PANEL DE ADMINISTRACIÓN
//
//  Por qué existe este archivo:
//  `AdminDashboard.tsx` tenía 831 líneas y mezclaba tres asuntos
//  distintos: el estado, las llamadas a la API y el dibujado. Cambiar
//  un botón obligaba a bucear entre peticiones `fetch`.
//
//  Aquí queda TODO lo que no se ve (estado + red) y el componente se
//  queda sólo con lo que se ve. Es el patrón "hook contenedor": una
//  separación estándar de React, sin capas artificiales de por medio.
//
//  El comportamiento es exactamente el mismo que antes; lo que cambia
//  es dónde vive el código y que ahora los errores se tratan de
//  verdad en lugar de ignorarse.
// ═══════════════════════════════════════════════════════════════

/** Imágenes de reserva si la galería del servidor no responde. */
export const IMAGENES_POR_DEFECTO = [
  "/img/products/guitarra-electrica.jpg",
  "/img/products/guitarra-acustica.jpg",
  "/img/products/sintetizador.jpg",
  "/img/products/bateria.jpg",
  "/img/products/violin.jpg",
  "/img/products/saxofon.jpg",
  "/img/products/bajo.jpg",
  "/img/products/microfono.jpg",
  "/img/atelier.jpg",
  "/img/hero.jpg",
];

/** Datos del formulario de alta o edición de un instrumento. */
export interface EstadoFormulario {
  name: string;
  tagline: string;
  category: string;
  /** Subcategoría. Cadena vacía = sin especificar (se guarda como NULL). */
  subcategory: string;
  description: string;
  price: string;
  stock: string;
  image: string;
  featured: boolean;
}

/** Formulario vacío para dar de alta una pieza nueva. */
export const FORMULARIO_VACIO: EstadoFormulario = {
  name: "",
  tagline: "",
  category: "cuerdas",
  subcategory: "",
  description: "",
  price: "",
  stock: "5",
  image: IMAGENES_POR_DEFECTO[0],
  featured: false,
};

/**
 * Traduce cualquier error a un texto presentable para el usuario.
 *
 * Nunca se enseña el error técnico en crudo: podría revelar rutas del
 * servidor o detalles internos (divulgación de información).
 */
function mensajeDeError(error: unknown, alternativa: string): string {
  if (error instanceof ErrorPeticion) return error.message;
  return alternativa;
}

/** Parámetros de entrada del hook. */
interface Opciones {
  productosIniciales: Product[];
  pedidosIniciales: Order[];
}

/**
 * Reúne el estado y las operaciones del panel de administración.
 */
export function useGestionCatalogo({
  productosIniciales,
  pedidosIniciales,
}: Opciones) {
  // ─── Estado de los datos ─────────────────────────────────────
  const [productos, setProductos] = useState<Product[]>(productosIniciales);
  const [pedidos, setPedidos] = useState<Order[]>(pedidosIniciales);

  // ─── Estado del formulario modal ─────────────────────────────
  const [editando, setEditando] = useState<Product | null>(null);
  const [creando, setCreando] = useState(false);
  const [formulario, setFormulario] = useState<EstadoFormulario>(FORMULARIO_VACIO);
  const [guardando, setGuardando] = useState(false);

  // Cerrojo antidoble-envío. Se usa `useRef` y no `useState` porque el
  // estado se actualiza de forma asíncrona: entre dos clics muy
  // seguidos, `guardando` todavía valdría `false` y se enviaría dos
  // veces. La referencia cambia en el acto.
  const cerrojoGuardado = useRef(false);

  // ─── Galería de imágenes disponibles ─────────────────────────
  const [opcionesImagen, setOpcionesImagen] =
    useState<string[]>(IMAGENES_POR_DEFECTO);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  /** Actualiza la lista de imágenes evitando renders innecesarios. */
  const sincronizarImagenes = useCallback((rutas: string[]) => {
    setOpcionesImagen((previas) => {
      const siguientes = rutas.length ? rutas : IMAGENES_POR_DEFECTO;
      // Si el contenido es idéntico devolvemos el array anterior: así
      // React no vuelve a dibujar el selector sin motivo.
      if (
        previas.length === siguientes.length &&
        previas.every((ruta, i) => ruta === siguientes[i])
      ) {
        return previas;
      }
      return siguientes;
    });
  }, []);

  // ─── Cargar la galería al montar el panel ────────────────────
  useEffect(() => {
    // El controlador cancela la petición si el componente se desmonta
    // antes de que llegue la respuesta (evita avisos de React y
    // actualizaciones de estado sobre un componente ya destruido).
    const controlador = new AbortController();

    peticionJson<{ images: { path: string }[] }>("/api/uploads", {
      signal: controlador.signal,
      reintentos: 1,
    })
      .then((datos) =>
        sincronizarImagenes((datos.images ?? []).map((img) => img.path)),
      )
      .catch(() => {
        // Sin galería seguimos con las imágenes por defecto: el panel
        // debe poder usarse igualmente.
      });

    return () => controlador.abort();
  }, [sincronizarImagenes]);

  // ─── Subir una foto desde el ordenador o el móvil ────────────
  const subirFoto = useCallback(async (archivo: File | undefined) => {
    if (!archivo) return;
    setSubiendoFoto(true);
    try {
      const cuerpo = new FormData();
      cuerpo.append("file", archivo);

      // Sin reintentos: reintentar una subida duplicaría el archivo
      // en el disco del servidor.
      const datos = await peticionJson<{ path: string }>("/api/uploads", {
        method: "POST",
        body: cuerpo,
        reintentos: 0,
        // 60 s: una foto pesada por una conexión móvil lenta necesita
        // bastante más que los 15 s que se usan por defecto.
        tiempoMaximo: 60_000,
      });

      // La foto recién subida queda seleccionada en el formulario.
      setFormulario((f) => ({ ...f, image: datos.path }));
      setOpcionesImagen((previas) =>
        previas.includes(datos.path) ? previas : [datos.path, ...previas],
      );
      toast.success("Foto subida y asignada al instrumento");
    } catch (error) {
      // El servidor explica el motivo exacto (formato no admitido,
      // demasiado grande, no es una imagen de verdad…).
      toast.error(mensajeDeError(error, "No se pudo subir la foto"));
    } finally {
      setSubiendoFoto(false);
    }
  }, []);

  // ─── Abrir y cerrar el formulario ────────────────────────────
  const abrirCreacion = useCallback(() => {
    setFormulario(FORMULARIO_VACIO);
    setEditando(null);
    setCreando(true);
  }, []);

  const abrirEdicion = useCallback((producto: Product) => {
    setFormulario({
      name: producto.name,
      tagline: producto.tagline,
      category: producto.category,
      // La base puede devolver NULL: en el formulario se representa
      // como cadena vacía, que es lo que entiende un <select>.
      subcategory: producto.subcategory ?? "",
      description: producto.description,
      // Los precios se guardan en céntimos (enteros) para no arrastrar
      // los errores de redondeo de los decimales; aquí se pasan a euros
      // sólo para mostrarlos.
      price: (producto.priceCents / 100).toString(),
      stock: producto.stock.toString(),
      image: producto.image,
      featured: producto.featured,
    });
    setCreando(false);
    setEditando(producto);
  }, []);

  const cerrarModal = useCallback(() => {
    setCreando(false);
    setEditando(null);
  }, []);

  // ─── Guardar (alta o edición) ────────────────────────────────
  const guardarProducto = useCallback(
    async (evento: { preventDefault: () => void }) => {
      evento.preventDefault();

      // Si ya hay un guardado en marcha, se ignora el segundo clic.
      if (cerrojoGuardado.current) return;
      cerrojoGuardado.current = true;
      setGuardando(true);

      // Se admite tanto la coma como el punto decimal: en España se
      // escribe «1.299,00» y el teclado numérico del móvil da coma.
      const precioNumerico = Number.parseFloat(
        formulario.price.replace(",", "."),
      );

      // Validación en cliente ANTES de enviar. El servidor la repite
      // igualmente (nunca se confía en el navegador), pero así el aviso
      // es inmediato y no gastamos una petición.
      if (!Number.isFinite(precioNumerico) || precioNumerico < 0) {
        toast.error("Introduce un precio válido");
        cerrojoGuardado.current = false;
        setGuardando(false);
        return;
      }

      const datosEnviados = {
        name: formulario.name,
        tagline: formulario.tagline,
        category: formulario.category,
        // Cadena vacía -> null: así el servidor la guarda como «sin
        // clasificar» en lugar de rechazarla por no ser un id válido.
        subcategory: formulario.subcategory || null,
        description: formulario.description,
        // `Math.round` evita los clásicos 12,99 € → 1298,9999 céntimos.
        priceCents: Math.round(precioNumerico * 100),
        stock: Number.parseInt(formulario.stock, 10) || 0,
        image: formulario.image,
        featured: formulario.featured,
      };

      try {
        const datos = await peticionJson<{ product: Product }>(
          editando ? `/api/products/${editando.id}` : "/api/products",
          {
            method: editando ? "PATCH" : "POST",
            body: datosEnviados,
            // Sin reintentos en el alta: podría crear dos productos.
            reintentos: 0,
          },
        );

        const guardado = datos.product;
        setProductos((previos) =>
          editando
            ? previos.map((p) => (p.id === guardado.id ? guardado : p))
            : [guardado, ...previos],
        );
        toast.success(
          editando ? "Pieza actualizada" : "Nueva pieza en el catálogo",
        );
        cerrarModal();
      } catch (error) {
        // Si el servidor devolvió errores por campo, se listan todos
        // para que el administrador no los descubra de uno en uno.
        if (error instanceof ErrorPeticion && error.detalles) {
          const listado = Object.values(error.detalles).flat().join(". ");
          toast.error(listado || error.message);
        } else {
          toast.error(mensajeDeError(error, "No se pudo guardar"));
        }
      } finally {
        cerrojoGuardado.current = false;
        setGuardando(false);
      }
    },
    [formulario, editando, cerrarModal],
  );

  // ─── Destacar o dejar de destacar ────────────────────────────
  const alternarDestacado = useCallback(async (producto: Product) => {
    const nuevoValor = !producto.featured;

    // Actualización optimista: se pinta el cambio al instante y, si el
    // servidor falla, se deshace. La interfaz se siente inmediata.
    setProductos((previos) =>
      previos.map((p) =>
        p.id === producto.id ? { ...p, featured: nuevoValor } : p,
      ),
    );

    try {
      await peticionJson(`/api/products/${producto.id}`, {
        method: "PATCH",
        body: { featured: nuevoValor },
      });
    } catch (error) {
      // Deshacer: se devuelve el valor anterior.
      setProductos((previos) =>
        previos.map((p) =>
          p.id === producto.id ? { ...p, featured: !nuevoValor } : p,
        ),
      );
      toast.error(mensajeDeError(error, "No se pudo actualizar"));
    }
  }, []);

  // ─── Retirar un producto del catálogo ────────────────────────
  const eliminarProducto = useCallback(async (producto: Product) => {
    // Confirmación previa: es una acción destructiva.
    if (!window.confirm(`¿Retirar «${producto.name}» del catálogo?`)) return;

    // Copia de seguridad para poder deshacer si el servidor rechaza.
    let copiaSeguridad: Product[] = [];
    setProductos((previos) => {
      copiaSeguridad = previos;
      return previos.filter((p) => p.id !== producto.id);
    });

    try {
      await peticionJson(`/api/products/${producto.id}`, {
        method: "DELETE",
        reintentos: 0,
      });
      toast.success("Pieza retirada del catálogo");
    } catch (error) {
      // Restauramos la lista tal y como estaba.
      setProductos(copiaSeguridad);
      toast.error(mensajeDeError(error, "No se pudo eliminar"));
    }
  }, []);

  // ─── Cambiar el estado de un pedido ──────────────────────────
  const cambiarEstadoPedido = useCallback(
    async (pedido: Order, estado: OrderStatus) => {
      // Optimista, igual que el destacado.
      setPedidos((previos) =>
        previos.map((o) => (o.id === pedido.id ? { ...o, status: estado } : o)),
      );

      try {
        await peticionJson(`/api/orders/${pedido.id}`, {
          method: "PATCH",
          body: { status: estado },
        });
        toast.success(`${pedido.code} → ${estado}`);
      } catch (error) {
        // Volvemos al estado anterior del pedido.
        setPedidos((previos) =>
          previos.map((o) =>
            o.id === pedido.id ? { ...o, status: pedido.status } : o,
          ),
        );
        toast.error(mensajeDeError(error, "No se pudo cambiar el estado"));
      }
    },
    [],
  );

  // El modal está abierto si se está creando o editando.
  const modalAbierto = creando || editando !== null;

  return {
    // Datos
    productos,
    pedidos,
    // Formulario
    formulario,
    setFormulario,
    editando,
    modalAbierto,
    guardando,
    abrirCreacion,
    abrirEdicion,
    cerrarModal,
    guardarProducto,
    // Imágenes
    opcionesImagen,
    sincronizarImagenes,
    subiendoFoto,
    subirFoto,
    // Acciones sobre las filas
    alternarDestacado,
    eliminarProducto,
    cambiarEstadoPedido,
  };
}
