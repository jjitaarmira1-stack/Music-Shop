"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AudioWaveform,
  LayoutDashboard,
  LogOut,
  Menu,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import RollingText from "@/components/bits/RollingText";
import Magnetic from "@/components/bits/Magnetic";
import { BUSINESS } from "@/lib/business";

const LINKS = [
  { href: "/#catalogo", label: "Catálogo" },
  { href: "/#atelier", label: "Atelier" },
  { href: "/#coleccion", label: "Colección" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const { count, openCart } = useCart();
  const { user, logout, loading } = useSession();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-500",
          scrolled
            ? "glass py-3 shadow-[0_10px_50px_rgba(0,0,0,0.45)]"
            : "bg-transparent py-5",
        )}
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 md:px-10">
          <Link href="/" className="flex items-center gap-2.5" data-cursor>
            <span className="grid h-9 w-9 place-items-center rounded-full border border-line bg-panel text-ember">
              <AudioWaveform className="h-4 w-4" />
            </span>
            <span className="font-display text-xl tracking-wide">
              {BUSINESS.name}
              <span className="ml-2 hidden font-mono text-[10px] uppercase tracking-[0.3em] text-fog sm:inline">
                {BUSINESS.suffix}
              </span>
            </span>
          </Link>

          <ul className="hidden items-center gap-9 md:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-fog transition-colors hover:text-cream"
                >
                  <RollingText text={link.label} />
                </Link>
              </li>
            ))}
            {user?.role === "admin" && (
              <li>
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 text-sm text-ember"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <RollingText text="Panel" />
                </Link>
              </li>
            )}
          </ul>

          <div className="flex items-center gap-2">
            <Magnetic strength={0.4}>
              <button
                onClick={openCart}
                aria-label="Abrir carrito"
                className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-panel/70 text-cream transition-colors hover:border-ember/50"
              >
                <ShoppingBag className="h-4 w-4" />
                <AnimatePresence>
                  {count > 0 && (
                    <motion.span
                      key={count}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1 font-mono text-[10px] font-medium text-ink"
                    >
                      {count}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </Magnetic>

            {!loading &&
              (user ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenu((v) => !v)}
                    aria-label="Cuenta"
                    className="grid h-10 w-10 place-items-center rounded-full border border-ember/40 bg-ember/10 font-display text-sm italic text-ember"
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </button>
                  <AnimatePresence>
                    {userMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.22 }}
                        className="glass absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl p-2"
                      >
                        <div className="border-b border-line px-3 py-2.5">
                          <p className="truncate text-sm text-cream">{user.name}</p>
                          <p className="truncate font-mono text-[10px] uppercase tracking-widest text-fog">
                            {user.role === "admin" ? "Administrador" : "Cliente"}
                          </p>
                        </div>
                        <Link
                          href="/cuenta"
                          onClick={() => setUserMenu(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-fog transition-colors hover:bg-panel hover:text-cream"
                        >
                          <UserRound className="h-4 w-4" /> Mi cuenta
                        </Link>
                        {user.role === "admin" && (
                          <Link
                            href="/admin"
                            onClick={() => setUserMenu(false)}
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-fog transition-colors hover:bg-panel hover:text-cream"
                          >
                            <LayoutDashboard className="h-4 w-4" /> Panel admin
                          </Link>
                        )}
                        <button
                          onClick={() => {
                            setUserMenu(false);
                            void logout();
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-fog transition-colors hover:bg-panel hover:text-ember"
                        >
                          <LogOut className="h-4 w-4" /> Cerrar sesión
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="hidden items-center gap-2 rounded-full border border-line bg-panel/70 px-4 py-2.5 text-sm text-fog transition-colors hover:border-ember/50 hover:text-cream sm:flex"
                >
                  <UserRound className="h-4 w-4" />
                  Entrar
                </Link>
              ))}

            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Menú"
              className="grid h-10 w-10 place-items-center rounded-full border border-line bg-panel/70 text-cream md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-ink/80 backdrop-blur-xl md:hidden"
          >
            <div className="flex items-center justify-between px-5 py-5">
              <span className="font-display text-xl italic text-ember">
                {BUSINESS.name}
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Cerrar menú"
                className="grid h-10 w-10 place-items-center rounded-full border border-line text-cream"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-2 px-6 pt-10">
              {[...LINKS, { href: user ? "/cuenta" : "/login", label: user ? "Mi cuenta" : "Entrar" }].map(
                (link, i) => (
                  <motion.div
                    key={link.href + link.label}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 * i + 0.1, duration: 0.5 }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="font-display text-5xl text-cream transition-colors hover:text-ember"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ),
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
