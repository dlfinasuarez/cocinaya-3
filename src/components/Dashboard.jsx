import { useState, useRef, useEffect } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { DAYS, slotKey } from '../constants';
import { byExpiry, expiryInfo, isExpiring } from '../utils/dates';
import { capitalize, keyName } from '../services/recipes';
import RecipeImg from './RecipeImg';
import { Icon, EmptyGraphic } from './Icons';

export default function Dashboard({ uid, ingredients = [], plan = [], shopping = [], loading, onOpenRecipe, go }) {
  const notify = useToast();

  // Estado para el formulario desplegable de compras rápidas
  const [showQuickShop, setShowQuickShop] = useState(false);
  const [quickItemName, setQuickItemName] = useState('');
  const [quickShopError, setQuickShopError] = useState('');
  const [savingQuick, setSavingQuick] = useState(false);
  const quickInputRef = useRef(null);

  // Fecha y día actual (índice 0 = Lunes ... 6 = Domingo)
  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayName = DAYS[todayIndex];
  const todayFullDate = capitalize(
    new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  );

  // Mi heladera: ordenar por vencimiento y tomar los 3-4 primeros
  const sortedIngredients = [...ingredients].sort(byExpiry);
  const topExpiring = sortedIngredients.slice(0, 4);
  const hasExpiringAlert = ingredients.some(isExpiring);

  // La comida de hoy
  const lunchKey = slotKey(todayIndex, 'almuerzo');
  const dinnerKey = slotKey(todayIndex, 'cena');
  const lunchSlot = plan.find((p) => p.id === lunchKey || (p.day === todayIndex && p.shift === 'almuerzo'));
  const dinnerSlot = plan.find((p) => p.id === dinnerKey || (p.day === todayIndex && p.shift === 'cena'));
  const hasMealToday = Boolean(lunchSlot || dinnerSlot);

  // Lista de compras
  const pendingShopping = shopping.filter((i) => !i.done);
  const pendingCount = pendingShopping.length;

  useEffect(() => {
    if (showQuickShop) {
      quickInputRef.current?.focus();
    }
  }, [showQuickShop]);

  // UPDATE: marcar comida de hoy como cocinada / pendiente
  const toggleMealDone = async (slot) => {
    if (!slot || !slot.id) return;
    try {
      await updateDoc(doc(db, 'users', uid, 'plan', slot.id), { done: !slot.done });
      notify(slot.done ? 'Comida marcada como pendiente' : '¡Comida marcada como cocinada!');
    } catch (err) {
      console.error(err);
      notify('No se pudo actualizar el estado de la comida.', 'error');
    }
  };

  // CREATE: agregado rápido a la lista de compras
  const handleQuickShopSubmit = async (e) => {
    e.preventDefault();
    const clean = quickItemName.trim();
    if (clean.length < 2) {
      setQuickShopError('Escribí al menos 2 letras.');
      return;
    }
    if (pendingShopping.some((i) => keyName(i.name) === keyName(clean))) {
      setQuickShopError('Ese producto ya está pendiente en tu lista.');
      return;
    }

    setQuickShopError('');
    setSavingQuick(true);
    try {
      await addDoc(collection(db, 'users', uid, 'shopping'), {
        name: capitalize(clean),
        done: false,
        source: 'manual',
        createdAt: serverTimestamp(),
      });
      setQuickItemName('');
      notify(`"${capitalize(clean)}" agregado a la lista de compras`);
      quickInputRef.current?.focus();
    } catch (err) {
      console.error(err);
      notify('No se pudo guardar en la lista de compras.', 'error');
    } finally {
      setSavingQuick(false);
    }
  };

  if (loading) {
    return (
      <section className="dash-v2" aria-busy="true">
        <div className="skeleton title-skel" />
        <div className="skeleton tall card-skel" />
        <div className="skeleton tall card-skel" />
        <div className="skeleton tall card-skel" />
      </section>
    );
  }

  return (
    <section className="dash-v2">
      {/* Cabezal de bienvenida sobrio y editorial */}
      <header className="dash-intro">
        <p className="dash-date">{todayFullDate}</p>
        <h2 className="dash-headline">¿Qué cocinamos hoy?</h2>
      </header>

      {/* SECCIÓN 1 · MI HELADERA */}
      <article className="panel dash-section" aria-labelledby="sec-fridge-title">
        <div className="section-head">
          <div className="section-title-wrap">
            <span className="section-kicker">Despensa en casa</span>
            <h3 id="sec-fridge-title">Mi heladera</h3>
          </div>
          {ingredients.length > 0 && (
            <button
              type="button"
              className="btn-link"
              onClick={() => go('fridge')}
              aria-label="Ver heladera completa"
            >
              Ver heladera ({ingredients.length}) <Icon name="arrow-right" size={14} />
            </button>
          )}
        </div>

        {ingredients.length === 0 ? (
          <div className="section-empty">
            <EmptyGraphic type="fridge" />
            <div className="empty-texts">
              <h4>Tu heladera todavía está vacía</h4>
              <p>Cargá los ingredientes que tenés en casa para saber qué podés preparar sin salir a comprar.</p>
            </div>
            <button
              type="button"
              className="btn primary"
              onClick={() => go('fridge', { focusAdd: true })}
            >
              <Icon name="plus" size={16} /> Agregar ingredientes
            </button>
          </div>
        ) : (
          <div className="fridge-summary">
            {hasExpiringAlert && (
              <div className="alert-notice alert-warning" role="status">
                <Icon name="alert" size={18} />
                <span>Tenés ingredientes que vencen pronto o ya vencieron. ¡Conviene usarlos primero!</span>
              </div>
            )}

            <div className="summary-meta">
              <p className="summary-count">
                Tenés <strong>{ingredients.length}</strong> {ingredients.length === 1 ? 'ingrediente' : 'ingredientes'} guardados.
              </p>
              <span className="summary-caption">Próximos a vencer:</span>
            </div>

            <ul className="expiry-preview-list" aria-label="Ingredientes que vencen primero">
              {topExpiring.map((item) => {
                const info = expiryInfo(item.expiresAt);
                return (
                  <li key={item.id} className="expiry-preview-item">
                    <div className="item-info">
                      <span className="item-qty">{item.quantity}×</span>
                      <strong className="item-name">{item.name}</strong>
                    </div>
                    {info ? (
                      <span className={`badge-exp exp-${info.level}`}>
                        <Icon name="clock" size={12} /> {info.label}
                      </span>
                    ) : (
                      <span className="badge-exp exp-none">Sin fecha</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </article>

      {/* SECCIÓN 2 · LA COMIDA DE HOY */}
      <article className="panel dash-section" aria-labelledby="sec-meals-title">
        <div className="section-head">
          <div className="section-title-wrap">
            <span className="section-kicker">Planificación de {todayName}</span>
            <h3 id="sec-meals-title">La comida de hoy</h3>
          </div>
          <button
            type="button"
            className="btn-link"
            onClick={() => go('plan')}
            aria-label="Ver menú de toda la semana"
          >
            Ver semana completa <Icon name="arrow-right" size={14} />
          </button>
        </div>

        {!hasMealToday ? (
          <div className="section-empty">
            <EmptyGraphic type="meal" />
            <div className="empty-texts">
              <h4>No tenés comidas planificadas para hoy</h4>
              <p>Elegí una receta con lo que tenés en la heladera y organizá tu almuerzo o cena en un toque.</p>
            </div>
            <button
              type="button"
              className="btn primary"
              onClick={() => go('recipes')}
            >
              <Icon name="pot" size={16} /> Agregar una comida a la semana
            </button>
          </div>
        ) : (
          <div className="today-meals-grid">
            {/* Almuerzo */}
            <div className={`meal-card ${lunchSlot ? (lunchSlot.done ? 'is-cooked' : 'is-ready') : 'is-empty'}`}>
              <div className="meal-shift-label">
                <Icon name="clock" size={14} /> Almuerzo
              </div>
              {lunchSlot ? (
                <div className="meal-content">
                  <div
                    className="meal-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenRecipe({ id: lunchSlot.recipeId, title: lunchSlot.title, thumb: lunchSlot.thumb })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onOpenRecipe({ id: lunchSlot.recipeId, title: lunchSlot.title, thumb: lunchSlot.thumb });
                      }
                    }}
                    aria-label={`Ver receta de ${lunchSlot.title}`}
                  >
                    <RecipeImg src={lunchSlot.thumb} alt={lunchSlot.title} className="meal-thumb" />
                    <div className="meal-details">
                      <strong className="meal-title">{lunchSlot.title}</strong>
                      <span className="meal-recipe-link">Ver receta y pasos</span>
                    </div>
                  </div>
                  <div className="meal-footer">
                    <label className="checkbox-custom">
                      <input
                        type="checkbox"
                        checked={Boolean(lunchSlot.done)}
                        onChange={() => toggleMealDone(lunchSlot)}
                      />
                      <span className="check-box" aria-hidden="true">
                        <Icon name="check" size={12} />
                      </span>
                      <span className="check-text">
                        {lunchSlot.done ? 'Cocinada' : 'Marcar como cocinada'}
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="meal-slot-empty">
                  <span>Sin almuerzo planificado</span>
                  <button type="button" className="btn small ghost" onClick={() => go('recipes')}>
                    Elegir receta
                  </button>
                </div>
              )}
            </div>

            {/* Cena */}
            <div className={`meal-card ${dinnerSlot ? (dinnerSlot.done ? 'is-cooked' : 'is-ready') : 'is-empty'}`}>
              <div className="meal-shift-label">
                <Icon name="clock" size={14} /> Cena
              </div>
              {dinnerSlot ? (
                <div className="meal-content">
                  <div
                    className="meal-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenRecipe({ id: dinnerSlot.recipeId, title: dinnerSlot.title, thumb: dinnerSlot.thumb })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onOpenRecipe({ id: dinnerSlot.recipeId, title: dinnerSlot.title, thumb: dinnerSlot.thumb });
                      }
                    }}
                    aria-label={`Ver receta de ${dinnerSlot.title}`}
                  >
                    <RecipeImg src={dinnerSlot.thumb} alt={dinnerSlot.title} className="meal-thumb" />
                    <div className="meal-details">
                      <strong className="meal-title">{dinnerSlot.title}</strong>
                      <span className="meal-recipe-link">Ver receta y pasos</span>
                    </div>
                  </div>
                  <div className="meal-footer">
                    <label className="checkbox-custom">
                      <input
                        type="checkbox"
                        checked={Boolean(dinnerSlot.done)}
                        onChange={() => toggleMealDone(dinnerSlot)}
                      />
                      <span className="check-box" aria-hidden="true">
                        <Icon name="check" size={12} />
                      </span>
                      <span className="check-text">
                        {dinnerSlot.done ? 'Cocinada' : 'Marcar como cocinada'}
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="meal-slot-empty">
                  <span>Sin cena planificada</span>
                  <button type="button" className="btn small ghost" onClick={() => go('recipes')}>
                    Elegir receta
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </article>

      {/* SECCIÓN 3 · LISTA DE COMPRAS */}
      <article className="panel dash-section" aria-labelledby="sec-shop-title">
        <div className="section-head">
          <div className="section-title-wrap">
            <span className="section-kicker">Abastecimiento</span>
            <h3 id="sec-shop-title">Lista de compras</h3>
          </div>
          <button
            type="button"
            className="btn-link"
            onClick={() => go('shop')}
            aria-label="Abrir lista de compras completa"
          >
            Ver lista <Icon name="arrow-right" size={14} />
          </button>
        </div>

        <div className="shop-dash-body">
          <div className="shop-status-row">
            <div className="shop-pending-badge">
              <Icon name="cart" size={18} />
              <span>
                {pendingCount === 0
                  ? 'No tenés productos pendientes'
                  : pendingCount === 1
                  ? '1 producto pendiente para comprar'
                  : `${pendingCount} productos pendientes para comprar`}
              </span>
            </div>

            {!showQuickShop && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowQuickShop(true)}
              >
                <Icon name="plus" size={16} /> Agregar a la lista de compras
              </button>
            )}
          </div>

          {/* Formulario rápido desplegable en el mismo lugar */}
          {showQuickShop && (
            <form className="quick-shop-form" onSubmit={handleQuickShopSubmit} noValidate>
              <div className="quick-form-head">
                <label htmlFor="quick-shop-input">¿Qué te está haciendo falta?</label>
                <button
                  type="button"
                  className="quick-close-btn"
                  onClick={() => {
                    setShowQuickShop(false);
                    setQuickShopError('');
                  }}
                  aria-label="Cancelar agregado rápido"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>

              <div className="quick-input-row">
                <input
                  id="quick-shop-input"
                  ref={quickInputRef}
                  type="text"
                  placeholder="Ej: yerba, manteca, harina..."
                  value={quickItemName}
                  onChange={(e) => {
                    setQuickItemName(e.target.value);
                    if (quickShopError) setQuickShopError('');
                  }}
                  aria-invalid={Boolean(quickShopError)}
                  disabled={savingQuick}
                />
                <button
                  type="submit"
                  className="btn primary"
                  disabled={savingQuick || quickItemName.trim().length === 0}
                >
                  {savingQuick ? 'Guardando…' : 'Agregar'}
                </button>
              </div>

              {quickShopError && (
                <p className="field-error" role="alert">
                  {quickShopError}
                </p>
              )}
            </form>
          )}
        </div>
      </article>
    </section>
  );
}
