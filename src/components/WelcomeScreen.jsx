import { useState } from 'react';
import isologoUrl from '../img/isologo_cocinaya.svg';
import { Icon } from './Icons';

export default function WelcomeScreen({ onLoginGoogle, onLoginGuest }) {
  const [loadingAction, setLoadingAction] = useState(null); // 'google' | 'guest' | null
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogle = async () => {
    try {
      setLoadingAction('google');
      setErrorMsg('');
      await onLoginGoogle();
    } catch (err) {
      console.error('Error al iniciar con Google:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // El usuario cerró la ventana emergente, no mostramos error alarmante
        setErrorMsg('Inicio de sesión cancelado.');
      } else if (err.code === 'auth/network-request-failed') {
        setErrorMsg('Error de conexión. Revisá tu conexión a internet.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setErrorMsg('Dominio no autorizado en Firebase. Añadí este dominio en la consola de Firebase.');
      } else {
        setErrorMsg(err.message || 'No se pudo iniciar sesión con Google. Intentá nuevamente.');
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleGuest = async () => {
    try {
      setLoadingAction('guest');
      setErrorMsg('');
      await onLoginGuest();
    } catch (err) {
      console.error('Error al iniciar como invitado:', err);
      setErrorMsg('No se pudo acceder como invitado. Intentá nuevamente.');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="welcome-screen-wrap">
      <div className="welcome-card">
        {/* Isologo & Marca */}
        <div className="welcome-brand">
          <img
            src={isologoUrl}
            alt="Isologo de CocinaYa"
            className="welcome-isologo"
            width="72"
            height="68"
          />
          <h1 className="welcome-title">CocinaYa</h1>
        </div>

        {/* Propósito / Slogan */}
        <p className="welcome-slogan">
          Organizá tus comidas, aprovechá tus ingredientes y simplificá tus compras.
        </p>

        {/* Mensaje de error si ocurre alguno */}
        {errorMsg && (
          <div className="welcome-error-banner" role="alert">
            <Icon name="alert" size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Acciones principales */}
        <div className="welcome-actions">
          {/* Botón Principal: Continuar con Google */}
          <button
            type="button"
            className="btn-google-auth"
            onClick={handleGoogle}
            disabled={loadingAction !== null}
            aria-label="Continuar con Google"
          >
            <svg
              className="google-icon-svg"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
              />
            </svg>
            <span>
              {loadingAction === 'google' ? 'Conectando con Google…' : 'Continuar con Google'}
            </span>
          </button>

          <div className="welcome-divider">
            <span className="welcome-divider-line" />
            <span className="welcome-divider-text">o también</span>
            <span className="welcome-divider-line" />
          </div>

          {/* Botón Secundario: Continuar como invitado */}
          <button
            type="button"
            className="btn-guest-auth"
            onClick={handleGuest}
            disabled={loadingAction !== null}
            aria-label="Continuar como invitado sin registrarse"
          >
            <Icon name="fridge" size={18} />
            <span>
              {loadingAction === 'guest' ? 'Ingresando como invitado…' : 'Continuar como invitado'}
            </span>
          </button>
        </div>

        <p className="welcome-privacy-hint">
          Podrás sincronizar y guardar tus recetas e ingredientes en cualquier momento.
        </p>
      </div>
    </div>
  );
}
