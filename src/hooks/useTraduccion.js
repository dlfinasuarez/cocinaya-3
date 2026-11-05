import { useState, useEffect } from 'react';
import { traducirTextos } from '../services/translate';

export function useTraduccionReceta(recetaOriginal) {
    const [recetaTraducida, setRecetaTraducida] = useState(null);

    useEffect(() => {
        if (!recetaOriginal) {
            setRecetaTraducida(null);
            return;
        }

        let cancelado = false;

        const traducir = async () => {
            const receta = {
                ...recetaOriginal,
                ingredients: recetaOriginal.ingredients?.map((i) => ({ ...i })),
                steps: recetaOriginal.steps?.map((s) => ({ ...s })),
                notes: [...(recetaOriginal.notes || [])]
            };

            const textos = [];
            const actualizar = [];

            const agregar = (texto, funcion) => {
                if (typeof texto === 'string' && texto.trim()) {
                    textos.push(texto);
                    actualizar.push(funcion);
                }
            };

            // Título y descripción
            agregar(receta.title, (v) => receta.title = v);
            agregar(receta.description, (v) => receta.description = v);

            // Ingredientes
            receta.ingredients?.forEach((ing) => {
                agregar(ing.display, (v) => ing.display = v);
                agregar(ing.localName, (v) => ing.localName = v);
                agregar(ing.preparation, (v) => ing.preparation = v);
                agregar(ing.group, (v) => ing.group = v);
            });

            // Pasos de preparación
            receta.steps?.forEach((step) => {
                agregar(step.text, (v) => step.text = v);
                agregar(step.group, (v) => step.group = v);
            });

            // Notas
            receta.notes.forEach((nota, index) => {
                agregar(nota, (v) => receta.notes[index] = v);
            });

            try {
                const traducciones = await traducirTextos(textos);

                traducciones.forEach((traduccion, index) => {
                    actualizar[index](traduccion);
                });

                if (!cancelado) {
                    setRecetaTraducida(receta);
                }

            } catch (error) {
                console.error('No se pudo traducir la receta:', error);

                if (!cancelado) {
                    setRecetaTraducida(recetaOriginal);
                }
            }
        };

        traducir();

        return () => {
            cancelado = true;
        };

    }, [recetaOriginal]);

    return recetaTraducida;
}