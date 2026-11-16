import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback((message, typeOrOpts = 'success', extraAction = null) => {
    const id = `${Date.now()}-${Math.random()}`;
    let type = 'success';
    let action = null;
    let duration = 4000;

    if (typeof typeOrOpts === 'string') {
      type = typeOrOpts;
      if (extraAction) action = extraAction;
    } else if (typeOrOpts && typeof typeOrOpts === 'object') {
      type = typeOrOpts.type || 'success';
      action = typeOrOpts.action || null;
      if (typeOrOpts.duration) duration = typeOrOpts.duration;
    }

    // Si tiene acción de deshacer, dejamos un poco más de tiempo visible
    if (action) duration = 6500;

    setToasts((t) => [...t, { id, message, type, action }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-msg">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  try {
                    t.action.onClick?.();
                  } catch (e) {
                    console.error('Error al ejecutar acción de toast:', e);
                  }
                  dismiss(t.id);
                }}
              >
                {t.action.label || 'Deshacer'}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
