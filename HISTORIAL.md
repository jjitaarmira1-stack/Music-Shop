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
| 🎯 Uso | Mejora la experiencia de quien usa la web |
| ⚙️ Configuración | Entorno, dependencias, herramientas |

---

## 2026-09-16 · El build caía con una DATABASE_URL mal copiada

**Commit:** pendiente · **Tipo:** 🐛 Corrección

### El síntoma

```
• DATABASE_URL: DATABASE_URL debe empezar por postgres:// o postgresql://
La compilación continúa con valores de relleno...
Error: Failed to collect configuration for /api/auth/logout
  at src/lib/env.ts:142
Build failed
```

Llamativo: el aviso decía «la compilación continúa» y acto seguido se caía.

### Dos causas a la vez

**1. Un fallo mío en la red de seguridad.** La entrega anterior hizo que
compilar no necesitara base de datos, pero el relleno estaba escrito así:

```ts
DATABASE_URL: process.env.DATABASE_URL || RELLENO.DATABASE_URL
```

`||` solo sustituye cuando el valor **falta**. Si existe pero es **inválido**,
lo conserva, y el `.parse()` siguiente —sin `safe`— lanzaba la excepción que
tumbaba el build. Cubrí el caso «no está» y olvidé el caso «está mal».

Ahora se descarta cualquier campo que no pase la validación, falte o esté mal
escrito, y si aun así fallara se recurre a la configuración mínima. Compilar
no puede depender de que las variables de producción sean correctas.

**2. El valor estaba mal copiado** en el panel de Netlify: la cadena llevaba
comillas alrededor. En un archivo `.env` las comillas se admiten, pero en el
panel de un proveedor el valor se toma literal, comillas incluidas, y entonces
no empieza por `postgresql://` aunque a simple vista lo parezca.

### El arreglo

Además de corregir el fallo, ahora las variables se **limpian antes de
validarse**: se quitan espacios, saltos de línea, comillas envolventes y un
punto y coma final. Son los cuatro accidentes típicos al pegar una cadena, y
el error que provocan no menciona la causa real, así que cuesta mucho verlo.

Lo que **no** se toca es el contenido: una cadena mal escrita de verdad (por
ejemplo `mysql://`) se sigue rechazando.

### Comprobado

| Caso | Antes | Ahora |
|---|---|---|
| `"postgresql://..."` con comillas | ✗ build caía | ✔ se limpia y compila |
| Espacio o salto de línea delante | ✗ build caía | ✔ se limpia y compila |
| `psql://` mal escrito | ✗ build caía | ✔ avisa y compila |
| Comillas simples, punto y coma final | ✗ | ✔ se limpian |
| `mysql://` (inválida de verdad) | — | ✔ rechazada, como debe |
| Vacía o ausente | ✔ | ✔ |

Verificado con `next build` real usando la cadena entrecomillada: compila sin
un solo aviso. Con una irrecuperable, avisa pero ya no se cae.

### Archivos tocados

| Archivo | Qué cambió |
|---|---|
| `src/lib/env.ts` | El relleno cubre también valores inválidos; limpieza previa de las variables |

### Nota sobre el panel de Netlify

Al pegar valores en **Environment variables** no hay que poner comillas: el
valor se guarda tal cual se escribe. Es distinto de un archivo `.env`.

---

## 2026-09-15 · Conexión con Neon: guía y dos arreglos

**Commit:** pendiente · **Tipo:** 📄 Documentación · 🐛 Corrección

### Qué se pidió

Explicar paso a paso cómo conectar una base de datos de Neon con la tienda.

Al preparar la guía aparecieron dos fallos del código que habrían hecho
fracasar la conexión, así que se arreglan también.

### Arreglo 1 · El cifrado dependía de NODE_ENV

El pool activaba TLS solo si `NODE_ENV` era `production`:

```ts
ssl: CONFIG.esProduccion ? { rejectUnauthorized: false } : undefined
```

Eso falla en un caso muy normal: conectarse **desde tu ordenador** a la base
de datos en la nube, que es justo lo que hay que hacer para crear las tablas
(`npx drizzle-kit push`). En local `NODE_ENV` no es `production`, así que el
cifrado quedaba desactivado y Neon rechazaba la conexión.

