"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { peticionJson } from "@/lib/cliente-http";

export interface ClientUser {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "customer";
}

interface SessionContextValue {
  user: ClientUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /**
   * Vuelve a preguntar al servidor quién es el usuario actual.
   *
   * La sesión vive en una cookie HttpOnly, así que el navegador NO
   * puede leerla con JavaScript (esa es justamente la protección
   * contra el robo de sesión por XSS). La única forma de saber quién
   * eres es preguntárselo al servidor.
   */
  const refresh = useCallback(async () => {
    try {
      // Un solo reintento: si falla, es preferible mostrar la interfaz
      // como visitante antes que dejarla bloqueada cargando.
      const datos = await peticionJson<{ user: ClientUser | null }>(
        "/api/auth/me",
        { reintentos: 1, tiempoMaximo: 8_000 },
      );
      setUser(datos.user ?? null);
    } catch {
      // Ante cualquier fallo asumimos "no autenticado": es la opción
      // segura, nunca al revés.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Cierra la sesión y devuelve al usuario a la portada. */
  const logout = useCallback(async () => {
    try {
      // El servidor borra la cookie; el cliente no puede hacerlo solo.
      await peticionJson("/api/auth/logout", { method: "POST" });
    } catch {
      // Aunque la llamada falle, limpiamos el estado local: el usuario
      // ha pedido salir y la interfaz debe obedecer de inmediato.
    }
    setUser(null);
    router.push("/");
    router.refresh();
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, loading, refresh, logout }),
    [user, loading, refresh, logout],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
