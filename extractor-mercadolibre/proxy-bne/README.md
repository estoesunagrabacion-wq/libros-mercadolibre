# Proxy BNE — Biblioteca Nacional de España (Cloudflare Worker)

Este mini-servicio le permite a la app web traer datos de la **Biblioteca Nacional de
España (BNE)** por ISBN: sobre todo **medidas (alto/ancho en cm)** y **cantidad de
páginas**, que la BNE suele tener para **libros en español** (justo donde Google Books
y OpenLibrary muchas veces no traen medidas). Es gratis y corre en Cloudflare. Se
despliega **una sola vez**.

## Por qué hace falta

El navegador no puede leer el catálogo de la BNE directamente (no habilita "CORS").
Este Worker corre del lado del servidor, consulta la BNE y le devuelve a la app los
datos en JSON con el permiso que falta.

> **La BNE no bloquea como Mercado Libre.** Los catálogos de bibliotecas están hechos
> para ser consultados por programas, así que este proxy debería funcionar sin trabas.

## Desplegarlo (2 minutos, gratis)

1. Entrá a **https://dash.cloudflare.com/** e iniciá sesión (si no tenés cuenta, es gratis).
2. En el menú, andá a **Workers & Pages** → **Create application** → **Create Worker**.
3. Ponele un nombre (ej. `bne-libros`) y **Deploy**.
4. Tocá **Edit code**, borrá todo lo que haya y **pegá el contenido de `worker.js`** (el archivo de esta carpeta).
5. **Deploy** (arriba a la derecha).
6. Copiá la URL que te queda, del tipo:
   `https://bne-libros.TU-USUARIO.workers.dev`

## Probarlo antes de conectarlo

Abrí en el navegador, con un ISBN de un libro en español, agregando `&debug=1`:

```
https://bne-libros.TU-USUARIO.workers.dev/?isbn=9788437619187&debug=1
```

- Si ves un `resultado` con `paginas` y/o `altura_cm`: **funciona**, ya lo podés conectar.
- Si ves `found:false` o errores en `intentos`: **copiame lo que devuelve** (todo el JSON) y
  ajusto el `worker.js` (puede que la BNE haya cambiado la dirección o la forma de consulta).

## Conectarlo a la app

1. Abrí la app → **⚙️ Configuración**.
2. Pegá esa URL en **"Proxy BNE (URL)"** y **Guardá**.
3. Listo: cuando un libro tenga ISBN y todavía le falten las medidas, la app consulta la
   BNE automáticamente para completarlas.

## En la versión de escritorio

El extractor de escritorio (Python) **no necesita este Worker**: consulta la BNE directo.
Alcanza con poner `"bne": true` en tu `config.json`.

## Notas

- La BNE da sobre todo **alto** (y a veces ancho) y **páginas**; no trae peso ni grosor.
- Las medidas se **redondean hacia arriba** (con 1 cm de margen para el envío), igual que
  en el resto de la app.
- Si algún día la BNE cambia su servicio y deja de traer datos, avisame con la salida de
  `&debug=1` y actualizo el `worker.js`.
