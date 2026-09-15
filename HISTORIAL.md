# Historial de mejoras · JPR Music Shop

Registro de todo lo que se va cambiando en el proyecto, en orden cronológico
inverso (lo más reciente arriba).

**Cómo usar este archivo:** cada vez que se haga una mejora, se añade una
entrada nueva arriba del todo siguiendo la misma plantilla. La idea es poder
responder de un vistazo a «¿cuándo cambió esto y por qué?» sin tener que
bucear en el historial de git.

**Leyenda de etiquetas**

| Etiqueta | Significado |
|---|---|
| 🔒 Seguridad | Cierra una vulnerabilidad |
| 🐛 Corrección | Arregla algo que estaba roto |
| ⚡ Rendimiento | La web va más rápida o consume menos |
| ♿ Accesibilidad | Mejora el uso con teclado o lector de pantalla |
| 🏗️ Arquitectura | Reordena el código sin cambiar lo que hace |
| 📄 Documentación | Solo afecta a textos y documentos |
| ⚙️ Configuración | Entorno, dependencias, herramientas |

---

## 2026-09-15 · Las animaciones vuelven a verse siempre

**Commit:** pendiente · **Tipo:** 🐛 Corrección · 📄 Documentación

### Qué se reportó

Las cintas de texto en bucle (la del manifiesto y la del pie) se habían
quedado congeladas, y los contadores de cifras — años de garantía,
instrumentos vendidos — mostraban **0** en lugar del número real.

### Por qué pasaba

Fue un fallo introducido el día anterior, al añadir accesibilidad. Se metió
esta regla en `globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-iteration-count: 1 !important; }
}
```

El selector `*` no distingue: alcanzaba **todos** los elementos. Las
marquesinas usan una animación infinita que desliza la cinta de
`translateX(0)` a `translateX(-50%)`; al forzarles una sola repetición de
0,01 ms, se quedaban clavadas en el fotograma final, o sea paradas **y**
descolocadas medio ancho a la izquierda.

Los contadores fallaban por otra vía distinta: `framer-motion` respeta esa
preferencia por su cuenta, así que la cuenta ascendente nunca arrancaba y el
número se quedaba en su valor inicial, 0. Ese era el más grave de los dos
síntomas, porque no era un efecto perdido sino **un dato incorrecto en
pantalla**.

El primer intento de arreglo dejó las marquesinas girando pero tres veces más
lentas. No fue suficiente: el propietario pidió que la web se vea **igual en
todos los equipos**, con la opción del sistema activada o no.

### Qué se cambió

| Archivo | Cambio |
|---|---|
| `src/app/globals.css` | Eliminado el bloque `@media (prefers-reduced-motion: reduce)` completo. En su lugar queda un comentario que explica la decisión y **deja el bloque escrito listo para pegar** si algún día se quiere revertir |
| `src/components/bits/CountUp.tsx` | Ya no consulta la preferencia: la cuenta ascendente se ejecuta siempre |
| `src/components/site/Providers.tsx` | El desplazamiento suave (Lenis) se inicializa siempre; `useLenis()` se queda sin parámetros |
| `src/lib/accesibilidad.ts` | `useMovimientoReducido` se conserva pero **sin uso**, con un aviso explicando por qué sigue ahí |

### Lo que hay que saber

Esta es una **decisión de producto consciente**, no un descuido, y conviene
tenerla por escrito:

El criterio **WCAG 2.3.3** («Animación a partir de interacciones») es de nivel
**AAA** — el más exigente, y no obligatorio en la mayoría de marcos legales.
Al ignorar la preferencia del sistema, un visitante con trastorno vestibular o
migraña fotosensible verá el movimiento igualmente.

Se decidió así porque la identidad visual del proyecto descansa en esas
animaciones. **El resto de mejoras de accesibilidad siguen intactas**: el
enlace de salto al contenido, el foco visible, el carrito manejable con
teclado y las etiquetas para lector de pantalla no se han tocado.

Revertirlo es barato: volver a pegar el bloque `@media` que quedó documentado
en `globals.css`. No hace falta tocar ningún componente.

---

## 2026-09-15 · ZIP descargable y contraseña fuera del repositorio

**Commit:** `02983e1` · **Tipo:** 🔒 Seguridad · ⚙️ Configuración

### Qué se cambió

Se añadió `MusicShop-mejorado.zip` al repositorio para poder descargar el
proyecto completo desde GitHub.

Al revisar el contenido antes de subirlo — control que se hace siempre antes
de publicar en un repositorio **público** — apareció una fuga:

```json
// drizzle.config.json
"url": "postgresql://shop:<CONTRASEÑA>@127.0.0.1:5432/musicshop"
```

La contraseña de la base de datos estaba escrita dentro del archivo, y **ya
estaba publicada** desde el commit anterior.

La causa de fondo: un archivo `.json` no puede leer variables de entorno, así
que el secreto no tenía más remedio que vivir dentro.

### Solución

`drizzle.config.json` → **`drizzle.config.ts`**, que lee
`process.env.DATABASE_URL` y falla con un mensaje claro si falta.

### Pendiente

La contraseña de desarrollo sigue en el historial de git (commit `295b993`).
Es la de desarrollo local, no de producción, pero **conviene rotarla si esa
misma cadena se reutiliza en otro sitio**. Borrarla del historial exigiría
reescribirlo, cosa que no se ha hecho.