Ahora se decide por la **cadena de conexión**, que es de donde viene la
información correcta: se cifra si la cadena lleva `sslmode=require` o si el
servidor no es local. Un PostgreSQL en tu propia máquina sigue sin cifrado.

Comprobado con cinco cadenas distintas (local, Neon con y sin `-pooler`,
Supabase y local con `sslmode=disable`): las cinco aciertan.

### Arreglo 2 · DB_POOL_MAX era una variable fantasma

Estaba documentada en `.env.example` pero **el código nunca la leía**: el
tamaño del pool estaba fijado a 10 y ajustarla no servía de nada.

Ahora se lee, y además el valor por defecto se adapta al alojamiento:

| Dónde | Conexiones | Por qué |
|---|---|---|
| Servidor normal (VPS, Railway) | 10 | Un solo proceso reutiliza conexiones |
| Netlify / Vercel | 3 | Cada instancia abre su propio pool |

En alojamiento efímero, además, el mínimo baja a 0: mantener una conexión
abierta en una instancia que va a morir en segundos solo ocupa un hueco.

Sin este ajuste, con algo de tráfico en Netlify se agotarían las conexiones
disponibles de la base de datos.

### Lo que hay que saber de Neon

**Neon da dos cadenas de conexión para la misma base, y cada una sirve para
una cosa distinta.** Confundirlas es el error más común:

| Cadena | Se distingue por | Para qué |
|---|---|---|
| Agrupada | Lleva `-pooler` | La tienda funcionando (va en Netlify) |
| Directa | No lleva `-pooler` | Crear las tablas con `drizzle-kit push` |

Usar la agrupada para crear tablas falla con errores que no mencionan el
motivo real, del tipo `prepared statement "s1" already exists`.

### Archivos tocados

| Archivo | Qué cambió |
|---|---|
| `src/db/index.ts` | TLS según la cadena, no según NODE_ENV; pool configurable |
| `src/lib/env.ts` | `DB_POOL_MAX` ya se lee, con valor por defecto según el alojamiento |
| `NEON.md` | **Nuevo.** Guía paso a paso |

### Cómo se comprobó

1. Cinco cadenas de conexión distintas: el cifrado se activa donde debe.
2. Cuatro escenarios de alojamiento: el pool se dimensiona correctamente.
3. La aplicación local sigue funcionando: portada, login y panel en 200, y
   `/api/health` informa de la base activa sin cifrado, que es lo correcto
   contra un PostgreSQL local.

---

## 2026-09-15 · Preparar el despliegue en Netlify

**Commit:** pendiente · **Tipo:** ⚙️ Configuración · 🐛 Corrección

### El síntoma

La compilación en Netlify fallaba antes de terminar:

```
DATABASE_URL: DATABASE_URL es obligatoria
  at src/lib/env.ts
  recopilando datos de la página /api/auth/logout
```

### La causa

`src/lib/env.ts` valida las variables de entorno **en el momento de
importarse**, y si falta alguna lanza un error. Es lo correcto al arrancar el
servidor: mejor fallar enseguida que a mitad de la petición de un cliente.

El problema es que durante `next build` Next importa cada ruta para
analizarla, así que ese error se disparaba **mientras se compilaba**.

Y compilar no necesita base de datos: son dos momentos distintos. Se compila
en el servidor de Netlify, y la aplicación se ejecuta después, con las
variables de producción ya puestas. Se estaba exigiendo una conexión en el
momento equivocado.

### El arreglo

`env.ts` distingue ahora las dos fases mediante `NEXT_PHASE`, que Next define
automáticamente:

| Momento | Comportamiento |
|---|---|
| Compilando | Avisa en el registro y continúa con valores de relleno |
| Ejecutando | Aborta si falta algo, como antes |

**No se ha relajado la seguridad.** Los valores de relleno solo existen
mientras se compila y nunca llegan a producción: en cuanto la aplicación
arranca de verdad, la validación vuelve a ser estricta. Comprobadas las cuatro
combinaciones (compilar sin variables, ejecutar sin variables, ejecutar con
ellas, y con una `DATABASE_URL` malformada).

### Tres problemas más que habrían roto el despliegue

El error de compilación era solo el primero. Los otros tres no dan error: se
manifiestan cuando la tienda ya está publicada, que es peor.

**1. No habrías podido entrar a tu propia tienda.**

