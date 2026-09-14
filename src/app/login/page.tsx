"use client";

import { Suspense, useId, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AudioWaveform, KeyRound, Loader2, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { BUSINESS } from "@/lib/business";
import { peticionJson, ErrorPeticion } from "@/lib/cliente-http";
import { esquemaLogin, esquemaRegistro } from "@/lib/validaciones";
import { rutaInternaSegura } from "@/lib/navegacion";
import Aurora from "@/components/bits/Aurora";
import SplitText from "@/components/bits/SplitText";
import StarBorder from "@/components/bits/StarBorder";
import SpotlightCard from "@/components/bits/SpotlightCard";

/** Modos del formulario: entrar o crear cuenta. */
type ModoFormulario = "login" | "register";

/** Errores de validación, indexados por nombre de campo. */
type ErroresCampo = Partial<Record<"name" | "email" | "password", string>>;

function FormularioAcceso() {
  // ─── Estado del formulario ───────────────────────────────────
  const [modo, setModo] = useState<ModoFormulario>("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [errores, setErrores] = useState<ErroresCampo>({});
  const [enviando, setEnviando] = useState(false);

  // `useRef` como cerrojo ANTIREENVÍO. El estado `enviando` no sirve por
  // sí solo: React lo actualiza de forma asíncrona, así que dos pulsaciones
  // muy seguidas podrían colarse antes del primer repintado.
  const bloqueado = useRef(false);

  const router = useRouter();
  const parametros = useSearchParams();
  const { refresh } = useSession();

  // `useId` genera identificadores únicos y estables. Son necesarios
  // para asociar cada <label> con su <input> mediante htmlFor/id, que
  // es lo que permite a un lector de pantalla anunciar el campo.
  const idBase = useId();
  const idNombre = `${idBase}-nombre`;
  const idEmail = `${idBase}-email`;
  const idContrasena = `${idBase}-contrasena`;

  /**
   * Valida los datos en el navegador antes de enviarlos.
   * Es una comodidad para el usuario: el servidor vuelve a validarlo
   * todo, porque la validación del cliente se puede saltar.
   */
  const validarEnCliente = (): boolean => {
    // Se usa el MISMO esquema Zod que el servidor: imposible que las
    // dos validaciones se desincronicen.
    const esquema = modo === "login" ? esquemaLogin : esquemaRegistro;
    const datos =
      modo === "login"
        ? { email, password: contrasena }
        : { name: nombre, email, password: contrasena };

    const resultado = esquema.safeParse(datos);
    if (resultado.success) {
      setErrores({}); // Todo correcto: limpiamos errores previos.
      return true;
    }

    // Convertimos los errores de Zod al formato campo → mensaje.
    const nuevosErrores: ErroresCampo = {};
    for (const incidencia of resultado.error.issues) {
      const campo = incidencia.path[0] as keyof ErroresCampo;
      // Nos quedamos con el primer mensaje de cada campo.
      if (campo && !nuevosErrores[campo]) {
        nuevosErrores[campo] = incidencia.message;
      }
    }
    setErrores(nuevosErrores);
    return false;
  };

  /** Envía el formulario al servidor. */
  const alEnviar = async (evento: FormEvent) => {
    evento.preventDefault();

    // Cerrojo: si ya hay un envío en curso, ignoramos la pulsación.
    if (bloqueado.current) return;

    // Validación previa en el navegador.
    if (!validarEnCliente()) return;

    bloqueado.current = true;
    setEnviando(true);

    try {
      const destino =
        modo === "login" ? "/api/auth/login" : "/api/auth/register";

      // `peticionJson` añade tiempo de espera, reintentos y traducción
      // de errores de red a mensajes comprensibles.
      const datos = await peticionJson<{
        user: { name: string; role: string };
      }>(destino, {
        method: "POST",
        body:
          modo === "login"
            ? { email, password: contrasena }
            : { name: nombre, email, password: contrasena },
      });

      // Refrescamos el contexto de sesión con el usuario recién creado.
      await refresh();

      toast.success(
        modo === "login"
          ? `De nuevo en el escenario, ${datos.user.name.split(" ")[0]}`
          : "Cuenta creada: bienvenido al atelier",
      );

      // ─── Redirección segura ────────────────────────────────
      // `rutaInternaSegura` sólo admite rutas internas. Sin ella, un
      // enlace como /login?next=https://sitio-falso.com redirigiría a
      // un dominio externo tras iniciar sesión (open redirect).
      const solicitado = rutaInternaSegura(parametros.get("next"));
      const porDefecto = datos.user.role === "admin" ? "/admin" : "/cuenta";
      router.push(solicitado ?? porDefecto);
      router.refresh();
    } catch (error) {
      // Si el servidor devolvió errores por campo, los pintamos junto
      // a cada entrada además de mostrar el aviso general.
      if (error instanceof ErrorPeticion && error.detalles) {
        const erroresServidor: ErroresCampo = {};
        for (const [campo, mensajes] of Object.entries(error.detalles)) {
          if (campo in { name: 1, email: 1, password: 1 }) {
            erroresServidor[campo as keyof ErroresCampo] = mensajes[0];
          }
        }
        setErrores(erroresServidor);
      }
      toast.error(
        error instanceof Error ? error.message : "No se pudo completar la acción",
      );
    } finally {
      // Liberamos el cerrojo pase lo que pase.
      bloqueado.current = false;
      setEnviando(false);
    }
  };

  /** Cambia entre "entrar" y "crear cuenta" limpiando los errores. */
  const cambiarModo = (nuevoModo: ModoFormulario) => {
    setModo(nuevoModo);
    setErrores({});
  };

  /** Clases del campo, con borde rojo cuando hay error. */
  const clasesCampo = (hayError: boolean) =>
    cn(
      "w-full rounded-2xl border bg-panel/60 px-5 py-3.5 text-sm text-cream outline-none transition-colors placeholder:text-fog/60",
      hayError
        ? "border-red-500/70 focus:border-red-400" // Estado de error.
        : "border-line focus:border-ember/60", // Estado normal.
    );

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-5 py-28">
      <Aurora />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <SpotlightCard className="glass rounded-3xl p-8 md:p-10">
          <div
            aria-hidden // Icono decorativo: se oculta al lector de pantalla.
            className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-full border border-ember/40 bg-ember/10 text-ember"
          >
            <AudioWaveform className="h-6 w-6" />
          </div>

          <h1 className="text-center font-display text-4xl">
            <SplitText
              text={modo === "login" ? "Vuelve al escenario" : "Únete al atelier"}
              key={modo}
            />
          </h1>
          <p className="mt-2 text-center text-sm text-fog">
            {modo === "login"
              ? "Accede con tu cuenta del atelier"
              : "Crea tu cuenta en menos de un compás"}
          </p>
          <p className="mt-1 text-center font-display text-sm italic text-ember/80">
            {BUSINESS.name} {BUSINESS.suffix}
          </p>

          {/*
            Selector entrar / crear cuenta.
            `role="tablist"` y `aria-selected` permiten que un lector de
            pantalla anuncie cuál de las dos opciones está activa.
          */}
          <div
            role="tablist"
            aria-label="Elegir entre iniciar sesión o crear una cuenta"
            className="mt-8 grid grid-cols-2 rounded-full border border-line p-1"
          >
            {(["login", "register"] as const).map((opcion) => (
              <button
                key={opcion}
                type="button" // Evita que actúe como botón de envío.
                role="tab"
                aria-selected={modo === opcion}
                onClick={() => cambiarModo(opcion)}
                className={cn(
                  // `min-h-11` ≈ 44 px: tamaño mínimo recomendado para
                  // poder pulsar con el dedo sin fallar.
                  "relative min-h-11 rounded-full py-2.5 text-sm transition-colors",
                  modo === opcion ? "text-ink" : "text-fog hover:text-cream",
                )}
              >
                {modo === opcion && (
                  <motion.span
                    layoutId="auth-tab"
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-ember"
                  />
                )}
                <span className="relative z-10">
                  {opcion === "login" ? "Entrar" : "Crear cuenta"}
                </span>
              </button>
            ))}
          </div>

          {/* `noValidate` desactiva los mensajes del navegador para
              usar los nuestros, que son coherentes con los del servidor. */}
          <form onSubmit={alEnviar} className="mt-8 space-y-4" noValidate>
            {/* ─── Nombre (sólo al registrarse) ─── */}
            {modo === "register" && (
              <div>
                <label
                  htmlFor={idNombre} // Asocia etiqueta y campo.
                  className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-fog"
                >
                  Nombre
                </label>
                <input
                  id={idNombre}
                  name="name"
                  type="text"
                  autoComplete="name" // Ayuda al autorrelleno del navegador.
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  // Marca el campo como inválido para las tecnologías de apoyo.
                  aria-invalid={Boolean(errores.name)}
                  // Enlaza el campo con su mensaje de error.
                  aria-describedby={errores.name ? `${idNombre}-error` : undefined}
                  placeholder="María Mercury"
                  className={clasesCampo(Boolean(errores.name))}
                />
                {errores.name && (
                  <p
                    id={`${idNombre}-error`}
                    role="alert" // El lector de pantalla lo anuncia al aparecer.
                    className="mt-1.5 text-xs text-red-400"
                  >
                    {errores.name}
                  </p>
                )}
              </div>
            )}

            {/* ─── Correo electrónico ─── */}
            <div>
              <label
                htmlFor={idEmail}
                className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-fog"
              >
                Email
              </label>
              <input
                id={idEmail}
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email" // Teclado con @ en el móvil.
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-invalid={Boolean(errores.email)}
                aria-describedby={errores.email ? `${idEmail}-error` : undefined}
                placeholder="tú@ejemplo.com"
                className={clasesCampo(Boolean(errores.email))}
              />
              {errores.email && (
                <p
                  id={`${idEmail}-error`}
                  role="alert"
                  className="mt-1.5 text-xs text-red-400"
                >
                  {errores.email}
                </p>
              )}
            </div>

            {/* ─── Contraseña ─── */}
            <div>
              <label
                htmlFor={idContrasena}
                className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-fog"
              >
                Contraseña
              </label>
              <input
                id={idContrasena}
                name="password"
                type="password"
                // Indica al gestor de contraseñas si es una nueva o existente.
                autoComplete={
                  modo === "login" ? "current-password" : "new-password"
                }
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                required
                aria-invalid={Boolean(errores.password)}
                aria-describedby={
                  errores.password
                    ? `${idContrasena}-error`
                    : modo === "register"
                      ? `${idContrasena}-ayuda`
                      : undefined
                }
                placeholder="••••••••••"
                className={clasesCampo(Boolean(errores.password))}
              />
              {/* Requisitos visibles ANTES de fallar, no después. */}
              {modo === "register" && !errores.password && (
                <p id={`${idContrasena}-ayuda`} className="mt-1.5 text-xs text-fog">
                  Mínimo 10 caracteres, con al menos una letra y un número.
                </p>
              )}
              {errores.password && (
                <p
                  id={`${idContrasena}-error`}
                  role="alert"
                  className="mt-1.5 text-xs text-red-400"
                >
                  {errores.password}
                </p>
              )}
            </div>

            <div className="pt-2">
              <StarBorder
                type="submit"
                disabled={enviando} // Evita el doble envío visualmente.
                aria-busy={enviando} // Anuncia el estado de carga.
                className="w-full"
                innerClassName="w-full py-4 disabled:opacity-60"
              >
                {enviando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : modo === "login" ? (
                  <KeyRound className="h-4 w-4" aria-hidden />
                ) : (
                  <UserRoundPlus className="h-4 w-4" aria-hidden />
                )}
                {enviando
                  ? "Procesando…"
                  : modo === "login"
                    ? "Entrar al atelier"
                    : "Crear mi cuenta"}
              </StarBorder>
            </div>
          </form>
        </SpotlightCard>

        {/*
          Aquí se mostraban las CREDENCIALES DEMO (correo y contraseña del
          administrador) a cualquier visitante: era el fallo crítico C-5.
          Se sustituye por un aviso neutro que conserva el mismo hueco
          visual sin revelar ningún dato de acceso.
        */}
        <div className="mt-6 rounded-2xl border border-line bg-coal/70 px-6 py-4 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
            Acceso protegido
          </p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-cream/70">
            Tus datos viajan cifrados y la contraseña se guarda con Argon2id.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function PaginaLogin() {
  // `useSearchParams` obliga a envolver el componente en <Suspense>.
  return (
    <Suspense
      fallback={
        <div className="grid min-h-svh place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-ember" aria-label="Cargando" />
        </div>
      }
    >
      <FormularioAcceso />
    </Suspense>
  );
}
