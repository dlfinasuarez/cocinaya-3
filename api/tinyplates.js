// Función serverless de Vercel. El navegador llama a /api/tinyplates y esta función
// reenvía la consulta a Tiny Plates agregando la API key, que vive SOLO en el servidor.
const ALLOWED = /^(pantry|search|popular|shopping-list|substitutions|recipes\/[A-Za-z0-9_-]+)$/;

export default async function handler(req, res) {
  const key = process.env.TINY_PLATES_API_KEY;
  if (!key) return res.status(500).json({ error: { message: 'Falta TINY_PLATES_API_KEY en el servidor.' } });

  const { path, ...params } = req.query;
  if (typeof path !== 'string' || !ALLOWED.test(path)) {
    return res.status(400).json({ error: { message: 'Ruta no permitida.' } });
  }

  const url = new URL(`https://api.tinyplates.dev/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, Array.isArray(v) ? v.join(',') : v));

  try {
    const upstream = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const body = await upstream.text();
    res.setHeader('Content-Type', 'application/json');
    // Solo las respuestas correctas se guardan en el CDN de Vercel: ahorran cupo diario
    res.setHeader('Cache-Control', upstream.ok ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'no-store');
    return res.status(upstream.status).send(body);
  } catch {
    return res.status(502).json({ error: { message: 'No se pudo contactar a Tiny Plates.' } });
  }
}