En producción hay que poner `SEED_DEMO_DATA=false`, para no llenar el catálogo
de instrumentos de ejemplo. Pero esa misma variable controlaba también la
creación de la cuenta de administración. Resultado: base de datos sin ningún
usuario y sin forma de acceder al panel, salvo creándolo a mano por SQL.

Ahora son dos cosas separadas. El administrador se crea **siempre** que la
tabla de usuarios esté vacía; el catálogo de ejemplo sigue siendo opcional.

**2. Las imágenes subidas se perderían.**

Netlify no tiene disco permanente: cada petición puede atenderla una instancia
nueva y vacía. Una imagen subida dura unos minutos y desaparece. Es cómo
funciona la plataforma, no un fallo del código.

No se puede arreglar sin añadir un servicio externo, así que se hacen dos
cosas: detectar el alojamiento y escribir en `/tmp` (el único sitio donde se
puede escribir, evitando un error de permisos al subir), y avisarlo en el
registro al arrancar. Las imágenes del catálogo que trae el proyecto sí
funcionan siempre, porque viajan dentro del despliegue.

**3. El limitador de intentos es menos estricto de lo configurado.**

El contador vive en la memoria de cada instancia. Con varias activas, cada una
lleva su propia cuenta y el límite real se multiplica. Sigue protegiendo, pero
menos. Resolverlo exigiría Redis. Queda avisado en el registro.

### Archivos tocados

| Archivo | Qué cambió |
|---|---|
| `src/lib/env.ts` | Distingue compilación de ejecución; detecta alojamiento efímero |
| `src/db/seed.ts` | El administrador se crea siempre, aunque la demo esté desactivada |
| `src/lib/almacenamiento.ts` | Usa `/tmp` donde el disco del proyecto es de sólo lectura |
| `src/instrumentation.ts` | Avisa al arrancar de las limitaciones de la plataforma |
| `netlify.toml` | **Nuevo.** Orden de compilación, versión de Node y plugin de Next |
| `DESPLIEGUE.md` | **Nuevo.** Guía paso a paso |
| `.env.example` | Avisos sobre qué cambia en alojamiento gestionado |

### Cómo se comprobó

1. `next build` **sin ninguna variable de entorno**, como hace Netlify: la
   compilación termina con las 23 rutas y el aviso visible en el registro.
2. Las cuatro combinaciones de validación, ya descritas.
3. Arranque real con `SEED_DEMO_DATA=false`: se crea la cuenta de
   administración y el catálogo queda vacío, que es justo lo que se quería.
4. Login con esas credenciales → 200; `/admin` y `/api/users` → 200.
5. La portada y `/api/products` responden bien con el catálogo vacío.

### Qué tienes que hacer tú

Está detallado en `DESPLIEGUE.md`. Resumen:

1. Crear una base de datos PostgreSQL (Neon, Supabase o Railway; hay plan
   gratuito). Netlify no incluye ninguna.
2. En **Site configuration → Environment variables** añadir `DATABASE_URL`,
   `SESSION_SECRET`, `APP_ENV=production`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
3. Ejecutar `npx drizzle-kit push` una vez contra esa base, para crear las
   tablas.
4. Desplegar.

---

## 2026-09-15 · Imágenes del catálogo con error 404

**Commit:** pendiente · **Tipo:** 🐛 Corrección

### El síntoma

```
GET /media/products/bateria.jpg 404
⨯ The requested resource isn't a valid image for
  /media/products/bateria.jpg received null
```

### La causa

La aplicación tiene **dos orígenes distintos** de imágenes, y se estaban
confundiendo:

| Ruta | De dónde salen | Cómo se sirven |
|---|---|---|
| `/img/products/…` | Las que trae el proyecto, en `public/img/products` | Next, como estáticos |
| `/media/products/…` | Las que sube el administrador, en `var/uploads` | Un handler propio que lee el disco |

Están separadas a propósito: las subidas viven **fuera** de `public/` para que
pasen por un control que comprueba su contenido real antes de entregarlas.

El problema estaba en `AnimatedImage.tsx`, que reescribía toda ruta
`/img/products/…` como `/media/products/…` antes de pintarla, dando por hecho
que la segunda servía también el catálogo. No lo hace: allí solo hay subidas.
Resultado, `bateria.jpg` se pedía a una carpeta donde nunca estuvo → 404, y
Next añadía su propio aviso al recibir `null` en vez de una imagen.

