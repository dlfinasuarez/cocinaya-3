import { Fragment, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { AISLES, AISLE_ORDER } from '../constants';
import { buildShoppingList, capitalize, inFridge, isStaple, isTinyId, keyName, toSpanish } from '../services/recipes';
import { addToShopping } from '../services/shopping';

const aisleIndex = (i) => {
  const idx = AISLE_ORDER.indexOf(i.aisle || 'other');
  return idx === -1 ? AISLE_ORDER.length : idx;
};

export default function Shopping({ uid, items, loading, plan, fridge }) {
  const notify = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const pending = items.filter((i) => !i.done);
  const bought = items.filter((i) => i.done);
  // Pendientes agrupados por pasillo; los comprados al final
  const sorted = [...items].sort((a, b) => a.done - b.done || aisleIndex(a) - aisleIndex(b) || a.name.localeCompare(b.name));

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

  // Automático: Tiny Plates une las recetas de la semana en una sola lista (1 consulta)
  // y acá le sacamos lo que ya tenés en la heladera.
  const generate = async () => {
    const ids = [...new Set(plan.map((p) => p.recipeId))].filter(isTinyId);
    if (!ids.length) return notify('Primero planificá recetas nuevas en la pestaña Semana.', 'error');
    setGenerating(true);
    try {
      const { items: list } = await buildShoppingList(ids);
      const needed = list
        .filter((it) => !isStaple(it.name) && !inFridge(it.name, fridge))
        .map((it) => ({ name: capitalize(toSpanish(it.name)), detail: it.display, aisle: it.category }));
      const n = await addToShopping(uid, needed, items, 'semana');
      notify(n ? `${n} ingrediente${n > 1 ? 's' : ''} agregado${n > 1 ? 's' : ''} desde tu semana` : 'No te falta nada para tu semana');
    } catch (err) {
      console.error(err);
      notify(err.userMessage || 'No se pudo generar la lista desde tu semana.', 'error');
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
            {sorted.map((item, idx) => {
              const prev = sorted[idx - 1];
              const showAisle = !item.done && item.aisle && (!prev || prev.done || prev.aisle !== item.aisle);
              return (
                <Fragment key={item.id}>
                  {showAisle && <li className="aisle">{AISLES[item.aisle] || 'Otros'}</li>}
                  <li className={item.done ? 'checked' : ''}>
                    <label>
                      <input type="checkbox" checked={item.done} onChange={() => toggle(item)} />
                      <span>{item.name}{item.detail && <small> · {item.detail}</small>}</span>
                    </label>
                    <button className="icon-btn" onClick={() => remove(item)} aria-label={`Quitar ${item.name}`}>✕</button>
                  </li>
                </Fragment>
              );
            })}
          </ul>
          {bought.length > 0 && <button className="btn ghost" onClick={clearBought}>Quitar los {bought.length} comprados</button>}
        </>
      )}
    </section>
  );
}
