import { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { findRecipes, popularRecipes, searchRecipes, withAvailability } from '../services/recipes';
import { byExpiry, isExpiring } from '../utils/dates';
import { formatMinutes } from '../utils/format';
import { ALLERGEN_LABELS, AVOID_OPTIONS, DAYS, DIET_LABELS, SHIFTS, slotKey } from '../constants';
import RecipeImg from './RecipeImg';

const MODES = [
  { id: 'pantry', label: 'Con mi heladera' },
  { id: 'search', label: 'Buscar' },
  { id: 'popular', label: 'Populares' },
];

function RecipeCard({ recipe, uid, plan, fridge, onOpen }) {
  const notify = useToast();
  const [slot, setSlot] = useState(slotKey(0, 'almuerzo'));
  const [saving, setSaving] = useState(false);

  const needed = withAvailability(recipe, fridge).filter((i) => !i.staple && !i.optional);
  const have = needed.filter((i) => i.have).length;
  const diets = Object.keys(DIET_LABELS).filter((k) => recipe.dietary?.[k] === true).slice(0, 3);
  const minutes = recipe.times.total || recipe.times.cook;

  const add = async () => {
    const [dayIndex, shift] = slot.split('_');
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', uid, 'plan', slot), {
        recipeId: recipe.id,
        title: recipe.title,
        thumb: recipe.thumb ?? null,
        day: Number(dayIndex),
        shift,
        done: false,
        createdAt: serverTimestamp(),
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
        <RecipeImg src={recipe.thumb} alt="" />
      </button>
      <div className="recipe-body">
        <h3>{recipe.title}</h3>
        <p className="recipe-meta">
          {minutes ? <span>⏱ {formatMinutes(minutes)}</span> : null}
          {recipe.rating?.value ? <span>★ {Math.round(recipe.rating.value * 10) / 10}{recipe.rating.count ? ` (${recipe.rating.count})` : ''}</span> : null}
        </p>
        {needed.length > 0 && (
          <p className={`avail ${have === needed.length ? 'full' : ''}`}>
            {have === needed.length ? 'Tenés todo para cocinarla' : `Tenés ${have} de ${needed.length} ingredientes`}
          </p>
        )}
        {diets.length > 0 && (
          <div className="pills">{diets.map((k) => <span key={k} className="pill">{DIET_LABELS[k]}</span>)}</div>
        )}
        {recipe.allergens.length > 0 && (
          <p className="allergen-line">Contiene: {recipe.allergens.map((a) => ALLERGEN_LABELS[a] || a).join(', ')}</p>
        )}
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
  const [mode, setMode] = useState('pantry');
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('en');
  const [maxMissing, setMaxMissing] = useState('');
  const [without, setWithout] = useState([]);
  const [recipes, setRecipes] = useState(null);
  const [loading, setLoading] = useState(false);
  const planByKey = Object.fromEntries(plan.map((p) => [p.id, p]));

  const toggleAvoid = (a) => setWithout((w) => (w.includes(a) ? w.filter((x) => x !== a) : [...w, a]));

  const run = async () => {
    if (mode === 'search' && query.trim().length < 2) return notify('Escribí al menos 2 letras para buscar.', 'error');
    setLoading(true);
    try {
      const base = { language, without };
      let list;
      if (mode === 'pantry') {
        const sorted = [...ingredients].sort(byExpiry);
        list = await findRecipes(sorted.map((i) => i.name), {
          ...base,
          maxMissing: maxMissing === '' ? undefined : Number(maxMissing),
          priority: sorted.filter(isExpiring).map((i) => i.name),
        });
      } else if (mode === 'search') {
        list = await searchRecipes(query.trim(), base);
      } else {
        list = await popularRecipes(base);
      }
      setRecipes(list);
      if (!list.length) notify('No encontramos recetas con esos filtros.', 'error');
    } catch (err) {
      console.error(err);
      notify(err.userMessage || 'No se pudieron buscar recetas. Intentá de nuevo en un momento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const blocked = mode === 'pantry' && !ingredients.length;

  return (
    <section>
      <div className="panel finder">
        <div>
          <h2>Recetas</h2>
          <p>Lo que vence antes se prioriza al buscar con tu heladera.</p>
        </div>

        <div className="chips" role="group" aria-label="Tipo de búsqueda">
          {MODES.map((m) => (
            <button key={m.id} className={`chip ${mode === m.id ? 'on' : ''}`} onClick={() => { setMode(m.id); setRecipes(null); }}>
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'search' && (
          <div className="field">
            <label htmlFor="rq">¿Qué tenés ganas de comer? (en inglés funciona mejor)</label>
            <input id="rq" value={query} placeholder="creamy pasta, vegetarian lunch…"
              onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
          </div>
        )}

        <div className="filters">
          <div className="field">
            <label htmlFor="rl">Idioma de las recetas</label>
            <select id="rl" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">English (más recetas)</option>
              <option value="es">Español (menos recetas)</option>
            </select>
          </div>
          {mode === 'pantry' && (
            <div className="field">
              <label htmlFor="rm">Ingredientes que me faltan</label>
              <select id="rm" value={maxMissing} onChange={(e) => setMaxMissing(e.target.value)}>
                <option value="">Cualquiera</option>
                <option value="0">Ninguno (cocinar ya)</option>
                <option value="1">Hasta 1</option>
                <option value="2">Hasta 2</option>
                <option value="3">Hasta 3</option>
              </select>
            </div>
          )}
        </div>

        <div>
          <p className="filter-label">Evitar alérgenos</p>
          <div className="chips" role="group" aria-label="Evitar alérgenos">
            {AVOID_OPTIONS.map((a) => (
              <button key={a} className={`chip ${without.includes(a) ? 'on' : ''}`} onClick={() => toggleAvoid(a)}>
                {ALLERGEN_LABELS[a]}
              </button>
            ))}
          </div>
          <p className="hint">Informativo: verificá siempre los ingredientes y las etiquetas.</p>
        </div>

        <button className="btn primary" onClick={run} disabled={loading || blocked}>
          {loading ? 'Buscando…' : mode === 'popular' ? 'Ver populares' : 'Buscar recetas'}
        </button>
      </div>

      {blocked && (
        <div className="empty-state">
          <div className="empty-icon">🍳</div>
          <h3>Primero cargá ingredientes</h3>
          <p>Para buscar con tu heladera necesitás ingredientes cargados. También podés usar Buscar o Populares.</p>
        </div>
      )}
      {loading && <div className="recipe-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton tall" />)}</div>}
      {!loading && recipes && (
        <div className="recipe-grid">
          {recipes.map((r) => <RecipeCard key={r.id} recipe={r} uid={uid} plan={planByKey} fridge={ingredients} onOpen={onOpenRecipe} />)}
        </div>
      )}
    </section>
  );
}