Había un `onError` que devolvía la ruta buena, así que **la imagen acababa
viéndose**. Por eso pasó desapercibido: el fallo se notaba en la consola y en
un parpadeo al cargar, no en la pantalla. Pero cada imagen se pedía dos veces,
la primera para nada.

El mismo error estaba copiado en otros dos sitios: la previsualización del
formulario de instrumentos y las miniaturas de la galería.

### El arreglo

**1. No se reescriben las rutas.** Las tres reescrituras se han quitado. La
ruta que llega ya es la correcta: la base de datos y `/api/uploads` guardan
cada imagen con el prefijo que le toca. Al no haber 404, sobran también los
`onError` de respaldo.

**2. Red de seguridad en `/media/products/`.** Si el archivo no está entre las
subidas, ahora se busca también en el catálogo antes de devolver 404. Esto
cubre las instalaciones que ya tuvieran alguna ruta mal guardada en su base de
datos por culpa del fallo anterior.

Es seguro: el respaldo vuelve a pasar por `resolverRutaSegura`, que valida el
nombre y confirma que la ruta resultante no se sale de la carpeta permitida.
Comprobado que los intentos de path traversal siguen rechazándose.

### Cómo se comprobó

| Prueba | Antes | Ahora |
|---|---|---|
| `/media/products/bateria.jpg` | 404 | 200 · image/jpeg |
| `/img/products/bateria.jpg` | 200 | 200 |
| Las 8 imágenes del catálogo, por ambas rutas | mitad en 404 | todas 200 |
| Subir → servir → listar → borrar una imagen | — | correcto |
| `/media/products/..%2f..%2fpackage.json` | rechazado | rechazado |
| Imagen inexistente | 404 | 404 |

Repasadas `/`, `/login`, `/cuenta` y `/admin`: todas 200.

### Archivos tocados

| Archivo | Qué cambió |
|---|---|
| `src/components/bits/AnimatedImage.tsx` | Ya no reescribe la ruta; fuera el `onError` y el estado que sobraban |
| `src/components/admin/AdminDashboard.tsx` | Previsualización del formulario, sin reescritura |
| `src/components/admin/GalleryManager.tsx` | Miniaturas de la galería, sin reescritura |
| `src/app/media/products/[name]/route.ts` | Respaldo al catálogo antes de dar 404 |

### Al actualizar

Nada que ejecutar. Esta entrega no toca la base de datos.

---

## 2026-09-15 · El login fallaba tras actualizar (migración sin aplicar)

**Commit:** pendiente · **Tipo:** 🐛 Corrección · ⚙️ Configuración

### El síntoma

Después de bajarse la entrega anterior, el inicio de sesión devolvía un error
500 con este volcado en la consola:

```
POST /api/auth/login 500
Error: Failed query: select "id", "name", "email", "password_hash",
"role", "sessions_valid_from", "created_at" from "users" ...
[cause]: error: no existe la columna «sessions_valid_from»
```

### La causa

Ninguna sorpresa, pero sí un fallo de entrega por mi parte: la entrega
anterior añadió la columna `sessions_valid_from` a la tabla `users` para poder
cerrar las sesiones al cambiar un rol o una contraseña. Esa columna estaba en
el código, pero **la base de datos no se había actualizado**, porque hacerlo
requiere ejecutar `npx drizzle-kit push` a mano.

El código pedía una columna que no existía y PostgreSQL respondía con el error
42703 («no existe la columna»). Como la consulta del login es la primera que
toca la tabla `users`, el fallo se manifestaba justo al intentar entrar.

El aviso estaba escrito en el historial, pero **depender de que alguien lea una
nota no es un mecanismo**. El arreglo va en tres capas para que no vuelva a
ocurrir.

### Capa 1 · El error ahora dice qué hacer

`manejarError` reconoce los códigos de PostgreSQL que delatan un desajuste
entre el código y la base de datos (`42703` columna inexistente, `42P01` tabla
inexistente, `42704` objeto inexistente) y responde con una instrucción
concreta en lugar de un volcado de SQL:

> La base de datos está desactualizada: le falta alguna columna que el código
> ya usa. Ejecuta «npx drizzle-kit push» para aplicar los cambios pendientes
> del esquema.

