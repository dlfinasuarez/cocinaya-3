import { useState } from 'react';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { DAYS, SHIFTS, slotKey } from '../constants';
import RecipeImg from './RecipeImg';
import { Icon } from './Icons';

export default function Planner({ uid, plan = [], loading, onOpenRecipe }) {
  const notify = useToast();
  const [busy, setBusy] = useState(null);
  const byKey = Object.fromEntries(plan.map((p) => [p.id, p]));
  const cooked = plan.filter((p) => p.done).length;

  // UPDATE: cambia el booleano "done" en Firestore
  const toggle = async (slot) => {
    setBusy(slot.id);
    try {
      await updateDoc(doc(db, 'users', uid, 'plan', slot.id), { done: !slot.done });
      notify(slot.done ? 'Comida marcada como pendiente' : '¡Comida marcada como cocinada!');
    } catch (err) {
      console.error(err);
      notify('No se pudo actualizar el estado de la comida.', 'error');
    } finally {
      setBusy(null);
    }
  };

  // DELETE con Deshacer
  const remove = async (slot) => {
    setBusy(slot.id);
    const backupSlot = { ...slot };
    try {
      await deleteDoc(doc(db, 'users', uid, 'plan', slot.id));
      notify(`"${slot.title}" quitada de tu semana`, {
        action: {
          label: 'Deshacer',
          onClick: async () => {
            try {
              const { id, ...data } = backupSlot;
              await setDoc(doc(db, 'users', uid, 'plan', id), data);
              notify(`"${backupSlot.title}" restaurada en tu semana`);
            } catch (e) {
              console.error(e);
              notify('No se pudo restaurar la comida.', 'error');
            }
          },
        },
      });
    } catch (err) {
      console.error(err);
      notify('No se pudo quitar la comida.', 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="week">
        {DAYS.map((d) => (
          <div key={d} className="skeleton tall" />
        ))}
      </div>
    );
  }

  return (
    <section className="planner-page">
      <div className="panel planner-header-editorial">
        <div>
          <h2>Menú semanal</h2>
          <p>
            {plan.length === 0
              ? 'Todavía no planificaste comidas para los próximos días. Elegí recetas en la pestaña Recetas.'
              : `${cooked} de ${plan.length} comidas marcadas como cocinadas.`}
          </p>
        </div>
      </div>

      <div className="week-grid">
        {DAYS.map((day, i) => (
          <div className="day-card" key={day}>
            <div className="day-header">
              <h3>{day}</h3>
            </div>

            <div className="day-shifts">
              {SHIFTS.map((s) => {
                const slot = byKey[slotKey(i, s.id)];
                return (
                  <div
                    key={s.id}
                    className={`shift-slot ${slot ? 'has-recipe' : 'is-free'} ${
                      slot?.done ? 'is-cooked' : ''
                    }`}
                  >
                    <span className="shift-badge">{s.label}</span>

                    {slot ? (
                      <div className="slot-inner">
                        <button
                          type="button"
                          className="slot-recipe-btn"
                          onClick={() =>
                            onOpenRecipe({
                              id: slot.recipeId,
                              title: slot.title,
                              thumb: slot.thumb,
                            })
                          }
                          aria-label={`Ver receta de ${slot.title}`}
                        >
                          <RecipeImg src={slot.thumb} className="slot-thumb" alt="" />
                          <strong className="slot-title">{slot.title}</strong>
                        </button>

                        <div className="slot-controls">
                          <label className="checkbox-custom small">
                            <input
                              type="checkbox"
                              checked={Boolean(slot.done)}
                              disabled={busy === slot.id}
                              onChange={() => toggle(slot)}
                            />
                            <span className="check-box" aria-hidden="true">
                              <Icon name="check" size={12} />
                            </span>
                            <span className="check-text">
                              {slot.done ? 'Cocinada' : 'Marcar cocinada'}
                            </span>
                          </label>

                          <button
                            type="button"
                            className="btn-link-danger"
                            disabled={busy === slot.id}
                            onClick={() => remove(slot)}
                            aria-label={`Quitar ${slot.title}`}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="slot-free-indicator">
                        <span>Sin planificar</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
