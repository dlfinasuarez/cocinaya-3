import { Fragment, useState, useRef, useEffect } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { AISLES, AISLE_ORDER } from '../constants';
import { buildShoppingList, capitalize, inFridge, isStaple, isTinyId, keyName, toSpanish } from '../services/recipes';
import { addToShopping } from '../services/shopping';
import { Icon, EmptyGraphic } from './Icons';

const aisleIndex = (i) => {
  const idx = AISLE_ORDER.indexOf(i.aisle || 'other');
  return idx === -1 ? AISLE_ORDER.length : idx;
};

export default function Shopping({ uid, items = [], loading, plan = [], fridge = [] }) {
  const notify = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Estados de animación para microinteracción de completado
  // animatingMap: { [itemId]: 'completing' (fase 1) | 'sliding' (fase 2) }
  const [animatingMap, setAnimatingMap] = useState({});
  const timersRef = useRef({});

  // Limpiar temporizadores activos al desmontar
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  const pending = items.filter((i) => !i.done && !animatingMap[i.id]);
  const bought = items.filter((i) => i.done);

  // Pendientes agrupados por pasillo; comprados al final
  const sorted = [...items].sort(
    (a, b) => a.done - b.done || aisleIndex(a) - aisleIndex(b) || a.name.localeCompare(b.name)
  );

  // CREATE (manual)
  const add = async (ev) => {
    ev.preventDefault();
    const n = name.trim();
    if (n.length < 2) return setError('Escribí al menos 2 letras.');
    if (pending.some((i) => keyName(i.name) === keyName(n))) {
      return setError('Ese producto ya está en tu lista de compras.');
    }
    setError('');
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', uid, 'shopping'), {
        name: capitalize(n),
        done: false,
        source: 'manual',
        createdAt: serverTimestamp(),
      });
      setName('');
      notify(`"${capitalize(n)}" sumado a la lista`);
    } catch (err) {
      console.error(err);
      notify('No se pudo agregar el producto. Revisá tu conexión.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // MICROINTERACCIÓN DE COMPLETADO Y ELIMINACIÓN SUAVE EN 3 FASES
  const handleCheck = (item) => {
    const id = item.id;

    // Si ya está en proceso de animación, el usuario desmarcó para CANCELAR la eliminación
    if (animatingMap[id]) {
      if (timersRef.current[id]) {
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
      }
      setAnimatingMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    // FASE 1: Confirmación visual inmediata (~0 a 280ms)
    // Checkbox relleno en verde, tachado animado y ligera opacidad
    setAnimatingMap((prev) => ({ ...prev, [id]: 'completing' }));

    // FASE 2: Salida suave (~280 a 680ms)
    // Deslizamiento lateral a la derecha y colapso vertical suave
    timersRef.current[id] = setTimeout(() => {
      setAnimatingMap((prev) => ({ ...prev, [id]: 'sliding' }));

      // FASE 3: Persistencia en Firestore al concluir la animación (~680ms)
      timersRef.current[id] = setTimeout(async () => {
        try {
          await deleteDoc(doc(db, 'users', uid, 'shopping', id));
        } catch (err) {
          console.error(err);
          notify(`No se pudo eliminar ${item.name}.`, 'error');
        } finally {
          delete timersRef.current[id];
          setAnimatingMap((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      }, 380);
    }, 280);
  };

  // DELETE manual con botón de tacho (incluye toast con Deshacer)
  const remove = async (item) => {
    if (timersRef.current[item.id]) {
      clearTimeout(timersRef.current[item.id]);
      delete timersRef.current[item.id];
    }
    const backupItem = { ...item };
    try {
      await deleteDoc(doc(db, 'users', uid, 'shopping', item.id));
      notify(`"${item.name}" quitado de la lista`, {
        action: {
          label: 'Deshacer',
          onClick: async () => {
            try {
              const { id, ...data } = backupItem;
              await setDoc(doc(db, 'users', uid, 'shopping', id), data);
              notify(`"${backupItem.name}" restaurado en tu lista`);
            } catch (e) {
              console.error(e);
              notify('No se pudo restaurar el producto.', 'error');
            }
          },
        },
      });
    } catch (err) {
      console.error(err);
      notify(`No se pudo quitar ${item.name}.`, 'error');
    }
  };

  // Limpiar comprados
  const clearBought = async () => {
    if (!bought.length) return;
    const ok = window.confirm(
      `¿Querés eliminar los ${bought.length} productos ya comprados de tu lista?`
    );
    if (!ok) return;

    try {
      const batch = writeBatch(db);
      bought.forEach((i) => batch.delete(doc(db, 'users', uid, 'shopping', i.id)));
      await batch.commit();
      notify(`Lista limpia: se quitaron los ${bought.length} productos comprados`);
    } catch (err) {
      console.error(err);
      notify('No se pudo limpiar la lista. Probá de nuevo.', 'error');
    }
  };

  // Automático: Tiny Plates une las recetas de la semana en una sola lista
  const generate = async () => {
    const ids = [...new Set(plan.map((p) => p.recipeId))].filter(isTinyId);
    if (!ids.length) {
      return notify('Primero planificá recetas en la pestaña Semana.', 'error');
    }
    setGenerating(true);
    try {
      const { items: list } = await buildShoppingList(ids);
      const needed = list
        .filter((it) => !isStaple(it.name) && !inFridge(it.name, fridge))
        .map((it) => ({
          name: capitalize(toSpanish(it.name)),
          detail: it.display,
          aisle: it.category,
        }));
      const n = await addToShopping(uid, needed, items, 'semana');
      notify(
        n
          ? `${n} ingrediente${n > 1 ? 's' : ''} agregado${n > 1 ? 's' : ''} desde tu semana`
          : '¡Tenés todo! No te falta nada para las comidas de tu semana'
      );
    } catch (err) {
      console.error(err);
      notify(err.userMessage || 'No se pudo generar la lista desde tu semana.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="shop-page">
      <div className="panel shop-header-editorial">
        <div className="shop-header-title">
          <h2>Lista de compras</h2>
          <p>
            {pending.length
              ? `${pending.length} producto${pending.length === 1 ? '' : 's'} por comprar. Marcá con el check para completar.`
              : 'Lo que te falta en casa para cocinar tus recetas.'}
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={generate}
          disabled={generating}
        >
          <Icon name="sparkles" size={16} />
          {generating ? 'Calculando faltantes…' : 'Generar desde mi semana'}
        </button>
      </div>

      <form className="panel shop-add-form" onSubmit={add} noValidate>
        <div className="field grow">
          <label htmlFor="shop-name">Agregar producto a mano</label>
          <div className="shop-input-wrap">
            <input
              id="shop-name"
              value={name}
              placeholder="Ej: yerba, rollo de cocina, café…"
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              aria-invalid={Boolean(error)}
            />
            <button
              type="submit"
              className="btn primary"
              disabled={saving || name.trim().length === 0}
            >
              <Icon name="plus" size={16} /> {saving ? 'Agregando…' : 'Agregar'}
            </button>
          </div>
          {error && <p className="field-error">{error}</p>}
        </div>
      </form>

      {loading ? (
        <div className="skeleton-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="panel empty-state">
          <EmptyGraphic type="cart" />
          <h3>Tu lista de compras está vacía</h3>
          <p>Generala automáticamente con los ingredientes que te faltan para tu semana o sumá productos a mano.</p>
        </div>
      ) : (
        <div className="shop-list-container">
          <ul className="panel shop-list-editorial" aria-label="Productos de la lista de compras">
            {sorted.map((item, idx) => {
              const prev = sorted[idx - 1];
              const showAisle =
                !item.done && item.aisle && (!prev || prev.done || prev.aisle !== item.aisle);
              const animPhase = animatingMap[item.id];
              const isChecked = Boolean(item.done || animPhase);
              const isCompleting = animPhase === 'completing';
              const isSliding = animPhase === 'sliding';

              return (
                <Fragment key={item.id}>
                  {showAisle && (
                    <li className="aisle-divider" role="presentation">
                      <span className="aisle-title">{AISLES[item.aisle] || 'Otros'}</span>
                    </li>
                  )}
                  <li
                    className={`shop-item ${item.done ? 'is-bought' : ''} ${
                      isCompleting ? 'is-completing' : ''
                    } ${isSliding ? 'is-sliding-out' : ''}`}
                  >
                    <label className="checkbox-custom shop-check">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCheck(item)}
                      />
                      <span className="check-box" aria-hidden="true">
                        <Icon name="check" size={12} />
                      </span>
                      <span className="item-label">
                        <strong className="item-title">{item.name}</strong>
                        {item.detail && <small className="item-detail"> · {item.detail}</small>}
                      </span>
                    </label>

                    <button
                      type="button"
                      className="btn-icon-danger"
                      onClick={() => remove(item)}
                      aria-label={`Quitar ${item.name}`}
                      title="Quitar"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </li>
                </Fragment>
              );
            })}
          </ul>

          {bought.length > 0 && (
            <div className="shop-footer-actions">
              <button type="button" className="btn ghost" onClick={clearBought}>
                <Icon name="trash" size={14} /> Quitar los {bought.length} productos comprados
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