El error real viene envuelto por Drizzle, así que se mira también dentro de
`cause`, que es donde queda el error original del driver.

En producción se sigue devolviendo el mensaje genérico de siempre con su
número de incidencia: el detalle solo se muestra en desarrollo.

### Capa 2 · Aviso automático al arrancar

Nuevo script `scripts/comprobar-esquema.mjs`, enganchado a `npm run dev`
mediante `predev`. Antes de levantar el servidor consulta qué columnas existen
de verdad y, si falta alguna, imprime un aviso en rojo imposible de pasar por
alto con la orden exacta que hay que ejecutar.

No detiene el arranque a propósito: solo informa. Bloquear `npm run dev` sería
más molesto que útil, y tampoco falla si la base de datos aún no responde
(caso típico al levantar todo con Docker).

Cuando se añada una columna nueva al esquema, se apunta en la lista
`COLUMNAS_ESPERADAS` del script.

### Capa 3 · Atajos en package.json

| Orden | Qué hace |
|---|---|
| `npm run db:check` | Comprueba si falta alguna columna |
| `npm run db:push` | Aplica los cambios del esquema |

### Qué tienes que hacer al bajarte esta entrega

```
npm run db:push
```

Es seguro: la columna tiene valor por defecto, no se pierde ningún dato y
nadie pierde su sesión.

### Cómo se comprobó

1. Se borró la columna de la base de datos local para reproducir el fallo
   exacto: login → 500 con el volcado de SQL. Reproducido.
2. Con la capa 1 aplicada, el mismo fallo devuelve ya el mensaje que explica
   la solución.
3. `npm run db:check` detecta la columna que falta y la nombra.
4. Tras `npm run db:push`, el login responde 200 y el comprobador dice que la
   base de datos está al día.
5. Repasadas las rutas `/`, `/login`, `/cuenta`, `/admin` y las APIs de
   productos, sesión, cuentas y salud: todas 200.

### Archivos tocados

| Archivo | Qué cambió |
|---|---|
| `src/lib/errores.ts` | Detecta errores de esquema y responde con la instrucción concreta |
| `scripts/comprobar-esquema.mjs` | **Nuevo.** Aviso al arrancar si falta alguna columna |
| `package.json` | `predev`, `db:check` y `db:push` |

---

## 2026-09-15 · Gráficas en el panel y gestión de cuentas

**Commit:** pendiente · **Tipo:** 🎯 Uso · 🔒 Seguridad

### Qué se pidió

Dos cosas: ver el recuento de los datos importantes en gráficas dentro del
panel de administración, y poder gestionar las cuentas de las personas
usuarias (restablecer su contraseña de forma segura y cambiarles el rol).

### 1. Gráficas del resumen

En la pestaña **Resumen** hay ahora un bloque «Cómo va la tienda» con cuatro
paneles:

| Panel | Qué enseña |
|---|---|
| Ingresos por día | Área con los últimos 30 días, sin contar cancelados |
| Pedidos por estado | Barras con el reparto entre pendiente, pagado, enviado, entregado y cancelado |
| Catálogo por familia | Cuántos instrumentos hay en cada una de las cinco familias |
| Reposición y éxitos | Los 5 productos con menos existencias y los 5 más vendidos |

**Sin librería de gráficas.** Recharts o Chart.js habrían añadido entre 100 y
200 KB al paquete que descarga el navegador en cada visita al panel. Para
cuatro gráficas sencillas no compensa: se dibujan con SVG nativo, que pesa
cero, se adapta solo a cualquier pantalla y usa los colores de la marca.

**Los cálculos se hacen en PostgreSQL, no en JavaScript.** Traerse todos los
pedidos al servidor para agruparlos allí funciona con 50 filas y se cae con
50.000. Las consultas usan `group by` y `date_trunc`, y devuelven una decena
de filas ya resumidas. Las cinco consultas van en paralelo.

**Detalle de los días vacíos:** la consulta solo devuelve los días en los que
hubo pedidos. Si se dibujara tal cual, una semana sin ventas se vería como una
línea recta engañosa entre dos puntos lejanos. Se rellenan los 30 días con
ceros antes de dibujar.

### 2. Pestaña «Cuentas»

Nueva pestaña en el panel con la lista de personas registradas: nombre,
correo, rol, fecha de alta y número de pedidos. Hay buscador por nombre o
correo. Dos acciones por fila:

