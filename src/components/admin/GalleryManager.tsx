"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CloudUpload,
  Copy,
  Images,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ErrorPeticion, peticionJson } from "@/lib/cliente-http";

export interface GalleryImage {
  name: string;
  path: string;
  folder: string;
  sizeKb: number;
}

/** Librería visual de imágenes: sube, previsualiza, copia rutas y limpia. */
export default function GalleryManager({
  onChange,
}: {
  onChange?: (paths: string[]) => void;
}) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Pide al servidor la lista de imágenes de la galería. */
  const load = useCallback(async () => {
    try {
      const datos = await peticionJson<{ images: GalleryImage[] }>(
        "/api/uploads",
        { reintentos: 1 },
      );
      const lista = datos.images ?? [];
      setImages(lista);
      // Avisa al panel para que el selector de imagen del formulario
      // de producto muestre también las fotos recién subidas.
      onChange?.(lista.map((img) => img.path));
    } catch {
      toast.error("No se pudo cargar la galería");
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Sube uno o varios archivos, de uno en uno.
   *
   * Se envían en serie y no en paralelo a propósito: el servidor
   * limita las subidas por minuto, y mandar quince a la vez dispararía
   * el límite y haría fallar la mayoría.
   */
  const uploadFiles = async (files: Iterable<File>) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(list.length);
    let ok = 0;
    for (const file of list) {
      try {
        // Sin reintentos: duplicaría el archivo en el servidor.
        // 60 s de margen para fotos pesadas por conexión lenta.
        await peticionJson("/api/uploads", {
          method: "POST",
          body: (() => {
            const cuerpo = new FormData();
            cuerpo.append("file", file);
            return cuerpo;
          })(),
          reintentos: 0,
          tiempoMaximo: 60_000,
        });
        ok += 1;
      } catch (error) {
        // El servidor dice el motivo exacto: formato no admitido,
        // demasiado grande o límite de subidas alcanzado.
        const motivo =
          error instanceof ErrorPeticion
            ? error.message
            : `Error de red con ${file.name}`;
        toast.error(`${file.name}: ${motivo}`);
      }
    }
    setUploading(0);
    if (ok > 0) {
      toast.success(
        ok === 1 ? "Imagen publicada en la galería" : `${ok} imágenes publicadas`,
      );
      await load();
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void uploadFiles(e.dataTransfer.files);
  };

  const copyPath = async (imagePath: string) => {
    try {
      await navigator.clipboard.writeText(imagePath);
      setCopied(imagePath);
      toast.success("Ruta copiada", { description: imagePath });
      setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.info("Ruta de la imagen", { description: imagePath });
    }
  };

  const removeImage = async (image: GalleryImage) => {
    if (!window.confirm(`¿Borrar «${image.name}» de la galería?`)) return;
    setDeleting(image.name);
    try {
      // `encodeURIComponent` evita que un nombre con caracteres raros
      // rompa la URL. El servidor valida el nombre de nuevo por su
      // cuenta, porque el cliente nunca es de fiar.
      await peticionJson(`/api/uploads/${encodeURIComponent(image.name)}`, {
        method: "DELETE",
        reintentos: 0,
      });
      toast.success("Imagen retirada");
      await load();
    } catch (error) {
      // Caso habitual: 409 porque algún producto sigue usando la foto.
      // Ese aviso concreto es mucho más útil que un "no se pudo".
      toast.error(
        error instanceof ErrorPeticion ? error.message : "No se pudo borrar",
      );
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-baseline gap-3 font-display text-2xl">
          Galería
          <span className="font-mono text-sm text-fog">{images.length}</span>
        </h2>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 rounded-full border border-ember/50 bg-ember/10 px-5 py-2.5 text-sm text-ember transition-colors hover:bg-ember hover:text-ink"
        >
          <CloudUpload className="h-4 w-4" />
          Subir imágenes
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          hidden
          onChange={(e) => {
            void uploadFiles(e.target.files ?? []);
            e.target.value = "";
          }}
        />
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "mt-5 cursor-pointer rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging
            ? "border-ember bg-ember/10"
            : "border-line bg-panel/30 hover:border-ember/40",
        )}
      >
        <p className="flex items-center justify-center gap-3 text-sm text-fog">
          {uploading > 0 ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-ember" />
              Publicando {uploading} {uploading === 1 ? "imagen…" : "imágenes…"}
            </>
          ) : (
            <>
              <CloudUpload className="h-4 w-4 text-ember" />
              Arrastra fotos aquí o haz clic para elegirlas · jpg / png / webp ·
              hasta 6 MB
            </>
          )}
        </p>
      </div>

      {/* Rejilla */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 pt-6 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] animate-pulse rounded-2xl border border-line bg-panel/40"
            />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-line bg-panel/40 py-16 text-center">
          <Images className="h-6 w-6 text-fog" />
          <p className="text-sm text-fog">La galería está vacía: sube tu primera fotografía.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 pt-6 md:grid-cols-4">
          <AnimatePresence initial={false}>
            {images.map((image) => (
              <motion.figure
                key={image.path}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative overflow-hidden rounded-2xl border border-line bg-panel/40"
              >
                <div className="aspect-[4/3] w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.path.replace(
                      "/img/products/",
                      "/media/products/",
                    )}
                    onError={(e) => {
                      // Si el alias no responde (build antiguo), vuelve a /img
                      const el = e.currentTarget;
                      if (!el.dataset.fallback) {
                        el.dataset.fallback = "1";
                        el.src = image.path;
                      }
                    }}
                    alt={image.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <figcaption className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="truncate font-mono text-[10px] text-fog">
                    {image.name}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-fog/60">
                    {image.sizeKb} KB
                  </span>
                </figcaption>
                <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-ember backdrop-blur">
                  {image.folder}
                </span>

                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/60 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
                  <button
                    onClick={() => copyPath(image.path)}
                    aria-label={`Copiar ruta de ${image.name}`}
                    className="grid h-10 w-10 place-items-center rounded-full border border-cream/30 bg-ink/70 text-cream transition-colors hover:border-ember hover:text-ember"
                  >
                    {copied === image.path ? (
                      <Check className="h-4 w-4 text-ember" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  {image.folder === "products" && (
                    <button
                      onClick={() => removeImage(image)}
                      disabled={deleting === image.name}
                      aria-label={`Borrar ${image.name}`}
                      className="grid h-10 w-10 place-items-center rounded-full border border-cream/30 bg-ink/70 text-cream transition-colors hover:border-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      {deleting === image.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </motion.figure>
            ))}
          </AnimatePresence>
        </div>
      )}

      <p className="mt-5 text-xs leading-relaxed text-fog/70">
        Las imágenes subidas aterrizan en{" "}
        <code className="font-mono text-ember/80">public/img/products/</code> y
        quedan disponibles enseguida en el selector «Fotografía» del formulario
        de instrumentos. Una imagen solo se puede borrar si ningún instrumento
        la está usando.
      </p>
    </div>
  );
}
