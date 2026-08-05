#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extractor de datos de libros para publicaciones de Mercado Libre.

A partir de una FOTO de la tapa/portada de un libro (o de un ISBN, o de un
texto escrito a mano), usa un modelo de IA con visión para leer el libro y
arma una fila lista para pegar en la planilla de Mercado Libre.

Uso rápido:
    1) Copiá tus fotos dentro de la carpeta "fotos/"
    2) Configurá tu API key en config.json (ver config.example.json)
    3) Ejecutá:   python extractor.py
    4) Abrí el archivo "salida.xlsx" que se genera.

También:
    python extractor.py --texto "Restos del dia Kazuo Ishiguro"
    python extractor.py --isbn 9788483462287
    python extractor.py --carpeta /ruta/a/mis/fotos --salida resultado.xlsx

Ver README.md para la guía paso a paso.
"""

import argparse
import base64
import json
import mimetypes
import os
import re
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("Falta la librería 'requests'. Instalá con:  pip install -r requirements.txt")
    sys.exit(1)

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
except ImportError:
    print("Falta la librería 'openpyxl'. Instalá con:  pip install -r requirements.txt")
    sys.exit(1)

# Pillow es opcional: solo se usa para achicar fotos muy grandes (ahorra costo y tiempo).
try:
    from PIL import Image
    HAY_PILLOW = True
except ImportError:
    HAY_PILLOW = False


# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

RAIZ = Path(__file__).resolve().parent

CONFIG_POR_DEFECTO = {
    # "gemini", "openai" o "anthropic"
    "proveedor": "gemini",
    # Tu clave. También podés dejarla vacía acá y usar una variable de entorno
    # (GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY).
    "api_key": "",
    # Modelo a usar (se puede dejar el sugerido por proveedor).
    "modelo": "",
    # Carpeta donde están las fotos a procesar.
    "carpeta_fotos": "fotos",
    # Archivo Excel de salida.
    "archivo_salida": "salida.xlsx",
    # Moneda para la columna CURRENCY_ID (ML usa "ARS").
    "moneda": "ARS",
    # Etiqueta que se agrega al final del título (como "Microcentro" en tu planilla).
    # Dejalo vacío ("") si no querés etiqueta.
    "etiqueta_titulo": "Microcentro",
    # SKU / ubicación física por defecto (columna SKU).
    "sku_por_defecto": "",
    # Precio: "manual" (queda vacío), "sugerir" (la IA propone) o un número fijo (ej. 20000).
    "precio": "manual",
    # Stock por defecto (columna STOCK_FLEX).
    "stock": 1,
    # Largo máximo del título de ML.
    "max_largo_titulo": 60,
}

MODELOS_POR_DEFECTO = {
    "gemini": "gemini-2.5-flash",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-sonnet-20241022",
}

VAR_ENTORNO_KEY = {
    "gemini": "GEMINI_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
}

# Columnas de la planilla de Mercado Libre (respetá este orden).
COLUMNAS_ML = [
    "FAMILY_ID", "ITEM_ID", "PRODUCT_NUMBER", "VARIATION_ID", "SKU",
    "TITLE", "VARIATIONS", "STOCK_FLEX", "PRICE", "CURRENCY_ID",
]

# Columnas extra con la información que extrae la IA (te sirven de referencia
# y para completar los atributos en el formulario de ML).
COLUMNAS_EXTRA = [
    "TITULO_LIBRO", "AUTOR", "EDITORIAL", "IDIOMA", "ANIO", "ISBN",
    "TEMA_GENERO", "FORMATO", "ESTADO", "DESCRIPCION",
    "PRECIO_SUGERIDO", "ARCHIVO", "CONFIANZA", "OBSERVACIONES",
]

EXTENSIONES_IMAGEN = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".bmp", ".gif"}


# ---------------------------------------------------------------------------
# Prompt de extracción
# ---------------------------------------------------------------------------

INSTRUCCIONES = """Sos un asistente experto en catalogación de libros (usados, antiguos y raros)
para vender en Mercado Libre Argentina. Vas a recibir la foto de la tapa/portada
de un libro (o un dato textual del libro) y tenés que identificarlo.

Devolvé EXCLUSIVAMENTE un objeto JSON válido, sin texto adicional, con estas claves
(usá "" o null cuando no puedas determinar el dato con razonable seguridad; NO inventes):