- **Cambiar el rol** (cliente ↔ administrador)
- **Restablecer la contraseña**

Ambas piden confirmación en un diálogo que explica exactamente qué va a
ocurrir, no un «¿estás seguro?» genérico.

**Cómo se restablece la contraseña.** La genera el servidor al azar (18 bytes
aleatorios) y se muestra **una sola vez** en pantalla, con un botón para
copiarla. No se guarda en claro en ningún sitio: en la base de datos solo
queda su hash Argon2id, y en los registros no aparece nunca.

¿Por qué no la escribe el administrador? Porque tendería a poner algo
memorizable y, sobre todo, porque la conocería de antemano y podría entrar en
la cuenta ajena sin dejar rastro. Generada al azar y mostrada una vez, quien
la recibe puede cambiarla y el administrador no se la queda.

Lo ideal de verdad sería mandar un enlace de un solo uso por correo, pero eso
exige un servicio de email que el proyecto todavía no tiene. Esta es la mejor
opción disponible sin añadir infraestructura.

### 3. El problema de seguridad que había que resolver antes

Las sesiones de esta aplicación son **autocontenidas**: los datos de la
persona (incluido su rol) viajan firmados dentro de la cookie y el servidor no
guarda ninguna lista de sesiones activas. Es rápido, pero tenía una
consecuencia grave en cuanto se añade la gestión de cuentas:

> Si un administrador bajaba de rol a alguien, esa persona **seguiría
> entrando al panel durante 7 días**, porque su cookie ya emitida llevaba
> dentro el rol antiguo y era perfectamente válida. Lo mismo al restablecer
> una contraseña: si la cuenta estaba comprometida, el intruso se quedaba
> dentro con su cookie.

**Solución:** una columna nueva en `users`, `sessions_valid_from`. Al cambiar
un rol o una contraseña se pone la fecha actual, y cualquier cookie emitida
antes de ese instante se rechaza al validarla. Es un «cerrar sesión en todos
los dispositivos» que cuesta una sola columna, sin montar una tabla de
sesiones.

El coste es una consulta por clave primaria en cada petición autenticada
(microsegundos, resuelta por índice único). Si la base de datos no responde,
se **deniega** la sesión en lugar de concederla: ante la duda, nunca se da
por buena.

### 4. Protecciones contra errores irreparables

| Situación | Qué pasa |
|---|---|
| Quitarte a ti mismo el rol de administrador | Bloqueado (409). Es el error más fácil de cometer y te deja fuera del panel |
| Degradar a la única cuenta de administración | Bloqueado (409). La tienda se quedaría sin nadie que la gestione |
| Mandar un rol inventado (`superadmin`) | Rechazado (422) antes de tocar la base de datos |
| Mandar campos de más (`passwordHash`) | Se ignoran: del cuerpo solo se lee `role` |
| Petición desde otro sitio web | Rechazada (403) por la comprobación de origen |
| Sin sesión / siendo cliente | 401 / 403 |

En la interfaz, los botones bloqueados se ven desactivados y explican en su
`title` **por qué** no se pueden pulsar, que si no resulta desconcertante.

### Archivos tocados

| Archivo | Qué cambió |
|---|---|
| `src/db/schema.ts` | Columna `sessions_valid_from` en `users`; excluida del tipo público |
| `src/lib/auth.ts` | `obtenerSesion` comprueba que la sesión no haya sido revocada |
| `src/servicios/usuarios.ts` | `listarUsuarios`, `cambiarRolUsuario`, `restablecerContrasenaUsuario`, `sesionSigueVigente` |
| `src/servicios/productos.ts` | `obtenerDatosGraficas` con las cinco consultas agregadas |
| `src/lib/validaciones.ts` | `esquemaCambiarRol` (lista cerrada de dos valores) |
| `src/lib/data.ts` | `getAdminCharts` |
| `src/app/admin/page.tsx` | Carga los datos de gráficas y pasa el correo del administrador |
| `src/app/api/users/route.ts` | **Nuevo.** Listado de cuentas |
| `src/app/api/users/[id]/rol/route.ts` | **Nuevo.** Cambio de rol |
| `src/app/api/users/[id]/contrasena/route.ts` | **Nuevo.** Restablecer contraseña |
| `src/components/admin/GraficasResumen.tsx` | **Nuevo.** Las cuatro gráficas en SVG |
| `src/components/admin/GestionUsuarios.tsx` | **Nuevo.** Tabla de cuentas y diálogos |
| `src/components/admin/AdminDashboard.tsx` | Pestaña «Cuentas» y bloque de gráficas |

