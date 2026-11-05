// Tiny Plates (https://www.tinyplates.dev) a través de /api/tinyplates:
// el servidor (Vite en desarrollo, Vercel en producción) agrega la API key.
// El plan gratis permite 50 consultas por día y 300 por semana POR CUENTA,
// por eso todo se cachea (memoria + localStorage). Es solo caché de la API;
// los datos de la app (heladera, semana, compras) viven en Firestore.
const ENDPOINT = '/api/tinyplates';

// ---------- Diccionario español → nombre canónico en inglés ----------
const ES_EN = {
  pollo: 'chicken', carne: 'beef', vaca: 'beef', res: 'beef', cerdo: 'pork', cordero: 'lamb',
  jamon: 'ham', pescado: 'fish', salmon: 'salmon', atun: 'tuna', huevo: 'egg', leche: 'milk',
  queso: 'cheese', manteca: 'butter', crema: 'cream', yogur: 'yogurt', tomate: 'tomato',
  cebolla: 'onion', papa: 'potato', patata: 'potato', zanahoria: 'carrot', ajo: 'garlic',
  morron: 'bell pepper', pimiento: 'bell pepper', zapallo: 'pumpkin', calabaza: 'pumpkin',
  zapallito: 'zucchini', berenjena: 'eggplant', pepino: 'cucumber', choclo: 'corn', maiz: 'corn',
  espinaca: 'spinach', lechuga: 'lettuce', brocoli: 'broccoli', champinon: 'mushroom', hongo: 'mushroom',
  arroz: 'rice', fideo: 'pasta', pasta: 'pasta', harina: 'flour', azucar: 'sugar', aceite: 'olive oil',
  pan: 'bread', avena: 'oats', lenteja: 'lentil', garbanzo: 'chickpea', poroto: 'bean',
  limon: 'lemon', naranja: 'orange', banana: 'banana', manzana: 'apple', frutilla: 'strawberry',
  palta: 'avocado', mani: 'peanut', nuez: 'walnut', almendra: 'almond', miel: 'honey',
  mayonesa: 'mayonnaise', mostaza: 'mustard', chocolate: 'chocolate', canela: 'cinnamon',
  perejil: 'parsley', albahaca: 'basil', oregano: 'oregano', tomillo: 'thyme',
};
const EN_ES = {};
Object.entries(ES_EN).forEach(([es, en]) => { if (!EN_ES[en]) EN_ES[en] = es; });
const ACCENTS = {
  morron: 'morrón', limon: 'limón', azucar: 'azúcar', champinon: 'champiñón', brocoli: 'brócoli',
  salmon: 'salmón', atun: 'atún', jamon: 'jamón', maiz: 'maíz', oregano: 'orégano', mani: 'maní',
};

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

// ---------- Comparar ingredientes: "red bell pepper" contiene "bell pepper" ----------
const phrase = (s) => normalize(s).split(/[\s-]+/).filter(Boolean).map(keyName).join(' ');
const contains = (text, part) => {
  const p = phrase(part);
  return p !== '' && ` ${phrase(text)} `.includes(` ${p} `);
};
export const inFridge = (name, fridge) => fridge.some((f) => contains(name, toEnglish(f.name)));

// Lo que Tiny Plates da por hecho que hay en cualquier cocina
const STAPLES = ['salt', 'sea salt', 'kosher salt', 'pepper', 'black pepper', 'water', 'oil', 'olive oil',
  'vegetable oil', 'sugar', 'flour', 'all-purpose flour'];
export const isStaple = (name) => STAPLES.includes(normalize(name));
// Los ids de Tiny Plates son de 24 caracteres hexadecimales
export const isTinyId = (id) => /^[a-f0-9]{24}$/i.test(id || '');

// Marca qué ingredientes de la receta ya están en la heladera
export function withAvailability(recipe, fridge) {
  return recipe.ingredients.map((ing) =>
    isStaple(ing.name) ? { ...ing, have: true, staple: true } : { ...ing, have: inFridge(ing.name, fridge) });
}
// Nombre para mostrar: el de la receta si viene en su idioma, o la traducción
export const ingredientLabel = (ing) => capitalize(ing.localName || toSpanish(ing.name));

