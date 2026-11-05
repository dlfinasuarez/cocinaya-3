import { useEffect, useState } from 'react';
import { findRecipes } from '../services/recipes';
import { byExpiry } from '../utils/dates';

// Busca una receta priorizando los ingredientes que vencen antes.
// Vive en App para no repetir la consulta al cambiar de pestaña.
export function useSuggestion(ingredients, ready) {
  const [state, setState] = useState({ loading: false, recipe: null, error: false });
  const key = [...ingredients].sort(byExpiry).slice(0, 5).map((i) => i.name).join('|');

  useEffect(() => {
    if (!ready || !key) {
      setState({ loading: false, recipe: null, error: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: false }));
    findRecipes(key.split('|'))
      .then((list) => {
        if (cancelled) return;
        const top = list.slice(0, 3); // rota entre las 3 mejores según el día
        setState({ loading: false, recipe: top.length ? top[new Date().getDate() % top.length] : null, error: false });
      })
      .catch(() => !cancelled && setState({ loading: false, recipe: null, error: true }));
    return () => { cancelled = true; };
  }, [key, ready]);

  return state;
}
