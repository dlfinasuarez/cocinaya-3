import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import {
  signInGoogle,
  signInGuest,
  linkCurrentWithGoogle,
  logoutUser,
  checkRedirectResult,
} from '../services/auth';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Verificar si volvemos de una redirección OAuth
    checkRedirectResult().catch((e) => setError(e));

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return unsub;
  }, []);

  const loginGoogle = async () => {
    setError(null);
    return await signInGoogle();
  };

  const loginGuest = async () => {
    setError(null);
    return await signInGuest();
  };

  const linkGoogle = async () => {
    setError(null);
    const updatedUser = await linkCurrentWithGoogle();
    setUser({ ...updatedUser });
    return updatedUser;
  };

  const logout = async () => {
    setError(null);
    await logoutUser();
  };

  return {
    user,
    loading,
    error,
    isAnonymous: Boolean(user?.isAnonymous),
    loginGoogle,
    loginGuest,
    linkGoogle,
    logout,
  };
}