// ---------- Llamada a la API ----------
function apiError(message) {
  const e = new Error(message);
  e.userMessage = message; // los componentes lo muestran en el toast
  return e;
}

async function request(path, params = {}) {
  const qs = new URLSearchParams({ path });
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  let res;
  try {
    res = await fetch(`${ENDPOINT}?${qs}`);
  } catch {
    throw apiError('No hay conexión con el servicio de recetas.');
  }
  if (res.ok) return res.json();
  let message = '';
  try { message = (await res.json()).error?.message || ''; } catch { /* sin cuerpo */ }
  if (res.status === 401) throw apiError('La API key de Tiny Plates falta o no es válida. Revisá TINY_PLATES_API_KEY.');
  if (res.status === 429) throw apiError('Se agotó el cupo de consultas de Tiny Plates (50 por día). Probá de nuevo más tarde.');
  if (res.status === 404) throw apiError('No encontramos esa receta.');
  if (res.status === 400) throw apiError(message || 'La consulta no es válida.');
  throw apiError('El servicio de recetas no respondió. Intentá de nuevo.');
}

// ---------- Caché (memoria + localStorage) ----------
const PREFIX = 'tp:';
const DAY = 24 * 3600 * 1000;
const mem = new Map();
const inflight = new Map();
const ttl = (key) => (key.startsWith('r:') ? 7 * DAY : DAY); // las recetas casi no cambian

function readCache(key) {
  if (mem.has(key)) return mem.get(key);
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw) {
      const { t, v } = JSON.parse(raw);
      if (Date.now() - t < ttl(key)) { mem.set(key, v); return v; }
      localStorage.removeItem(PREFIX + key);
    }
  } catch { /* sin caché persistente */ }
  return null;
}
function writeCache(key, value) {
  mem.set(key, value);
  const payload = JSON.stringify({ t: Date.now(), v: value });
  try {
    localStorage.setItem(PREFIX + key, payload);
  } catch {
    // Sin espacio: limpiamos el caché de recetas y reintentamos una vez
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(PREFIX + key, payload);
    } catch { /* ignorar */ }
  }
}
function cached(key, loader) {
  const hit = readCache(key);
  if (hit) return Promise.resolve(hit);
  if (inflight.has(key)) return inflight.get(key); // evita consultas duplicadas
  const p = loader().then((v) => { writeCache(key, v); return v; }).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ---------- Convertir la receta de la API a lo que usa la app ----------
const toMin = (d) => (d?.seconds ? Math.max(1, Math.round(d.seconds / 60)) : null);

function pickMedia(media = []) {
  const images = media.filter((m) => m.type === 'image');
  const hero = images.find((m) => m.role === 'hero') || images.find((m) => m.role === 'thumbnail') || images.find((m) => m.role === 'gallery');
  // El hero puede venir recortado; la variante más grande (o la última) es la foto completa
  const biggest = (m) => {
    const v = m.variants || [];
    const sized = v.filter((x) => x.width).sort((a, b) => b.width - a.width);
    return (sized[0] || v[v.length - 1] || m).url;
  };
  return {
    thumb: hero?.url || null,
    image: hero ? biggest(hero) : null,
    gallery: images.filter((m) => m.role === 'gallery').slice(0, 6).map((m) => ({ url: m.url, alt: m.alt || '' })),
    stepImages: Object.fromEntries(images.filter((m) => m.role === 'step' && m.step).map((m) => [m.step, m.url])),
    videos: media.filter((m) => m.type === 'video').map((m) => ({ url: m.embedUrl || m.url, title: m.caption || m.alt || 'Ver video' })),
  };
}

export function normalizeRecipe(r) {
  const media = pickMedia(r.media);
  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    url: r.url,
    author: r.author || null,
    language: r.language,
    ...media,
    times: { prep: toMin(r.times?.prep), cook: toMin(r.times?.cook), total: toMin(r.times?.total) },
    servings: r.servings || null,
    rating: r.rating || null,
    courses: r.courses || [],
    cuisines: r.cuisines || [],
    tags: (r.tags || []).slice(0, 8),
    equipment: r.equipment || [],
    notes: r.notes || [],
    dietary: r.dietary || {},
    allergens: Object.entries(r.allergens || {}).filter(([, v]) => v === true).map(([k]) => k),
    nutrition: r.nutrition || null,
    ingredients: (r.ingredients || []).map((i) => ({
      name: i.name, display: i.display, localName: i.localName, ingredientId: i.ingredientId,
      optional: !!i.optional, group: i.group, preparation: i.preparation,
    })),
    steps: (r.instructions || []).map((s) => ({
      step: s.step, text: s.text, group: s.group, seconds: s.duration?.seconds, temperature: s.temperature,
    })),
  };
}

