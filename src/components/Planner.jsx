import { useState, useEffect, useRef } from 'react';
import { deleteDoc, doc, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { DAYS, SHIFTS, slotKey } from '../constants';
import { searchRecipes, popularRecipes, capitalize } from '../services/recipes';
import RecipeImg from './RecipeImg';
import { Icon } from './Icons';

export default function Planner({ uid, plan = [], loading, onOpenRecipe }) {
  const notify = useToast();
  const [busy, setBusy] = useState(null);

  // Drag and Drop State
  const [draggedSlotKey, setDraggedSlotKey] = useState(null);
  const [dragOverSlotKey, setDragOverSlotKey] = useState(null);

  // Modal de asignación / edición rápida de comida
  const [assignTarget, setAssignTarget] = useState(null); // { dayIndex, shiftId, slot }
  const [assignTab, setAssignTab] = useState('search'); // 'search' | 'manual'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  // Modal accesible de reubicación "Mover a..." para celular/touch
  const [moveSlotTarget, setMoveSlotTarget] = useState(null);

  const byKey = Object.fromEntries(plan.map((p) => [p.id, p]));
  const cooked = plan.filter((p) => p.done).length;

  // Cargar recetas populares sugeridas al abrir el modal de asignación
  useEffect(() => {
    if (!assignTarget) return;
    setSearchQuery('');
    setManualTitle(assignTarget.slot?.title || '');
    setSearching(true);
    popularRecipes({ limit: 6 })
      .then((list) => setSearchResults(list))
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  }, [assignTarget]);

  // UPDATE: marca/desmarca done
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

  // MOVER O INTERCAMBIAR ATÓMICAMENTE (writeBatch)
  const handleMoveOrSwap = async (fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    const fromItem = byKey[fromKey];
    if (!fromItem) return;

    const toItem = byKey[toKey];
    const [fromDayStr, fromShift] = fromKey.split('_');
    const [toDayStr, toShift] = toKey.split('_');
    const fromDay = Number(fromDayStr);
    const toDay = Number(toDayStr);

    setBusy(toKey);
    try {
      const batch = writeBatch(db);

      if (toItem) {
        // Swap: intercambiar ambas comidas de lugar
        batch.set(doc(db, 'users', uid, 'plan', toKey), {
          ...fromItem,
          id: toKey,
          day: toDay,
          shift: toShift,
        });
        batch.set(doc(db, 'users', uid, 'plan', fromKey), {
          ...toItem,
          id: fromKey,
          day: fromDay,
          shift: fromShift,
        });
        await batch.commit();
        notify(`Intercambiaste "${fromItem.title}" con "${toItem.title}"`);
      } else {
        // Move: mover la comida al casillero libre y limpiar el de origen
        batch.set(doc(db, 'users', uid, 'plan', toKey), {
          ...fromItem,
          id: toKey,
          day: toDay,
          shift: toShift,
        });
        batch.delete(doc(db, 'users', uid, 'plan', fromKey));
        await batch.commit();
        const toShiftLabel = SHIFTS.find((s) => s.id === toShift)?.label || toShift;
        notify(`"${fromItem.title}" movida a ${DAYS[toDay]} · ${toShiftLabel}`);
      }
    } catch (err) {
      console.error(err);
      notify('No se pudo mover la comida. Revisá tu conexión.', 'error');
    } finally {
      setBusy(null);
      setDraggedSlotKey(null);
      setDragOverSlotKey(null);
      setMoveSlotTarget(null);
    }
  };

  // Handlers para Drag & Drop nativo de desktop
  const onDragStart = (e, key) => {
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedSlotKey(key);
  };

  const onDragOver = (e, key) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSlotKey !== key) {
      setDragOverSlotKey(key);
    }
  };

  const onDragLeave = (e, key) => {
    if (dragOverSlotKey === key) {
      setDragOverSlotKey(null);
    }
  };

  const onDrop = (e, targetKey) => {
    e.preventDefault();
    const sourceKey = e.dataTransfer.getData('text/plain') || draggedSlotKey;
    handleMoveOrSwap(sourceKey, targetKey);
  };

  // Búsqueda de recetas en el modal de asignación
  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const list = await searchRecipes(q, { limit: 8 });
      setSearchResults(list);
      if (!list.length) {
        notify('No encontramos recetas con ese nombre.', 'error');
      }
    } catch (err) {
      console.error(err);
      notify('No se pudieron buscar recetas.', 'error');
    } finally {
      setSearching(false);
    }
  };

  // Guardar receta desde la API de Tiny Plates
  const assignRecipe = async (recipe) => {
    if (!assignTarget) return;
    setSavingAssign(true);
    const key = slotKey(assignTarget.dayIndex, assignTarget.shiftId);
    try {
      await setDoc(doc(db, 'users', uid, 'plan', key), {
        recipeId: recipe.id,
        title: recipe.title,
        thumb: recipe.thumb ?? null,
        day: assignTarget.dayIndex,
        shift: assignTarget.shiftId,
        done: assignTarget.slot?.done || false,
        createdAt: serverTimestamp(),
      });
      const shiftLabel = SHIFTS.find((s) => s.id === assignTarget.shiftId)?.label;
      notify(`"${recipe.title}" asignada a ${DAYS[assignTarget.dayIndex]} · ${shiftLabel}`);
      setAssignTarget(null);
    } catch (err) {
      console.error(err);
      notify('No se pudo asignar la receta.', 'error');
    } finally {
      setSavingAssign(false);
    }
  };

  // Guardar comida casera / manual rápida (recipeId = null)
  const assignManual = async (e) => {
    if (e) e.preventDefault();
    if (!assignTarget) return;
    const clean = manualTitle.trim();
    if (clean.length < 2) {
      return notify('Escribí al menos 2 letras para el nombre del plato.', 'error');
    }
    setSavingAssign(true);
    const key = slotKey(assignTarget.dayIndex, assignTarget.shiftId);
    try {
      await setDoc(doc(db, 'users', uid, 'plan', key), {
        recipeId: null,
        title: capitalize(clean),
        thumb: null,
        day: assignTarget.dayIndex,
        shift: assignTarget.shiftId,
        done: assignTarget.slot?.done || false,
        createdAt: serverTimestamp(),
      });
      const shiftLabel = SHIFTS.find((s) => s.id === assignTarget.shiftId)?.label;
      notify(`"${capitalize(clean)}" planificada para ${DAYS[assignTarget.dayIndex]} · ${shiftLabel}`);
      setAssignTarget(null);
    } catch (err) {
      console.error(err);
      notify('No se pudo guardar la comida.', 'error');
    } finally {
      setSavingAssign(false);
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
        <div className="planner-title-block">
          <h2>Menú semanal interactivo</h2>
          <p>
            {plan.length === 0
              ? 'Hacé clic en cualquier casillero libre para planificar una comida o arrastrá para reorganizar tu semana.'
              : `${cooked} de ${plan.length} comidas cocinadas. Arrastrá una tarjeta para cambiarla de día o turno.`}
          </p>
        </div>
      </div>

      <div className="week-grid">
        {DAYS.map((day, dayIndex) => (
          <div className="day-card" key={day}>
            <div className="day-header">
              <h3>{day}</h3>
            </div>

            <div className="day-shifts">
              {SHIFTS.map((s) => {
                const currentKey = slotKey(dayIndex, s.id);
                const slot = byKey[currentKey];
                const isDragOver = dragOverSlotKey === currentKey;
                const isDragging = draggedSlotKey === currentKey;

                return (
                  <div
                    key={s.id}
                    className={`shift-slot ${slot ? 'has-recipe' : 'is-free'} ${
                      slot?.done ? 'is-cooked' : ''
                    } ${isDragOver ? 'is-drag-target' : ''} ${isDragging ? 'is-dragging' : ''}`}
                    onDragOver={(e) => onDragOver(e, currentKey)}
                    onDragLeave={(e) => onDragLeave(e, currentKey)}
                    onDrop={(e) => onDrop(e, currentKey)}
                  >
                    <div className="shift-slot-header">
                      <span className="shift-badge">{s.label}</span>
                      {slot && (
                        <div
                          className="drag-handle"
                          draggable="true"
                          onDragStart={(e) => onDragStart(e, currentKey)}
                          title="Arrastrar comida a otro día o turno"
                          aria-label="Arrastrar para mover"
                        >
                          <Icon name="grip" size={14} />
                        </div>
                      )}
                    </div>

                    {slot ? (
                      <div className="slot-inner">
                        <div className="slot-main-interactive">
                          <button
                            type="button"
                            className="slot-recipe-btn"
                            onClick={() => {
                              if (slot.recipeId) {
                                onOpenRecipe({
                                  id: slot.recipeId,
                                  title: slot.title,
                                  thumb: slot.thumb,
                                });
                              } else {
                                setAssignTarget({ dayIndex, shiftId: s.id, slot });
                              }
                            }}
                            aria-label={`Ver receta de ${slot.title}`}
                          >
                            <RecipeImg src={slot.thumb} className="slot-thumb" alt="" />
                            <div className="slot-title-wrap">
                              <strong className="slot-title">{slot.title}</strong>
                              {!slot.recipeId && (
                                <span className="slot-manual-pill">Plato casero</span>
                              )}
                            </div>
                          </button>
                        </div>

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
                              {slot.done ? 'Cocinada' : 'Cocinada'}
                            </span>
                          </label>

                          <div className="slot-button-group">
                            <button
                              type="button"
                              className="btn-link-action"
                              onClick={() => setMoveSlotTarget(slot)}
                              title="Mover o intercambiar con otro turno"
                              aria-label={`Mover ${slot.title} a otro día`}
                            >
                              <Icon name="move" size={13} /> Mover
                            </button>

                            <button
                              type="button"
                              className="btn-link-action"
                              onClick={() => setAssignTarget({ dayIndex, shiftId: s.id, slot })}
                              title="Cambiar esta comida por otra"
                              aria-label={`Cambiar comida ${slot.title}`}
                            >
                              <Icon name="edit" size={13} /> Cambiar
                            </button>

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
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="slot-free-btn"
                        onClick={() => setAssignTarget({ dayIndex, shiftId: s.id, slot: null })}
                        aria-label={`Planificar ${s.label} del ${day}`}
                      >
                        <Icon name="plus" size={14} />
                        <span>Planificar {s.label.toLowerCase()}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ==========================================================================
          MODAL DE ASIGNACIÓN RÁPIDA / CAMBIO DE COMIDA (BUSCADOR O CASERA)
          ========================================================================== */}
      {assignTarget && (
        <div className="modal-backdrop" onClick={() => setAssignTarget(null)} role="presentation">
          <div
            className="modal assign-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Asignar comida al planificador"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bottomsheet-handle" aria-hidden="true" />
            <button
              type="button"
              className="modal-close"
              onClick={() => setAssignTarget(null)}
              aria-label="Cerrar modal"
            >
              <Icon name="close" size={20} />
            </button>

            <div className="modal-body assign-modal-body">
              <div className="assign-header">
                <span className="section-kicker">
                  {DAYS[assignTarget.dayIndex]} · {SHIFTS.find((s) => s.id === assignTarget.shiftId)?.label}
                </span>
                <h2>{assignTarget.slot ? 'Cambiar comida planificada' : 'Planificar comida'}</h2>
              </div>

              {/* Selector de modo: Buscar Receta vs. Comida Casera */}
              <div className="chips" role="tablist" aria-label="Tipo de comida">
                <button
                  type="button"
                  className={`chip ${assignTab === 'search' ? 'on' : ''}`}
                  onClick={() => setAssignTab('search')}
                  role="tab"
                  aria-selected={assignTab === 'search'}
                >
                  <Icon name="search" size={14} /> Buscar receta
                </button>
                <button
                  type="button"
                  className={`chip ${assignTab === 'manual' ? 'on' : ''}`}
                  onClick={() => setAssignTab('manual')}
                  role="tab"
                  aria-selected={assignTab === 'manual'}
                >
                  <Icon name="pot" size={14} /> Comida casera o rápida
                </button>
              </div>

              {/* Pestaña: Buscar en Tiny Plates */}
              {assignTab === 'search' && (
                <div className="assign-search-tab">
                  <form onSubmit={handleSearchSubmit} className="assign-search-form">
                    <div className="assign-input-group">
                      <input
                        type="text"
                        placeholder="Ej: pastas, tarta, ensalada tibia…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                      />
                      <button type="submit" className="btn primary" disabled={searching}>
                        <Icon name="search" size={16} /> {searching ? 'Buscando…' : 'Buscar'}
                      </button>
                    </div>
                  </form>

                  <div className="assign-results-list" aria-label="Recetas encontradas">
                    {searching ? (
                      <div className="assign-skels">
                        <div className="skeleton tall" />
                        <div className="skeleton tall" />
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((rec) => (
                        <div key={rec.id} className="assign-recipe-card">
                          <RecipeImg src={rec.thumb} alt={rec.title} className="assign-recipe-thumb" />
                          <div className="assign-recipe-info">
                            <strong>{rec.title}</strong>
                            {rec.times?.total && (
                              <span className="assign-recipe-time">
                                <Icon name="clock" size={12} /> {rec.times.total} min
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn primary small"
                            onClick={() => assignRecipe(rec)}
                            disabled={savingAssign}
                          >
                            Elegir
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="assign-empty-hint">
                        Buscá una receta o elegí una comida casera en la pestaña superior.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Pestaña: Plato Casero / Rápido */}
              {assignTab === 'manual' && (
                <form onSubmit={assignManual} className="assign-manual-form">
                  <p className="assign-manual-desc">
                    Anotá cualquier comida rápida sin necesidad de seguir una receta (ej: "Milanesas con puré", "Sobras del asado", "Empanadas compradas").
                  </p>
                  <div className="field">
                    <label htmlFor="manual-dish-name">Nombre de la comida</label>
                    <input
                      id="manual-dish-name"
                      type="text"
                      placeholder="Ej: Milanesas con ensalada"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn primary"
                    disabled={savingAssign || manualTitle.trim().length === 0}
                  >
                    <Icon name="check" size={16} />
                    {savingAssign ? 'Guardando…' : 'Asignar este plato'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL ACCESIBLE DE REUBICACIÓN ("MOVER A...") PARA MÓVILES Y TOUCH
          ========================================================================== */}
      {moveSlotTarget && (
        <div className="modal-backdrop" onClick={() => setMoveSlotTarget(null)} role="presentation">
          <div
            className="modal move-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Mover ${moveSlotTarget.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bottomsheet-handle" aria-hidden="true" />
            <button
              type="button"
              className="modal-close"
              onClick={() => setMoveSlotTarget(null)}
              aria-label="Cerrar modal"
            >
              <Icon name="close" size={20} />
            </button>

            <div className="modal-body">
              <div className="assign-header">
                <span className="section-kicker">Reorganizar comida</span>
                <h2>Mover "{moveSlotTarget.title}"</h2>
                <p className="move-modal-caption">
                  Elegí a qué día y turno querés pasar este plato. Si el casillero ya tiene otra comida, se intercambiarán automáticamente de lugar.
                </p>
              </div>

              <div className="move-options-grid" aria-label="Elegir casillero destino">
                {DAYS.map((d, dIdx) =>
                  SHIFTS.map((sh) => {
                    const targetKey = slotKey(dIdx, sh.id);
                    if (targetKey === moveSlotTarget.id) return null;
                    const existing = byKey[targetKey];

                    return (
                      <button
                        key={targetKey}
                        type="button"
                        className={`move-slot-btn ${existing ? 'has-occupant' : 'is-empty-slot'}`}
                        onClick={() => handleMoveOrSwap(moveSlotTarget.id, targetKey)}
                      >
                        <div className="move-slot-head">
                          <strong>{d}</strong>
                          <span className="move-slot-shift">{sh.label}</span>
                        </div>
                        <span className="move-slot-status">
                          {existing ? `↔ Intercambiar con "${existing.title}"` : '+ Casillero libre'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
