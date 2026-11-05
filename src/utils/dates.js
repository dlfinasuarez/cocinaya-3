// Las fechas de vencimiento se guardan como texto "YYYY-MM-DD" (o null).
export const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

// Días que faltan hasta la fecha (negativo = ya venció, null = sin fecha)
export function daysLeft(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}

// level: red (vencido o ≤ 1 día) · yellow (2-3 días) · ok
export function expiryInfo(iso) {
  const n = daysLeft(iso);
  if (n === null) return null;
  if (n < 0) return { level: 'red', label: 'Vencido' };
  if (n === 0) return { level: 'red', label: 'Vence hoy' };
  if (n === 1) return { level: 'red', label: 'Vence mañana' };
  return { level: n <= 3 ? 'yellow' : 'ok', label: `Vence en ${n} días` };
}

export const isExpiring = (item) => {
  const n = daysLeft(item.expiresAt);
  return n !== null && n <= 3;
};

// Orden: primero lo que vence antes; sin fecha al final
export const byExpiry = (a, b) => (daysLeft(a.expiresAt) ?? 9999) - (daysLeft(b.expiresAt) ?? 9999);
