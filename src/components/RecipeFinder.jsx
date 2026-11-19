import { useState, useRef } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { findRecipes, popularRecipes, searchRecipes, withAvailability } from '../services/recipes';
import { byExpiry, isExpiring } from '../utils/dates';
import { formatMinutes } from '../utils/format';
import { ALLERGEN_LABELS, AVOID_OPTIONS, DAYS, DIET_LABELS, SHIFTS, slotKey } from '../constants';
import RecipeImg from './RecipeImg';
import { useTraduccionReceta } from '../hooks/useTraduccion';
import { Icon, EmptyGraphic } from './Icons';

const MODES = [
  { id: 'pantry', label: 'Con mi heladera' },
  { id: 'search', label: 'Buscar por plato' },
  { id: 'popular', label: 'Populares' },
];

function RecipeCard({ recipe, uid, plan, fridge, onOpen }) {
  const recetaSugerida = useTraduccionReceta(recipe);
  const receta = recetaSugerida || recipe;
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
        title: receta.title,
        thumb: recipe.thumb ?? null,
        day: Number(dayIndex),
        shift,
        done: false,
        createdAt: serverTimestamp(),
      });
      notify(`"${receta.title}" agregada a tu semana`);
    } catch (err) {
      console.error(err);
      notify('No se pudo agregar la receta a tu semana.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="recipe-card-editorial">
      <button
        type="button"
        className="recipe-img-btn"
        onClick={() => onOpen(recipe)}
        aria-label={`Ver receta de ${receta.title}`}
      >
        <RecipeImg src={recipe.thumb} alt={receta.title} />
        {minutes ? (
          <span className="recipe-time-tag">
            <Icon name="clock" size={12} /> {formatMinutes(minutes)}
          </span>
        ) : null}
      </button>

      <div className="recipe-card-body">
        <h3 className="recipe-title">{receta.title}</h3>

        <div className="recipe-meta-row">
          {recipe.rating?.value ? (
            <span className="recipe-rating">
              ★ {Math.round(recipe.rating.value * 10) / 10}
              {recipe.rating.count ? ` (${recipe.rating.count})` : ''}
            </span>
          ) : null}
          {recipe.language && (
            <span className="recipe-lang-tag">
              {recipe.language.toUpperCase()}
            </span>
          )}
        </div>

        {needed.length > 0 && (
          <p className={`avail-badge ${have === needed.length ? 'full' : 'partial'}`}>
            <Icon name={have === needed.length ? 'check' : 'pot'} size={14} />
            {have === needed.length
              ? 'Tenés todo para cocinarla'
              : `Tenés ${have} de ${needed.length} ingredientes`}
          </p>
        )}

        {diets.length > 0 && (
          <div className="pills">
            {diets.map((k) => (
              <span key={k} className="pill good">
                {DIET_LABELS[k]}
              </span>
            ))}
          </div>
        )}

        {recipe.allergens.length > 0 && (
          <p className="allergen-line">
            Contiene: {recipe.allergens.map((a) => ALLERGEN_LABELS[a] || a).join(', ')}
          </p>
        )}

        <button
          type="button"
          className="btn ghost small view-detail-btn"
          onClick={() => onOpen(receta)}
        >
          Ver ingredientes y modo cocina
        </button>

        <div className="recipe-plan-assign">
          <label htmlFor={`slot-select-${recipe.id}`} className="sr-only">
            Elegir día y turno para planificar
          </label>
          <select
            id={`slot-select-${recipe.id}`}
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
          >
            {DAYS.map((d, i) =>
              SHIFTS.map((s) => {
                const key = slotKey(i, s.id);
                return (
                  <option key={key} value={key}>
                    {d} · {s.label}
                    {plan[key] ? ' (ocupado)' : ''}
                  </option>
                );
              })
            )}
          </select>
          <button
            type="button"
            className="btn primary small"
            onClick={add}
            disabled={saving}
          >
            <Icon name="plus" size={14} /> {saving ? 'Sumando…' : 'A mi semana'}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function RecipeFinder({ uid, ingredients = [], plan = [], onOpenRecipe }) {
  const notify = useToast();
  const [mode, setMode] = useState('pantry');
  const [query, setQuery] = useState('');
  const [maxMissing, setMaxMissing] = useState('');
  const [without, setWithout] = useState([]);
  const [recipes, setRecipes] = useState(null);
  const [loading, setLoading] = useState(false);
  const searchSeqRef = useRef(0);
  const planByKey = Object.fromEntries(plan.map((p) => [p.id, p]));

  const toggleAvoid = (a) =>
    setWithout((w) => (w.includes(a) ? w.filter((x) => x !== a) : [...w, a]));

  const run = async () => {
    if (mode === 'search' && query.trim().length < 2) {
      return notify('Escribí al menos 2 letras para buscar una receta.', 'error');
    }
    const currentSeq = ++searchSeqRef.current;
    setLoading(true);
    try {
      // Sin selector de idioma manual: consultamos todas las recetas disponibles (ES + EN unificadas y cacheadas)
      const base = { without, language: 'both' };
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

      // Evita condiciones de carrera si el usuario disparó otra búsqueda mientras esta procesaba
      if (currentSeq !== searchSeqRef.current) return;

      setRecipes(list);
      if (!list.length) {
        if (mode === 'search') {
          if (without.length > 0) {
            notify(`No encontramos recetas para "${query.trim()}" con los alérgenos filtrados. Probá ajustando los filtros.`, 'error');
          } else {
            notify(`No encontramos recetas con el término "${query.trim()}". Probá con palabras como pasta, pollo, ensalada o pizza.`, 'error');
          }
        } else if (mode === 'pantry') {
          notify('No encontramos recetas con esos filtros. Probá ajustando la tolerancia de ingredientes o alérgenos.', 'error');
        } else {
          notify('No se encontraron recetas populares en este momento.', 'error');
        }
      }
    } catch (err) {
      if (currentSeq !== searchSeqRef.current) return;
      console.error(err);
      notify(err.userMessage || 'No se pudieron buscar recetas. Intentá de nuevo en un momento.', 'error');
    } finally {
      if (currentSeq === searchSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const blocked = mode === 'pantry' && !ingredients.length;

  return (
    <section className="recipes-page">
      <div className="panel finder-box">
        <header className="finder-header">
          <div>
            <h2>Buscador de recetas</h2>
            <p>Descubrí recetas combinando lo que tenés en la heladera, priorizando lo que vence antes.</p>
          </div>
        </header>

        {/* Modos de búsqueda */}
        <div className="chips" role="group" aria-label="Modo de búsqueda de recetas">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`chip ${mode === m.id ? 'on' : ''}`}
              onClick={() => {
                setMode(m.id);
                setRecipes(null);
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Campo de búsqueda libre */}
        {mode === 'search' && (
          <div className="field">
            <label htmlFor="rq">¿Qué tenés ganas de cocinar?</label>
            <div className="input-with-icon">
              <input
                id="rq"
                value={query}
                placeholder="Ej: pasta carbonara, guiso de lentejas, ensalada tibia…"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && run()}
              />
            </div>
          </div>
        )}

        {/* Filtros específicos según el modo */}
        <div className="filters-grid">
          {mode === 'pantry' && (
            <div className="field">
              <label htmlFor="rm">Tolerancia de ingredientes faltantes</label>
              <select
                id="rm"
                value={maxMissing}
                onChange={(e) => setMaxMissing(e.target.value)}
              >
                <option value="">Cualquiera (ver todas las posibles)</option>
                <option value="0">Ninguno (solo con lo que tengo ahora)</option>
                <option value="1">Hasta 1 ingrediente faltante</option>
                <option value="2">Hasta 2 ingredientes faltantes</option>
                <option value="3">Hasta 3 ingredientes faltantes</option>
              </select>
            </div>
          )}
        </div>

        {/* Filtro de alérgenos a evitar */}
        <div className="allergen-filter-section">
          <p className="filter-label">Evitar alérgenos:</p>
          <div className="chips" role="group" aria-label="Evitar alérgenos">
            {AVOID_OPTIONS.map((a) => (
              <button
                key={a}
                type="button"
                className={`chip chip-allergen ${without.includes(a) ? 'on' : ''}`}
                onClick={() => toggleAvoid(a)}
              >
                {ALLERGEN_LABELS[a]}
              </button>
            ))}
          </div>
          <span className="hint">Filtro orientativo. Verificá siempre los ingredientes individuales de la receta.</span>
        </div>

        <button
          type="button"
          className="btn primary"
          onClick={run}
          disabled={loading || blocked}
        >
          <Icon name="search" size={16} />
          {loading
            ? 'Buscando recetas…'
            : mode === 'popular'
            ? 'Explorar recetas populares'
            : 'Buscar recetas'}
        </button>
      </div>

      {blocked && (
        <div className="panel empty-state">
          <EmptyGraphic type="fridge" />
          <h3>Cargá tus ingredientes primero</h3>
          <p>Para buscar recetas con tu heladera necesitás registrar lo que tenés en casa. También podés usar "Buscar por plato" o "Populares".</p>
        </div>
      )}

      {loading && (
        <div className="recipe-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton tall" />
          ))}
        </div>
      )}

      {!loading && recipes && recipes.length === 0 && (
        <div className="panel empty-state">
          <EmptyGraphic type="meal" />
          <h3>No encontramos recetas</h3>
          <p>
            {mode === 'search'
              ? `No encontramos resultados para "${query.trim()}". Probá con términos como fideos, pasta, pollo, pizza o ensalada, o desactivá los filtros de alérgenos.`
              : 'Probá aumentando la tolerancia de ingredientes faltantes o quitando alérgenos para encontrar más opciones.'}
          </p>
        </div>
      )}

      {!loading && recipes && recipes.length > 0 && (
        <div className="recipe-grid">
          {recipes.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              uid={uid}
              plan={planByKey}
              fridge={ingredients}
              onOpen={onOpenRecipe}
            />
          ))}
        </div>
      )}
    </section>
  );
}