---

## 2026-09-14 · Auditoría de seguridad y preparación para producción

**Commit:** `295b993` · **Tipo:** 🔒 Seguridad · ⚡ Rendimiento · ♿ Accesibilidad · 🏗️ Arquitectura

La intervención grande. Informe completo en
[`docs/INFORME-FINAL.md`](./docs/INFORME-FINAL.md) y diagnóstico previo en
[`docs/AUDITORIA.md`](./docs/AUDITORIA.md).

### Resumen

| Indicador | Antes | Después |
|---|---|---|
| Vulnerabilidades críticas | 5 | 0 |
| Vulnerabilidades altas | 9 | 0 |
| `npm audit` | 7 (1 crítica, 2 altas) | 4 moderadas, solo desarrollo |
| Errores de TypeScript | — | 0 |
| Avisos de ESLint | 32 | 5 (heredados, documentados) |

### Los cinco fallos críticos

| # | Problema | Estado |
|---|---|---|
| C-1 | Contraseñas con scrypt y **sal reutilizada**, comparadas con `===` | Argon2id, con migración transparente al primer acceso |
| C-2 | **Cookie de sesión sin firmar**: bastaba editarla para ser administrador | Firmada con HMAC-SHA256 |
| C-3 | **Condición de carrera en el stock**: 8 pedidos simultáneos sobre 1 unidad dejaban el stock en **−3** | Transacción con `SELECT ... FOR UPDATE`. Verificado: 1 pedido, stock 0, 7 rechazos |
| C-4 | **Subida sin validar**: un PHP renombrado a `.jpg` se guardaba y devolvía `201` | Validación por firma binaria. Ahora devuelve `400` |
| C-5 | **Credenciales `admin`/`admin`** escritas en el código y visibles en pantalla | Eliminadas. Contraseña aleatoria mostrada una sola vez |

### Los nueve altos

CSRF sin protección · sin límite de intentos de acceso · IDOR en pedidos
(cualquiera leía los datos de todos) · asignación masiva (`"role":"admin"` al
registrarse) · sin cabeceras de seguridad · errores con traza técnica ·
validación solo en el navegador · redirección abierta · recorrido de rutas.

Todos verificados **atacando la aplicación en marcha**, no solo leyendo código.

### Base de datos

7 restricciones `CHECK` y 13 índices. La restricción `stock >= 0` actúa como
última línea de defensa: aunque un fallo futuro de la aplicación lo intentara,
PostgreSQL lo rechaza.

### Rendimiento

Siembra movida al arranque (antes se comprobaba en **cada lectura**) ·
paginación real (antes se enviaba la tabla entera) · galería en 3 lecturas
paralelas · caché inmutable en imágenes · pool de conexiones configurado.

### Accesibilidad

Enlace «Saltar al contenido» · foco visible con `:focus-visible` · el carrito
pasa a ser un diálogo modal de verdad (atrapa el foco, cierra con `Escape`,
devuelve el foco al botón) · el fondo oscurecido pasa de `<div onClick>` a
`<button>` accesible con teclado.

> Parte de este bloque se revirtió el 15/09 a petición del propietario: ver la
> entrada de arriba. **Lo que se revirtió es únicamente lo relativo a
> `prefers-reduced-motion`**; el resto sigue en pie.

### Arquitectura

`AdminDashboard.tsx` pasa de **831 a 649 líneas**, con la lógica de estado y
red movida a `useGestionCatalogo.ts` · `middleware.ts` → `proxy.ts` (lo exige
Next 16) · eliminados los restos de Vite (`index.html`, `vite.config.js`).

### Dependencias

**Añadidas:** `@node-rs/argon2`, `zod`, `server-only`.
**Actualizada:** `next` 16.2.6 → 16.3.5, que cerraba **11 avisos de
seguridad** (ejecución remota vía AVIF, SSRF, elusión del middleware…).

### Detalle a recordar

Los hooks conservan el prefijo inglés `use` (`useFocoModal`,
`useGestionCatalogo`) aunque el resto del proyecto esté en castellano. React
identifica los hooks **por ese prefijo**: con `usar...` aparecieron 25 errores
de `rules-of-hooks` y el compilador dejó de optimizarlos.

---

## 2026-09-14 · Auditoría inicial (solo diagnóstico)

**Tipo:** 📄 Documentación

Primera fase: revisar el proyecto entero **sin tocar una línea de código**,
clasificando cada problema por gravedad y explicando el porqué antes de
proponer arreglos.

Resultado en [`docs/AUDITORIA.md`](./docs/AUDITORIA.md): 5 críticos, 9 altos y
el resto de niveles medio y bajo. Los críticos C-3 (venta por encima del
stock) y C-4 (subida maliciosa) se confirmaron **explotándolos** contra la
aplicación, no por lectura del código.

---

## Plantilla para entradas nuevas

```markdown
## AAAA-MM-DD · Título corto y claro

**Commit:** `xxxxxxx` · **Tipo:** [etiquetas]

### Qué se cambió
(Qué se tocó, en lenguaje llano.)

### Por qué
(Qué problema resolvía. Si viene de un fallo reportado, describir el síntoma.)

### Archivos afectados
| Archivo | Cambio |
|---|---|

### Riesgos o cosas a tener en cuenta
(Qué podría romperse, qué queda pendiente, cómo revertirlo.)
```
