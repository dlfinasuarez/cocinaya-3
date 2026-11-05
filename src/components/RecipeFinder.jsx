import { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { findRecipes, toSpanish } from '../services/recipes';
import { byExpiry } from '../utils/dates';
import { DAYS, SHIFTS, slotKey } from '../constants';

function RecipeCard({ recipe, uid, plan, onOpen }) {
  const notify = useToast();
  const [slot, setSlot] = useState(slotKey(0, 'almuerzo'));
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const [dayIndex, shift] = slot.split('_');
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', uid, 'plan', slot), {
        recipeId: recipe.id, title: recipe.title, thumb: recipe.thumb,
        day: Number(dayIndex), shift, done: false, createdAt: serverTimestamp(),
      });
      notify(`${recipe.title} agregada a tu semana`);
    } catch (err) {
      console.error(err);
      notify('No se pudo agregar la receta a tu semana.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="recipe">
      <button className="recipe-img" onClick={() => onOpen(recipe)} aria-label={`Ver receta de ${recipe.title}`}>
        <img src={`${recipe.thumb}/preview`} alt="" loading="lazy" />
      </button>
      <div className="recipe-body">
        <h3>{recipe.title}</h3>
        <p className="match">Usa: {recipe.matches.map(toSpanish).join(', ')}</p>
        <button className="btn ghost small" onClick={() => onOpen(recipe)}>Ver receta y modo cocina</button>
        <div className="recipe-actions">
          <select value={slot} onChange={(e) => setSlot(e.target.value)} aria-label="Elegir día y turno">
            {DAYS.map((d, i) => SHIFTS.map((s) => {
              const key = slotKey(i, s.id);
              return <option key={key} value={key}>{d} · {s.label}{plan[key] ? ' (ocupado)' : ''}</option>;
            }))}
          </select>
          <button className="btn primary small" onClick={add} disabled={saving}>
            {saving ? 'Agregando…' : 'Añadir a mi semana'}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function RecipeFinder({ uid, ingredients, plan, onOpenRecipe }) {
  const notify = useToast();
  const [recipes, setRecipes] = useState(null);
  const [loading, setLoading] = useState(false);
  const planByKey = Object.fromEntries(plan.map((p) => [p.id, p]));

  const search = async () => {
    setLoading(true);
    try {
      const result = await findRecipes([...ingredients].sort(byExpiry).map((i) => i.name));
      setRecipes(result);
      if (!result.length) notify('No encontramos recetas con esos ingredientes.', 'error');
    } catch (err) {
      console.error(err);
      notify('No se pudieron buscar recetas. Intentá de nuevo en un momento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div className="panel finder-head">
        <div>
          <h2>Recetas con lo que tenés</h2>
          <p>Lo que vence antes se prioriza en la búsqueda.</p>
        </div>
        <button className="btn primary" onClick={search} disabled={loading || !ingredients.length}>
          {loading ? 'Buscando…' : 'Buscar recetas'}
        </button>
      </div>
      {!ingredients.length && (
        <div className="empty-state"><div className="empty-icon">🍳</div><h3>Primero cargá ingredientes</h3><p>Las recetas se arman con lo que hay en tu heladera.</p></div>
      )}
      {loading && <div className="recipe-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton tall" />)}</div>}
      {!loading && recipes && (
        <div className="recipe-grid">
          {recipes.map((r) => <RecipeCard key={r.id} recipe={r} uid={uid} plan={planByKey} onOpen={onOpenRecipe} />)}
        </div>
      )}
    </section>
  );
}
