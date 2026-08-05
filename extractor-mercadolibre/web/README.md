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

Las **61 columnas** de la planilla oficial **"Publicar varios productos"** de Mercado Libre
(categoría Libros Físicos), en el mismo orden (A → BI): Título, Condición, ISBN, SKU, Stock,
Precio, Descripción, medidas y peso del paquete, forma de envío y condiciones de venta, y
todas las características del libro (Autor, Editorial, Subtítulo, Serie, Idioma, Edición, Tapa,
Índice, Año, Coautores, Traductores, Tipo de narración, Colección, Cantidad de páginas, etc.).

Cómo usarlo: abrí el CSV con Excel/Google Sheets, **copiá las filas de datos** y pegalas en la
planilla que descargás desde Mercado Libre. Viene en UTF-8, así que acentos y otros alfabetos
se ven bien.

### Qué completa y qué no
- **Completa** lo que puede: con la IA (lee la tapa) + bases de datos gratis (Google Books /
  OpenLibrary por ISBN o título). Lo que no puede determinar, lo deja **en blanco**.
- **Valores por defecto** (configurables): Condición (Usado), Stock (1), medidas/peso del
  paquete, forma de envío, cuotas y retiro.
- **Queda en blanco para vos:** Fotos (van del Gestor de fotos de ML) y, si lo dejaste en
  manual, el Precio.

### Precio (sugerencia, no se completa solo)
Por cada libro ves una **estimación orientativa** de la IA y **botones** que abren la búsqueda
de ese libro en **Mercado Libre, Iberlibro y eBay** para que veas precios reales. El campo de
precio no se llena automáticamente (salvo que elijas ese modo en Configuración).

---

## Notas

- La lista de libros cargados **se guarda en el teléfono** aunque cierres la página, hasta
  que la vacíes. Acordate de **descargar el CSV** antes de vaciarla.
- Si un dato salió mal, editalo en el campo antes de agregarlo. La IA no inventa: cuando no
  está segura deja el dato vacío y avisa en "confianza / observaciones".
