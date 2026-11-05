import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { keyName } from './recipes';

// Agrega varios ítems en un solo batch, evitando repetir los que ya están pendientes.
// items: textos o { name, detail?, aisle? }. Devuelve cuántos se agregaron.
export async function addToShopping(uid, items, existing, source = 'manual') {
  const taken = new Set(existing.filter((i) => !i.done).map((i) => keyName(i.name)));
  const fresh = [];
  items.map((i) => (typeof i === 'string' ? { name: i } : i)).forEach((it) => {
    const name = it.name.slice(0, 80);
    const k = keyName(name);
    if (k && !taken.has(k)) { taken.add(k); fresh.push({ ...it, name }); }
  });
  if (!fresh.length) return 0;
  const batch = writeBatch(db);
  const col = collection(db, 'users', uid, 'shopping');
  fresh.forEach((it) => batch.set(doc(col), {
    name: it.name,
    done: false,
    source,
    createdAt: serverTimestamp(),
    ...(it.detail ? { detail: it.detail.slice(0, 120) } : {}),
    ...(it.aisle ? { aisle: it.aisle } : {}),
  }));
  await batch.commit();
  return fresh.length;
}
