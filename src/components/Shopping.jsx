import { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { capitalize, getRecipeDetails, keyName, toSpanish, withAvailability } from '../services/recipes';
import { addToShopping } from '../services/shopping';

export default function Shopping({ uid, items, loading, plan, fridge }) {
  const notify = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const pending = items.filter((i) => !i.done);
  const bought = items.filter((i) => i.done);
  const sorted = [...pending, ...bought].sort((a, b) => a.done - b.done || a.name.localeCompare(b.name));

  // CREATE (manual)
  const add = async (ev) => {
    ev.preventDefault();
    const n = name.trim();
    if (n.length < 2) return setError('Escribí al menos 2 letras.');
    if (pending.some((i) => keyName(i.name) === keyName(n))) return setError('Ya está en tu lista.');
    setError('');
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', uid, 'shopping'), { name: capitalize(n), done: false, source: 'manual', createdAt: serverTimestamp() });
      setName('');
      notify('Agregado a tu lista de compras');
    } catch (err) {
      console.error(err);
      notify('No se pudo agregar a la lista.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // UPDATE: tachar / destachar
  const toggle = async (item) => {
    try {
      await updateDoc(doc(db, 'users', uid, 'shopping', item.id), { done: !item.done });
    } catch (err) {
      console.error(err);
      notify(`No se pudo actualizar ${item.name}.`, 'error');
    }
  };

  // DELETE
  const remove = async (item) => {
    try {
      await deleteDoc(doc(db, 'users', uid, 'shopping', item.id));
      notify(`${item.name} quitado de la lista`);
    } catch (err) {
      console.error(err);
      notify(`No se pudo quitar ${item.name}.`, 'error');
    }
  };

  const clearBought = async () => {
    try {
      const batch = writeBatch(db);
      bought.forEach((i) => batch.delete(doc(db, 'users', uid, 'shopping', i.id)));
      await batch.commit();
      notify('Lista limpia: quitamos lo ya comprado');
    } catch (err) {
      console.error(err);
      notify('No se pudo limpiar la lista.', 'error');
    }
  };

  // Automático: junta lo que falta para todas las recetas de la semana
  const generate = async () => {
    if (!plan.length) return notify('Primero planificá comidas en la pestaña Semana.', 'error');
    setGenerating(true);
    try {
      const ids = [...new Set(plan.map((p) => p.recipeId))];
      const all = await Promise.all(ids.map(getRecipeDetails));
      const names = all.flatMap((d) => withAvailability(d, fridge).filter((i) => !i.have).map((i) => capitalize(toSpanish(i.name))));
      const n = await addToShopping(uid, names, items, 'semana');
      notify(n ? `${n} ingrediente${n > 1 ? 's' : ''} agregado${n > 1 ? 's' : ''} desde tu semana` : 'No te falta nada para tu semana');
    } catch (err) {
      console.error(err);
      notify('No se pudo generar la lista desde tu semana.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section>
      <div className="panel shop-head">
        <div>
          <h2>Lista de compras</h2>
          <p>{items.length ? `${bought.length} de ${items.length} comprados` : 'Lo que te falta para cocinar tu semana.'}</p>
        </div>
        <button className="btn accent" onClick={generate} disabled={generating}>
          {generating ? 'Calculando…' : 'Generar desde mi semana'}
        </button>
      </div>

      <form className="panel shop-form" onSubmit={add} noValidate>
        <div className="field grow">
          <label htmlFor="shop-name">Agregar a mano</label>
          <input id="shop-name" value={name} placeholder="Ej: yerba" onChange={(e) => setName(e.target.value)} aria-invalid={!!error} />
          {error && <p className="field-error">{error}</p>}
        </div>
        <button className="btn primary" disabled={saving}>{saving ? 'Agregando…' : 'Agregar'}</button>
      </form>

      {loading ? (
        <div className="skeleton-list">{[0, 1, 2].map((i) => <div key={i} className="skeleton" />)}</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🛒</div>
          <h3>Tu lista está vacía</h3>
          <p>Generala desde tu semana o agregá faltantes desde una receta.</p>
        </div>
      ) : (
        <>
          <ul className="panel shop-list">
            {sorted.map((item) => (
              <li key={item.id} className={item.done ? 'checked' : ''}>
                <label>
                  <input type="checkbox" checked={item.done} onChange={() => toggle(item)} />
                  <span>{item.name}</span>
                </label>
                <button className="icon-btn" onClick={() => remove(item)} aria-label={`Quitar ${item.name}`}>✕</button>
              </li>
            ))}
          </ul>
          {bought.length > 0 && <button className="btn ghost" onClick={clearBought}>Quitar los {bought.length} comprados</button>}
        </>
      )}
    </section>
  );
}
