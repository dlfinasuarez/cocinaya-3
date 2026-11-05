import { useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { CATEGORIES, CATEGORY_ICONS } from '../constants';
import { byExpiry, expiryInfo, isExpiring, todayISO } from '../utils/dates';

const FILTERS = ['Todos', ...CATEGORIES, 'Por vencer'];
const EMPTY_COPY = {
  Verduras: ['Sin verduras por ahora', 'Una ensalada o un salteado empiezan con una buena verdura.'],
  Carnes: ['No hay carnes cargadas', 'Sumá lo que tengas en el freezer o la heladera.'],
  Lácteos: ['Sin lácteos por ahora', 'Leche, queso o yogur: cargalos para recibir más ideas.'],
  Despensa: ['Despensa vacía', 'Arroz, fideos, harina… lo que tengas a mano suma recetas.'],
};

function Row({ item, onUpdate, onRemove }) {
  const info = expiryInfo(item.expiresAt);
  return (
    <li className={info?.level === 'red' ? 'is-red' : info?.level === 'yellow' ? 'is-yellow' : ''}>
      <div className="item-name">
        <strong>{item.name}</strong>
        {info && <span className={`exp exp-${info.level}`}>{info.label}</span>}
      </div>
      <div className="stepper" aria-label={`Cantidad de ${item.name}`}>
        <button aria-label="Restar uno" disabled={item.quantity <= 1}
          onClick={() => onUpdate(item, { quantity: item.quantity - 1 })}>−</button>
        <span>{item.quantity}</span>
        <button aria-label="Sumar uno" onClick={() => onUpdate(item, { quantity: item.quantity + 1 })}>+</button>
      </div>
      <input className="date-edit" type="date" aria-label={`Vencimiento de ${item.name}`}
        value={item.expiresAt || ''}
        onChange={(e) => onUpdate(item, { expiresAt: e.target.value || null }, 'Vencimiento actualizado')} />
      <button className="btn danger small" onClick={() => onRemove(item)}>Eliminar</button>
    </li>
  );
}

export default function Fridge({ uid, items, loading }) {
  const notify = useToast();
  const [form, setForm] = useState({ name: '', quantity: 1, category: CATEGORIES[0], expiresAt: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('Todos');
  const formRef = useRef(null);
  const nameRef = useRef(null);

  const startAdd = (cat) => {
    if (cat) setForm((f) => ({ ...f, category: cat }));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 300);
  };

  const validate = () => {
    const e = {};
    const name = form.name.trim();
    const qty = Number(form.quantity);
    if (name.length < 2) e.name = 'Escribí al menos 2 letras.';
    else if (name.length > 60) e.name = 'Máximo 60 caracteres.';
    else if (items.some((i) => i.name.toLowerCase() === name.toLowerCase()))
      e.name = 'Ya tenés ese ingrediente. Modificá su cantidad abajo.';
    if (!Number.isFinite(qty) || qty <= 0) e.quantity = 'Ingresá un número mayor a 0.';
    if (form.expiresAt && form.expiresAt < todayISO()) e.expiresAt = 'Esa fecha ya pasó.';
    return e;
  };

  // CREATE
  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', uid, 'ingredients'), {
        name: form.name.trim(),
        quantity: Number(form.quantity),
        category: form.category,
        expiresAt: form.expiresAt || null,
        createdAt: serverTimestamp(),
      });
      setForm({ ...form, name: '', quantity: 1, expiresAt: '' });
      notify('Ingrediente guardado');
    } catch (err) {
      console.error(err);
      notify('No se pudo guardar el ingrediente. Revisá tu conexión e intentá de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // UPDATE
  const update = async (item, changes, okMsg) => {
    try {
      await updateDoc(doc(db, 'users', uid, 'ingredients', item.id), changes);
      if (okMsg) notify(okMsg);
    } catch (err) {
      console.error(err);
      notify(`No se pudo actualizar ${item.name}.`, 'error');
    }
  };

  // DELETE
  const remove = async (item) => {
    try {
      await deleteDoc(doc(db, 'users', uid, 'ingredients', item.id));
      notify(`${item.name} eliminado`);
    } catch (err) {
      console.error(err);
      notify(`No se pudo eliminar ${item.name}.`, 'error');
    }
  };

  const count = (f) => (f === 'Todos' ? items.length : f === 'Por vencer' ? items.filter(isExpiring).length : items.filter((i) => i.category === f).length);
  const sorted = (list) => [...list].sort((a, b) => byExpiry(a, b) || a.name.localeCompare(b.name));
  const groups = (filter === 'Todos'
    ? CATEGORIES.map((c) => [c, items.filter((i) => i.category === c)])
    : filter === 'Por vencer'
      ? [['Por vencer', items.filter(isExpiring)]]
      : [[filter, items.filter((i) => i.category === filter)]]
  ).filter(([, list]) => list.length);

  return (
    <section>
      <form ref={formRef} className="panel add-form" onSubmit={handleSubmit} noValidate>
        <h2>Sumar a la heladera</h2>
        <div className="field grow">
          <label htmlFor="ing-name">Ingrediente</label>
          <input id="ing-name" ref={nameRef} value={form.name} placeholder="Ej: tomate"
            onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>
        <div className="field">
          <label htmlFor="ing-qty">Cantidad</label>
          <input id="ing-qty" type="number" min="1" step="any" value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })} aria-invalid={!!errors.quantity} />
          {errors.quantity && <p className="field-error">{errors.quantity}</p>}
        </div>
        <div className="field">
          <label htmlFor="ing-cat">Categoría</label>
          <select id="ing-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ing-exp">Vence el (opcional)</label>
          <input id="ing-exp" type="date" min={todayISO()} value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} aria-invalid={!!errors.expiresAt} />
          {errors.expiresAt && <p className="field-error">{errors.expiresAt}</p>}
        </div>
        <button className="btn primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar ingrediente'}</button>
      </form>

      <div className="chips" role="group" aria-label="Filtrar ingredientes">
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f} <span className="chip-count">{count(f)}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton-list">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" />)}</div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          {items.length === 0 ? (
            <>
              <div className="empty-icon">🧊</div>
              <h3>Tu heladera está vacía</h3>
              <p>Sumá lo que tenés y te sugerimos qué cocinar.</p>
              <button className="btn primary" onClick={() => startAdd()}>Añadir ingrediente</button>
            </>
          ) : filter === 'Por vencer' ? (
            <>
              <div className="empty-icon">✅</div>
              <h3>Nada por vencer</h3>
              <p>Todo lo que tenés está fresco por ahora.</p>
            </>
          ) : (
            <>
              <div className="empty-icon">{CATEGORY_ICONS[filter]}</div>
              <h3>{EMPTY_COPY[filter][0]}</h3>
              <p>{EMPTY_COPY[filter][1]}</p>
              <button className="btn primary" onClick={() => startAdd(filter)}>Añadir {filter.toLowerCase()}</button>
            </>
          )}
        </div>
      ) : (
        groups.map(([name, list]) => (
          <div key={name} className={`jar ${name === 'Por vencer' ? 'cat-soon' : `cat-${name}`}`}>
            <h3>{name === 'Por vencer' ? '⏰' : CATEGORY_ICONS[name]} {name} <span className="count">{list.length}</span></h3>
            <ul>{sorted(list).map((item) => <Row key={item.id} item={item} onUpdate={update} onRemove={remove} />)}</ul>
          </div>
        ))
      )}
    </section>
  );
}
