"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  Loader2,
  MapPin,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { ErrorPeticion, peticionJson } from "@/lib/cliente-http";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/session";
import { formatPrice } from "@/lib/utils";
import Aurora from "@/components/bits/Aurora";
import SplitText from "@/components/bits/SplitText";
import SpotlightCard from "@/components/bits/SpotlightCard";
import StarBorder from "@/components/bits/StarBorder";

interface OrderResult {
  code: string;
  totalCents: number;
}

export default function CheckoutPage() {
  const { lines, totalCents, clear } = useCart();
  const { user } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<OrderResult | null>(null);

  useEffect(() => {
    if (user) {
      setName((v) => v || user.name);
      setEmail((v) => v || user.email);
    }
  }, [user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      toast.error("Tu selección está vacía");
      return;
    }
    setPending(true);
    try {
      // Un pedido NO se reintenta automáticamente: si la respuesta se
      // perdiera por el camino, el reintento podría generar un segundo
      // pedido y un segundo cargo. Ante la duda, mejor que el usuario
      // decida pulsar de nuevo.
      const datos = await peticionJson<{
        order: { code: string; totalCents: number };
      }>("/api/orders", {
        method: "POST",
        reintentos: 0,
        body: {
          customerName: name,
          customerEmail: email,
          address,
          items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
        },
      });

      setDone({ code: datos.order.code, totalCents: datos.order.totalCents });
      clear();
      toast.success("Pedido confirmado");
    } catch (error) {
      // `ErrorPeticion` ya trae el mensaje del servidor traducido, que
      // es mucho más útil que un genérico: por ejemplo, avisa de qué
      // producto concreto se agotó mientras se rellenaba el formulario.
      const mensaje =
        error instanceof ErrorPeticion
          ? error.message
          : "No se pudo conectar con el servidor";
      toast.error(mensaje);
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-5">
        <Aurora />
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-md text-center"
        >
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.2 }}
            className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-full border border-ember/50 bg-ember/10 text-ember"
          >
            <BadgeCheck className="h-9 w-9" />
          </motion.span>
          <h1 className="font-display text-5xl">
            <SplitText text="Pedido sellado" accentWords={["sellado"]} />
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-fog">
            Tu instrumento entra ahora en la fase final del atelier. Te
            escribiremos con el seguimiento.
          </p>
          <p className="mt-6 font-mono text-lg text-ember">{done.code}</p>
          <p className="mt-1 font-mono text-xs text-fog">
            Total abonado · {formatPrice(done.totalCents)}
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link
              href="/cuenta"
              className="rounded-full border border-ember/50 bg-ember/10 px-6 py-3 text-sm text-ember transition-colors hover:bg-ember hover:text-ink"
            >
              Ver mis pedidos
            </Link>
            <Link
              href="/#catalogo"
              className="rounded-full border border-line px-6 py-3 text-sm text-fog transition-colors hover:border-ember/50 hover:text-cream"
            >
              Seguir explorando
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto min-h-svh max-w-7xl px-5 pb-24 pt-28 md:px-10 md:pt-36">
      <Aurora className="opacity-40" />
      <Link
        href="/#catalogo"
        className="mb-8 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-fog transition-colors hover:text-ember"
      >
        <ArrowLeft className="h-4 w-4" />
        Seguir explorando
      </Link>

      <h1 className="font-display text-[clamp(2.4rem,5vw,4.5rem)] leading-none">
        <SplitText text="Última nota" accentWords={["nota"]} />
      </h1>

      {lines.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 py-20 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full border border-line bg-panel text-fog">
            <ShoppingBag className="h-6 w-6" />
          </span>
          <p className="font-display text-2xl">Tu selección está en silencio</p>
          <p className="max-w-xs text-sm text-fog">
            Añade algún instrumento del catálogo para continuar con el pedido.
          </p>
          <Link
            href="/#catalogo"
            className="mt-2 rounded-full border border-ember/50 bg-ember/10 px-6 py-3 text-sm text-ember transition-colors hover:bg-ember hover:text-ink"
          >
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="relative mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]"
        >
          <div className="space-y-6">
            <SpotlightCard className="rounded-3xl border border-line bg-panel/40 p-7">
              <h2 className="flex items-center gap-3 font-display text-2xl">
                <MapPin className="h-5 w-5 text-ember" />
                Envío
              </h2>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                    Nombre completo
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-line bg-ink/60 px-5 py-3.5 text-sm outline-none transition-colors focus:border-ember/60"
                  />
                </div>
                <div>
                  <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-line bg-ink/60 px-5 py-3.5 text-sm outline-none transition-colors focus:border-ember/60"
                  />
                </div>
                <div>
                  <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                    Dirección de entrega
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    rows={3}
                    placeholder="Calle, número, ciudad, código postal, país"
                    className="w-full resize-none rounded-2xl border border-line bg-ink/60 px-5 py-3.5 text-sm outline-none transition-colors focus:border-ember/60"
                  />
                </div>
              </div>
            </SpotlightCard>

            <SpotlightCard className="rounded-3xl border border-line bg-panel/40 p-7">
              <h2 className="flex items-center gap-3 font-display text-2xl">
                <CreditCard className="h-5 w-5 text-ember" />
                Pago
              </h2>
              <p className="mt-4 rounded-2xl border border-ember/30 bg-ember/5 px-5 py-4 text-xs leading-relaxed text-fog">
                Entorno demo: el cobro es simulado, el pedido es real. En
                producción este módulo se conectaría a Stripe, Redsys o PayPal.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <input
                  placeholder="Número de tarjeta"
                  inputMode="numeric"
                  className="col-span-2 w-full rounded-2xl border border-line bg-ink/60 px-5 py-3.5 text-sm outline-none transition-colors placeholder:text-fog/50 focus:border-ember/60"
                />
                <input
                  placeholder="MM / AA"
                  className="w-full rounded-2xl border border-line bg-ink/60 px-5 py-3.5 text-sm outline-none transition-colors placeholder:text-fog/50 focus:border-ember/60"
                />
                <input
                  placeholder="CVC"
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-line bg-ink/60 px-5 py-3.5 text-sm outline-none transition-colors placeholder:text-fog/50 focus:border-ember/60"
                />
              </div>
            </SpotlightCard>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <SpotlightCard className="rounded-3xl border border-line bg-panel/60 p-7">
              <h2 className="font-display text-2xl">Tu selección</h2>
              <ul className="mt-6 space-y-4">
                {lines.map(({ product, qty }) => (
                  <li key={product.id} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-cream">{product.name}</p>
                      <p className="font-mono text-xs text-fog">×{qty}</p>
                    </div>
                    <p className="font-mono text-sm text-cream">
                      {formatPrice(product.priceCents * qty)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
                <div className="flex justify-between text-fog">
                  <span>Envío asegurado</span>
                  <span className="text-ember">Incluido</span>
                </div>
                <div className="flex justify-between text-fog">
                  <span>Setup del atelier</span>
                  <span className="text-ember">Incluido</span>
                </div>
                <div className="flex items-baseline justify-between pt-3">
                  <span className="font-mono text-xs uppercase tracking-[0.25em] text-fog">
                    Total
                  </span>
                  <span className="font-display text-3xl text-ember">
                    {formatPrice(totalCents)}
                  </span>
                </div>
              </div>
              <div className="mt-7">
                <StarBorder
                  type="submit"
                  disabled={pending}
                  className="w-full"
                  innerClassName="w-full py-4"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" />
                  )}
                  Confirmar pedido · {formatPrice(totalCents)}
                </StarBorder>
              </div>
            </SpotlightCard>
          </aside>
        </form>
      )}
    </div>
  );
}
