// TheMealDB (gratis, clave de prueba "1"). El plan gratuito solo filtra por
// UN ingrediente por consulta, así que consultamos varios y combinamos resultados.
const API = 'https://www.themealdb.com/api/json/v1/1';

const ES_EN = {
  pollo: 'chicken', carne: 'beef', vaca: 'beef', res: 'beef', cerdo: 'pork',
  cordero: 'lamb', pescado: 'salmon', salmon: 'salmon', huevo: 'egg',
  leche: 'milk', queso: 'cheese', manteca: 'butter', crema: 'cream',
  yogur: 'yogurt', tomate: 'tomatoes', cebolla: 'onion', papa: 'potatoes',
  patata: 'potatoes', zanahoria: 'carrots', ajo: 'garlic', morron: 'peppers',
  pimiento: 'peppers', zapallo: 'pumpkin', espinaca: 'spinach',
  lechuga: 'lettuce', arroz: 'rice', fideo: 'pasta', pasta: 'pasta',
  harina: 'flour', azucar: 'sugar', aceite: 'olive oil', limon: 'lemon',
  champinon: 'mushrooms', hongo: 'mushrooms', brocoli: 'broccoli',
  banana: 'banana', manzana: 'apple', pan: 'bread', palta: 'avocado',
};
const EN_ES = {};
Object.entries(ES_EN).forEach(([es, en]) => { if (!EN_ES[en]) EN_ES[en] = es; });
const ACCENTS = { morron: 'morrón', limon: 'limón', azucar: 'azúcar', champinon: 'champiñón', brocoli: 'brócoli', salmon: 'salmón' };

const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
// Clave para comparar nombres: sin tildes ni plural simple
export const keyName = (s) => {
  const k = normalize(s);
  const singular = k.replace(/(es|s)$/, '');
  return singular.length >= 3 ? singular : k;
};
export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function toEnglish(name) {
  const n = normalize(name);
  return ES_EN[n] || ES_EN[keyName(name)] || n;
}
export function toSpanish(en) {
  const es = EN_ES[normalize(en)] || EN_ES[keyName(en)];
  return es ? ACCENTS[es] || es : en.toLowerCase();
}

export async function findRecipes(names) {
  const terms = [...new Set(names.map(toEnglish))].slice(0, 6);
  const results = await Promise.all(
    terms.map(async (term) => {
      const res = await fetch(`${API}/filter.php?i=${encodeURIComponent(term)}`);
      if (!res.ok) throw new Error('La API de recetas no respondió');
      const json = await res.json();
      return { term, meals: json.meals || [] };
    })
  );
  const merged = new Map();
  results.forEach(({ term, meals }) =>
    meals.forEach((m) => {
      const e = merged.get(m.idMeal) || { id: m.idMeal, title: m.strMeal, thumb: m.strMealThumb, matches: [] };
      e.matches.push(term);
      merged.set(m.idMeal, e);
    })
  );
  return [...merged.values()].sort((a, b) => b.matches.length - a.matches.length).slice(0, 12);
}

// Detalle completo (ingredientes + pasos). Se cachea en memoria.
const cache = new Map();
export async function getRecipeDetails(id) {
  if (cache.has(id)) return cache.get(id);
  const res = await fetch(`${API}/lookup.php?i=${id}`);
  if (!res.ok) throw new Error('No se pudo cargar la receta');
  const m = (await res.json()).meals?.[0];
  if (!m) throw new Error('Receta no encontrada');

  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = m[`strIngredient${i}`]?.trim();
    if (name) ingredients.push({ name, measure: (m[`strMeasure${i}`] || '').trim() });
  }
  const text = m.strInstructions || '';
  let steps = text.split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length > 3 && !/^step\s*\d+$/i.test(s));
  if (steps.length < 3) {
    steps = text.split(/\.\s+/).map((s) => s.trim()).filter(Boolean).map((s) => (s.endsWith('.') ? s : `${s}.`));
  }
  const details = { id: m.idMeal, title: m.strMeal, thumb: m.strMealThumb, category: m.strCategory, area: m.strArea, ingredients, steps };
  cache.set(id, details);
  return details;
}

// Marca qué ingredientes de la receta ya están en la heladera
export function withAvailability(details, fridge) {
  const have = new Set(fridge.map((i) => keyName(toEnglish(i.name))));
  return details.ingredients.map((ing) => {
    const words = normalize(ing.name).split(/\s+/);
    const hit = have.has(keyName(ing.name)) || words.some((w) => have.has(keyName(w)));
    return { ...ing, have: hit };
  });
}
