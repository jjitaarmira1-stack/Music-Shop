import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageOpen, ShieldCheck, UserRound } from "lucide-react";
import { obtenerSesion as getSession } from "@/lib/auth";
import { getOrdersForUser } from "@/lib/data";
import { formatDate, formatPrice } from "@/lib/utils";
import Aurora from "@/components/bits/Aurora";
import SplitText from "@/components/bits/SplitText";
import Reveal from "@/components/bits/Reveal";
import StatusBadge from "@/components/site/StatusBadge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/cuenta");

  const orders = await getOrdersForUser(session.uid);

  return (
    <div className="relative mx-auto min-h-svh max-w-5xl px-5 pb-24 pt-28 md:px-10 md:pt-36">
      <Aurora className="opacity-40" />

      <Reveal className="relative">
        <div className="glass flex flex-wrap items-center gap-6 rounded-3xl p-7 md:p-9">
          <span className="grid h-16 w-16 place-items-center rounded-full border border-ember/40 bg-ember/10 font-display text-2xl italic text-ember">
            {session.name.charAt(0).toUpperCase()}
          </span>
          <div className="flex-1">
            <h1 className="font-display text-3xl md:text-4xl">
              <SplitText text={session.name} />
            </h1>
            <p className="mt-1 font-mono text-xs text-fog">{session.email}</p>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-line bg-panel/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-fog">
            {session.role === "admin" ? (
              <ShieldCheck className="h-3.5 w-3.5 text-ember" />
            ) : (
              <UserRound className="h-3.5 w-3.5 text-ember" />
            )}
            {session.role === "admin" ? "Administrador" : "Cliente"}
          </span>
        </div>
      </Reveal>

      <Reveal delay={0.15} className="relative mt-12">
        <h2 className="flex items-baseline gap-3 font-display text-3xl">
          Mis pedidos
          <span className="font-mono text-sm text-fog">{orders.length}</span>
        </h2>
      </Reveal>

      {orders.length === 0 ? (
        <Reveal delay={0.2} className="relative">
          <div className="mt-8 flex flex-col items-center gap-4 rounded-3xl border border-line bg-panel/40 py-20 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full border border-line bg-panel text-fog">
              <PackageOpen className="h-6 w-6" />
            </span>
            <p className="font-display text-2xl">Todavía no hay pedidos</p>
            <p className="max-w-xs text-sm text-fog">
              Cuando selecciones un instrumento del catálogo aparecerá aquí su
              seguimiento.
            </p>
            <Link
              href="/#catalogo"
              className="mt-2 rounded-full border border-ember/50 bg-ember/10 px-6 py-3 text-sm text-ember transition-colors hover:bg-ember hover:text-ink"
            >
              Ir al catálogo
            </Link>
          </div>
        </Reveal>
      ) : (
        <div className="relative mt-8 space-y-5">
          {orders.map((order, i) => (
            <Reveal key={order.id} delay={0.06 * i}>
              <article className="rounded-3xl border border-line bg-panel/40 p-6 transition-colors hover:border-ember/30">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm text-ember">{order.code}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-fog">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={order.status} />
                    <p className="font-display text-2xl">
                      {formatPrice(order.totalCents)}
                    </p>
                  </div>
                </div>
                <ul className="mt-5 flex flex-wrap gap-3 border-t border-line pt-5">
                  {order.items.map((item) => (
                    <li
                      key={item.productId}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-ink/40 py-2 pl-2 pr-4"
                    >
                      <span className="relative h-10 w-10 overflow-hidden rounded-xl">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </span>
                      <span className="text-xs text-cream">
                        {item.name}
                        <span className="ml-2 font-mono text-fog">×{item.qty}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