{
  "titulo_libro": "título del libro tal como figura",
  "autor": "autor/a principal (Nombre Apellido)",
  "editorial": "editorial si es visible",
  "idioma": "idioma del contenido (Español, Italiano, Ruso, Inglés, Francés, etc.)",
  "anio": "año de edición si es visible",
  "isbn": "ISBN si es visible (solo dígitos, sin guiones)",
  "tema_genero": "tema o género (Filosofía, Novela, Poesía, Historia, etc.)",
  "formato": "Tapa dura / Tapa blanda si se puede inferir",
  "estado": "estado aparente del ejemplar (Usado / Muy bueno / Bueno / Con marcas), si la foto lo muestra",
  "descripcion": "2 a 4 oraciones para la publicación: de qué trata + datos del ejemplar. Español neutro, sin exagerar.",
  "precio_sugerido": "número entero en pesos argentinos SOLO si te lo piden; si no, null",
  "confianza": "alta / media / baja según cuán seguro estás de la identificación",
  "observaciones": "cualquier duda relevante (ej: 'título parcialmente tapado', 'autor no visible')"
}

Reglas:
- El idioma del libro puede NO ser el español: leé el alfabeto/idioma real de la tapa.
- Si es una foto borrosa o no es un libro, poné confianza "baja" y explicá en observaciones.
- No agregues comentarios fuera del JSON."""


def prompt_para(sugerir_precio: bool, dato_texto: str = "") -> str:
    partes = [INSTRUCCIONES]
    if sugerir_precio:
        partes.append(
            "\nADEMÁS: proponé un 'precio_sugerido' orientativo (entero, en pesos argentinos) "
            "para un usado en Mercado Libre Argentina. Es solo una referencia."
        )
    if dato_texto:
        partes.append(
            f"\nNo hay foto. Identificá el libro a partir de este dato textual: \"{dato_texto}\""
        )
    return "\n".join(partes)


# ---------------------------------------------------------------------------
# Llamadas a los proveedores de IA
# ---------------------------------------------------------------------------

def _imagen_a_base64(ruta: Path):
    """Devuelve (base64, mime). Achica la imagen si Pillow está disponible."""
    mime, _ = mimetypes.guess_type(str(ruta))
    if mime is None:
        mime = "image/jpeg"

    if HAY_PILLOW:
        try:
            img = Image.open(ruta)
            img = img.convert("RGB")
            # Achicar a máx 1600px de lado mayor para ahorrar costo/tiempo.
            maximo = 1600
            if max(img.size) > maximo:
                escala = maximo / max(img.size)
                nuevo = (int(img.size[0] * escala), int(img.size[1] * escala))
                img = img.resize(nuevo, Image.LANCZOS)
            import io
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            return base64.b64encode(buf.getvalue()).decode("ascii"), "image/jpeg"
        except Exception:
            pass  # Si falla el reescalado, usamos el archivo original.

    with open(ruta, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii"), mime


def llamar_gemini(cfg, prompt, imagen_b64=None, mime=None):
    modelo = cfg["modelo"] or MODELOS_POR_DEFECTO["gemini"]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
    partes = [{"text": prompt}]
    if imagen_b64:
        partes.append({"inline_data": {"mime_type": mime, "data": imagen_b64}})
    body = {
        "contents": [{"parts": partes}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1},
    }
    r = requests.post(url, params={"key": cfg["api_key"]}, json=body, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


def llamar_openai(cfg, prompt, imagen_b64=None, mime=None):
    modelo = cfg["modelo"] or MODELOS_POR_DEFECTO["openai"]
    url = "https://api.openai.com/v1/chat/completions"
    contenido = [{"type": "text", "text": prompt}]
    if imagen_b64:
        contenido.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{imagen_b64}"},
        })
    body = {
        "model": modelo,
        "messages": [{"role": "user", "content": contenido}],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
    }
    headers = {"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json"}
    r = requests.post(url, headers=headers, json=body, timeout=120)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def llamar_anthropic(cfg, prompt, imagen_b64=None, mime=None):
    modelo = cfg["modelo"] or MODELOS_POR_DEFECTO["anthropic"]
    url = "https://api.anthropic.com/v1/messages"
    contenido = []
    if imagen_b64:
        contenido.append({
            "type": "image",
            "source": {"type": "base64", "media_type": mime, "data": imagen_b64},
        })
    contenido.append({"type": "text", "text": prompt})
    body = {
        "model": modelo,
        "max_tokens": 1024,
        "temperature": 0.1,
        "messages": [{"role": "user", "content": contenido}],
    }
    headers = {
        "x-api-key": cfg["api_key"],
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    r = requests.post(url, headers=headers, json=body, timeout=120)
    r.raise_for_status()
    return r.json()["content"][0]["text"]


def llamar_ia(cfg, prompt, imagen_b64=None, mime=None):
    proveedor = cfg["proveedor"]
    if proveedor == "gemini":
        return llamar_gemini(cfg, prompt, imagen_b64, mime)
    if proveedor == "openai":
        return llamar_openai(cfg, prompt, imagen_b64, mime)
    if proveedor == "anthropic":
        return llamar_anthropic(cfg, prompt, imagen_b64, mime)
    raise ValueError(f"Proveedor desconocido: {proveedor}. Usá gemini, openai o anthropic.")


def parsear_json(texto: str) -> dict:
    """Extrae el primer objeto JSON del texto devuelto por la IA."""
    texto = texto.strip()
    # Sacar posibles ```json ... ```
    texto = re.sub(r"^```(json)?", "", texto).strip()
    texto = re.sub(r"```$", "", texto).strip()
    try:
        return json.loads(texto)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", texto, re.DOTALL)
        if m:
            return json.loads(m.group(0))
        raise


# ---------------------------------------------------------------------------
# Enriquecimiento gratis por ISBN (Google Books, sin API key)
# ---------------------------------------------------------------------------

def buscar_por_isbn(isbn: str) -> dict:
    isbn = re.sub(r"[^0-9Xx]", "", isbn or "")
    if len(isbn) not in (10, 13):
        return {}
    try:
        r = requests.get(
            "https://www.googleapis.com/books/v1/volumes",
            params={"q": f"isbn:{isbn}"}, timeout=30,
        )
        r.raise_for_status()
        items = r.json().get("items")
        if not items:
            return {}
        v = items[0]["volumeInfo"]
        return {
            "titulo_libro": v.get("title", ""),
            "autor": ", ".join(v.get("authors", [])),
            "editorial": v.get("publisher", ""),
            "anio": (v.get("publishedDate", "") or "")[:4],
            "idioma": {"es": "Español", "en": "Inglés", "it": "Italiano",
                       "ru": "Ruso", "fr": "Francés", "de": "Alemán",
                       "pt": "Portugués"}.get(v.get("language", ""), v.get("language", "")),
            "tema_genero": ", ".join(v.get("categories", [])),
            "descripcion": v.get("description", ""),
            "isbn": isbn,
        }
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# Armado de la fila de Mercado Libre
# ---------------------------------------------------------------------------

def limpiar(txt) -> str:
    if txt is None:
        return ""
    return str(txt).strip()


def armar_titulo(datos: dict, cfg) -> str:
    partes = [limpiar(datos.get("titulo_libro")), limpiar(datos.get("autor"))]
    etiqueta = limpiar(cfg.get("etiqueta_titulo"))
    if etiqueta:
        partes.append(etiqueta)
    titulo = " ".join(p for p in partes if p)
    titulo = re.sub(r"\s+", " ", titulo).strip()
    max_largo = int(cfg.get("max_largo_titulo", 60))
    if len(titulo) > max_largo:
        titulo = titulo[:max_largo].rstrip()
    return titulo


def resolver_precio(datos: dict, cfg):
    modo = cfg.get("precio", "manual")
    if isinstance(modo, (int, float)):
        return int(modo)
    modo = str(modo).strip().lower()
    if modo == "sugerir":
        p = datos.get("precio_sugerido")
        try:
            return int(float(p))
        except (TypeError, ValueError):
            return ""
    if modo.isdigit():
        return int(modo)
    return ""  # manual -> vacío


def construir_fila(datos: dict, cfg, archivo: str) -> dict:
    titulo = armar_titulo(datos, cfg)
    fila = {c: "" for c in COLUMNAS_ML + COLUMNAS_EXTRA}
    # Columnas de ML (los IDs quedan vacíos: son publicaciones nuevas).
    fila["SKU"] = limpiar(cfg.get("sku_por_defecto"))
    fila["TITLE"] = titulo
    fila["VARIATIONS"] = titulo
    fila["STOCK_FLEX"] = cfg.get("stock", 1)
    fila["PRICE"] = resolver_precio(datos, cfg)
    fila["CURRENCY_ID"] = cfg.get("moneda", "ARS")
    # Columnas extra con lo extraído.
    fila["TITULO_LIBRO"] = limpiar(datos.get("titulo_libro"))
    fila["AUTOR"] = limpiar(datos.get("autor"))
    fila["EDITORIAL"] = limpiar(datos.get("editorial"))
    fila["IDIOMA"] = limpiar(datos.get("idioma"))
    fila["ANIO"] = limpiar(datos.get("anio"))
    fila["ISBN"] = limpiar(datos.get("isbn"))
    fila["TEMA_GENERO"] = limpiar(datos.get("tema_genero"))
    fila["FORMATO"] = limpiar(datos.get("formato"))
    fila["ESTADO"] = limpiar(datos.get("estado"))
    fila["DESCRIPCION"] = limpiar(datos.get("descripcion"))
    fila["PRECIO_SUGERIDO"] = limpiar(datos.get("precio_sugerido"))
    fila["ARCHIVO"] = archivo
    fila["CONFIANZA"] = limpiar(datos.get("confianza"))
    fila["OBSERVACIONES"] = limpiar(datos.get("observaciones"))
    return fila


# ---------------------------------------------------------------------------
# Procesamiento de una entrada (foto / texto / isbn)
# ---------------------------------------------------------------------------

def procesar_foto(cfg, ruta: Path) -> dict:
    b64, mime = _imagen_a_base64(ruta)
    prompt = prompt_para(sugerir_precio=(str(cfg.get("precio")).lower() == "sugerir"))
    texto = llamar_ia(cfg, prompt, b64, mime)
    datos = parsear_json(texto)
    # Enriquecer con Google Books si la IA leyó un ISBN.
    if limpiar(datos.get("isbn")):
        extra = buscar_por_isbn(datos["isbn"])
        for k, v in extra.items():
            if not limpiar(datos.get(k)) and v:
                datos[k] = v
    return datos


def procesar_texto(cfg, dato: str) -> dict:
    prompt = prompt_para(
        sugerir_precio=(str(cfg.get("precio")).lower() == "sugerir"),
        dato_texto=dato,
    )
    texto = llamar_ia(cfg, prompt, None, None)
    return parsear_json(texto)


def procesar_isbn(cfg, isbn: str) -> dict:
    datos = buscar_por_isbn(isbn)
    if not datos:
        # Si Google Books no lo encuentra, probamos con la IA.
        datos = procesar_texto(cfg, f"ISBN {isbn}")
    else:
        datos.setdefault("confianza", "alta")
    return datos


# ---------------------------------------------------------------------------
# Salida a Excel
# ---------------------------------------------------------------------------

def escribir_excel(filas, ruta_salida: Path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Publicaciones"
    columnas = COLUMNAS_ML + COLUMNAS_EXTRA

    encabezado_fill = PatternFill("solid", fgColor="FFE699")
    extra_fill = PatternFill("solid", fgColor="D9E1F2")
    negrita = Font(bold=True)

    for i, col in enumerate(columnas, start=1):
        celda = ws.cell(row=1, column=i, value=col)
        celda.font = negrita
        celda.fill = encabezado_fill if col in COLUMNAS_ML else extra_fill
        celda.alignment = Alignment(horizontal="center")

    for fila in filas:
        ws.append([fila.get(c, "") for c in columnas])

    # Ancho de columnas aproximado.
    anchos = {
        "SKU": 14, "TITLE": 42, "VARIATIONS": 42, "TITULO_LIBRO": 34,
        "AUTOR": 24, "EDITORIAL": 20, "IDIOMA": 12, "DESCRIPCION": 60,
        "OBSERVACIONES": 34, "ARCHIVO": 24,
    }
    for i, col in enumerate(columnas, start=1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = anchos.get(col, 14)
    ws.freeze_panes = "A2"
    wb.save(ruta_salida)


# ---------------------------------------------------------------------------
# Carga de configuración
# ---------------------------------------------------------------------------

def cargar_config(ruta_config: Path) -> dict:
    cfg = dict(CONFIG_POR_DEFECTO)
    if ruta_config.exists():
        try:
            with open(ruta_config, "r", encoding="utf-8") as f:
                cfg.update({k: v for k, v in json.load(f).items() if v != "" or k == "etiqueta_titulo"})
        except json.JSONDecodeError as e:
            print(f"⚠️  config.json inválido ({e}). Uso valores por defecto.")
    # La variable de entorno pisa la key vacía.
    if not cfg.get("api_key"):
        cfg["api_key"] = os.environ.get(VAR_ENTORNO_KEY.get(cfg["proveedor"], ""), "")
    return cfg


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Extrae datos de libros para publicaciones de Mercado Libre a partir de fotos, ISBN o texto.",
    )
    parser.add_argument("--config", default=str(RAIZ / "config.json"), help="Ruta al config.json")
    parser.add_argument("--carpeta", help="Carpeta con fotos (pisa la del config)")
    parser.add_argument("--salida", help="Archivo Excel de salida (pisa el del config)")
    parser.add_argument("--texto", help="Identificar un libro a partir de un texto (título/autor)")
    parser.add_argument("--isbn", help="Identificar un libro a partir de su ISBN")
    args = parser.parse_args()

    cfg = cargar_config(Path(args.config))
    if args.carpeta:
        cfg["carpeta_fotos"] = args.carpeta
    if args.salida:
        cfg["archivo_salida"] = args.salida

    # Validaciones amables.
    proveedor = cfg.get("proveedor")
    if proveedor not in MODELOS_POR_DEFECTO:
        print(f"❌ Proveedor inválido en config: '{proveedor}'. Usá gemini, openai o anthropic.")
        sys.exit(1)
    necesita_key = not (args.isbn and not args.texto)  # el ISBN puro puede resolverse gratis
    if not cfg.get("api_key") and necesita_key:
        print("❌ Falta la API key.")
        print(f"   Poné tu clave en config.json (campo 'api_key') o en la variable "
              f"de entorno {VAR_ENTORNO_KEY[proveedor]}.")
        print("   Ver README.md → 'Cómo conseguir la API key'.")
        sys.exit(1)

    filas = []

    # Modo texto / isbn puntual.
    if args.texto or args.isbn:
        try:
            if args.isbn:
                print(f"🔎 Buscando ISBN {args.isbn} ...")
                datos = procesar_isbn(cfg, args.isbn)
                origen = f"ISBN:{args.isbn}"
            else:
                print(f"🔎 Identificando: {args.texto} ...")
                datos = procesar_texto(cfg, args.texto)
                origen = f"TEXTO:{args.texto}"
            fila = construir_fila(datos, cfg, origen)
            filas.append(fila)
            print(f"   ✔ {fila['TITLE']}  (confianza: {fila['CONFIANZA'] or 's/d'})")
        except Exception as e:
            print(f"   ✖ Error: {e}")
    else:
        # Modo lote: todas las fotos de la carpeta.
        carpeta = Path(cfg["carpeta_fotos"])
        if not carpeta.is_absolute():
            carpeta = RAIZ / carpeta
        if not carpeta.exists():
            print(f"❌ No existe la carpeta de fotos: {carpeta}")
            print("   Creá la carpeta y poné adentro las fotos de los libros.")
            sys.exit(1)

        fotos = sorted(
            p for p in carpeta.iterdir()
            if p.is_file() and p.suffix.lower() in EXTENSIONES_IMAGEN
        )
        if not fotos:
            print(f"❌ No encontré fotos en {carpeta}")
            print(f"   Formatos aceptados: {', '.join(sorted(EXTENSIONES_IMAGEN))}")
            sys.exit(1)

        print(f"📚 {len(fotos)} foto(s) a procesar con {proveedor} "
              f"({cfg['modelo'] or MODELOS_POR_DEFECTO[proveedor]})\n")

        for i, foto in enumerate(fotos, start=1):
            print(f"[{i}/{len(fotos)}] {foto.name} ...", end=" ", flush=True)
            intentos = 0
            while True:
                try:
                    datos = procesar_foto(cfg, foto)
                    fila = construir_fila(datos, cfg, foto.name)
                    filas.append(fila)
                    print(f"✔ {fila['TITLE']}  (confianza: {fila['CONFIANZA'] or 's/d'})")
                    break
                except requests.HTTPError as e:
                    intentos += 1
                    codigo = e.response.status_code if e.response is not None else "?"
                    if codigo == 429 and intentos <= 4:
                        espera = 2 ** intentos
                        print(f"⏳ límite de uso, reintento en {espera}s ...", end=" ", flush=True)
                        time.sleep(espera)
                        continue
                    print(f"✖ Error HTTP {codigo}")
                    filas.append(construir_fila(
                        {"observaciones": f"Error HTTP {codigo}", "confianza": "baja"},
                        cfg, foto.name))
                    break
                except Exception as e:
                    print(f"✖ Error: {e}")
                    filas.append(construir_fila(
                        {"observaciones": f"Error: {e}", "confianza": "baja"},
                        cfg, foto.name))
                    break

    if not filas:
        print("\nNo se generó ninguna fila.")
        sys.exit(1)

    salida = Path(cfg["archivo_salida"])
    if not salida.is_absolute():
        salida = RAIZ / salida
    escribir_excel(filas, salida)
    print(f"\n✅ Listo. {len(filas)} fila(s) escritas en:\n   {salida}")
    print("   Revisá las columnas amarillas (para pegar en la planilla de ML) "
          "y las celestes (datos extra / atributos).")


if __name__ == "__main__":
    main()