// Guarda cada receta por separado: abrirla después no gasta otra consulta
const remember = (r) => { const base = normalizeRecipe(r); writeCache(`r:${r.id}`, base); return base; };

// Sube primero las recetas que usan ingredientes que vencen pronto
function boost(list, priority) {
  if (!priority.length) return list;
  const wanted = priority.map(toEnglish);
  const score = (r) => (r.matches || []).filter((m) => wanted.some((w) => contains(m, w))).length;
  return [...list].sort((a, b) => score(b) - score(a) || b.coverage - a.coverage);
}

// ---------- Endpoints ----------
// /pantry: recetas ordenadas por cuánto cubre tu heladera
export async function findRecipes(names, opts = {}) {
  const { language = 'en', maxMissing, without = [], priority = [], limit = 12 } = opts;
  const terms = [...new Set(names.map(toEnglish))].slice(0, 20);
  if (!terms.length) return [];
  const key = ['pantry', language, maxMissing ?? 'x', [...without].sort().join('+'), limit, [...terms].sort().join(',')].join(':');
  const list = await cached(key, async () => {
    const data = await request('pantry', {
      ingredients: terms.join(','), language, limit, maxMissing, without: without.join(','),
    });
    return (data.recipes || []).map((r) => ({
      ...remember(r),
      coverage: r.coverage,
      matches: r.matchedIngredients || [],
      missing: r.missingIngredients || [],
    }));
  });
  return boost(list, priority);
}

// /search: búsqueda por significado ("pasta cremosa" encuentra carbonara)
export function searchRecipes(query, { language = 'en', without = [], limit = 12 } = {}) {
  const key = ['search', language, [...without].sort().join('+'), limit, normalize(query)].join(':');
  return cached(key, async () => {
    const data = await request('search', { query, limit, language, without: without.join(',') });
    return (data.results || []).map(remember);
  });
}

// /popular: las mejor puntuadas
export function popularRecipes({ language = 'en', limit = 12 } = {}) {
  return cached(`popular:${language}:${limit}`, async () => {
    const data = await request('popular', { language, limit });
    return (data.recipes || []).map(remember);
  });
}

// /recipes/{id}: receta completa; con servings y units la devuelve escalada o convertida
export function getRecipeDetails(id, { servings, units } = {}) {
  const key = servings || units ? `r:${id}:${servings || ''}:${units || ''}` : `r:${id}`;
  return cached(key, async () => normalizeRecipe((await request(`recipes/${id}`, { servings, units })).recipe));
}

// /substitutions: con qué reemplazar un ingrediente, en qué proporción y con qué cuidado
export function getSubstitutions(names) {
  const list = [...new Set(names)].slice(0, 20);
  return cached(`sub:${[...list].sort().join(',')}`, () => request('substitutions', { ingredients: list.join(',') }));
}

// /shopping-list: une varias recetas en una lista agrupada por pasillo
export function buildShoppingList(recipeIds) {
  const ids = [...new Set(recipeIds)].sort();
  return cached(`list:${ids.join(',')}`, () => request('shopping-list', { recipes: ids.join(',') }));
}
