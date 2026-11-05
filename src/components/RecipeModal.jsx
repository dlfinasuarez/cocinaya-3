import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { capitalize, getRecipeDetails, toSpanish, withAvailability } from '../services/recipes';
import { addToShopping } from '../services/shopping';

export default function RecipeModal({ recipe, uid, fridge, shopping, onClose }) {
  const notify = useToast();
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(false);
  const [done, setDone] = useState({}); // pasos tildados (solo mientras cocinás)
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDetails(null); setError(false); setDone({});
    getRecipeDetails(recipe.id)
      .then((d) => !cancelled && setDetails(d))
      .catch(() => !cancelled && setError(true));
    return () => { cancelled = true; };
  }, [recipe.id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const ingredients = details ? withAvailability(details, fridge) : [];
  const missing = ingredients.filter((i) => !i.have);
  const stepsDone = Object.values(done).filter(Boolean).length;

  const addMissing = async () => {
    setAdding(true);
    try {
      const names = missing.map((i) => capitalize(toSpanish(i.name)));
      const n = await addToShopping(uid, names, shopping, 'receta');
      notify(n ? `${n} ingrediente${n > 1 ? 's' : ''} agregado${n > 1 ? 's' : ''} a tu lista de compras` : 'Esos ingredientes ya están en tu lista');
    } catch (err) {
      console.error(err);
      notify('No se pudo actualizar la lista de compras.', 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={recipe.title} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        <img className="modal-img" src={`${recipe.thumb}/preview`} alt={recipe.title} />
        <div className="modal-body">
          <h2>{recipe.title}</h2>
          {details && <p className="meta">{[details.category, details.area].filter(Boolean).join(' · ')}</p>}

          {error && <p className="field-error">No pudimos cargar esta receta. Cerrá e intentá de nuevo.</p>}
          {!details && !error && <><div className="skeleton" /><div className="skeleton" /><div className="skeleton tall" /></>}

          {details && (
            <>
              <h3>Ingredientes <span className="count">{ingredients.length - missing.length} de {ingredients.length} en tu heladera</span></h3>
              <ul className="ing-list">
                {ingredients.map((i) => (
                  <li key={i.name} className={i.have ? 'have' : 'miss'}>
                    <span className="mark" aria-hidden="true">{i.have ? '✓' : '✗'}</span>
                    <span className="ing-name">{capitalize(toSpanish(i.name))}<small> {i.name.toLowerCase() !== toSpanish(i.name) ? `(${i.name})` : ''}</small></span>
                    <span className="measure">{i.measure}</span>
                    <span className="sr-only">{i.have ? 'Lo tenés' : 'Te falta'}</span>
                  </li>
                ))}
              </ul>
              {missing.length > 0 && (
                <button className="btn primary" onClick={addMissing} disabled={adding}>
                  {adding ? 'Agregando…' : `Agregar ${missing.length} faltante${missing.length > 1 ? 's' : ''} a compras`}
                </button>
              )}

              <h3>Modo cocina <span className="count">{stepsDone} de {details.steps.length} pasos</span></h3>
              <div className="bar" aria-hidden="true"><i style={{ width: `${details.steps.length ? (stepsDone / details.steps.length) * 100 : 0}%` }} /></div>
              <ol className="steps">
                {details.steps.map((s, idx) => (
                  <li key={idx} className={done[idx] ? 'checked' : ''}>
                    <label>
                      <input type="checkbox" checked={!!done[idx]} onChange={() => setDone((d) => ({ ...d, [idx]: !d[idx] }))} />
                      <span>{s}</span>
                    </label>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
