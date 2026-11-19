import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useCollection } from './hooks/useCollection';
import { useSuggestion } from './hooks/useSuggestion';
import { useToast } from './context/ToastContext';
import Dashboard from './components/Dashboard';
import Fridge from './components/Fridge';
import RecipeFinder from './components/RecipeFinder';
import Planner from './components/Planner';
import Shopping from './components/Shopping';
import RecipeModal from './components/RecipeModal';
import { Icon } from './components/Icons';
import isologoUrl from './img/isologo_cocinaya.svg';

const TABS = [
  { id: 'home', label: 'Inicio', icon: 'home' },
  { id: 'fridge', label: 'Heladera', icon: 'fridge' },
  { id: 'recipes', label: 'Recetas', icon: 'recipes' },
  { id: 'plan', label: 'Semana', icon: 'plan' },
  { id: 'shop', label: 'Compras', icon: 'shop' },
];

export default function App() {
  const notify = useToast();
  const { user, loading: authLoading, error: authError } = useAuth();
  const uid = user?.uid;
  const ingredients = useCollection(uid, 'ingredients');
  const plan = useCollection(uid, 'plan');
  const shopping = useCollection(uid, 'shopping');
  const suggestion = useSuggestion(ingredients.data, !ingredients.loading);

  const [tab, setTab] = useState('home');
  const [fridgeAutoFocus, setFridgeAutoFocus] = useState(false);
  const [openRecipe, setOpenRecipe] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const toggleButtonRef = useRef(null);

  const closeRecipe = useCallback(() => setOpenRecipe(null), []);

  const goTo = useCallback((targetTab, opts = {}) => {
    setTab(targetTab);
    setMenuOpen(false);
    if (targetTab === 'fridge' && opts.focusAdd) {
      setFridgeAutoFocus(true);
    } else {
      setFridgeAutoFocus(false);
    }
  }, []);

  useEffect(() => {
    if (ingredients.error || plan.error || shopping.error) {
      notify('No se pudieron leer tus datos. Revisá las reglas de Firestore.', 'error');
    }
  }, [ingredients.error, plan.error, shopping.error, notify]);

  // Manejo de foco y cierre del menú hamburguesa en mobile
  useEffect(() => {
    if (!menuOpen) return;

    // Bloqueo de scroll de fondo
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Foco inicial en el botón de cerrar del drawer
    closeButtonRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        toggleButtonRef.current?.focus();
        return;
      }

      // Atrapado de foco dentro del drawer
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  if (authLoading) return <div className="boot">Preparando tu cocina…</div>;
  if (authError) {
    return (
      <div className="boot error">
        <h1>No pudimos iniciar sesión</h1>
        <p>Verificá que Authentication → Anónimo esté habilitado y que las variables de entorno sean correctas.</p>
        <code>{authError.code}</code>
      </div>
    );
  }

  const pendingShop = shopping.data.filter((i) => !i.done).length;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <button
            type="button"
            className="brand-btn"
            onClick={() => goTo('home')}
            aria-label="Ir al inicio de CocinaYa"
          >
            <img
              src={isologoUrl}
              alt=""
              className="brand-isologo"
              width="36"
              height="34"
              aria-hidden="true"
            />
            <h1>CocinaYa</h1>
          </button>
        </div>

        {/* Navegación visible en Desktop (>= 960px) */}
        <nav className="nav-desktop" aria-label="Navegación principal">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'on' : ''}
              onClick={() => goTo(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              <Icon name={t.icon} size={16} />
              <span>{t.label}</span>
              {t.id === 'shop' && pendingShop > 0 && (
                <span className="nav-badge" aria-label={`${pendingShop} compras pendientes`}>
                  {pendingShop}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Botón hamburguesa en Mobile / Tablet (< 960px) */}
        <button
          ref={toggleButtonRef}
          type="button"
          className="nav-toggle"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-controls="nav-drawer"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} size={24} />
          {pendingShop > 0 && !menuOpen && (
            <span className="toggle-badge" aria-label={`${pendingShop} pendientes`}>
              {pendingShop}
            </span>
          )}
        </button>
      </header>

      {/* Menú lateral desplegable (Drawer) para mobile con backdrop y foco atrapado */}
      {menuOpen && (
        <div
          className="drawer-overlay"
          onClick={() => {
            setMenuOpen(false);
            toggleButtonRef.current?.focus();
          }}
          aria-hidden="true"
        />
      )}

      <aside
        id="nav-drawer"
        ref={drawerRef}
        className={`drawer ${menuOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        aria-hidden={!menuOpen}
      >
        <div className="drawer-head">
          <div className="drawer-title">
            <span className="drawer-mark">CY</span>
            <strong>Cocina Ya</strong>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="drawer-close"
            onClick={() => {
              setMenuOpen(false);
              toggleButtonRef.current?.focus();
            }}
            aria-label="Cerrar menú"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <nav className="drawer-nav" aria-label="Secciones de la aplicación">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`drawer-link ${tab === t.id ? 'on' : ''}`}
              onClick={() => goTo(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              <span className="drawer-icon">
                <Icon name={t.icon} size={20} />
              </span>
              <span className="drawer-label">{t.label}</span>
              {t.id === 'shop' && pendingShop > 0 && (
                <span className="drawer-badge">{pendingShop}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="drawer-foot">
          <p className="drawer-caption">SmartPantry & Planner</p>
        </div>
      </aside>

      <main id="main-content">
        {tab === 'home' && (
          <Dashboard
            uid={uid}
            ingredients={ingredients.data}
            plan={plan.data}
            shopping={shopping.data}
            suggestion={suggestion}
            loading={ingredients.loading || plan.loading || shopping.loading}
            onOpenRecipe={setOpenRecipe}
            go={goTo}
          />
        )}
        {tab === 'fridge' && (
          <Fridge
            uid={uid}
            items={ingredients.data}
            loading={ingredients.loading}
            autoFocus={fridgeAutoFocus}
            onFocusHandled={() => setFridgeAutoFocus(false)}
          />
        )}
        {tab === 'recipes' && (
          <RecipeFinder
            uid={uid}
            ingredients={ingredients.data}
            plan={plan.data}
            onOpenRecipe={setOpenRecipe}
          />
        )}
        {tab === 'plan' && (
          <Planner
            uid={uid}
            plan={plan.data}
            loading={plan.loading}
            onOpenRecipe={setOpenRecipe}
          />
        )}
        {tab === 'shop' && (
          <Shopping
            uid={uid}
            items={shopping.data}
            loading={shopping.loading}
            plan={plan.data}
            fridge={ingredients.data}
          />
        )}
      </main>

      {openRecipe && (
        <RecipeModal
          recipe={openRecipe}
          uid={uid}
          fridge={ingredients.data}
          shopping={shopping.data}
          onClose={closeRecipe}
        />
      )}
    </div>
  );
}
