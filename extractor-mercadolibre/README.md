# Extractor de datos de libros para Mercado Libre

Herramienta de escritorio que, a partir de una **foto de la tapa de un libro**
(o de un **ISBN**, o de un **texto** escrito a mano), lee el libro con IA y arma
una **fila lista para pegar en la planilla de Mercado Libre**.

Pensada para vender **libros usados / antiguos / raros** (incluso en otros
idiomas: italiano, ruso, francés, etc.), donde muchas veces no hay código de barras.

Viene en **dos versiones**:
- 💻 **De escritorio** (este README): procesás una **carpeta de fotos en lote** desde la compu.
- 📱 **Web para el celular** (ya publicada en
  **https://estoesunagrabacion-wq.github.io/libros-mercadolibre/**): sacás la **foto con la
  cámara** del teléfono, ves los datos con botón de **copiar** (ideal para cargar de a uno) y
  descargás un **CSV** con todos los libros juntos (ideal para **carga masiva**).
  El código es el `index.html` de la raíz del repo. Ver `web/README.md`.

## Qué hace

1. Tomás fotos de las tapas y las ponés en la carpeta `fotos/` (una foto por libro).
2. Corrés un comando.
3. Se genera `salida.xlsx` con **las 61 columnas** de la planilla oficial
   **"Publicar varios productos"** de Mercado Libre (Libros Físicos), en orden.
   Abrís el archivo, **copiás las filas** y las pegás en la planilla que descargás de ML.

Por cada libro completa lo que puede con la **IA** (lee la tapa) + **Google Books /
OpenLibrary** (por ISBN o título); lo que no encuentra queda **en blanco**. Cuando lo
tienen, también traen **medidas (alto/ancho/grosor) y peso** del libro por ISBN (las medidas
se **redondean hacia arriba**). Opcionalmente puede consultar la **BNE (Biblioteca Nacional
de España)** para medidas/páginas de libros en español: poné `"bne": true` en `config.json`. Los campos
de logística (condición, stock, medidas del paquete, envío) van con **valores por defecto
configurables**.

El **título** se arma con el patrón `Título Autor Microcentro` (recortado a 60 caracteres);
la etiqueta final ("Microcentro") se configura.

### Varias fotos del mismo libro
Si tenés tapa + contratapa + hoja con el ISBN, nombrá los archivos con el mismo prefijo y
**doble guion bajo** para que se combinen en un solo libro:

```
ishiguro__tapa.jpg   ishiguro__contra.jpg   ishiguro__isbn.jpg
```

Todas las `ishiguro__*.jpg` se procesan juntas → un solo libro con más datos (el ISBN de la
contratapa mejora mucho el enriquecimiento). Los archivos sin `__` se toman como un libro cada uno.

---

## Instalación (una sola vez)

### 1. Instalar Python
- **Windows:** descargá Python desde https://www.python.org/downloads/ y, durante
  la instalación, **tildá la casilla "Add Python to PATH"**.
- **Mac:** ya suele venir; si no, instalalo desde el mismo link.

### 2. Descargar esta herramienta
Descargá la carpeta `extractor-mercadolibre` a tu compu.

### 3. Instalar las librerías
Abrí una terminal / consola **dentro de la carpeta** y ejecutá:

```
pip install -r requirements.txt
```

(En Mac, si `pip` no funciona, probá `pip3`.)

### 4. Conseguir la API key (la "llave" de la IA)

La herramienta usa un servicio de IA con visión para leer las tapas.
**Recomendado: Google Gemini**, que tiene un **plan gratuito** generoso.

**Gemini (gratis para empezar):**
1. Entrá a https://aistudio.google.com/app/apikey
2. Iniciá sesión con tu cuenta de Google y clic en **"Create API key"**.
3. Copiá la clave.

> ¿Preferís otro? También funciona con **OpenAI** (`gpt-4o-mini`) o **Claude**
> (Anthropic). Son muy precisos y baratos por uso, pero **no tienen plan gratis**.
> Ver más abajo cómo cambiar de proveedor.

### 5. Configurar
1. Copiá el archivo `config.example.json` y renombrá la copia a **`config.json`**.
2. Abrilo con el Bloc de notas y **pegá tu clave** en `"api_key"`.

```json
{
  "proveedor": "gemini",
  "api_key": "TU-CLAVE-ACA",
  "etiqueta_titulo": "Microcentro",
  "precio": "manual"
}
```

---

## Uso

### Modo lote (varias fotos)
1. Poné todas las fotos en la carpeta `fotos/`.
2. Ejecutá:

```
python extractor.py
```

3. Abrí `salida.xlsx`.

### Un libro por ISBN (gratis, sin gastar IA)
```
python extractor.py --isbn 9788483462287
```

### Un libro escribiendo el dato a mano
```
python extractor.py --texto "Restos del dia Kazuo Ishiguro"
```

### Opciones útiles
```
python extractor.py --carpeta "C:\Users\vos\Desktop\libros" --salida "hoy.xlsx"
```

---

## Configuración (`config.json`)

| Campo | Qué hace | Valores |
|-------|----------|---------|
| `proveedor` | Qué IA usar | `gemini`, `openai`, `anthropic` |
| `api_key` | Tu clave | (texto) |
| `modelo` | Modelo puntual (opcional) | vacío = **autodetección** (Gemini) |
| `carpeta_fotos` | Dónde están las fotos | `fotos` |
| `archivo_salida` | Excel de salida | `salida.xlsx` |
| `etiqueta_titulo` | Se agrega al final del título | `Microcentro` (o `""` para ninguna) |
| `condicion` | Columna Condición | `Usado` / `Nuevo` |
| `sku_por_defecto` | Columna SKU / ubicación física | `""` |
| `foto_generica` | URL de una foto genérica para la columna Fotos (vacío = sin foto) | `""` |
| `stock` | Columna Stock | `1` |
| `precio` | Columna Precio | `manual` (vacío), `sugerir` (la IA propone), o un número fijo |
| `paq_ancho` / `paq_alto` / `paq_prof` | Medidas del **paquete** de envío (cm) | `24` / `17` / `4` |
| `paq_peso` | Peso del paquete (kg) | `0.5` |
| `forma_envio` / `costo_envio` / `retiro` | Condiciones de envío | `Mercado Envíos` / `A cargo del comprador` / `Acepto` |
| `cuotas` / `costo_cuotas` | Cuotas | `No agregar cuotas` / `Sin costo` |
| `libreria` | Nombre de tu librería (cierre de la descripción) | `Librería Los Siete Pilares` |
| `retiro_texto` | Texto de retiro/ubicación (cierre de la descripción) | (frase de retiro) |
| `titulo_italica` | Título del libro en itálicas (Unicode) en la descripción | `false` |
| `bne` | Consultar la **BNE** por ISBN (medidas/páginas de libros en español) | `false` / `true` |
| `plantilla` | Ruta a la planilla oficial de ML para **rellenarla** | `""` (vacío = crea `salida.xlsx`) |
| `max_largo_titulo` | Largo máximo del título | `60` |

### Cómo se arma la Descripción
Cada descripción sale con esta estructura:

```
Autor, Título del libro, Ciudad, Editorial, año. N páginas. Estado.

(texto descriptivo escrito por la IA)

Retiro en persona en una librería a la calle en la zona de Paraguay y Reconquista.

Librería Los Siete Pilares
```

El nombre de la librería y el texto de retiro se configuran (`libreria` / `retiro_texto`).

### Rellenar la planilla oficial (mismo archivo, lleno)
En vez de generar un archivo nuevo, podés hacer que **complete tu planilla de ML**:

```
python extractor.py --plantilla "Publicar.xlsx"
```

Toma la planilla oficial ("Publicar varios productos" → Libros Físicos), escribe los libros en
las filas de datos **conservando las hojas, los desplegables y los valores por defecto**, y
guarda el resultado en `salida.xlsx` (no pisa tu plantilla original). Ese archivo ya se puede
subir a Mercado Libre; solo faltan las **Fotos** (del Gestor de fotos) y el **Precio** si lo dejaste manual.

**Cambiar de proveedor:** poné `"proveedor": "openai"` o `"anthropic"` y su clave
correspondiente. También podés dejar la clave en una variable de entorno
(`GEMINI_API_KEY`, `OPENAI_API_KEY` o `ANTHROPIC_API_KEY`) en vez del `config.json`.

---

## Cómo pasar los datos a Mercado Libre

La salida usa las **61 columnas** de la planilla oficial **"Publicar varios productos"**
(Libros Físicos). Para publicar:

1. Descargá esa planilla desde Mercado Libre (Publicar → varios productos → Libros Físicos).
2. Abrí `salida.xlsx`, **copiá las filas de datos** (sin el encabezado) y pegalas en la
   planilla de ML, respetando el orden de columnas.
3. Completá en ML lo que la herramienta deja en blanco a propósito: **Fotos** (van del Gestor
   de fotos de ML) y el **Precio** si lo dejaste en manual.

> ¿De dónde salen los datos? De la **IA** (lee la tapa) + **Google Books** y **OpenLibrary**
> (bases de datos gratuitas, por ISBN o título). Para el **precio** no se scrapea ningún sitio:
> conviene mirar Mercado Libre / Iberlibro / eBay a mano (la versión web trae botones para eso).

---

## Costos (aproximados)

- **Gemini:** capa gratuita amplia; para volúmenes altos, fracciones de centavo por foto.
- **OpenAI `gpt-4o-mini` / Claude:** del orden de **USD 0,001–0,01 por libro** según la foto.

Para ahorrar, la herramienta **achica las fotos** automáticamente antes de enviarlas
(si tenés instalada la librería Pillow, incluida en `requirements.txt`).

---

## Consejos para mejores resultados

- Foto **de frente, con buena luz** y el título/autor legibles.
- Sumá una foto de la **contratapa con el ISBN** (con el mismo prefijo y `__`): mejora
  mucho los datos que se traen de Google Books / OpenLibrary.
- **Medidas con regla:** si ponés una **regla** (o algo de tamaño conocido: tarjeta = 8,5 cm)
  al lado del libro, la IA calcula alto/ancho/grosor. Esas medidas se usan (con un pequeño
  margen) para las **medidas del paquete** de ese libro; si no hay regla, se usan los valores
  por defecto del `config.json`. El **peso** no se puede medir por foto.
- Para libros modernos con **código de barras**, el `--isbn` es lo más exacto (y gratis).
- La IA **no inventa**: si no está segura de un dato, lo deja vacío. Siempre revisá
  antes de publicar (sobre todo **precio** y **condición**).

---

## Problemas frecuentes

| Mensaje | Solución |
|---------|----------|
| `Falta la librería 'requests'` | Ejecutá `pip install -r requirements.txt` |
| `Falta la API key` | Completá `api_key` en `config.json` |
| `Error HTTP 401` | La clave es incorrecta o venció |
| `Error HTTP 429` | Llegaste al límite de uso; la herramienta reintenta sola, o esperá un rato |
| `No encontré fotos` | Verificá que las imágenes estén en la carpeta `fotos/` |
