# Conectar Neon con la tienda · paso a paso

Guía completa para crear la base de datos en Neon y enlazarla con NOCTURNE.
Escrita para seguirse sin saber nada de bases de datos.

Tiempo aproximado: **15 minutos**.

---

## Antes de empezar

Neon es PostgreSQL alojado en internet. Tu tienda necesita una base de datos
para guardar productos, pedidos y cuentas, y Netlify no incluye ninguna.

El plan gratuito de Neon basta de sobra para esta tienda.

**Una cosa que conviene saber:** en el plan gratuito, si nadie visita la web
durante un rato, la base de datos se «duerme» para ahorrar recursos. Al
entrar alguien, tarda **uno o dos segundos** en despertar y luego va normal.
No es un fallo; si te molesta, el plan de pago lo evita.

---

## Paso 1 · Crear la cuenta

1. Entra en **neon.tech** y pulsa **Sign up**.
2. Regístrate con GitHub (lo más rápido) o con tu correo.
3. No pide tarjeta para el plan gratuito.

---

## Paso 2 · Crear el proyecto

Al entrar te pedirá crear un proyecto:

| Campo | Qué poner |
|---|---|
| **Project name** | `music-shop` |
| **Postgres version** | La que venga por defecto |
| **Region** | La más cercana a tus clientes |

Sobre la región: elige la más próxima a donde vivan quienes van a comprar. Si
tu tienda es para Guatemala, alguna de Estados Unidos (`US East` o `US West`)
irá bien. Cuanto más lejos esté el servidor, más tarda cada consulta.

**La región no se puede cambiar después** sin crear otro proyecto.

Pulsa **Create project**.

---

## Paso 3 · Copiar la cadena de conexión

Nada más crearlo, Neon te muestra la cadena de conexión. Es la dirección con
usuario y contraseña que tu tienda usará para entrar.

Tiene esta forma:

```
postgresql://neondb_owner:npg_AbC123@ep-cool-dawn-12345678-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Muy importante: tienes que copiar DOS cadenas distintas

Neon ofrece dos versiones de la misma dirección, y **cada una sirve para una
cosa**. Confundirlas es el error más habitual.

En el recuadro de la conexión hay un desplegable o un interruptor que pone
**Connection pooling** (agrupación de conexiones):

| Interruptor | Cadena | Se distingue por | Para qué sirve |
|---|---|---|---|
| **Activado** | Agrupada | Lleva **`-pooler`** en la dirección | La tienda funcionando |
| **Desactivado** | Directa | **No** lleva `-pooler` | Crear las tablas |

**Copia las dos y guárdalas** en un bloc de notas, apuntando cuál es cuál.

**Por qué son dos:** la agrupada reparte conexiones entre muchas visitas a la
vez, que es lo que necesita una web publicada en Netlify. La directa es una
conexión normal, que es lo que necesitan las herramientas que crean tablas —
por la agrupada fallan con errores raros del tipo `prepared statement "s1"
already exists`.

Si te cuesta encontrarlas: **Dashboard → Connect** (o el botón *Connect*
arriba a la derecha). Ahí está el interruptor.

---

## Paso 4 · Crear las tablas

La base de datos existe pero está vacía. Hay que crear las tablas donde se
guardarán productos, pedidos y usuarios.

Esto se hace **desde tu ordenador**, una sola vez, con la carpeta del
proyecto abierta en la terminal.

**Usa la cadena DIRECTA** (la que NO lleva `-pooler`).

### En Windows (PowerShell)

```powershell
$env:DATABASE_URL="postgresql://neondb_owner:TU_CLAVE@ep-...us-east-2.aws.neon.tech/neondb?sslmode=require"
npx drizzle-kit push
```

### En Mac o Linux

```bash
export DATABASE_URL="postgresql://neondb_owner:TU_CLAVE@ep-...us-east-2.aws.neon.tech/neondb?sslmode=require"
npx drizzle-kit push
```

Debe terminar con:

```
[✓] Changes applied
```

**Comprueba que ha funcionado:** en Neon, entra en **Tables** (menú
izquierdo). Deben aparecer `users`, `products` y `orders`.

> Este paso hay que repetirlo **cada vez que una entrega cambie la estructura
> de la base de datos**. El archivo `HISTORIAL.md` lo avisa en las entradas
> que lo necesitan, y `npm run db:check` te lo dice.

---

## Paso 5 · Configurar Netlify

Ahora le decimos a Netlify cómo encontrar la base de datos.

En el panel de tu sitio: **Site configuration → Environment variables →
Add a variable**.

Añade estas cinco, una a una:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La cadena **AGRUPADA** (la que lleva `-pooler`) |
| `SESSION_SECRET` | Ver abajo |
| `APP_ENV` | `production` |
| `ADMIN_EMAIL` | Tu correo, por ejemplo `admin@tutienda.com` |
| `ADMIN_PASSWORD` | Una contraseña larga que elijas tú |

Fíjate bien: **aquí va la cadena con `-pooler`**, al revés que en el paso 4.

### Cómo generar `SESSION_SECRET`

Es la clave con la que se firman las cookies de sesión. Ejecuta en tu
terminal:

```
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copia el resultado (64 caracteres raros). **Guárdalo:** si lo cambias más
adelante, todo el mundo tendrá que volver a iniciar sesión.

