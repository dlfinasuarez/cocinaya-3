export const traducirTextos = async (textos) => {
    if (!textos.length) return [];

    try {
        const respuesta = await fetch('/api/deepl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: textos,
                target_lang: 'ES'
            })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(datos.message || datos.error || 'Error al traducir');
        }

        return datos.translations.map((item) => item.text);

    } catch (error) {
        console.error('Error al traducir:', error);
        throw error;
    }
};

export const traducirTexto = async (texto) => {
    if (!texto) return texto;

    const resultado = await traducirTextos([texto]);

    return resultado[0];
};