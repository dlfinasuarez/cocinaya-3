import { useCallback, useEffect, useState } from 'react';
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

const TABS = [
  { id: 'home', label: 'Inicio' },
  { id: 'fridge', label: 'Heladera' },
  { id: 'recipes', label: 'Recetas' },
  { id: 'plan', label: 'Semana' },
  { id: 'shop', label: 'Compras' },
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
  const [openRecipe, setOpenRecipe] = useState(null);
  const closeRecipe = useCallback(() => setOpenRecipe(null), []);

  useEffect(() => {
    if (ingredients.error || plan.error || shopping.error)
      notify('No se pudieron leer tus datos. Revisá las reglas de Firestore.', 'error');
  }, [ingredients.error, plan.error, shopping.error, notify]);

  if (authLoading) return <div className="boot">Preparando tu cocina…</div>;
  if (authError)
    return (
      <div className="boot error">
        <h1>No pudimos iniciar sesión</h1>
        <p>Verificá que Authentication → Anónimo esté habilitado y que las variables de entorno sean correctas.</p>
        <code>{authError.code}</code>
      </div>
    );

  const pendingShop = shopping.data.filter((i) => !i.done).length;

  return (
    <div className="app">
      <header className="top">
        <h1>Cocina Ya </h1>
        <nav className="nav" aria-label="Secciones">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'on' : ''}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              {t.label}
              {t.id === 'shop' && pendingShop > 0 && (
                <b className="nav-badge">{pendingShop}</b>
              )}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'home' && (
          <Dashboard ingredients={ingredients.data} plan={plan.data} loading={ingredients.loading || plan.loading}
            suggestion={suggestion} onOpenRecipe={setOpenRecipe} go={setTab} />
        )}
        {tab === 'fridge' && <Fridge uid={uid} items={ingredients.data} loading={ingredients.loading} />}
        {tab === 'recipes' && <RecipeFinder uid={uid} ingredients={ingredients.data} plan={plan.data} onOpenRecipe={setOpenRecipe} />}
        {tab === 'plan' && <Planner uid={uid} plan={plan.data} loading={plan.loading} onOpenRecipe={setOpenRecipe} />}
        {tab === 'shop' && <Shopping uid={uid} items={shopping.data} loading={shopping.loading} plan={plan.data} fridge={ingredients.data} />}
      </main>
      {openRecipe && (
        <RecipeModal recipe={openRecipe} uid={uid} fridge={ingredients.data} shopping={shopping.data} onClose={closeRecipe} />
      )}
    </div>
  );
}
