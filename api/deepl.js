export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método no permitido'
    });
  }

  const apiKey = process.env.DEEPL_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'Falta configurar la API key de DeepL'
    });
  }

  try {
    const respuesta = await fetch(
      'https://api-free.deepl.com/v2/translate',
      {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: req.body.text,
          target_lang: 'ES'
        })
      }
    );

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      return res.status(respuesta.status).json(datos);
    }

    return res.status(200).json(datos);

  } catch (error) {
    console.error('Error de DeepL:', error);

    return res.status(500).json({
      error: 'No se pudo realizar la traducción'
    });
  }
}