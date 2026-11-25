import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInAnonymously,
  linkWithPopup,
  signOut,
  getRedirectResult,
} from 'firebase/auth';
import { auth } from '../firebase';

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Inicia sesión con Google mediante popup (con fallback a redirect si es necesario).
 */
export async function signInGoogle() {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  } catch (err) {
    if (err.code === 'auth/popup-blocked') {
      // Si el navegador bloqueó el popup, intentamos redirect
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw err;
  }
}

/**
 * Inicia sesión anónima (modo invitado).
 */
export async function signInGuest() {
  const cred = await signInAnonymously(auth);
  return cred.user;
}

/**
 * Vincula la cuenta anónima actual con una cuenta de Google,
 * conservando el mismo UID y todos los datos en Firestore.
 */
export async function linkCurrentWithGoogle() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No hay una sesión activa para vincular.');
  }

  try {
    const result = await linkWithPopup(currentUser, googleProvider);
    return result.user;
  } catch (err) {
    throw err;
  }
}

/**
 * Cierra la sesión activa.
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Procesa resultado de redirección si ocurrió signInWithRedirect.
 */
export async function checkRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (err) {
    console.error('Error al verificar redirección de auth:', err);
    return null;
  }
}
