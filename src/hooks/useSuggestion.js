import { useEffect, useState } from 'react';
import { findRecipes } from '../services/recipes';
import { byExpiry, isExpiring } from '../utils/dates';

// Busca una receta priorizando los ingredientes que vencen antes.
// Vive en App para no repetir la consulta al cambiar de pestaña.
// Usa la misma consulta que la pestaña Recetas, así comparten el caché.
export function useSuggestion(ingredients, ready) {
  const [state, setState] = useState({ loading: false, recipe: null, error: false });
  const sorted = [...ingredients].sort(byExpiry);
  const names = sorted.map((i) => i.name).join('|');
  const urgent = sorted.filter(isExpiring).map((i) => i.name).join('|');
  const key = `${names}#${urgent}`;

  useEffect(() => {
    if (!ready || !names) {
      setState({ loading: false, recipe: null, error: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: false }));
    findRecipes(names.split('|'), { priority: urgent ? urgent.split('|') : [] })
      .then((list) => {
        if (cancelled) return;
        const top = list.slice(0, 3); // rota entre las 3 mejores según el día
        setState({ loading: false, recipe: top.length ? top[new Date().getDate() % top.length] : null, error: false });
      })
      .catch(() => !cancelled && setState({ loading: false, recipe: null, error: true }));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  return state;
}
