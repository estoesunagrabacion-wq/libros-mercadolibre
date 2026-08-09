/**
 * Proxy de precios de Mercado Libre (Cloudflare Worker).
 *
 * Recibe ?q=<título autor> y devuelve un resumen de precios reales de ML Argentina
 * (mediana, rango típico), con CORS para que la app web lo consulte.
 *
 * Diagnóstico: agregá &debug=1 para ver qué le respondió Mercado Libre al Worker
 *   (útil cuando devuelve count:0). Ej: https://TU-WORKER.workers.dev/?q=Rayuela%20Cortazar&debug=1
 *
 * Deploy: ver README.md de esta carpeta.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const debug = url.searchParams.get("debug") === "1";
    if (!q) return json({ error: "Falta el parámetro q" }, 400);

    const diag = { q };
    try {
      // 1) API pública de ML (puede requerir auth).
      const api = await desdeAPI(q);
      diag.apiStatus = api.status;
      diag.apiCount = api.precios.length;

      // 2) HTML de la página de resultados.
      const html = await desdeHTML(q);
      diag.mlUrl = html.url;
      diag.htmlStatus = html.status;
      diag.htmlLen = html.text.length;
      const patrones = extraerPrecios(html.text);
      diag.patrones = patrones.conteos;

      // Elegir el conjunto con más valores.
      let precios = api.precios;
      for (const arr of [patrones.frac, patrones.jsonNum, patrones.jsonStr, patrones.meta]) {
        if (arr.length > precios.length) precios = arr;
      }
      const limpios = limpiar(precios);
      diag.crudos = precios.length;
      diag.limpios = limpios.length;

      if (debug) {
        diag.muestra = limpios.slice(0, 12);
        diag.htmlInicio = html.text.slice(0, 500);
        return json(diag);
      }
      if (!limpios.length) return json({ q, count: 0 });
      limpios.sort((a, b) => a - b);
      const pct = (p) => limpios[Math.min(limpios.length - 1, Math.floor(limpios.length * p))];
      return json({
        q, count: limpios.length,
        min: limpios[0], max: limpios[limpios.length - 1],
        median: pct(0.5), p25: pct(0.25), p75: pct(0.75),
      });
    } catch (e) {
      diag.error = String((e && e.message) || e);
      return json(diag, debug ? 200 : 502);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

async function desdeAPI(q) {
  try {
    const r = await fetch("https://api.mercadolibre.com/sites/MLA/search?limit=50&q=" + encodeURIComponent(q),
      { headers: { "Accept": "application/json" } });
    const status = r.status;
    if (!r.ok) return { status, precios: [] };
    const d = await r.json();
    const precios = (d.results || []).map((x) => Number(x.price)).filter((p) => p > 0);
    return { status, precios };
  } catch (e) {
    return { status: "err:" + ((e && e.message) || e), precios: [] };
  }
}

async function desdeHTML(q) {
  const url = "https://listado.mercadolibre.com.ar/" + encodeURIComponent(q);
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-AR,es;q=0.9",
    },
    redirect: "follow",
  });
  return { url: r.url || url, status: r.status, text: await r.text() };
}

// Extrae precios con varios patrones (los precios visibles usan '.' como miles; en JSON el '.' es decimal).
function extraerPrecios(html) {
  let m;
  const frac = [];
  const reFrac = /andes-money-amount__fraction[^>]*>([\d.]+)</g;
  while ((m = reFrac.exec(html))) { const n = parseInt(m[1].replace(/\./g, ""), 10); if (!isNaN(n)) frac.push(n); }

  const jsonNum = [];
  const reJsonNum = /"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/g;
  while ((m = reJsonNum.exec(html))) { const n = Math.round(parseFloat(m[1])); if (!isNaN(n)) jsonNum.push(n); }

  const jsonStr = [];
  const reJsonStr = /"price"\s*:\s*"([0-9]+(?:\.[0-9]+)?)"/g;
  while ((m = reJsonStr.exec(html))) { const n = Math.round(parseFloat(m[1])); if (!isNaN(n)) jsonStr.push(n); }

  const meta = [];
  const reMeta = /itemprop=["']price["'][^>]*content=["']([0-9]+(?:\.[0-9]+)?)["']/g;
  while ((m = reMeta.exec(html))) { const n = Math.round(parseFloat(m[1])); if (!isNaN(n)) meta.push(n); }

  return { frac, jsonNum, jsonStr, meta, conteos: { frac: frac.length, jsonNum: jsonNum.length, jsonStr: jsonStr.length, meta: meta.length } };
}

function limpiar(arr) {
  let p = arr.filter((n) => n >= 500 && n <= 5000000);
  if (p.length < 4) return p;
  const s = [...p].sort((a, b) => a - b);
  const q1 = s[Math.floor(s.length * 0.25)], q3 = s[Math.floor(s.length * 0.75)];
  const iqr = q3 - q1, lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
  return p.filter((n) => n >= lo && n <= hi);
}