### Al actualizar

Esta entrega **cambia la base de datos**. Después de bajar los cambios hay que
ejecutar:

```
npx drizzle-kit push
```

La columna nueva tiene valor por defecto, así que las cuentas existentes no se
ven afectadas y nadie pierde su sesión al aplicar el cambio.

### Cómo comprobarlo

1. Entra en `/admin`. En **Resumen** deben verse las cuatro gráficas.
2. Ve a la pestaña **Cuentas**: aparece la lista con el buscador.
3. Tu propia fila lleva la etiqueta «Tú» y tiene el cambio de rol desactivado.
4. Restablece la contraseña de una cuenta de prueba: sale el diálogo con la
   contraseña, y hay que marcar «Ya la he copiado» para poder cerrarlo.
5. Con la contraseña antigua ya no se puede entrar; con la nueva sí.
6. Si esa cuenta tenía la sesión abierta, queda cerrada al instante.

### Dependencias

Ninguna nueva. Las gráficas son SVG escrito a mano.

---

## 2026-09-15 · Error en el panel y clasificación guiada en dos pasos

**Commit:** pendiente · **Tipo:** 🐛 Corrección · 🎯 Uso

### El error

El panel de administración se caía al abrirse:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'replace')
    at AdminDashboard.tsx:604  →  src.replace("/img/products/", "")
