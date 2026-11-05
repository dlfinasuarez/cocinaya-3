import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { keyName } from './recipes';

// Agrega varios ítems en un solo batch, evitando repetir los que ya están pendientes.
// Devuelve cuántos se agregaron.
export async function addToShopping(uid, names, existing, source = 'manual') {
  const taken = new Set(existing.filter((i) => !i.done).map((i) => keyName(i.name)));
  const fresh = [];
  names.forEach((n) => {
    const k = keyName(n);
    if (k && !taken.has(k)) { taken.add(k); fresh.push(n); }
  });
  if (!fresh.length) return 0;
  const batch = writeBatch(db);
  const col = collection(db, 'users', uid, 'shopping');
  fresh.forEach((name) => batch.set(doc(col), { name, done: false, source, createdAt: serverTimestamp() }));
  await batch.commit();
  return fresh.length;
}
