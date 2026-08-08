# Proxy de precios de Mercado Libre (Cloudflare Worker)

Este mini-servicio le permite a la app web mostrar el **precio real** de un libro en
Mercado Libre (mediana y rango típico de publicaciones parecidas). Es gratis y corre en
Cloudflare. Se despliega **una sola vez**.

## Por qué hace falta
El navegador no puede leer Mercado Libre directamente (lo bloquea por seguridad, "CORS").
Este Worker corre del lado del servidor (sin ese límite), consulta ML y le devuelve a la app
un resumen de precios con el permiso que falta.

## Desplegarlo (2 minutos, gratis)

1. Entrá a **https://dash.cloudflare.com/** e iniciá sesión (si no tenés cuenta, es gratis).
2. En el menú, andá a **Workers & Pages** → **Create application** → **Create Worker**.
3. Ponele un nombre (ej. `precios-libros`) y **Deploy**.
4. Tocá **Edit code**, borrá todo lo que haya y **pegá el contenido de `worker.js`** (el archivo de esta carpeta).
5. **Deploy** (arriba a la derecha).
6. Copiá la URL que te queda, del tipo:
   `https://precios-libros.TU-USUARIO.workers.dev`

## Conectarlo a la app

1. Abrí la app → **⚙️ Configuración**.
2. Pegá esa URL en **"Proxy de precios (URL)"** y **Guardá**.
3. Listo: en cada libro vas a ver el botón **"💲 Precio real en ML"**.

## Cómo se usa
Al tocar **💲 Precio real en ML**, la app le pasa al Worker el título + autor del libro y
muestra: **mediana**, **rango típico** (percentil 25–75) y cuántas publicaciones encontró.
Podés tocar **"usar mediana"** para poner ese valor en el campo Precio.

## Notas
- Es una **referencia** de mercado, no un precio "oficial": depende de lo que haya publicado
  en ese momento. Para libros muy raros puede no encontrar publicaciones.
- Mercado Libre puede cambiar su página y romper la lectura; si algún día deja de traer datos,
  avisame y actualizo el `worker.js`.
- Prueba rápida: abrí en el navegador `https://TU-WORKER.workers.dev/?q=Rayuela%20Cortazar`
  y tenés que ver un JSON con `median`, `p25`, `p75`, etc.