```

### Por qué pasaba

Un fallo mío de la auditoría, de los que no salta hasta que alguien usa la
pantalla. Al traducir el código al castellano cambié también **los nombres de
los campos que devuelve la API**, pero sólo en una de las dos respuestas del
mismo endpoint:

| | Devolvía | El cliente leía |
|---|---|---|
| `GET /api/uploads` | `nombre`, `ruta`, `carpeta` | `name`, `path`, `folder` |
| `POST /api/uploads` | `name`, `path` | `name`, `path` ✔ |

El `GET` quedó en castellano y el `POST` en inglés: dos idiomas en la misma
API. El cliente pedía `img.path`, recibía `undefined`, y al llamar `.replace()`
sobre eso se caía **toda la pantalla de administración**, no sólo el selector.

### Qué se cambió

- **`src/app/api/uploads/route.ts`** — el `GET` vuelve a `name`/`path`/`folder`/
  `sizeKb`, igual que el `POST`.
- **`AdminDashboard.tsx` y `useGestionCatalogo.ts`** — `.filter(Boolean)` y
  `?? ""` como red de seguridad: si la API devolviera algo raro, se pierde una
  opción del desplegable en lugar de dejar al administrador sin panel.

**Regla que queda fijada:** los nombres de campo que cruzan la red se quedan en
inglés y no se traducen. Los comentarios, mensajes de error y nombres internos,
en castellano. Traducir un contrato público rompe a quien lo consume.

### Clasificación guiada en dos pasos

Los dos desplegables estaban sueltos entre el precio y el stock. Ahora forman
un bloque propio que se lee como **una decisión en dos pasos**:

```
┌─ Clasificación en el catálogo ─────────────────────┐
│  1. Familia          2. Tipo dentro de Cuerdas     │
│  [ Cuerdas    ▾ ]    [ Bajos              ▾ ]      │
│                                                     │
│  Se guardará en Cuerdas › Bajos                    │
└─────────────────────────────────────────────────────┘
```

- La etiqueta del segundo paso **nombra la familia elegida** («Tipo dentro de
  Cuerdas»), para que se entienda que depende de la primera.
- Una línea de confirmación muestra **dónde acabará el producto** antes de
  guardar, que es justo cuando sirve de algo.
- Sin clasificar, el campo se marca en ámbar tenue: es válido, pero se ve.
- La asignación es **manual**, decidida por quien da de alta el producto. Nada
  de adivinar por el nombre: un automatismo acabaría poniendo un bajo entre las
  guitarras, y corregirlo después cuesta más que elegirlo bien una vez.

### Comprobado

Panel abre sin errores · `GET /api/uploads` devuelve `name`/`path` · alta con
«Cuerdas › Bajos» → se guarda y aparece al filtrar · `tsc` limpio · lint sin
avisos nuevos.

---

## 2026-09-15 · Subcategorías en el catálogo

**Commit:** pendiente · **Tipo:** 🎯 Uso · 🏗️ Arquitectura

Primera mejora de **uso** (hasta ahora todo había sido seguridad).

### Qué se pidió

El catálogo solo tenía cinco grupos — Cuerdas, Teclas, Percusión, Viento,
Estudio — y dentro de cada uno estaba todo mezclado. Se pidió un segundo nivel:
Cuerdas › Guitarras, Bajos, Violines…

### Cómo quedó la clasificación

| Categoría | Subcategorías |
|---|---|
| **Cuerdas** | Guitarras eléctricas · Guitarras acústicas · Bajos · Violines y violas · Violonchelos y contrabajos · Arpas y otros |
| **Teclas** | Pianos digitales · Sintetizadores · Órganos · Controladores MIDI |
| **Percusión** | Baterías acústicas · Baterías electrónicas · Platillos · Percusión manual |
| **Viento** | Viento madera · Viento metal · Armónicas y otros |
| **Estudio** | Micrófonos · Monitores y auriculares · Interfaces de audio · Accesorios |

21 subcategorías en total.

### Decisiones de diseño

**Una sola fuente de verdad.** Toda la clasificación vive en
`src/lib/taxonomia.ts`. El filtro del catálogo, el formulario del panel, los
esquemas de Zod y la restricción de PostgreSQL beben de ahí. Añadir «ukeleles»
mañana es tocar un archivo, no cinco.

**El campo es opcional.** Un producto puede quedarse sin subcategoría. Si se
hubiera hecho obligatorio, los 8 productos que ya existían habrían dejado de
validar y el panel se habría bloqueado al editarlos.

**La subcategoría se reinicia al cambiar de categoría.** Si vienes de
Cuerdas › Bajos y pulsas Viento, quedaría el filtro «viento + bajos», que no
existe: verías una lista vacía sin entender por qué. Pasa igual en el
formulario del panel.

**Integridad en la base de datos, no solo en la aplicación.** Una restricción
`CHECK` impide guardar «viento + bajos» aunque alguien escriba directamente
por consola. Verificado: PostgreSQL lo rechaza, acepta las parejas correctas y
acepta `NULL`.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/lib/taxonomia.ts` | **Nuevo.** El árbol completo y las funciones de consulta |
| `src/db/schema.ts` | Columna `subcategory`, índice compuesto `(category, subcategory)` y `CHECK` de coherencia |
| `src/lib/validaciones.ts` | Esquema de subcategoría y validación cruzada con `superRefine` |
| `src/lib/utils.ts` | Reexporta desde la taxonomía; las importaciones antiguas siguen funcionando |
| `src/servicios/productos.ts` | Filtro por subcategoría y guardado del campo |
| `src/app/api/products/route.ts` | Acepta `?subcategory=` |
| `src/components/sections/Catalog.tsx` | Segunda fila de filtros, más discreta que la principal |
| `src/components/admin/AdminDashboard.tsx` | Selector dependiente y migas «Cuerdas › Bajos» en la lista |
| `src/components/admin/useGestionCatalogo.ts` | El campo en el estado del formulario |
| `src/db/seed.ts` | Los 8 productos de ejemplo ya vienen clasificados |

### Comprobado

Filtro de dos niveles (Cuerdas devuelve 4, Cuerdas › Bajos devuelve 1) ·
subcategoría inventada en la URL → `400` · crear producto con «viento + bajos»
→ rechazado con mensaje claro · PostgreSQL rechaza la pareja incoherente ·
acepta `NULL` · `tsc` sin errores · lint sin avisos nuevos.

### Cosas a tener en cuenta

- **Hay que ejecutar `npx drizzle-kit push`** tras actualizar: la tabla cambió.
- Los productos que ya tuvieras creados quedan **sin subcategoría** hasta que
  los edites. Siguen apareciendo con normalidad al filtrar por categoría.
- El filtro vive en el estado del componente, **no en la URL**. Por ahora no se
  puede compartir un enlace a «Cuerdas › Bajos» ni funciona el botón atrás del
  navegador. Es la primera mejora pendiente de esta serie.

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
