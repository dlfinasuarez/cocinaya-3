export const CATEGORIES = ['Verduras', 'Carnes', 'Lácteos', 'Despensa'];
export const CATEGORY_ICONS = { Verduras: '🥬', Carnes: '🥩', Lácteos: '🧀', Despensa: '🫙' };
export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const SHIFTS = [
  { id: 'almuerzo', label: 'Almuerzo' },
  { id: 'cena', label: 'Cena' },
];
export const slotKey = (dayIndex, shiftId) => `${dayIndex}_${shiftId}`;
