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
import WelcomeScreen from './components/WelcomeScreen';
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
  const {
    user,
    loading: authLoading,
    error: authError,
    isAnonymous,
    loginGoogle,
    loginGuest,
    linkGoogle,
    logout,
  } = useAuth();

  const uid = user?.uid;
  const ingredients = useCollection(uid, 'ingredients');
  const plan = useCollection(uid, 'plan');
  const shopping = useCollection(uid, 'shopping');
  const suggestion = useSuggestion(ingredients.data, !ingredients.loading);

  const [tab, setTab] = useState('home');
  const [fridgeAutoFocus, setFridgeAutoFocus] = useState(false);
  const [openRecipe, setOpenRecipe] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [linking, setLinking] = useState(false);

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

  const handleLinkGoogle = async () => {
    try {
      setLinking(true);
      await linkGoogle();
      notify('¡Tu cuenta se vinculó con Google con éxito! Tus datos se conservan intactos.');
    } catch (err) {
      console.error('Error al vincular con Google:', err);
      if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use') {
        notify(
          'Esta cuenta de Google ya pertenece a otro usuario registrado. Para no perder tus datos actuales, seguí como invitado, o cerrá sesión e ingresá con Google.',
          'error'
        );
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // Cancelado por el usuario
      } else if (err.code === 'auth/provider-already-linked') {
        notify('Esta cuenta ya está vinculada con Google.');
      } else {
        notify(err.message || 'No se pudo vincular la cuenta. Intentá más tarde.', 'error');
      }
    } finally {
      setLinking(false);
    }
  };

  const handleLogout = async () => {
    try {
      setMenuOpen(false);
      await logout();
      notify('Sesión cerrada correctamente.');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
      notify('No se pudo cerrar la sesión.', 'error');
    }
  };

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

  // Pantalla de carga mientras Firebase verifica si hay sesión previa guardada
  if (authLoading) {
    return (
      <div className="boot">
        <div className="boot-inner">
          <img
            src={isologoUrl}
            alt=""
            className="boot-isologo"
            width="56"
            height="52"
          />
          <p>Preparando tu cocina…</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado (ni anónimo ni Google), mostramos la pantalla de bienvenida / login
  if (!user) {
    return (
      <WelcomeScreen
        onLoginGoogle={loginGoogle}
        onLoginGuest={loginGuest}
      />
    );
  }

  if (authError) {
    return (
      <div className="boot error">
        <h1>No pudimos iniciar sesión</h1>
        <p>Verificá que Authentication esté habilitado en Firebase y que las credenciales sean correctas.</p>
        <code>{authError.code || authError.message}</code>
      </div>
    );
  }

  const pendingShop = shopping.data.filter((i) => !i.done).length;
  const userDisplayName = user?.displayName || user?.email?.split('@')[0] || 'Usuario';

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

          {/* Estado de usuario en Desktop */}
          <div className="nav-user-desktop">
            {isAnonymous ? (
              <div className="user-pill-guest">
                <span className="user-badge-guest">Invitado</span>
                <button
                  type="button"
                  className="btn-link-link-account"
                  onClick={handleLinkGoogle}
                  disabled={linking}
                  title="Vincular con tu cuenta de Google para no perder tus datos"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24Z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/>
                  </svg>
                  <span>{linking ? 'Vinculando…' : 'Vincular Google'}</span>
                </button>
              </div>
            ) : (
              <div className="user-pill-auth">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="user-avatar-img" />
                ) : (
                  <span className="user-avatar-initials">
                    {userDisplayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="user-name-text" title={user?.email || userDisplayName}>
                  {userDisplayName}
                </span>
                <button
                  type="button"
                  className="user-logout-btn"
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            )}
          </div>
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
            <img
              src={isologoUrl}
              alt=""
              className="drawer-isologo"
              width="32"
              height="30"
              aria-hidden="true"
            />
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

        {/* Identificación de usuario en el Drawer */}
        <div className="drawer-user-info">
          {isAnonymous ? (
            <div className="drawer-guest-box">
              <div className="drawer-guest-head">
                <span className="user-badge-guest">Modo Invitado</span>
              </div>
              <p className="drawer-guest-desc">
                Podés vincular tu cuenta con Google para respaldar tus ingredientes y recetas.
              </p>
              <button
                type="button"
                className="btn-drawer-link-google"
                onClick={handleLinkGoogle}
                disabled={linking}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24Z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/>
                </svg>
                <span>{linking ? 'Vinculando…' : 'Vincular con Google'}</span>
              </button>
            </div>
          ) : (
            <div className="drawer-auth-box">
              <div className="drawer-auth-user">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="drawer-avatar-img" />
                ) : (
                  <span className="drawer-avatar-initials">
                    {userDisplayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="drawer-user-meta">
                  <strong className="drawer-user-name">{userDisplayName}</strong>
                  {user?.email && <span className="drawer-user-email">{user.email}</span>}
                </div>
              </div>
            </div>
          )}
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
          <div className="drawer-actions">
            <button
              type="button"
              className="drawer-logout-btn"
              onClick={handleLogout}
            >
              {isAnonymous ? 'Salir del modo invitado' : 'Cerrar sesión'}
            </button>
          </div>
          <p className="drawer-caption">Cocina Ya</p>
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
