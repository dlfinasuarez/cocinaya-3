import { useEffect, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { CATEGORIES, CATEGORY_ICONS } from '../constants';
import { byExpiry, expiryInfo, isExpiring, todayISO } from '../utils/dates';
import { Icon, EmptyGraphic } from './Icons';

const FILTERS = ['Todos', ...CATEGORIES, 'Por vencer'];

const EMPTY_COPY = {
  Verduras: ['Sin verduras por ahora', 'Una ensalada fresca o un salteado empiezan con una buena verdura.'],
  Carnes: ['No hay carnes cargadas', 'Sumá lo que tengas en la heladera o freezer para planificar tus platos fuertes.'],
  Lácteos: ['Sin lácteos por ahora', 'Leche, quesos o yogures: cargalos para encontrar salsas y postres.'],
  Despensa: ['Despensa vacía', 'Arroz, fideos, legumbres o harinas: los básicos que salvan cualquier comida.'],
  Frutas: ['Sin frutas por ahora', 'Manzanas, bananas, cítricos o frutos rojos para desayunos y meriendas.'],
  'Pescados y mariscos': ['Sin pescados ni mariscos', 'Merluza, atún, salmón o langostinos para opciones ricas y livianas.'],
  Huevos: ['Sin huevos cargados', 'El comodín de la cocina: tortillas, revueltos, masas y repostería.'],
  Panadería: ['Sin panificados', 'Pan fresco, tostadas, masas de tarta o galletitas para acompañar el día.'],
  Congelados: ['Freezer sin registrar', 'Arvejas, choclo o medallones listos para cocinar en pocos minutos.'],
  Bebidas: ['Sin bebidas anotadas', 'Agua mineral, jugos, vinos o café para acompañar tus recetas.'],
  'Condimentos y salsas': ['Sin condimentos guardados', 'Aceites, vinagres, especias y salsas que le dan carácter a cada plato.'],
};

// Sugerencias de ingredientes comunes para autocompletado rápido
const COMMON_SUGGESTIONS = [
  'Aceite de oliva', 'Ajo', 'Albahaca', 'Arroz', 'Arvejas', 'Atún', 'Banana', 'Berenjena',
  'Café', 'Carne picada', 'Cebolla', 'Choclo', 'Crema de leche', 'Espinaca', 'Fideos',
  'Frutillas', 'Harina 000', 'Huevos', 'Jamón cocido', 'Leche', 'Lechuga', 'Limón',
  'Manzana', 'Manteca', 'Mayonesa', 'Merluza', 'Morrón rojo', 'Mostaza', 'Muzzarella',
  'Naranja', 'Orégano', 'Pan', 'Pan rallado', 'Papas', 'Pechuga de pollo', 'Pimienta negra',
  'Queso rallado', 'Sal fina', 'Salsa de tomate', 'Tapas de empanadas', 'Tomates', 'Zanahorias', 'Zapallitos',
];

function Row({ item, onUpdate, onRemove }) {
  const info = expiryInfo(item.expiresAt);
  return (
    <li className={`jar-item ${info?.level === 'red' ? 'is-red' : info?.level === 'yellow' ? 'is-yellow' : ''}`}>
      <div className="item-main">
        <strong className="item-name">{item.name}</strong>
        {info ? (
          <span className={`badge-exp exp-${info.level}`}>
            <Icon name="clock" size={12} /> {info.label}
          </span>
        ) : (
          <span className="badge-exp exp-none">Sin vencimiento</span>
        )}
      </div>

      <div className="item-controls">
        <div className="stepper" aria-label={`Cantidad de ${item.name}`}>
          <button
            type="button"
            aria-label="Restar una unidad"
            disabled={item.quantity <= 1}
            onClick={() => onUpdate(item, { quantity: item.quantity - 1 })}
          >
            <Icon name="minus" size={14} />
          </button>
          <span className="stepper-val">{item.quantity}</span>
          <button
            type="button"
            aria-label="Sumar una unidad"
            onClick={() => onUpdate(item, { quantity: item.quantity + 1 })}
          >
            <Icon name="plus" size={14} />
          </button>
        </div>

        <input
          className="date-edit"
          type="date"
          aria-label={`Vencimiento de ${item.name}`}
          value={item.expiresAt || ''}
          onChange={(e) => onUpdate(item, { expiresAt: e.target.value || null }, 'Fecha de vencimiento actualizada')}
        />

        <button
          type="button"
          className="btn-icon-danger"
          onClick={() => onRemove(item)}
          aria-label={`Eliminar ${item.name}`}
          title="Eliminar"
        >
          <Icon name="trash" size={16} />
        </button>
      </div>
    </li>
  );
}

export default function Fridge({ uid, items = [], loading, autoFocus, onFocusHandled }) {
  const notify = useToast();
  const [form, setForm] = useState({ name: '', quantity: 1, category: CATEGORIES[0], expiresAt: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('Todos');

  const formRef = useRef(null);
  const nameRef = useRef(null);
  const chipsRef = useRef(null);

  // Manejo de autofocus proveniente de la pantalla de inicio
  useEffect(() => {
    if (autoFocus) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const timer = setTimeout(() => {
        nameRef.current?.focus();
        onFocusHandled?.();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, onFocusHandled]);

  const startAdd = (cat) => {
    if (cat && CATEGORIES.includes(cat)) {
      setForm((f) => ({ ...f, category: cat }));
    }
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 250);
  };

  const validate = () => {
    const e = {};
    const name = form.name.trim();
    const qty = Number(form.quantity);
    if (name.length < 2) e.name = 'Escribí al menos 2 letras.';
    else if (name.length > 60) e.name = 'Máximo 60 caracteres.';
    else if (items.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      e.name = 'Ya tenés ese ingrediente guardado. Podés modificar su cantidad abajo.';
    }
    if (!Number.isFinite(qty) || qty <= 0) e.quantity = 'Ingresá un número mayor a 0.';
    if (form.expiresAt && form.expiresAt < todayISO()) e.expiresAt = 'Esa fecha ya pasó.';
    return e;
  };

  // CREATE (carga rápida con Enter)
  const handleSubmit = async (ev) => {
    if (ev) ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    const savedName = form.name.trim();
    try {
      await addDoc(collection(db, 'users', uid, 'ingredients'), {
        name: savedName,
        quantity: Number(form.quantity),
        category: form.category,
        expiresAt: form.expiresAt || null,
        createdAt: serverTimestamp(),
      });
      // Limpia y re-enfoca automáticamente para continuar la carga rápida
      setForm((f) => ({ ...f, name: '', quantity: 1, expiresAt: '' }));
      notify(`"${savedName}" sumado a tu heladera`);
      nameRef.current?.focus();
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

  // DELETE con Deshacer
  const remove = async (item) => {
    const backupItem = { ...item };
    try {
      await deleteDoc(doc(db, 'users', uid, 'ingredients', item.id));
      notify(`"${item.name}" eliminado`, {
        action: {
          label: 'Deshacer',
          onClick: async () => {
            try {
              const { id, ...data } = backupItem;
              await setDoc(doc(db, 'users', uid, 'ingredients', id), data);
              notify(`"${backupItem.name}" restaurado en tu heladera`);
            } catch (err) {
              console.error(err);
              notify('No se pudo restaurar el ingrediente.', 'error');
            }
          },
        },
      });
    } catch (err) {
      console.error(err);
      notify(`No se pudo eliminar ${item.name}.`, 'error');
    }
  };

  const count = (f) =>
    f === 'Todos'
      ? items.length
      : f === 'Por vencer'
      ? items.filter(isExpiring).length
      : items.filter((i) => i.category === f).length;

  const sorted = (list) => [...list].sort((a, b) => byExpiry(a, b) || a.name.localeCompare(b.name));

  const groups = (
    filter === 'Todos'
      ? CATEGORIES.map((c) => [c, items.filter((i) => i.category === c)])
      : filter === 'Por vencer'
      ? [['Por vencer', items.filter(isExpiring)]]
      : [[filter, items.filter((i) => i.category === filter)]]
  ).filter(([, list]) => list.length);

  return (
    <section className="fridge-page">
      {/* Formulario de carga rápida */}
      <form ref={formRef} className="panel add-form-editorial" onSubmit={handleSubmit} noValidate>
        <div className="add-form-header">
          <h2>Sumar a la heladera</h2>
          <span className="caption-editorial">Presioná Enter para guardar y cargar el siguiente</span>
        </div>

        <div className="add-form-fields">
          <div className="field grow">
            <label htmlFor="ing-name">Ingrediente</label>
            <input
              id="ing-name"
              ref={nameRef}
              list="common-ingredients"
              value={form.name}
              placeholder="Ej: tomate, leche, fideos..."
              autoComplete="off"
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (errors.name) setErrors((errs) => ({ ...errs, name: null }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              aria-invalid={Boolean(errors.name)}
            />
            <datalist id="common-ingredients">
              {COMMON_SUGGESTIONS.map((sug) => (
                <option key={sug} value={sug} />
              ))}
            </datalist>
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>

          <div className="field qty-field">
            <label htmlFor="ing-qty">Cantidad</label>
            <input
              id="ing-qty"
              type="number"
              min="1"
              step="any"
              value={form.quantity}
              onChange={(e) => {
                setForm({ ...form, quantity: e.target.value });
                if (errors.quantity) setErrors((errs) => ({ ...errs, quantity: null }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              aria-invalid={Boolean(errors.quantity)}
            />
            {errors.quantity && <p className="field-error">{errors.quantity}</p>}
          </div>

          <div className="field cat-field">
            <label htmlFor="ing-cat">Categoría</label>
            <select
              id="ing-cat"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="field date-field">
            <label htmlFor="ing-exp">Vencimiento (opcional)</label>
            <input
              id="ing-exp"
              type="date"
              min={todayISO()}
              value={form.expiresAt}
              onChange={(e) => {
                setForm({ ...form, expiresAt: e.target.value });
                if (errors.expiresAt) setErrors((errs) => ({ ...errs, expiresAt: null }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              aria-invalid={Boolean(errors.expiresAt)}
            />
            {errors.expiresAt && <p className="field-error">{errors.expiresAt}</p>}
          </div>

          <div className="field action-field">
            <button type="submit" className="btn primary" disabled={saving}>
              <Icon name="plus" size={16} /> {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>

      {/* Selector de filtros con scroll horizontal suave y limpio en mobile */}
      <div className="chips-scroll-wrapper" aria-label="Filtros por categoría">
        <div ref={chipsRef} className="chips-scroll" role="group" aria-label="Filtrar ingredientes">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`chip ${filter === f ? 'on' : ''} ${f === 'Por vencer' ? 'chip-warning' : ''}`}
              onClick={() => setFilter(f)}
            >
              <span className="chip-label">{f}</span>
              <span className="chip-count">{count(f)}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="skeleton-list">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="panel empty-state">
          {items.length === 0 ? (
            <>
              <EmptyGraphic type="fridge" />
              <h3>Tu heladera está vacía</h3>
              <p>Sumá los ingredientes que tenés a mano y descubrí qué recetas podés preparar.</p>
              <button type="button" className="btn primary" onClick={() => startAdd()}>
                <Icon name="plus" size={16} /> Sumar el primer ingrediente
              </button>
            </>
          ) : filter === 'Por vencer' ? (
            <>
              <div className="empty-icon-clean">
                <Icon name="check" size={32} />
              </div>
              <h3>Nada por vencer pronto</h3>
              <p>Todo lo que tenés registrado tiene fecha lejana o aún está fresco.</p>
            </>
          ) : (
            <>
              <div className="empty-icon-clean">
                <Icon name="pot" size={32} />
              </div>
              <h3>{EMPTY_COPY[filter]?.[0] || 'Sin ingredientes en esta categoría'}</h3>
              <p>{EMPTY_COPY[filter]?.[1] || 'Sumá productos para recibir sugerencias de recetas.'}</p>
              <button type="button" className="btn primary small" onClick={() => startAdd(filter)}>
                <Icon name="plus" size={16} /> Añadir {filter.toLowerCase()}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="jars-list">
          {groups.map(([name, list]) => {
            const safeClass = name.toLowerCase().replace(/[\s&]+/g, '-');
            return (
              <div key={name} className={`jar cat-${safeClass}`}>
                <div className="jar-head">
                  <div className="jar-title">
                    <span className="jar-badge-icon" aria-hidden="true">
                      {CATEGORY_ICONS[name] || '•'}
                    </span>
                    <h3>{name}</h3>
                  </div>
                  <span className="count-label">
                    {list.length} {list.length === 1 ? 'ítem' : 'ítems'}
                  </span>
                </div>
                <ul className="jar-items-list">
                  {sorted(list).map((item) => (
                    <Row key={item.id} item={item} onUpdate={update} onRemove={remove} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
