import { useState, useRef, useEffect } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { DAYS, slotKey, DIET_LABELS } from '../constants';
import { byExpiry, expiryInfo, isExpiring } from '../utils/dates';
import { formatMinutes } from '../utils/format';
import { capitalize, keyName, withAvailability } from '../services/recipes';
import RecipeImg from './RecipeImg';
import { Icon, EmptyGraphic } from './Icons';
import { useTraduccionReceta } from '../hooks/useTraduccion';

export default function Dashboard({
  uid,
  ingredients = [],
  plan = [],
  shopping = [],
  suggestion,
  loading,
  onOpenRecipe,
  go,
}) {
  const notify = useToast();

  // Estado para el formulario desplegable de compras rápidas en el módulo 3
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

  // Mi heladera: ordenar por vencimiento y tomar los 3 primeros
  const sortedIngredients = [...ingredients].sort(byExpiry);
  const topExpiring = sortedIngredients.slice(0, 3);
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
  const topPending = pendingShopping.slice(0, 3);

  // Sugerencia del día (traducción automática en caso de ser necesario)
  const recetaSugeridaTrad = useTraduccionReceta(suggestion?.recipe);
  const suggestedRecipe = recetaSugeridaTrad || suggestion?.recipe;

  // Ingredientes disponibles de la sugerencia
  const neededSuggested = suggestedRecipe
    ? withAvailability(suggestedRecipe, ingredients).filter((i) => !i.staple && !i.optional)
    : [];
  const haveSuggested = neededSuggested.filter((i) => i.have).length;
  const suggestedDiets = suggestedRecipe
    ? Object.keys(DIET_LABELS).filter((k) => suggestedRecipe.dietary?.[k] === true).slice(0, 3)
    : [];
  const suggestedMinutes = suggestedRecipe?.times?.total || suggestedRecipe?.times?.cook;

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
      <section className="dash-home-container" aria-busy="true">
        <header className="dash-intro">
          <div className="skeleton title-skel" style={{ width: '180px', height: '18px' }} />
          <div className="skeleton title-skel" style={{ width: '320px', height: '36px', marginTop: '8px' }} />
        </header>
        <div className="dash-two-cols">
          <div className="dash-left-col">
            <div className="skeleton tall mod-card-skel" />
            <div className="skeleton tall mod-card-skel" />
            <div className="skeleton tall mod-card-skel" />
          </div>
          <div className="dash-right-col">
            <div className="skeleton tall hero-card-skel" style={{ height: '100%', minHeight: '440px' }} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="dash-home-container">
      {/* Encabezado superior de bienvenida */}
      <header className="dash-intro">
        <p className="dash-date">{todayFullDate}</p>
        <h2 className="dash-headline">¿Qué cocinamos hoy?</h2>
      </header>

      {/* Grilla principal de 2 columnas: Izquierda (3 módulos) + Derecha (Sugerencia) */}
      <div className="dash-two-cols">
        {/* COLUMNA IZQUIERDA (~26-30% del ancho en Desktop) */}
        <div className="dash-left-col">
          {/* MÓDULO 1: HELADERA */}
          <article className="dash-card-mod mod-fridge" aria-labelledby="mod-fridge-title">
            <div className="mod-head">
              <div className="mod-title-group">
                <span className="mod-icon-wrap" aria-hidden="true">
                  <Icon name="fridge" size={16} />
                </span>
                <h3 id="mod-fridge-title" className="mod-title">Mi heladera</h3>
              </div>
              {ingredients.length > 0 && (
                <button
                  type="button"
                  className="mod-link-btn"
                  onClick={() => go('fridge')}
                  aria-label="Ver heladera completa"
                >
                  Ver ({ingredients.length}) <Icon name="arrow-right" size={12} />
                </button>
              )}
            </div>

            <div className="mod-body">
              {ingredients.length === 0 ? (
                <div className="mod-empty-state">
                  <p className="mod-empty-text">Tu heladera todavía está vacía.</p>
                  <button
                    type="button"
                    className="btn primary small mod-action-btn"
                    onClick={() => go('fridge', { focusAdd: true })}
                  >
                    <Icon name="plus" size={14} /> Agregar ingredientes
                  </button>
                </div>
              ) : (
                <div className="mod-fridge-content">
                  <p className="mod-count-line">
                    Tenés <strong>{ingredients.length}</strong> {ingredients.length === 1 ? 'ingrediente' : 'ingredientes'}.
                  </p>
                  {hasExpiringAlert && (
                    <div className="mod-micro-alert" role="status">
                      <Icon name="alert" size={13} />
                      <span>Ingredientes por vencer</span>
                    </div>
                  )}
                  <ul className="mod-mini-list" aria-label="Ingredientes que vencen primero">
                    {topExpiring.map((item) => {
                      const info = expiryInfo(item.expiresAt);
                      return (
                        <li key={item.id} className="mod-mini-item">
                          <span className="item-name-text">
                            <strong>{item.quantity}×</strong> {item.name}
                          </span>
                          {info ? (
                            <span className={`badge-exp exp-${info.level}`}>
                              {info.label}
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
            </div>
          </article>

          {/* MÓDULO 2: COMIDA DEL DÍA */}
          <article className="dash-card-mod mod-meal" aria-labelledby="mod-meal-title">
            <div className="mod-head">
              <div className="mod-title-group">
                <span className="mod-icon-wrap" aria-hidden="true">
                  <Icon name="clock" size={16} />
                </span>
                <h3 id="mod-meal-title" className="mod-title">Comida de hoy</h3>
              </div>
              <button
                type="button"
                className="mod-link-btn"
                onClick={() => go('plan')}
                aria-label="Ver menú semanal completo"
              >
                Semana <Icon name="arrow-right" size={12} />
              </button>
            </div>

            <div className="mod-body">
              {!hasMealToday ? (
                <div className="mod-empty-state">
                  <p className="mod-empty-text">Sin comidas planificadas para hoy.</p>
                  <button
                    type="button"
                    className="btn primary small mod-action-btn"
                    onClick={() => go('recipes')}
                  >
                    <Icon name="plus" size={14} /> Elegir qué cocinar
                  </button>
                </div>
              ) : (
                <div className="mod-meals-stack">
                  {/* Almuerzo */}
                  <div className={`mod-meal-entry ${lunchSlot ? (lunchSlot.done ? 'is-cooked' : 'is-ready') : 'is-empty'}`}>
                    <div className="meal-entry-top">
                      <span className="meal-entry-shift">Almuerzo</span>
                      {lunchSlot && (
                        <label className="checkbox-custom mini-check">
                          <input
                            type="checkbox"
                            checked={Boolean(lunchSlot.done)}
                            onChange={() => toggleMealDone(lunchSlot)}
                            aria-label="Marcar almuerzo como cocinado"
                          />
                          <span className="check-box" aria-hidden="true">
                            <Icon name="check" size={10} />
                          </span>
                          <span className="check-text">{lunchSlot.done ? 'Cocinada' : 'Lista'}</span>
                        </label>
                      )}
                    </div>
                    {lunchSlot ? (
                      <div
                        className="meal-entry-main"
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenRecipe({ id: lunchSlot.recipeId, title: lunchSlot.title, thumb: lunchSlot.thumb })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            onOpenRecipe({ id: lunchSlot.recipeId, title: lunchSlot.title, thumb: lunchSlot.thumb });
                          }
                        }}
                      >
                        <RecipeImg src={lunchSlot.thumb} alt={lunchSlot.title} className="mod-meal-thumb" />
                        <span className="meal-entry-title">{lunchSlot.title}</span>
                      </div>
                    ) : (
                      <button type="button" className="mod-slot-link" onClick={() => go('recipes')}>
                        + Asignar almuerzo
                      </button>
                    )}
                  </div>

                  {/* Cena */}
                  <div className={`mod-meal-entry ${dinnerSlot ? (dinnerSlot.done ? 'is-cooked' : 'is-ready') : 'is-empty'}`}>
                    <div className="meal-entry-top">
                      <span className="meal-entry-shift">Cena</span>
                      {dinnerSlot && (
                        <label className="checkbox-custom mini-check">
                          <input
                            type="checkbox"
                            checked={Boolean(dinnerSlot.done)}
                            onChange={() => toggleMealDone(dinnerSlot)}
                            aria-label="Marcar cena como cocinada"
                          />
                          <span className="check-box" aria-hidden="true">
                            <Icon name="check" size={10} />
                          </span>
                          <span className="check-text">{dinnerSlot.done ? 'Cocinada' : 'Lista'}</span>
                        </label>
                      )}
                    </div>
                    {dinnerSlot ? (
                      <div
                        className="meal-entry-main"
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenRecipe({ id: dinnerSlot.recipeId, title: dinnerSlot.title, thumb: dinnerSlot.thumb })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            onOpenRecipe({ id: dinnerSlot.recipeId, title: dinnerSlot.title, thumb: dinnerSlot.thumb });
                          }
                        }}
                      >
                        <RecipeImg src={dinnerSlot.thumb} alt={dinnerSlot.title} className="mod-meal-thumb" />
                        <span className="meal-entry-title">{dinnerSlot.title}</span>
                      </div>
                    ) : (
                      <button type="button" className="mod-slot-link" onClick={() => go('recipes')}>
                        + Asignar cena
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </article>

          {/* MÓDULO 3: LISTA DE COMPRAS */}
          <article className="dash-card-mod mod-shop" aria-labelledby="mod-shop-title">
            <div className="mod-head">
              <div className="mod-title-group">
                <span className="mod-icon-wrap" aria-hidden="true">
                  <Icon name="cart" size={16} />
                </span>
                <h3 id="mod-shop-title" className="mod-title">Lista de compras</h3>
              </div>
              <button
                type="button"
                className="mod-link-btn"
                onClick={() => go('shop')}
                aria-label="Abrir lista de compras"
              >
                Ver lista <Icon name="arrow-right" size={12} />
              </button>
            </div>

            <div className="mod-body">
              <div className="mod-shop-content">
                <p className="mod-count-line">
                  {pendingCount === 0
                    ? 'No tenés productos pendientes.'
                    : pendingCount === 1
                    ? '1 producto pendiente para comprar.'
                    : `${pendingCount} productos pendientes para comprar.`}
                </p>

                {topPending.length > 0 && !showQuickShop && (
                  <ul className="mod-shop-preview-list" aria-label="Productos pendientes">
                    {topPending.map((item) => (
                      <li key={item.id} className="mod-shop-preview-item">
                        <Icon name="cart" size={12} />
                        <span>{item.name}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {!showQuickShop ? (
                  <button
                    type="button"
                    className="btn secondary small mod-action-btn"
                    onClick={() => setShowQuickShop(true)}
                  >
                    <Icon name="plus" size={14} /> Agregar a la lista
                  </button>
                ) : (
                  <form className="mod-quick-shop-form" onSubmit={handleQuickShopSubmit} noValidate>
                    <div className="quick-form-inner">
                      <input
                        id="mod-quick-input"
                        ref={quickInputRef}
                        type="text"
                        placeholder="Ej: yerba, manteca..."
                        value={quickItemName}
                        onChange={(e) => {
                          setQuickItemName(e.target.value);
                          if (quickShopError) setQuickShopError('');
                        }}
                        aria-label="Nombre del producto"
                        disabled={savingQuick}
                      />
                      <button
                        type="submit"
                        className="btn primary small"
                        disabled={savingQuick || quickItemName.trim().length === 0}
                      >
                        {savingQuick ? '…' : 'Sumar'}
                      </button>
                      <button
                        type="button"
                        className="quick-cancel-icon"
                        onClick={() => {
                          setShowQuickShop(false);
                          setQuickShopError('');
                        }}
                        aria-label="Cerrar agregado rápido"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                    {quickShopError && <p className="field-error-mini">{quickShopError}</p>}
                  </form>
                )}
              </div>
            </div>
          </article>
        </div>

        {/* COLUMNA DERECHA (~70-74% del ancho en Desktop) · SUGERENCIA DEL DÍA */}
        <div className="dash-right-col">
          <article className="dash-hero-card" aria-labelledby="hero-suggestion-title">
            <header className="hero-head">
              <div className="hero-kicker-group">
                <span className="hero-kicker-badge">
                  <Icon name="pot" size={14} /> Sugerencia del día
                </span>
                <span className="hero-kicker-hint">
                  {ingredients.length > 0
                    ? 'Elegida especialmente con lo que tenés en la heladera'
                    : 'Descubrí qué cocinar con CocinaYa'}
                </span>
              </div>
            </header>

            {suggestion?.loading ? (
              <div className="hero-skel-wrapper">
                <div className="skeleton hero-img-skel" />
                <div className="hero-details-skel">
                  <div className="skeleton title-skel" style={{ width: '80%', height: '28px' }} />
                  <div className="skeleton text-skel" style={{ width: '50%', height: '16px', marginTop: '12px' }} />
                  <div className="skeleton text-skel" style={{ width: '100%', height: '40px', marginTop: '16px' }} />
                  <div className="skeleton btn-skel" style={{ width: '180px', height: '42px', marginTop: '24px' }} />
                </div>
              </div>
            ) : suggestedRecipe ? (
              <div className="hero-body">
                <div className="hero-media-wrap">
                  <RecipeImg
                    src={suggestedRecipe.thumb || suggestedRecipe.image}
                    alt={suggestedRecipe.title}
                    className="hero-img"
                  />
                  {suggestedMinutes && (
                    <span className="hero-time-tag">
                      <Icon name="clock" size={13} /> {formatMinutes(suggestedMinutes)}
                    </span>
                  )}
                </div>

                <div className="hero-content">
                  <div className="hero-meta-row">
                    {suggestedRecipe.rating?.value ? (
                      <span className="hero-rating">
                        ★ {Math.round(suggestedRecipe.rating.value * 10) / 10}
                        {suggestedRecipe.rating.count ? ` (${suggestedRecipe.rating.count})` : ''}
                      </span>
                    ) : null}
                    {suggestedRecipe.courses?.length > 0 && (
                      <span className="hero-course-tag">
                        {capitalize(suggestedRecipe.courses[0])}
                      </span>
                    )}
                  </div>

                  <h3 id="hero-suggestion-title" className="hero-title">
                    {suggestedRecipe.title}
                  </h3>

                  {neededSuggested.length > 0 && (
                    <p className={`avail-badge ${haveSuggested === neededSuggested.length ? 'full' : 'partial'}`}>
                      <Icon name={haveSuggested === neededSuggested.length ? 'check' : 'pot'} size={14} />
                      {haveSuggested === neededSuggested.length
                        ? '¡Tenés todos los ingredientes en casa!'
                        : `Tenés ${haveSuggested} de ${neededSuggested.length} ingredientes`}
                    </p>
                  )}

                  {suggestedRecipe.description && (
                    <p className="hero-description">
                      {suggestedRecipe.description}
                    </p>
                  )}

                  {suggestedDiets.length > 0 && (
                    <div className="hero-pills">
                      {suggestedDiets.map((d) => (
                        <span key={d} className="pill good">
                          {DIET_LABELS[d]}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="hero-actions-row">
                    <button
                      type="button"
                      className="btn primary hero-primary-btn"
                      onClick={() => onOpenRecipe(suggestedRecipe)}
                    >
                      <Icon name="recipes" size={16} /> Ver receta y modo cocina
                    </button>
                    <button
                      type="button"
                      className="btn secondary hero-secondary-btn"
                      onClick={() => go('recipes')}
                    >
                      Ver más opciones
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hero-empty-state">
                <EmptyGraphic type="meal" />
                <div className="hero-empty-info">
                  <h4>Cargá tus ingredientes para recibir sugerencias</h4>
                  <p>
                    CocinaYa analiza lo que tenés en la heladera y prioriza lo que vence antes
                    para armarte una sugerencia personalizada todos los días.
                  </p>
                </div>
                <div className="hero-empty-actions">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => go('fridge', { focusAdd: true })}
                  >
                    <Icon name="plus" size={16} /> Cargar mi heladera
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => go('recipes')}
                  >
                    <Icon name="search" size={16} /> Explorar recetas populares
                  </button>
                </div>
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
