import { useState } from 'react';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { DAYS, SHIFTS, slotKey } from '../constants';

export default function Planner({ uid, plan, loading, onOpenRecipe }) {
  const notify = useToast();
  const [busy, setBusy] = useState(null);
  const byKey = Object.fromEntries(plan.map((p) => [p.id, p]));
  const cooked = plan.filter((p) => p.done).length;

  // UPDATE: cambia el booleano "done" en Firestore
  const toggle = async (slot) => {
    setBusy(slot.id);
    try {
      await updateDoc(doc(db, 'users', uid, 'plan', slot.id), { done: !slot.done });
      notify(slot.done ? 'Marcada como pendiente' : 'Comida marcada como cocinada');
    } catch (err) {
      console.error(err);
      notify('No se pudo actualizar la comida.', 'error');
    } finally {
      setBusy(null);
    }
  };

  // DELETE
  const remove = async (slot) => {
    setBusy(slot.id);
    try {
      await deleteDoc(doc(db, 'users', uid, 'plan', slot.id));
      notify('Comida quitada de tu semana');
    } catch (err) {
      console.error(err);
      notify('No se pudo quitar la comida.', 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="week">{DAYS.map((d) => <div key={d} className="skeleton tall" />)}</div>;

  return (
    <section>
      <div className="panel">
        <h2>Tu semana</h2>
        <p>{plan.length === 0 ? 'Todavía no planificaste nada. Elegí recetas en la pestaña Recetas.' : `${cooked} de ${plan.length} comidas cocinadas`}</p>
      </div>
      <div className="week">
        {DAYS.map((day, i) => (
          <div className="day" key={day}>
            <h3>{day}</h3>
            {SHIFTS.map((s) => {
              const slot = byKey[slotKey(i, s.id)];
              return (
                <div key={s.id} className={`slot ${slot ? 'filled' : ''} ${slot?.done ? 'done' : ''}`}>
                  <span className="shift">{s.label}</span>
                  {slot ? (
                    <>
                      <button className="slot-main" onClick={() => onOpenRecipe({ id: slot.recipeId, title: slot.title, thumb: slot.thumb })}>
                        <img src={`${slot.thumb}/preview`} alt="" loading="lazy" />
                        <strong>{slot.title}</strong>
                      </button>
                      <div className="slot-actions">
                        <label className="check">
                          <input type="checkbox" checked={slot.done} disabled={busy === slot.id} onChange={() => toggle(slot)} />
                          Cocinada
                        </label>
                        <button className="btn danger small" disabled={busy === slot.id} onClick={() => remove(slot)}>Quitar</button>
                      </div>
                    </>
                  ) : (
                    <span className="free">Libre</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
