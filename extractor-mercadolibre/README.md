# Extractor de datos de libros para Mercado Libre

Herramienta de escritorio que, a partir de una **foto de la tapa de un libro**
(o de un **ISBN**, o de un **texto** escrito a mano), lee el libro con IA y arma
una **fila lista para pegar en la planilla de Mercado Libre**.

Pensada para vender **libros usados / antiguos / raros** (incluso en otros
idiomas: italiano, ruso, francés, etc.), donde muchas veces no hay código de barras.

Viene en **dos versiones**:
- 💻 **De escritorio** (este README): procesás una **carpeta de fotos en lote** desde la compu.
- 📱 **Web para el celular** (carpeta `web/`): sacás la **foto con la cámara** del teléfono,
  ves los datos con botón de **copiar** (ideal para cargar de a uno) y descargás un **CSV**
  con todos los libros juntos (ideal para **carga masiva**). Ver `web/README.md`.

## Qué hace

1. Tomás fotos de las tapas y las ponés en la carpeta `fotos/`.
2. Corrés un comando.
3. Se genera `salida.xlsx` con, por cada libro:
   - **Columnas de Mercado Libre** (amarillas): `TITLE`, `VARIATIONS`, `STOCK_FLEX`,
     `PRICE`, `CURRENCY_ID`, `SKU`, etc. — para pegar en tu planilla de carga.
   - **Columnas extra** (celestes): `AUTOR`, `EDITORIAL`, `IDIOMA`, `ANIO`, `ISBN`,
     `TEMA_GENERO`, `FORMATO`, `ESTADO`, `DESCRIPCION`, `CONFIANZA`, `OBSERVACIONES`
     — para completar los atributos del formulario de ML.

El **título** se arma con el patrón que ya usás: `Título Autor Microcentro`
(recortado a 60 caracteres). La etiqueta final ("Microcentro") se configura.

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
| `modelo` | Modelo puntual (opcional) | vacío = usa el recomendado |
| `carpeta_fotos` | Dónde están las fotos | `fotos` |
| `archivo_salida` | Excel de salida | `salida.xlsx` |
| `moneda` | Columna `CURRENCY_ID` | `ARS` |
| `etiqueta_titulo` | Se agrega al final del título | `Microcentro` (o `""` para ninguna) |
| `sku_por_defecto` | Columna `SKU` / ubicación física | `""` |
| `precio` | Cómo llenar `PRICE` | `manual` (vacío), `sugerir` (la IA propone), o un número fijo (ej. `20000`) |
| `stock` | Columna `STOCK_FLEX` | `1` |
| `max_largo_titulo` | Largo máximo del título | `60` |

**Cambiar de proveedor:** poné `"proveedor": "openai"` o `"anthropic"` y su clave
correspondiente. También podés dejar la clave en una variable de entorno
(`GEMINI_API_KEY`, `OPENAI_API_KEY` o `ANTHROPIC_API_KEY`) en vez del `config.json`.

---

## Cómo pasar los datos a Mercado Libre

Tené en cuenta una diferencia importante:

- La planilla que compartiste es la de **"Modificá tus publicaciones"**: sirve para
  **editar publicaciones que ya existen** (por eso tiene columnas de IDs como
  `ITEM_ID`). Desde esa planilla **ML no deja agregar publicaciones nuevas**.
- Esta herramienta está pensada para **libros nuevos a publicar**, así que deja los
  IDs vacíos y completa lo que se puede (`TITLE`, `PRICE`, `CURRENCY_ID`, `STOCK_FLEX`,
  `SKU`) más los atributos en las columnas extra.

Entonces, para publicar tenés dos caminos:
1. **Formulario de ML:** usá las columnas extra (celestes) para completar título,
   precio, descripción y atributos (autor, idioma, editorial…) al publicar cada libro.
2. **Carga masiva de nuevas publicaciones:** si usás el flujo de "publicar en lote"
   de ML, copiá los datos a esa plantilla (avisame y la adapto a ese formato exacto).

> Si tus libros **ya están publicados** y solo querés completar datos, decímelo y
> ajusto la salida para que use el mismo formato de tu planilla (con los `ITEM_ID`).

---

## Costos (aproximados)

- **Gemini:** capa gratuita amplia; para volúmenes altos, fracciones de centavo por foto.
- **OpenAI `gpt-4o-mini` / Claude:** del orden de **USD 0,001–0,01 por libro** según la foto.

Para ahorrar, la herramienta **achica las fotos** automáticamente antes de enviarlas
(si tenés instalada la librería Pillow, incluida en `requirements.txt`).

---

## Consejos para mejores resultados

- Foto **de frente, con buena luz** y el título/autor legibles.
- Si el título quedó tapado o la confianza es **baja**, revisá la columna
  `OBSERVACIONES` y corregí a mano esa fila.
- Para libros modernos con **código de barras**, el `--isbn` es lo más exacto (y gratis).
- La IA **no inventa**: si no está seguro de un dato, lo deja vacío. Siempre revisá
  antes de publicar.

---

## Problemas frecuentes

| Mensaje | Solución |
|---------|----------|
| `Falta la librería 'requests'` | Ejecutá `pip install -r requirements.txt` |
| `Falta la API key` | Completá `api_key` en `config.json` |
| `Error HTTP 401` | La clave es incorrecta o venció |
| `Error HTTP 429` | Llegaste al límite de uso; la herramienta reintenta sola, o esperá un rato |
| `No encontré fotos` | Verificá que las imágenes estén en la carpeta `fotos/` |
