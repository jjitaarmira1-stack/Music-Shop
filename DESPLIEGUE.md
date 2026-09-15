# Cómo publicar la tienda en internet

Guía paso a paso para poner NOCTURNE en producción. Está escrita para
seguirse sin conocimientos previos de despliegue.

---

## Antes de empezar: lo que hay que entender

Esta tienda **no es una web de archivos estáticos**. Necesita un servidor que
ejecute código: comprueba contraseñas, guarda pedidos y consulta una base de
datos. Eso implica dos cosas:

1. **Hace falta una base de datos PostgreSQL**, y Netlify no incluye ninguna.
   Hay que contratarla aparte (hay opciones gratuitas).
2. **Hay que configurar variables de entorno**, que son los datos secretos
   (la conexión a la base de datos y la clave de firma de sesiones). Nunca se
   escriben en el código: se configuran en el panel del proveedor.

---

## Paso 1 · Crear la base de datos

Cualquiera de estos servicios sirve y tienen plan gratuito:

| Servicio | Dirección |
|---|---|
| Neon | neon.tech |
| Supabase | supabase.com |
| Railway | railway.app |

Crea un proyecto PostgreSQL y copia la **cadena de conexión**. Tiene esta
pinta:

```
postgresql://usuario:contraseña@servidor.neon.tech/basededatos?sslmode=require
```

La parte `?sslmode=require` del final suele ser necesaria: casi todos estos
servicios exigen conexión cifrada.

---

## Paso 2 · Generar la clave de sesiones

Es la clave con la que se firman las cookies. Ejecuta esto en tu ordenador y
copia el resultado:

```
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Sale algo como `kJ8x_2mQp...` con 64 caracteres. **Guárdalo**: si lo cambias
más adelante, se cierran todas las sesiones abiertas.

---

## Paso 3 · Configurar las variables en Netlify

En el panel de tu sitio: **Site configuration → Environment variables**.

Añade estas:

| Variable | Valor | ¿Obligatoria? |
|---|---|---|
| `DATABASE_URL` | La cadena del paso 1 | **Sí** |
| `SESSION_SECRET` | La clave del paso 2 | **Sí** |
| `APP_ENV` | `production` | Recomendada |
| `ADMIN_EMAIL` | Tu correo | Recomendada |
| `ADMIN_PASSWORD` | La contraseña que quieras | Recomendada |

**Por qué conviene definir `ADMIN_EMAIL` y `ADMIN_PASSWORD`:** si no lo haces,
la aplicación genera una contraseña aleatoria y la escribe en la consola del
servidor. En Netlify esa consola es el registro de funciones, incómodo de
consultar y que se rota, así que es fácil perderse el mensaje y quedarte sin
poder entrar a tu propia tienda.

Estas dos variables **solo se usan la primera vez**, cuando no hay ningún
usuario. Después puedes borrarlas.

---

## Paso 4 · Preparar la base de datos

La base de datos está vacía: hay que crear las tablas. Desde tu ordenador, con
la carpeta del proyecto abierta:

```
# 1. Apunta temporalmente a la base de datos de producción
export DATABASE_URL="la-cadena-del-paso-1"

# 2. Crea las tablas
npx drizzle-kit push
```

En Windows, con PowerShell, la primera línea es:

```
$env:DATABASE_URL="la-cadena-del-paso-1"
```

Esto hay que repetirlo **cada vez que una entrega cambie el esquema**. El
archivo `HISTORIAL.md` lo indica en cada entrada que lo necesita.

---

## Paso 5 · Desplegar

Conecta el repositorio de GitHub a Netlify. El archivo `netlify.toml` que hay
en el proyecto ya lleva la configuración: orden de compilación, versión de
Node y el plugin oficial de Next.js.

El primer arranque crea la cuenta de administración automáticamente. Entra en
`tudominio.netlify.app/login` con las credenciales del paso 3.

---

## Qué NO va a funcionar en Netlify (y por qué)

Conviene saberlo antes, no descubrirlo con la tienda publicada.

### 1. Las imágenes que subas desde el panel se perderán

Netlify no tiene disco permanente: cada petición puede atenderla una máquina
nueva y vacía. Una imagen subida funciona unos minutos y luego desaparece.

No es un fallo del código, es cómo funcionan estas plataformas.

**Las imágenes del catálogo que trae el proyecto sí funcionan siempre**,
porque viajan dentro del despliegue.

**Soluciones, de menos a más trabajo:**

- Usar solo las imágenes incluidas y añadir las nuevas al repositorio a mano
  (en `public/img/products/`), desplegando después.
- Integrar un servicio de imágenes como Cloudinary (tiene plan gratuito).
- Desplegar en un servidor con disco real: Railway, Render o un VPS.

### 2. El limitador de intentos de acceso es menos estricto

El contador que bloquea los ataques de fuerza bruta vive en la memoria de cada
instancia. Con varias instancias activas, cada una lleva su propia cuenta, así
que el límite real se multiplica.

Sigue protegiendo, pero menos de lo configurado. Para que sea exacto haría
falta Redis (por ejemplo Upstash, que tiene plan gratuito).

Ambas limitaciones se avisan en el registro al arrancar, para que queden a la
vista.

---

## Si algo falla

### «DATABASE_URL es obligatoria» al compilar

Ya no debería ocurrir: la compilación no necesita base de datos. Si aparece
como **aviso** en el registro, es informativo y el despliegue continúa. Si
aparece como **error al ejecutarse**, es que falta la variable en el panel.

### La web carga pero da error al entrar

La base de datos no responde o le faltan tablas. Comprueba:

- Que `DATABASE_URL` sea correcta y lleve `?sslmode=require`.
- Que hayas ejecutado `npx drizzle-kit push` (paso 4).
- `tudominio.netlify.app/api/health` informa del estado de la conexión.

### No sé la contraseña de administración

Si no definiste `ADMIN_PASSWORD`, búscala en **Functions → logs** de Netlify,
en el primer arranque. Si ya no está, lo más rápido es borrar la fila de la
tabla `users` desde el panel de tu proveedor de base de datos, definir
`ADMIN_EMAIL` y `ADMIN_PASSWORD`, y volver a desplegar.

---

## Alternativa: alojamiento con disco real

Si quieres que las subidas de imágenes funcionen sin integrar otro servicio,
**Railway** o **Render** son más adecuados que Netlify para esta aplicación:
ofrecen disco permanente y base de datos PostgreSQL en el mismo sitio. El
proceso es equivalente y las mismas variables de entorno sirven.
