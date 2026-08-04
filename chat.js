// Proxy serverless a la API de Anthropic.
// La API key vive SOLO acá (variable de entorno en Vercel), nunca en el navegador.
//
// Configurar en Vercel: Settings → Environment Variables → ANTHROPIC_API_KEY
//
// Acepta dos formas:
//   { prompt, system }                  → consulta de texto simple
//   { content: [...bloques], system }   → texto + imágenes (análisis con visión)

export default async function handler(req, res) {
  // Diagnóstico: el panel lo consulta al abrir para saber si la IA está
  // disponible ANTES de una reunión.
  if (req.method === "GET") {
    return res.status(200).json({ ia: Boolean(process.env.ANTHROPIC_API_KEY) });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo POST" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "sin_api_key" });
  }

  try {
    const { prompt, content, system, max_tokens } = req.body || {};

    const userContent = Array.isArray(content) && content.length
      ? content
      : prompt
        ? [{ type: "text", text: prompt }]
        : null;

    if (!userContent) return res.status(400).json({ error: "Falta el contenido" });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: max_tokens || 1500,
        system: system || "",
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!r.ok) {
      const detalle = await r.text();
      return res.status(r.status).json({ error: "error_anthropic", detalle });
    }

    const data = await r.json();
    const texto = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return res.status(200).json({ texto });
  } catch (e) {
    return res.status(500).json({ error: "fallo_servidor", detalle: String(e) });
  }
}