### Por qué conviene poner `ADMIN_EMAIL` y `ADMIN_PASSWORD`

Si no las pones, la tienda genera una contraseña al azar y la escribe en el
registro del servidor, que en Netlify es incómodo de consultar y se borra al
cabo de un tiempo. Es fácil perdérsela y quedarte sin poder entrar a tu
propia tienda.

Poniéndolas, entras con lo que tú has elegido. **Solo se usan la primera
vez**, cuando todavía no hay ningún usuario; después puedes borrarlas.

---

## Paso 6 · Desplegar

En Netlify: **Deploys → Trigger deploy → Deploy site**.

Cuando termine, entra en `tudominio.netlify.app/login` con el correo y la
contraseña del paso 5.

---

## Comprobar que todo está bien

| Qué mirar | Dónde | Qué debe salir |
|---|---|---|
| La base responde | `tudominio.netlify.app/api/health` | `"db":"activa"` |
| Puedes entrar | `/login` | Entra al panel |
| El panel carga | `/admin` | Se ven las gráficas |
| Las tablas existen | Neon → Tables | `users`, `products`, `orders` |

---

## Si algo falla

### «no existe la columna ...» al entrar

Falta ejecutar el paso 4, o una entrega nueva cambió la estructura. Repite el
paso 4 con la cadena **directa**.

### La web carga pero `/api/health` dice que la base no responde

- Revisa que `DATABASE_URL` esté bien copiada, **entera** y sin espacios.
- Que termine en `?sslmode=require`.
- Que en Netlify sea la cadena **con** `-pooler`.
- Después de cambiar una variable hay que **volver a desplegar**: Netlify no
  las aplica en caliente.

### «prepared statement "s1" already exists» al crear las tablas

Estás usando la cadena agrupada donde va la directa. Vuelve al paso 4 y usa
la que **no** lleva `-pooler`.

### «password authentication failed»

La contraseña de la cadena es incorrecta o caducó. En Neon: **Dashboard →
Connect → Reset password**, y actualiza la variable en Netlify.

### La primera visita del día tarda un par de segundos

Normal: es la base de datos despertando del modo reposo. Solo pasa tras un
rato sin visitas.

---

## Buenas costumbres

**No compartas la cadena de conexión.** Lleva la contraseña dentro. No la
pegues en chats, capturas ni en el código. Si se te escapa, cámbiala desde
**Connect → Reset password**.

**No la escribas en ningún archivo del proyecto.** Para eso están las
variables de entorno de Netlify. El archivo `.env` está excluido de git
justamente por esto.

**Haz copias de seguridad.** Neon guarda un historial de 24 horas en el plan
gratuito, que permite volver atrás si algo se borra por error. Para una
tienda real conviene algo más: exportar la base periódicamente.

---

## Alternativa: Neon + Railway

Si te importa que las imágenes que subas desde el panel se conserven, Netlify
no es el mejor sitio para esta tienda (borra los archivos subidos; está
explicado en `DESPLIEGUE.md`).

**Railway** sí tiene disco permanente y acepta la misma base de datos de
Neon, con estas mismas variables. Si más adelante te encuentras con ese
problema, el cambio es sencillo.
