import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Suscripción en tiempo real a users/{uid}/{name}
export function useCollection(uid, name) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'users', uid, name),
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [uid, name]);

  return { data, loading, error };
}
