import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Instrument_Serif, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/site/Providers";
import Navbar from "@/components/site/Navbar";
import Footer from "@/components/site/Footer";
import CartDrawer from "@/components/site/CartDrawer";
import Cursor from "@/components/bits/Cursor";
import { BUSINESS } from "@/lib/business";

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: {
    default: `${BUSINESS.name.toUpperCase()} — ${BUSINESS.tagline}`,
    template: `%s · ${BUSINESS.name.toUpperCase()}`,
  },
  description: BUSINESS.description,
};

export const viewport: Viewport = {
  themeColor: "#0b0a08",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es"
      className={`${instrument.variable} ${grotesk.variable} ${jetbrains.variable}`}
    >
      <body className="grain bg-ink text-cream antialiased selection:bg-ember selection:text-ink">
        {/*
          Enlace de salto: primer elemento tabulable de la página.
          Invisible con el ratón, aparece al pulsar Tab y permite ir
          directo al contenido sin recorrer todo el menú (WCAG 2.4.1).
        */}
        <a href="#contenido-principal" className="salto-contenido">
          Saltar al contenido principal
        </a>

        <Providers>
          <Cursor />
          <Navbar />
          <CartDrawer />
          {/*
            `id` es el destino del enlace de salto y `tabIndex={-1}`
            permite que reciba el foco por programa (sin añadirlo al
            orden natural del tabulador).
          */}
          <main id="contenido-principal" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
