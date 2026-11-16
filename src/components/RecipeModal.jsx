import { Fragment, useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { ALLERGEN_LABELS, DIET_LABELS } from '../constants';
import { getRecipeDetails, getSubstitutions, ingredientLabel, toSpanish, capitalize, withAvailability } from '../services/recipes';
import { addToShopping } from '../services/shopping';
import { formatMinutes, formatServings } from '../utils/format';
import RecipeImg from './RecipeImg';
import { useTraduccionReceta } from '../hooks/useTraduccion';
import { Icon } from './Icons';

const NUTRIENTS = [
  ['calories', 'Calorías'], ['protein', 'Proteínas'], ['carbohydrates', 'Carbohidratos'], ['fat', 'Grasas'],
  ['saturatedFat', 'Grasas saturadas'], ['fiber', 'Fibra'], ['sugar', 'Azúcares'], ['sodium', 'Sodio'],
];

function Nutrition({ n }) {
  const rows = NUTRIENTS.filter(([k]) => n?.[k]);
  if (!rows.length) return null;
  const basis = n.basis?.type === 'serving' ? `por porción${n.basis.description ? ` (${n.basis.description})` : ''}`
    : n.basis?.type === 'recipe' ? 'por receta entera' : 'cada 100 g';
  return (
    <div className="modal-nutrition-block">
      <h3>Información nutricional <span className="count-label">({basis})</span></h3>
      <dl className="nutri">
        {rows.map(([k, label]) => (
          <div key={k}><dt>{label}</dt><dd>{Math.round(n[k].value * 10) / 10} {n[k].unit}</dd></div>
        ))}
      </dl>
    </div>
  );
}

export default function RecipeModal({ recipe, uid, fridge = [], shopping = [], onClose }) {
  const notify = useToast();
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState({}); // pasos tildados mientras cocinás
  const [adding, setAdding] = useState(false);
  const [baseServings, setBaseServings] = useState(null);
  const [scale, setScale] = useState({ servings: '', units: '' });
  const [rescaling, setRescaling] = useState(false);
  const [subs, setSubs] = useState(null);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const recetaBase = details || recipe;

  const recetaSugerida = useTraduccionReceta(recetaBase);
  const receta = recetaSugerida || recetaBase;

  useEffect(() => {
    let cancelled = false;
    setDetails(null); setError(''); setDone({}); setSubs(null);
    getRecipeDetails(recipe.id)
      .then((d) => {
        if (cancelled) return;
        setDetails(d);
        setBaseServings(d.servings?.quantity || null);
        setScale({ servings: d.servings?.quantity || '', units: '' });
      })
      .catch((err) => !cancelled && setError(err.userMessage || 'No pudimos cargar esta receta. Cerrá e intentá de nuevo.'));
    return () => { cancelled = true; };
  }, [recipe.id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  const ingredients = receta?.ingredients
    ? withAvailability(receta, fridge)
    : [];
  const missing = ingredients.filter((i) => !i.have && !i.optional);
  const stepsDone = Object.values(done).filter(Boolean).length;
  const steps = receta?.steps || [];

  const applyScale = async () => {
    const sv = Number(scale.servings);
    setRescaling(true);
    try {
      setDetails(await getRecipeDetails(recipe.id, {
        servings: sv > 0 && sv !== baseServings ? sv : undefined,
        units: scale.units || undefined,
      }));
    } catch (err) {
      notify(err.userMessage || 'No se pudo recalcular la receta.', 'error');
    } finally {
      setRescaling(false);
    }
  };

  const addMissing = async () => {
    setAdding(true);
    try {
      const n = await addToShopping(uid, missing.map((i) => ({ name: ingredientLabel(i), detail: i.display })), shopping, 'receta');
      notify(n ? `${n} ingrediente${n > 1 ? 's' : ''} agregado${n > 1 ? 's' : ''} a tu lista de compras` : 'Esos ingredientes ya están en tu lista');
    } catch (err) {
      console.error(err);
      notify('No se pudo actualizar la lista de compras.', 'error');
    } finally {
      setAdding(false);
    }
  };

  const loadSubs = async () => {
    setLoadingSubs(true);
    try {
      setSubs(await getSubstitutions(missing.map((i) => i.name)));
    } catch (err) {
      notify(err.userMessage || 'No se pudieron buscar sustitutos.', 'error');
    } finally {
      setLoadingSubs(false);
    }
  };

  const d = receta;
  const diets = d ? Object.keys(DIET_LABELS).filter((k) => d.dietary?.[k] === true) : [];
  const times = d ? [['Preparación', d.times.prep], ['Cocción', d.times.cook], ['Total', d.times.total]].filter(([, v]) => v) : [];

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={receta.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bottomsheet-handle" aria-hidden="true" />
        <button className="modal-close" onClick={onClose} aria-label="Cerrar modal">
          <Icon name="close" size={20} />
        </button>

        <RecipeImg className="modal-img" src={d?.image || recipe.image || recipe.thumb} alt={receta.title} />

        <div className="modal-body">
          <h2 className="modal-recipe-title">{receta.title}</h2>

          {error && <p className="field-error" role="alert">{error}</p>}
          {!d && !error && (
            <div className="modal-loading-skels">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton tall" />
            </div>
          )}

          {d && (
            <>
              {d.description && <p className="modal-description">{d.description}</p>}

              <div className="pills modal-meta-pills">
                {times.map(([label, v]) => (
                  <span key={label} className="pill">
                    <Icon name="clock" size={12} /> {label}: {formatMinutes(v)}
                  </span>
                ))}
                {d.servings && <span className="pill">🍽️ {formatServings(d.servings)}</span>}
                {d.rating?.value ? (
                  <span className="pill">
                    ★ {Math.round(d.rating.value * 10) / 10}
                    {d.rating.count ? ` (${d.rating.count})` : ''}
                  </span>
                ) : null}
                {[...d.cuisines, ...d.courses].map((c) => (
                  <span key={c} className="pill soft">{c}</span>
                ))}
                {diets.map((k) => (
                  <span key={k} className="pill good">{DIET_LABELS[k]}</span>
                ))}
              </div>

              {d.allergens.length > 0 && (
                <p className="allergen-line">
                  Contiene: {d.allergens.map((a) => ALLERGEN_LABELS[a] || a).join(', ')}. Información orientativa: verificá siempre las etiquetas.
                </p>
              )}

              {d.gallery.length > 0 && (
                <div className="gallery">
                  {d.gallery.map((g) => (
                    <RecipeImg key={g.url} src={g.url} alt={g.alt} />
                  ))}
                </div>
              )}

              {baseServings && (
                <div className="scale-box">
                  <div className="field">
                    <label htmlFor="sv">Porciones</label>
                    <input
                      id="sv"
                      type="number"
                      min="1"
                      max="50"
                      value={scale.servings}
                      onChange={(e) => setScale({ ...scale, servings: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="un">Unidades</label>
                    <select
                      id="un"
                      value={scale.units}
                      onChange={(e) => setScale({ ...scale, units: e.target.value })}
                    >
                      <option value="">Originales</option>
                      <option value="metric">Métricas (g, ml, °C)</option>
                      <option value="imperial">Imperiales (oz, cup, °F)</option>
                    </select>
                  </div>
                  <button type="button" className="btn small primary" onClick={applyScale} disabled={rescaling}>
                    {rescaling ? 'Calculando…' : 'Recalcular'}
                  </button>
                </div>
              )}

              <div className="modal-section-title-wrap">
                <h3>Ingredientes</h3>
                <span className="count-label">
                  ({ingredients.filter((i) => i.have).length} de {ingredients.length} en tu heladera)
                </span>
              </div>

              <ul className="ing-list" aria-label="Ingredientes necesarios">
                {ingredients.map((i, idx) => (
                  <Fragment key={idx}>
                    {i.group && i.group !== ingredients[idx - 1]?.group && (
                      <li className="group-head">{i.group}</li>
                    )}
                    <li className={i.have ? 'have' : 'miss'}>
                      <span className="mark" aria-hidden="true">
                        <Icon name={i.have ? 'check' : 'close'} size={14} />
                      </span>
                      <span className="ing-name">
                        <span className="ing-title">
                          {ingredientLabel(i)}
                          {i.optional && <small className="ing-tag"> (opcional)</small>}
                          {i.staple && <small className="ing-tag"> (básico)</small>}
                        </span>
                        <small className="display">{i.display}</small>
                      </span>
                      <span className="sr-only">{i.have ? 'Lo tenés' : 'Te falta'}</span>
                    </li>
                  </Fragment>
                ))}
              </ul>

              {missing.length > 0 && (
                <div className="btn-row">
                  <button type="button" className="btn primary" onClick={addMissing} disabled={adding}>
                    <Icon name="plus" size={16} />
                    {adding ? 'Agregando…' : `Agregar ${missing.length} faltante${missing.length > 1 ? 's' : ''} a compras`}
                  </button>
                  <button type="button" className="btn secondary" onClick={loadSubs} disabled={loadingSubs}>
                    {loadingSubs ? 'Buscando…' : 'Ver sustitutos'}
                  </button>
                </div>
              )}

              {subs && (
                <div className="sub-box">
                  <h3>Sustitutos sugeridos</h3>
                  {subs.substitutions.map((s) => (
                    <div key={s.ingredient} className="sub-item">
                      <strong>{capitalize(toSpanish(s.ingredient))}:</strong>
                      <ul>
                        {s.options.map((o, idx) => (
                          <li key={idx}>
                            Usá <b>{capitalize(toSpanish(o.ingredient))}</b>
                            {o.ratio === 1 ? ' en la misma cantidad' : ` (${Math.round(o.ratio * 100)}% de la cantidad)`}
                            {o.note && <> — {o.note}</>}
                            {o.caution && <span className="caution"> Ojo: {o.caution}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {subs.unknown.length > 0 && (
                    <p className="hint">Sin sustitutos conocidos para: {subs.unknown.map((u) => toSpanish(u)).join(', ')}.</p>
                  )}
                </div>
              )}

              <div className="modal-section-title-wrap">
                <h3>Modo cocina</h3>
                <span className="count-label">({stepsDone} de {steps.length} pasos completados)</span>
              </div>
              <div className="bar" aria-hidden="true">
                <i style={{ width: `${steps.length ? (stepsDone / steps.length) * 100 : 0}%` }} />
              </div>

              <ol className="steps" aria-label="Instrucciones paso a paso">
                {steps.map((s, idx) => (
                  <Fragment key={idx}>
                    {s.group && s.group !== steps[idx - 1]?.group && (
                      <li className="group-head">{s.group}</li>
                    )}
                    <li className={done[idx] ? 'checked' : ''}>
                      <label className="step-label">
                        <input
                          type="checkbox"
                          checked={Boolean(done[idx])}
                          onChange={() => setDone((x) => ({ ...x, [idx]: !x[idx] }))}
                        />
                        <span className="step-num">{s.step || idx + 1}.</span>
                        <span className="step-text">{s.text}</span>
                      </label>
                      {(s.seconds || s.temperature) && (
                        <p className="step-meta">
                          {s.seconds ? `⏱ ${formatMinutes(Math.max(1, Math.round(s.seconds / 60)))}` : ''}
                          {s.temperature ? ` 🌡 ${s.temperature.value} °${s.temperature.unit}` : ''}
                        </p>
                      )}
                      {d.stepImages[s.step] && (
                        <RecipeImg className="step-img" src={d.stepImages[s.step]} alt={`Paso ${s.step}`} />
                      )}
                    </li>
                  </Fragment>
                ))}
              </ol>

              <Nutrition n={d.nutrition} />

              {d.notes.length > 0 && (
                <div className="modal-notes-block">
                  <h3>Notas del cocinero</h3>
                  <ul className="notes">{d.notes.map((n, idx) => <li key={idx}>{n}</li>)}</ul>
                </div>
              )}

              <p className="source">
                {d.author?.name && (
                  <>Receta de {d.author.url ? <a href={d.author.url} target="_blank" rel="noreferrer">{d.author.name}</a> : d.author.name} · </>
                )}
                <a href={d.url} target="_blank" rel="noreferrer">Ver receta original</a> · Datos provistos por <a href="https://www.tinyplates.dev" target="_blank" rel="noreferrer">Tiny Plates</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
