import Link from "next/link";
import { AudioWaveform, Download, Globe, Mail, Radio, type LucideIcon } from "lucide-react";
import Marquee from "@/components/bits/Marquee";
import RollingText from "@/components/bits/RollingText";
import ShinyText from "@/components/bits/ShinyText";
import { BUSINESS } from "@/lib/business";

const SOCIAL_ICONS: Record<string, LucideIcon> = {
  globe: Globe,
  mail: Mail,
  radio: Radio,
};

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-line bg-coal">
      <div className="border-b border-line py-5">
        <Marquee duration={40}>
          {BUSINESS.perks.map((perk) => (
            <span
              key={perk}
              className="mx-8 flex items-center gap-8 font-mono text-xs uppercase tracking-[0.3em] text-fog"
            >
              {perk}
              <span className="text-ember">✦</span>
            </span>
          ))}
        </Marquee>
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-10">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-line bg-panel text-ember">
              <AudioWaveform className="h-5 w-5" />
            </span>
            <span className="font-display text-2xl">{BUSINESS.name}</span>
          </Link>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-fog">
            {BUSINESS.description}
          </p>
          <div className="mt-6 flex gap-3">
            {BUSINESS.socials.map(({ icon, label, href }) => {
              const Icon = SOCIAL_ICONS[icon] ?? Globe;
              return (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="grid h-9 w-9 place-items-center rounded-full border border-line text-fog transition-colors hover:border-ember/60 hover:text-ember"
                >
                  <Icon className="h-4 w-4" />
                </a>
              );
            })}
          </div>
          <ul className="mt-6 space-y-1.5 font-mono text-xs text-fog">
            <li>{BUSINESS.contact.email}</li>
            <li>{BUSINESS.contact.phone}</li>
            <li>{BUSINESS.contact.address}</li>
          </ul>
        </div>

        <div>
          <h4 className="font-mono text-[10px] uppercase tracking-[0.3em] text-ember">
            Explorar
          </h4>
          <ul className="mt-5 space-y-3 text-sm">
            {[
              { href: "/#catalogo", label: "Catálogo" },
              { href: "/#coleccion", label: "Colección destacada" },
              { href: "/#atelier", label: "El atelier" },
              { href: "/login", label: "Acceso" },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-fog hover:text-cream">
                  <RollingText text={l.label} />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/*
          Antes esta columna listaba las CREDENCIALES DEMO (correo y
          contraseña del administrador) a la vista de cualquier visitante.
          Era el fallo crítico C-5 de la auditoría. Se sustituye por la
          información de contacto, manteniendo exactamente la misma
          estructura visual (título + lista en la misma columna).
        */}
        <div>
          <h4 className="font-mono text-[10px] uppercase tracking-[0.3em] text-ember">
            Contacto
          </h4>
          <ul className="mt-5 space-y-3 font-mono text-xs leading-relaxed text-fog">
            <li>
              {/* Enlace de correo: se abre en el gestor del usuario. */}
              <a
                href={`mailto:${BUSINESS.contact.email}`}
                className="transition-colors hover:text-ember"
              >
                {BUSINESS.contact.email}
              </a>
            </li>
            <li>
              {/* Enlace de teléfono: en móvil permite llamar directamente. */}
              <a
                href={`tel:${BUSINESS.contact.phone.replace(/\s/g, "")}`}
                className="transition-colors hover:text-ember"
              >
                {BUSINESS.contact.phone}
              </a>
            </li>
            <li className="text-cream">
              {BUSINESS.contact.address} · {BUSINESS.contact.city}
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-mono text-[10px] uppercase tracking-[0.3em] text-ember">
            Código fuente
          </h4>
          <p className="mt-5 text-sm leading-relaxed text-fog">
            Estructura completa del proyecto: Next.js 16, Drizzle ORM,
            componentes cinéticos y guía Firebase.
          </p>
          <a
            href="/nocturne-source.zip"
            download
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-ember/50 bg-ember/10 px-5 py-2.5 text-sm text-ember transition-all hover:bg-ember hover:text-ink"
          >
            <Download className="h-4 w-4" />
            <ShinyText>Descargar .zip</ShinyText>
          </a>
        </div>
      </div>

      <div className="relative select-none overflow-hidden">
        <p className="pointer-events-none whitespace-nowrap text-center font-display text-[18vw] leading-[0.75] text-cream/[0.04]">
          {BUSINESS.name}
        </p>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 font-mono text-[10px] uppercase tracking-[0.25em] text-fog md:flex-row md:px-10">
          <span>
            © {new Date().getFullYear()} {BUSINESS.name} {BUSINESS.suffix}
          </span>
          <span>Hecho a mano en la penumbra</span>
        </div>
      </div>
    </footer>
  );
}
