import { DAYS, SHIFTS } from '../constants';
import { byExpiry, daysLeft, expiryInfo, isExpiring } from '../utils/dates';
import { capitalize, toSpanish } from '../services/recipes';

const TOTAL_SLOTS = DAYS.length * SHIFTS.length;

export default function Dashboard({ ingredients, plan, loading, suggestion, onOpenRecipe, go }) {
  const expiring = ingredients.filter(isExpiring).sort(byExpiry);
  const worst = expiring.length ? Math.min(...expiring.map((i) => daysLeft(i.expiresAt))) : null;
  const level = worst === null ? 'ok' : worst <= 1 ? 'red' : 'yellow';
  const pct = Math.round((plan.length / TOTAL_SLOTS) * 100);
  const cooked = plan.filter((p) => p.done).length;
  const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const { recipe, loading: sugLoading, error: sugError } = suggestion;

  return (
    <section className="dash">
      <div className="hero">
        <h2>¿Qué cocinamos hoy?</h2>
        <p>{capitalize(today)}</p>
      </div>

      {level === 'red' && (
        <div className="banner red" role="alert">
          <span>Tenés ingredientes que vencen hoy, mañana o ya vencieron.</span>
          <button className="btn small" onClick={() => go('fridge')}>Revisar</button>
        </div>
      )}

      {loading ? (
        <div className="stats">{[0, 1, 2].map((i) => <div key={i} className="skeleton tall" />)}</div>
      ) : (
        <div className="stats">
          <div className="stat">
            <span className="stat-icon">🧊</span>
            <strong className="stat-num">{ingredients.length}</strong>
            <span className="stat-label">ingredientes en tu heladera</span>
          </div>
          <div className={`stat ${level}`}>
            <span className="stat-icon">{level === 'red' ? '🚨' : level === 'yellow' ? '⏰' : '✅'}</span>
            <strong className="stat-num">{expiring.length}</strong>
            <span className="stat-label">
              {expiring.length ? 'vencen en los próximos 3 días' : 'Nada por vencer: todo en orden'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-icon">📅</span>
            <strong className="stat-num">{pct}%</strong>
            <span className="stat-label">de tu semana planificada ({plan.length} de {TOTAL_SLOTS}; {cooked} cocinadas)</span>
            <div className="bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
      )}

      <h3 className="section-title">Sugerencia del día</h3>
      {sugLoading || loading ? (
        <div className="skeleton tall" />
      ) : recipe ? (
        <article className="suggest">
          <img src={`${recipe.thumb}/preview`} alt={recipe.title} />
          <div className="suggest-body">
            <h3>{recipe.title}</h3>
            <p>
              Usa {recipe.matches.map((m) => toSpanish(m)).join(', ')} de tu heladera
              {expiring.length ? ', priorizando lo que vence antes.' : '.'}
            </p>
            <button className="btn accent" onClick={() => onOpenRecipe(recipe)}>Ver receta</button>
          </div>
        </article>
      ) : (
        <div className="panel empty-inline">
          <p>
            {sugError
              ? 'No pudimos buscar una sugerencia ahora. Probá de nuevo en un rato.'
              : ingredients.length
                ? 'No encontramos recetas con tus ingredientes. Probá sumando otros.'
                : 'Cargá ingredientes en tu heladera y te sugerimos qué cocinar.'}
          </p>
          {!ingredients.length && <button className="btn primary small" onClick={() => go('fridge')}>Ir a Heladera</button>}
        </div>
      )}

      {expiring.length > 0 && (
        <>
          <h3 className="section-title">Para usar primero</h3>
          <ul className="panel quick-list">
            {expiring.slice(0, 5).map((i) => {
              const info = expiryInfo(i.expiresAt);
              return (
                <li key={i.id}>
                  <strong>{i.name}</strong>
                  <span className={`exp exp-${info.level}`}>{info.label}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
