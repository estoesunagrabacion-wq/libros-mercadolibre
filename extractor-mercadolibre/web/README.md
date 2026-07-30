# 📱 Versión web (para el celular)

Ya está **publicada y online**. Abrila desde el celular en:

### 👉 https://estoesunagrabacion-wq.github.io/detective-sintactico/

(El código de la página es el archivo `index.html` de la **raíz del repositorio**; se
publica solo con GitHub Pages cada vez que se actualiza `main`. El juego "Detective
Sintáctico" quedó en `/juego/`.)

Una sola página que abrís en el navegador del teléfono para:

1. **Sacar la foto** de la tapa del libro con la cámara.
2. Que la IA lea el libro y te muestre los datos en campos editables, cada uno con
   botón **copiar** → ideal para **cargar de a uno** en el formulario de Mercado Libre.
3. **Agregar** cada libro a una lista y después **descargar un CSV** con todos juntos →
   ideal para la **carga masiva**.

No necesita servidor: es un solo archivo. Tu clave y tus fotos quedan en tu teléfono
(la foto solo se envía al servicio de IA que elijas, para poder leerla).

---

## Cómo usarla en tu celular

Simplemente abrí la dirección de arriba en el navegador del teléfono. Si querés tenerla
como app, usá el menú del navegador → **"Agregar a pantalla de inicio"**.

> La publicación es automática: cada cambio que se sube a la rama `main` republica la web
> (workflow `.github/workflows/deploy-pages.yml`).

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
