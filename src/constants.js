export const CATEGORIES = ['Verduras', 'Carnes', 'Lácteos', 'Despensa'];
export const CATEGORY_ICONS = { Verduras: '🥬', Carnes: '🥩', Lácteos: '🧀', Despensa: '🫙' };
export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const SHIFTS = [
  { id: 'almuerzo', label: 'Almuerzo' },
  { id: 'cena', label: 'Cena' },
];
export const slotKey = (dayIndex, shiftId) => `${dayIndex}_${shiftId}`;

// ---- Textos para los datos de Tiny Plates ----
// Pasillos de la lista de compras (campo "category" de /shopping-list)
export const AISLES = {
  produce: 'Verdulería', meat: 'Carnes', seafood: 'Pescados y mariscos', dairy: 'Lácteos',
  bakery: 'Panadería', pantry: 'Despensa', spices: 'Especias', frozen: 'Congelados',
  drinks: 'Bebidas', other: 'Otros',
};
export const AISLE_ORDER = Object.keys(AISLES);

// Los 16 alérgenos regulados que informa cada receta
export const ALLERGEN_LABELS = {
  celery: 'apio', crustaceans: 'crustáceos', eggs: 'huevo', fish: 'pescado',
  'gluten-cereals': 'gluten (cereales)', lupin: 'altramuz', milk: 'leche', molluscs: 'moluscos',
  mustard: 'mostaza', 'nuts-eu': 'frutos secos', peanuts: 'maní', sesame: 'sésamo', soy: 'soja',
  sulphites: 'sulfitos', 'tree-nuts-us': 'frutos secos (EE. UU.)', wheat: 'trigo',
};
// Alérgenos que se pueden evitar desde el buscador (parámetro "without")
export const AVOID_OPTIONS = ['milk', 'eggs', 'gluten-cereals', 'peanuts', 'soy', 'fish'];

export const DIET_LABELS = {
  vegan: 'Vegana', vegetarian: 'Vegetariana', pescatarian: 'Pescetariana',
  glutenFree: 'Sin gluten', dairyFree: 'Sin lácteos',
};
