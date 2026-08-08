/**
 * Proxy de precios de Mercado Libre (Cloudflare Worker).
 *
 * Qué hace: recibe ?q=<título autor> y devuelve un resumen de precios reales de
 * publicaciones parecidas en Mercado Libre Argentina (mediana, rango típico, etc.),
 * con los headers CORS necesarios para que la app web lo pueda consultar.
 *
 * Por qué hace falta: el navegador no puede leer Mercado Libre directamente (CORS).
 * Este Worker corre en el borde de Cloudflare (sin ese límite) y hace de intermediario.
 *
 * Cómo desplegarlo: ver README.md de esta carpeta (2 minutos en el panel de Cloudflare).
 *
 * Uso:  https://TU-WORKER.workers.dev/?q=Rayuela%20Cortazar
 * Devuelve JSON: { q, count, median, p25, p75, min, max }
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
    if (!q) return json({ error: "Falta el parámetro q" }, 400);
    try {
      let precios = await desdeAPI(q);
      if (precios.length < 3) {
        const scr = await desdeHTML(q);
        if (scr.length > precios.length) precios = scr;
      }
      precios = limpiar(precios);
      if (!precios.length) return json({ q, count: 0 });
      precios.sort((a, b) => a - b);
      const pct = (p) => precios[Math.min(precios.length - 1, Math.floor(precios.length * p))];
      return json({
        q,
        count: precios.length,
        min: precios[0],
        max: precios[precios.length - 1],
        median: pct(0.5),
        p25: pct(0.25),
        p75: pct(0.75),
      });
    } catch (e) {
      return json({ q, error: String(e && e.message || e) }, 502);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

// Intenta la API pública de Mercado Libre (puede requerir auth; si falla, devuelve []).
async function desdeAPI(q) {
  try {
    const r = await fetch(
      "https://api.mercadolibre.com/sites/MLA/search?limit=50&q=" + encodeURIComponent(q),
      { headers: { "Accept": "application/json" } }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.results || []).map((x) => Number(x.price)).filter((p) => p > 0);
  } catch (e) {
    return [];
  }
}

// Lee la página de resultados de ML y extrae los precios visibles.
async function desdeHTML(q) {
  const u = "https://listado.mercadolibre.com.ar/" + encodeURIComponent(q);
  const r = await fetch(u, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept-Language": "es-AR,es;q=0.9",
    },
  });
  const html = await r.text();
  const precios = [];
  const re = /andes-money-amount__fraction[^>]*>([\d.]+)</g;
  let m;
  while ((m = re.exec(html))) {
    const n = parseInt(m[1].replace(/\./g, ""), 10);
    if (!isNaN(n)) precios.push(n);
  }
  return precios;
}

// Filtra valores fuera de rango razonable y outliers (IQR) para que la mediana sea confiable.
function limpiar(arr) {
  let p = arr.filter((n) => n >= 500 && n <= 5000000);
  if (p.length < 4) return p;
  const s = [...p].sort((a, b) => a - b);
  const q1 = s[Math.floor(s.length * 0.25)];
  const q3 = s[Math.floor(s.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
  return p.filter((n) => n >= lo && n <= hi);
}
