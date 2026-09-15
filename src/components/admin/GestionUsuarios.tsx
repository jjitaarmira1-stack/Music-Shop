"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Search,
  ShieldCheck,
  User as IconoUsuario,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
//  GESTIÓN DE USUARIOS
//
//  Dos operaciones, ambas sensibles:
//    1. Cambiar el rol de una cuenta (cliente ↔ administrador).
//    2. Restablecer su contraseña.
//
//  Las dos exigen confirmación explícita antes de ejecutarse: son
//  irreversibles desde el punto de vista del afectado (le cierran la
//  sesión) y un clic accidental en una tabla es demasiado fácil.
// ═══════════════════════════════════════════════════════════════

/** Forma de cada usuario tal y como llega de `GET /api/users`. */
interface Usuario {
  id: string;
  name: string;
  email: string;
  role: "admin" | "customer";
  createdAt: string;
  totalPedidos: number;
}

/** Acción pendiente de confirmación en el diálogo. */
type AccionPendiente =
  | { tipo: "rol"; usuario: Usuario; nuevoRol: "admin" | "customer" }
  | { tipo: "contrasena"; usuario: Usuario }
  | null;

interface Props {
  /** Correo del administrador que está usando el panel. */
  emailAdminActual: string;
}

export default function GestionUsuarios({ emailAdminActual }: Props) {
  // Lista de cuentas. Se carga al montar el componente.
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  // Cargando el listado inicial.
  const [cargando, setCargando] = useState(true);
  // Texto del buscador.
  const [busqueda, setBusqueda] = useState("");
  // Acción esperando confirmación en el diálogo.
  const [pendiente, setPendiente] = useState<AccionPendiente>(null);
  // Id de la cuenta sobre la que se está operando (bloquea sus botones).
  const [ocupado, setOcupado] = useState<string | null>(null);
  // Contraseña recién generada, para enseñarla una sola vez.
  const [contrasenaNueva, setContrasenaNueva] = useState<{
    usuario: string;
    valor: string;
  } | null>(null);

  // ─── Carga inicial ───────────────────────────────────────────
  useEffect(() => {
    // `cancelado` evita actualizar el estado si el componente se
    // desmonta antes de que responda la petición (aviso de React).
    let cancelado = false;

    (async () => {
      try {
        const respuesta = await fetch("/api/users");
        if (!respuesta.ok) throw new Error("No se pudo cargar la lista");
        const datos = await respuesta.json();
        if (!cancelado) setUsuarios(datos.users ?? []);
      } catch {
        if (!cancelado) toast.error("No se pudieron cargar las cuentas");
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  // ─── Filtrado por nombre o correo ────────────────────────────
  // `useMemo` para no recalcular la lista en cada renderizado; con
  // pocas cuentas da igual, con muchas se nota al teclear.
  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return usuarios;
    return usuarios.filter(
      (u) =>
        u.name.toLowerCase().includes(termino) ||
        u.email.toLowerCase().includes(termino),
    );
  }, [usuarios, busqueda]);

  // Cuántos administradores hay: si sólo queda uno, se avisa en su fila.
  const totalAdmins = usuarios.filter((u) => u.role === "admin").length;

  // ─── Ejecutar la acción confirmada ───────────────────────────
  async function confirmar() {
    if (!pendiente) return;

    const { usuario } = pendiente;
    setOcupado(usuario.id); // Bloquea los botones de esa fila.
    setPendiente(null); // Cierra el diálogo.

    try {
      if (pendiente.tipo === "rol") {
        const respuesta = await fetch(`/api/users/${usuario.id}/rol`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: pendiente.nuevoRol }),
        });

        const datos = await respuesta.json();
        // El servidor puede negarse con un 409 razonado (última cuenta
        // de administración, auto-degradación…). Se muestra su mensaje.
        if (!respuesta.ok) throw new Error(datos.error ?? "No se pudo cambiar");

        // Actualización local: evita recargar toda la lista.
        setUsuarios((previos) =>
          previos.map((u) =>
            u.id === usuario.id ? { ...u, role: pendiente.nuevoRol } : u,
          ),
        );

        toast.success(
          pendiente.nuevoRol === "admin"
            ? `${usuario.name} ya es administrador`
            : `${usuario.name} vuelve a ser cliente`,
        );
      } else {
        const respuesta = await fetch(`/api/users/${usuario.id}/contrasena`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const datos = await respuesta.json();
        if (!respuesta.ok)
          throw new Error(datos.error ?? "No se pudo restablecer");

        // Se guarda en memoria para mostrarla UNA vez. No se persiste
        // en ningún sitio: ni localStorage, ni URL, ni registros.
        setContrasenaNueva({
          usuario: usuario.name,
          valor: datos.temporaryPassword,
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ha ocurrido un error",
      );
    } finally {
      setOcupado(null);
    }
  }

  // ─── Copiar la contraseña al portapapeles ────────────────────
  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Contraseña copiada");
    } catch {
      // El portapapeles falla si no hay HTTPS o falta el permiso.
      toast.error("No se pudo copiar. Selecciónala y cópiala a mano.");
    }
  }

  // ─── Estado de carga ─────────────────────────────────────────
  if (cargando) {
    return (
      <div className="mt-10 flex items-center justify-center gap-3 rounded-3xl border border-line bg-panel/40 py-16 text-sm text-fog">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando cuentas…
      </div>
    );
  }

  return (
    <div className="mt-10">
      {/* ─── Cabecera y buscador ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-2xl">
          Cuentas{" "}
          <span className="font-mono text-sm text-fog">{usuarios.length}</span>
        </h2>

        <label className="relative">
          {/* Etiqueta para lectores de pantalla; visualmente basta el icono. */}
          <span className="sr-only">Buscar por nombre o correo</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fog" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o correo"
            className="w-full min-w-[260px] rounded-full border border-line bg-panel/60 py-2.5 pl-11 pr-4 text-sm text-cream outline-none transition-colors placeholder:text-fog focus:border-ember/50"
          />
        </label>
      </div>

      {/* ─── Aviso permanente sobre el cierre de sesión ─── */}
      <p className="mt-4 rounded-2xl border border-line bg-panel/40 px-5 py-3 text-xs leading-relaxed text-fog">
        Al cambiar un rol o restablecer una contraseña se cierran todas las
        sesiones abiertas de esa cuenta. La persona tendrá que volver a entrar.
      </p>

      {/* ─── Tabla de cuentas ─── */}
      {visibles.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-line bg-panel/40 px-6 py-10 text-center text-sm text-fog">
          {busqueda
            ? `Ninguna cuenta coincide con «${busqueda}».`
            : "Todavía no hay cuentas registradas."}
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {visibles.map((u, i) => {
            // ¿Es la cuenta con la que estoy usando el panel ahora mismo?
            const esMiCuenta = u.email === emailAdminActual;
            // ¿Es el último administrador que queda?
            const esUltimoAdmin = u.role === "admin" && totalAdmins <= 1;
            // Sus botones están bloqueados por una operación en curso.
            const bloqueado = ocupado === u.id;

            return (
              <motion.li
                key={u.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-panel/40 p-4 transition-colors hover:border-ember/30"
              >
                {/* Icono según el rol: escudo para administración. */}
                <span
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-full border",
                    u.role === "admin"
                      ? "border-ember/40 text-ember"
                      : "border-line text-fog",
                  )}
                >
                  {u.role === "admin" ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : (
                    <IconoUsuario className="h-5 w-5" />
                  )}
                </span>

                {/* Identidad */}
                <div className="min-w-[180px] flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-display text-lg leading-tight">
                    {u.name}
                    {esMiCuenta && (
                      <span className="rounded-full border border-ember/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-ember">
                        Tú
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-fog">{u.email}</p>
                </div>

                {/* Datos secundarios: se ocultan en pantallas pequeñas
                    para que la fila no se rompa. */}
                <div className="hidden text-right sm:block">
                  <p className="font-mono text-sm text-cream">
                    {u.totalPedidos}
                  </p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-fog">
                    {u.totalPedidos === 1 ? "pedido" : "pedidos"}
                  </p>
                </div>

                <div className="hidden text-right md:block">
                  <p className="font-mono text-xs text-fog">
                    {formatDate(u.createdAt)}
                  </p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-fog">
                    alta
                  </p>
                </div>

                {/* ─── Acciones ─── */}
                <div className="flex items-center gap-2">
                  {/* Cambio de rol */}
                  <button
                    type="button"
                    disabled={bloqueado || esMiCuenta || esUltimoAdmin}
                    onClick={() =>
                      setPendiente({
                        tipo: "rol",
                        usuario: u,
                        nuevoRol: u.role === "admin" ? "customer" : "admin",
                      })
                    }
                    // `title` explica por qué está desactivado, que si no
                    // resulta desconcertante.
                    title={
                      esMiCuenta
                        ? "No puedes cambiar tu propio rol"
                        : esUltimoAdmin
                          ? "Es la única cuenta de administración"
                          : u.role === "admin"
                            ? "Convertir en cliente"
                            : "Hacer administrador"
                    }
                    className="rounded-full border border-line px-4 py-2 text-xs text-fog transition-colors hover:border-ember/50 hover:text-cream disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:text-fog"
                  >
                    {u.role === "admin" ? "Hacer cliente" : "Hacer admin"}
                  </button>

                  {/* Restablecer contraseña */}
                  <button
                    type="button"
                    disabled={bloqueado}
                    onClick={() => setPendiente({ tipo: "contrasena", usuario: u })}
                    title="Restablecer contraseña"
                    aria-label={`Restablecer la contraseña de ${u.name}`}
                    className="grid h-9 w-9 place-items-center rounded-full border border-line text-fog transition-colors hover:border-ember/50 hover:text-cream disabled:opacity-35"
                  >
                    {bloqueado ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      {/* ─── Diálogo de confirmación ─── */}
      {pendiente && (
        <DialogoConfirmacion
          accion={pendiente}
          onCancelar={() => setPendiente(null)}
          onConfirmar={confirmar}
        />
      )}

      {/* ─── Contraseña recién generada ─── */}
      {contrasenaNueva && (
        <DialogoContrasena
          nombre={contrasenaNueva.usuario}
          contrasena={contrasenaNueva.valor}
          onCopiar={() => copiar(contrasenaNueva.valor)}
          onCerrar={() => setContrasenaNueva(null)}
        />
      )}
    </div>
  );
}

// ─── DIÁLOGO DE CONFIRMACIÓN ───────────────────────────────────

/**
 * Pide confirmación antes de una acción irreversible.
 * Se explica en cada caso qué va a ocurrir exactamente, en lugar de un
 * genérico «¿Estás seguro?» que nadie lee.
 */
function DialogoConfirmacion({
  accion,
  onCancelar,
  onConfirmar,
}: {
  accion: NonNullable<AccionPendiente>;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  // Texto distinto según la acción.
  const esRol = accion.tipo === "rol";
  const titulo = esRol ? "Cambiar el rol" : "Restablecer la contraseña";

  const cuerpo = esRol
    ? accion.nuevoRol === "admin"
      ? `${accion.usuario.name} podrá entrar al panel, crear y borrar instrumentos, ver todos los pedidos y gestionar cuentas. Concédelo sólo a quien deba tener control total de la tienda.`
      : `${accion.usuario.name} dejará de tener acceso al panel de administración y pasará a ser un cliente normal.`
    : `Se generará una contraseña nueva al azar para ${accion.usuario.name}. La actual dejará de funcionar de inmediato y tendrás que hacerle llegar la nueva.`;

  return (
    <Modal onCerrar={onCancelar} titulo={titulo}>
      <p className="text-sm leading-relaxed text-fog">{cuerpo}</p>

      <p className="mt-3 text-xs text-fog">
        También se cerrarán sus sesiones abiertas en todos los dispositivos.
      </p>

      <div className="mt-7 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-full border border-line px-6 py-2.5 text-sm text-fog transition-colors hover:border-ember/50 hover:text-cream"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          // `autoFocus` no: el foco por defecto debe estar en cancelar
          // para que pulsar Intro sin leer no ejecute la acción.
          className="rounded-full bg-ember px-6 py-2.5 text-sm font-medium text-ink transition-opacity hover:opacity-90"
        >
          {esRol ? "Cambiar el rol" : "Restablecer"}
        </button>
      </div>
    </Modal>
  );
}

// ─── DIÁLOGO DE LA CONTRASEÑA GENERADA ─────────────────────────

/**
 * Muestra la contraseña temporal. Sólo se ve aquí y una vez: en cuanto
 * se cierra el diálogo, desaparece de la memoria del navegador y no
 * hay forma de recuperarla (el servidor sólo guarda su hash).
 */
function DialogoContrasena({
  nombre,
  contrasena,
  onCopiar,
  onCerrar,
}: {
  nombre: string;
  contrasena: string;
  onCopiar: () => void;
  onCerrar: () => void;
}) {
  // Obliga a marcar la casilla antes de poder cerrar: evita cerrar sin
  // haber copiado la contraseña y tener que restablecerla otra vez.
  const [anotada, setAnotada] = useState(false);

  return (
    <Modal onCerrar={() => anotada && onCerrar()} titulo="Contraseña temporal">
      <p className="text-sm leading-relaxed text-fog">
        Esta es la contraseña nueva de{" "}
        <span className="text-cream">{nombre}</span>. Cópiala ahora: no se
        volverá a mostrar y no se guarda en ningún sitio.
      </p>

      {/* La contraseña, en monoespaciada y seleccionable. */}
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-ember/40 bg-ink/60 px-5 py-4">
        <code className="flex-1 select-all break-all font-mono text-base text-ember">
          {contrasena}
        </code>
        <button
          type="button"
          onClick={onCopiar}
          aria-label="Copiar la contraseña"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-fog transition-colors hover:border-ember/50 hover:text-cream"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-fog">
        Entrégasela por un canal privado y pídele que la cambie al entrar.
        Evita el correo sin cifrar y los grupos de mensajería.
      </p>

      {/* Confirmación explícita de que se ha guardado. */}
      <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm text-fog">
        <input
          type="checkbox"
          checked={anotada}
          onChange={(e) => setAnotada(e.target.checked)}
          className="h-4 w-4 accent-[#e8a33d]"
        />
        Ya la he copiado
      </label>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={!anotada}
          onClick={onCerrar}
          className="flex items-center gap-2 rounded-full bg-ember px-6 py-2.5 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Check className="h-4 w-4" />
          Cerrar
        </button>
      </div>
    </Modal>
  );
}

// ─── MODAL GENÉRICO ────────────────────────────────────────────

/** Ventana centrada con fondo oscurecido, reutilizada por los dos diálogos. */
function Modal({
  titulo,
  children,
  onCerrar,
}: {
  titulo: string;
  children: React.ReactNode;
  onCerrar: () => void;
}) {
  // Escape cierra el diálogo: es lo que espera cualquiera.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-5 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        // `role="dialog"` + `aria-modal` para que los lectores de
        // pantalla anuncien que el resto de la página queda detrás.
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-lg rounded-3xl border border-line bg-panel p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-xl text-cream">{titulo}</h3>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-fog transition-colors hover:border-ember/50 hover:text-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </motion.div>
    </div>
  );
}
