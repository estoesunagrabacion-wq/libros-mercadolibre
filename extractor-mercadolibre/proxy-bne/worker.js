/**
 * Proxy BNE (Biblioteca Nacional de España) — Cloudflare Worker.
 *
 * Recibe ?isbn=<isbn> y devuelve, en JSON y con CORS, los datos que la BNE tiene
 * de ese libro: cantidad de páginas y medidas físicas (alto/ancho en cm), que la
 * BNE suele traer para libros en español (donde Google Books / OpenLibrary fallan).
 *
 * Consulta el catálogo de la BNE por SRU (Search/Retrieve via URL), que devuelve
 * MARCXML. El campo MARC 300 trae la descripción física: $a = páginas, $c = medidas.
 *
 * Diagnóstico: agregá &debug=1 para ver qué endpoint respondió y con qué (útil si
 *   devuelve {found:false}). Ej: https://TU-WORKER.workers.dev/?isbn=9788483462287&debug=1
 *
 * Deploy: ver README.md de esta carpeta.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Distintos endpoints/formas de consulta de la BNE que probamos en orden hasta que
// uno devuelva un registro. Si la BNE cambia su servicio, se ajustan acá.
const CANDIDATOS = [
  (isbn) => ["catalogo/isbn", "https://catalogo.bne.es/uhtbin/sru?version=1.1&operation=searchRetrieve&recordSchema=marcxml&maximumRecords=1&query=" + encodeURIComponent("isbn=" + isbn)],
  (isbn) => ["catalogo/bath.isbn", "https://catalogo.bne.es/uhtbin/sru?version=1.1&operation=searchRetrieve&recordSchema=marcxml&maximumRecords=1&query=" + encodeURIComponent("bath.isbn=" + isbn)],
  (isbn) => ["catalogo/1.4", "https://catalogo.bne.es/uhtbin/sru?version=1.1&operation=searchRetrieve&recordSchema=marcxml&maximumRecords=1&query=" + encodeURIComponent("1.4=" + isbn)],
  (isbn) => ["catalogo-http/isbn", "http://catalogo.bne.es/uhtbin/sru?version=1.1&operation=searchRetrieve&recordSchema=marcxml&maximumRecords=1&query=" + encodeURIComponent("isbn=" + isbn)],
];

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const isbn = (url.searchParams.get("isbn") || "").replace(/[^0-9Xx]/g, "");
    const debug = url.searchParams.get("debug") === "1";
    if (!isbn) return json({ error: "Falta el parámetro isbn" }, 400);

    const diag = { isbn, intentos: [] };
    for (const build of CANDIDATOS) {
      const [nombre, u] = build(isbn);
      const intento = { nombre, url: u };
      try {
        const r = await fetch(u, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LibrosBot/1.0)",
            "Accept": "application/xml,text/xml,*/*",
          },
          redirect: "follow",
        });
        intento.status = r.status;
        const xml = await r.text();
        intento.len = xml.length;
        const rec = parseMarc(xml);
        intento.found = !!rec._record;
        if (debug) { intento.snippet = xml.slice(0, 400); intento.rec = rec; }
        diag.intentos.push(intento);
        if (rec._record && (rec.paginas || rec.altura_cm || rec.editorial)) {
          delete rec._record;
          if (debug) { diag.resultado = rec; return json(diag); }
          return json({ isbn, found: true, ...rec });
        }
      } catch (e) {
        intento.error = String((e && e.message) || e);
        diag.intentos.push(intento);
      }
    }
    if (debug) return json(diag);
    return json({ isbn, found: false });
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

// Extrae de un MARCXML: páginas (300$a), medidas (300$c), editorial/año/ciudad (260/264).
function parseMarc(xml) {
  const out = {};
  if (!xml || !/<(?:\w+:)?record[\s>]/.test(xml)) return out;
  out._record = true;

  const campo = (tag) => {
    const re = new RegExp('<(?:\\w+:)?datafield[^>]*tag="' + tag + '"[\\s\\S]*?<\\/(?:\\w+:)?datafield>', "i");
    const m = xml.match(re);
    return m ? m[0] : "";
  };
  const sub = (bloque, code) => {
    if (!bloque) return "";
    const m = bloque.match(new RegExp('<(?:\\w+:)?subfield[^>]*code="' + code + '"[^>]*>([^<]*)<', "i"));
    return m ? m[1].trim() : "";
  };

  const f300 = campo("300");
  const pag = sub(f300, "a");
  if (pag) { const m = pag.match(/(\d+)/); if (m) out.paginas = m[1]; }

  const dim = sub(f300, "c"); // ej. "21 cm", "24 x 17 cm"
  if (dim) {
    const nums = (dim.match(/[\d.,]+/g) || []).map((x) => parseFloat(x.replace(",", ".")));
    if (nums[0]) out.altura_cm = String(nums[0]);
    if (nums[1]) out.ancho_cm = String(nums[1]);
  }

  const f = campo("264") || campo("260");
  const ciudad = sub(f, "a").replace(/[\s:;,]+$/, "");
  const editorial = sub(f, "b").replace(/[\s:;,]+$/, "");
  const anioRaw = sub(f, "c");
  if (ciudad) out.ciudad = ciudad;
  if (editorial) out.editorial = editorial;
  if (anioRaw) { const m = anioRaw.match(/\d{4}/); if (m) out.anio = m[0]; }

  return out;
}
