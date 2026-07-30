# 📱 Versión web (para el celular)

Una sola página (`index.html`) que abrís en el navegador del teléfono para:

1. **Sacar la foto** de la tapa del libro con la cámara.
2. Que la IA lea el libro y te muestre los datos en campos editables, cada uno con
   botón **copiar** → ideal para **cargar de a uno** en el formulario de Mercado Libre.
3. **Agregar** cada libro a una lista y después **descargar un CSV** con todos juntos →
   ideal para la **carga masiva**.

No necesita servidor: es un solo archivo. Tu clave y tus fotos quedan en tu teléfono
(la foto solo se envía al servicio de IA que elijas, para poder leerla).

---

## Cómo ponerla en tu celular

Tenés dos opciones:

### Opción A — Publicarla con GitHub Pages (recomendada)
Así te queda una dirección web que abrís desde cualquier teléfono.

1. En el repositorio de GitHub, andá a **Settings → Pages**.
2. En "Build and deployment", elegí **Deploy from a branch**, rama `main` (o la que uses),
   carpeta `/root`, y guardá.
3. La página va a quedar disponible en una URL tipo
   `https://TU-USUARIO.github.io/detective-sintactico/extractor-mercadolibre/web/`.
4. Abrí esa URL en el celular y, si querés, "Agregar a pantalla de inicio" para tenerla como app.

### Opción B — Abrir el archivo directamente
Pasá el archivo `index.html` al teléfono (por mail, Drive, etc.) y abrilo con el navegador.
> Nota: algunos servicios de IA bloquean las llamadas cuando la página se abre como archivo
> local (`file://`). Si te da error de red, usá la Opción A (GitHub Pages) o probá con **Gemini**,
> que suele funcionar igual.

---

## Primer uso

1. Abrí la página y tocá **⚙️ Configuración**.
2. Elegí el **servicio de IA** y pegá tu **API key**:
   - **Google Gemini (gratis para empezar):** conseguí la clave en
     https://aistudio.google.com/app/apikey
   - OpenAI o Claude también funcionan (pegás su clave).
3. Ajustá la **etiqueta del título** (ej. `Microcentro`), la **moneda** y el modo de **precio**.
4. Tocá **💾 Guardar configuración**. Listo (queda guardado en el teléfono).

Después, por cada libro:
- **📷 Sacar foto** → la IA lo lee → revisás/corregís los campos → **➕ Agregar a la lista**.
- Cuando terminás la tanda, **⬇️ Descargar planilla (CSV)**.

---

## Qué trae el CSV

Las mismas columnas que la versión de escritorio:
- **Columnas de Mercado Libre:** `FAMILY_ID, ITEM_ID, PRODUCT_NUMBER, VARIATION_ID, SKU,
  TITLE, VARIATIONS, STOCK_FLEX, PRICE, CURRENCY_ID` (los IDs van vacíos porque son
  publicaciones nuevas).
- **Columnas extra:** `TITULO_LIBRO, AUTOR, EDITORIAL, IDIOMA, ANIO, ISBN, TEMA_GENERO,
  FORMATO, ESTADO, DESCRIPCION, PRECIO_SUGERIDO, ARCHIVO, CONFIANZA, OBSERVACIONES`.

El archivo se abre con Excel o Google Sheets (viene en UTF-8, así que los acentos y
otros alfabetos se ven bien).

---

## Notas

- La lista de libros cargados **se guarda en el teléfono** aunque cierres la página, hasta
  que la vacíes. Acordate de **descargar el CSV** antes de vaciarla.
- Si un dato salió mal, editalo en el campo antes de agregarlo. La IA no inventa: cuando no
  está segura deja el dato vacío y avisa en "confianza / observaciones".
