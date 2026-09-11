# SACIPETROL — Plataforma comercial

Esta guía está escrita para que puedas dejar todo funcionando sin
conocimientos técnicos. Sigue los pasos en orden, de arriba hacia abajo.

## Parte 1 — Crear la base de datos en Supabase

1. Entra a tu proyecto en https://supabase.com
2. En el menú de la izquierda, haz clic en **SQL Editor**.
3. Haz clic en **New query** (nueva consulta).
4. Abre el archivo `supabase/schema.sql` que viene junto a este proyecto,
   copia **todo** su contenido, y pégalo en el editor.
5. Haz clic en **Run** (ejecutar). Esto crea automáticamente todas las
   tablas, reglas de seguridad y funciones que la aplicación necesita.
   No tienes que diseñar ni tocar ninguna tabla manualmente.

## Parte 2 — Crear tu usuario Administrador

1. En el menú de la izquierda de Supabase, ve a **Authentication → Users**.
2. Haz clic en **Add user → Create new user**.
3. Escribe tu correo y una contraseña segura. Guarda ambos datos, los
   usarás para entrar a la aplicación.
4. Vuelve a **SQL Editor → New query** y pega esto (cambia el correo por
   el que usaste en el paso 3):

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'tu_correo@ejemplo.com');
   ```

5. Haz clic en **Run**. Con esto tu usuario ya es Administrador.

   Desde este momento, para crear más usuarios (vendedores, gerentes) NO
   necesitas volver a Supabase: entras a la aplicación con tu usuario admin
   y hay una pantalla de **"Usuarios"** en el menú donde puedes crearlos
   directamente, con nombre, correo, contraseña y su rol.

## Parte 3 — Crear el espacio para las fotos (Storage)

1. En el menú de la izquierda de Supabase, ve a **Storage**.
2. Haz clic en **Create bucket** (crear bucket).
3. Nombre exacto: `visit-photos`
4. Marca la opción **Public bucket** (bucket público) y confirma.

   Esto es todo lo que necesitas hacer aquí — la aplicación se encarga
   de subir y mostrar las fotos automáticamente.

## Parte 4 — Conectar la aplicación a tu proyecto de Supabase

1. En Supabase, ve a **Settings → API**.
2. Copia dos datos:
   - **Project URL**
   - **anon public key** (también llamada Publishable key)
3. Abre el archivo `.env.example` de este proyecto, cámbiale el nombre a
   `.env` (quitando el `.example`), y reemplaza los valores:

   ```
   VITE_SUPABASE_URL=pega-aquí-tu-Project-URL
   VITE_SUPABASE_PUBLISHABLE_KEY=pega-aquí-tu-anon-key
   ```

   Eso es lo único que necesitas cambiar. No hay más configuración técnica.

## Parte 5 — Publicar en Netlify

1. Sube este proyecto a un repositorio de GitHub (puedes arrastrar la
   carpeta descomprimida a GitHub Desktop, o pedir ayuda para este paso
   puntual si nunca lo hiciste).
2. Entra a https://app.netlify.com y haz clic en **Add new site → Import
   an existing project**.
3. Elige tu repositorio de GitHub.
4. Netlify va a detectar automáticamente que es un proyecto Vite. Antes
   de darle a "Deploy", ve a **Site settings → Environment variables** y
   agrega las mismas dos variables del paso anterior:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Haz clic en **Deploy site**. En un par de minutos tendrás tu URL pública
   (algo como `tu-app.netlify.app`).
6. Entra a esa URL, inicia sesión con tu usuario Administrador, y ya
   puedes empezar a usar la plataforma y crear a tus vendedores.

---

## Resumen rápido (lo mínimo que debes hacer)

**En Supabase:**
1. Pegar y ejecutar `supabase/schema.sql` en el SQL Editor.
2. Crear tu usuario admin en Authentication → Users.
3. Ejecutar el `UPDATE` que te convierte en admin (Parte 2, paso 4).
4. Crear el bucket `visit-photos` como público en Storage.
5. Copiar tu Project URL y anon key desde Settings → API.

**En Netlify:**
1. Conectar el repositorio del proyecto.
2. Agregar las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Deploy site.
4. Entrar a la URL, iniciar sesión como admin, y crear a tu equipo desde
   la pantalla de "Usuarios" dentro de la app.
