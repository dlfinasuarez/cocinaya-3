// Tiny Plates (https://www.tinyplates.dev) a través de /api/tinyplates:
// el servidor (Vite en desarrollo, Vercel en producción) agrega la API key.
// El plan gratis permite 50 consultas por día y 300 por semana POR CUENTA,
// por eso todo se cachea (memoria + localStorage). Es solo caché de la API;
// los datos de la app (heladera, semana, compras) viven en Firestore.
const ENDPOINT = '/api/tinyplates';

// ---------- Diccionario español → nombre canónico en inglés ----------
const ES_EN = {
  // Carnes
  pollo: 'chicken', carne: 'beef', vaca: 'beef', res: 'beef', cerdo: 'pork', cordero: 'lamb',
  jamon: 'ham', panceta: 'bacon', bacon: 'bacon', chorizo: 'sausage', salchicha: 'sausage',

  // Pescados y mariscos
  pescado: 'fish', salmon: 'salmon', atun: 'tuna', merluza: 'hake', camaron: 'shrimp',
  langostino: 'prawn', calamar: 'squid', pulpo: 'octopus', mejillon: 'mussel', bacalao: 'cod',
  trucha: 'trout',

  // Huevos y Lácteos
  huevo: 'egg', huevos: 'egg', clara: 'egg white', yema: 'egg yolk',
  leche: 'milk', queso: 'cheese', manteca: 'butter', crema: 'cream', yogur: 'yogurt',
  ricota: 'ricotta', muzzarella: 'mozzarella', parmesano: 'parmesan',

  // Verduras
  tomate: 'tomato', cebolla: 'onion', papa: 'potato', patata: 'potato', zanahoria: 'carrot', ajo: 'garlic',
  morron: 'bell pepper', pimiento: 'bell pepper', zapallo: 'pumpkin', calabaza: 'pumpkin',
  zapallito: 'zucchini', calabacin: 'zucchini', berenjena: 'eggplant', pepino: 'cucumber',
  choclo: 'corn', maiz: 'corn', espinaca: 'spinach', lechuga: 'lettuce', brocoli: 'broccoli',
  champinon: 'mushroom', hongo: 'mushroom', puerro: 'leek', apio: 'celery', coliflor: 'cauliflower',
  repollo: 'cabbage', remolacha: 'beetroot', esparrago: 'asparagus',

  // Frutas
  limon: 'lemon', naranja: 'orange', banana: 'banana', platano: 'banana', manzana: 'apple',
  frutilla: 'strawberry', fresa: 'strawberry', pera: 'pear', durazno: 'peach', uva: 'grape',
  palta: 'avocado', aguacate: 'avocado', arandano: 'blueberry', kiwi: 'kiwi', anana: 'pineapple',
  pina: 'pineapple', mango: 'mango', ciruela: 'plum', sandia: 'watermelon', melon: 'melon',
  pomelo: 'grapefruit', lima: 'lime',

  // Despensa y Granos
  arroz: 'rice', fideo: 'pasta', fideos: 'pasta', pasta: 'pasta', pastas: 'pasta',
  tallarines: 'noodles', spaghetti: 'pasta', espaguetis: 'pasta', canelones: 'cannelloni',
  lasana: 'lasagna', lasagne: 'lasagna', ñoquis: 'gnocchi', noquis: 'gnocchi',
  harina: 'flour', azucar: 'sugar',
  aceite: 'olive oil', avena: 'oats', lenteja: 'lentil', lentejas: 'lentil', garbanzo: 'chickpea',
  garbanzos: 'chickpea', poroto: 'bean', porotos: 'bean', frijoles: 'bean',
  mani: 'peanut', nuez: 'walnut', nueces: 'walnut', almendra: 'almond', almendras: 'almond',
  miel: 'honey', chocolate: 'chocolate', cacao: 'cocoa',

  // Platos, preparaciones y términos culinarios
  ensalada: 'salad', ensaladas: 'salad',
  pizza: 'pizza', pizzas: 'pizza',
  sopa: 'soup', sopas: 'soup', caldo: 'broth',
  guiso: 'stew', guisos: 'stew', estofado: 'stew',
  tarta: 'pie', tartas: 'pie', pastel: 'pie',
  torta: 'cake', tortas: 'cake',
  hamburguesa: 'burger', hamburguesas: 'burger', burger: 'burger',
  sandwich: 'sandwich', sanguche: 'sandwich',
  panqueque: 'pancake', panqueques: 'pancakes',
  milanesa: 'schnitzel', milanesas: 'schnitzel',
  pure: 'mashed potatoes', flan: 'flan', postre: 'dessert',
  empanada: 'empanada', empanadas: 'empanadas',
  risotto: 'risotto', tacos: 'tacos', taco: 'taco',
  asado: 'roast', asada: 'roasted', 'al horno': 'baked', frito: 'fried', frita: 'fried',
  salteado: 'stir fry', salteada: 'stir fry',
  crema: 'cream', salsa: 'sauce', queso: 'cheese',

  // Panadería
  pan: 'bread', tostada: 'toast', galletita: 'cookie', masa: 'dough', levadura: 'yeast',

  // Condimentos y salsas
  sal: 'salt', pimienta: 'pepper', oregano: 'oregano', tomillo: 'thyme', albahaca: 'basil',
  perejil: 'parsley', romero: 'rosemary', canela: 'cinnamon', comino: 'cumin', pimenton: 'paprika',
  laurel: 'bay leaf', mayonesa: 'mayonnaise', mostaza: 'mustard', ketchup: 'ketchup',
  vinagre: 'vinegar', salsa: 'sauce',

  // Bebidas
  agua: 'water', cafe: 'coffee', te: 'tea', vino: 'wine', cerveza: 'beer', jugo: 'juice',

  // Congelados
  hielo: 'ice',
};

const EN_ES = {};
Object.entries(ES_EN).forEach(([es, en]) => { if (!EN_ES[en]) EN_ES[en] = es; });
const ACCENTS = {
  morron: 'morrón', limon: 'limón', azucar: 'azúcar', champinon: 'champiñón', brocoli: 'brócoli',
  salmon: 'salmón', atun: 'atún', jamon: 'jamón', maiz: 'maíz', oregano: 'orégano', mani: 'maní',
  platano: 'plátano', arandano: 'arándano', anana: 'ananá', sandia: 'sandía', cafe: 'café',
  te: 'té', pimenton: 'pimentón',
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

// Traduce términos y combinaciones de búsqueda (ej: "fideos" -> "pasta", "sopa de pollo" -> "chicken soup")
export function translateSearchQuery(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const clean = normalize(raw);
  if (ES_EN[clean]) return ES_EN[clean];
  if (ES_EN[keyName(clean)]) return ES_EN[keyName(clean)];

  const tokens = clean.split(/\s+/).filter(Boolean);
  const STOP_WORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'en', 'para', 'al']);
  const translated = [];

  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    if (i < tokens.length - 1) {
      const pair = `${w} ${tokens[i + 1]}`;
      if (ES_EN[pair]) {
        translated.push(ES_EN[pair]);
        i++;
        continue;
      }
    }
    if (w === 'con') {
      translated.push('with');
      continue;
    }
    if (w === 'y') {
      translated.push('and');
      continue;
    }
    if (STOP_WORDS.has(w)) continue;
    const match = ES_EN[w] || ES_EN[keyName(w)];
    translated.push(match || w);
  }

  return translated.join(' ').trim();
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
  return (recipe.ingredients || []).map((ing) =>
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
  // No persistimos resultados vacíos en localStorage para evitar fijar falsos negativos por fallas transitorias
  if (Array.isArray(value) && value.length === 0) return;
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
// Si language es 'both' (por defecto), consulta es y en en paralelo y las combina deduplicando
export async function findRecipes(names, opts = {}) {
  const { language = 'both', maxMissing, without = [], priority = [], limit = 12 } = opts;
  const terms = [...new Set(names.map(toEnglish))].slice(0, 20);
  if (!terms.length) return [];

  if (language === 'both' || language === 'all') {
    const [es, en] = await Promise.all([
      findRecipes(names, { ...opts, language: 'es' }).catch(() => []),
      findRecipes(names, { ...opts, language: 'en' }).catch(() => []),
    ]);
    const seen = new Set();
    const combined = [];
    for (const r of [...es, ...en]) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        combined.push(r);
      }
    }
    return boost(combined, priority);
  }

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
export async function searchRecipes(query, { language = 'both', without = [], limit = 12 } = {}) {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return [];

  if (language === 'both' || language === 'all') {
    const enQuery = translateSearchQuery(cleanQuery) || cleanQuery;
    const queries = [
      { q: cleanQuery, lang: 'es' },
      { q: enQuery, lang: 'en' },
    ];
    if (enQuery.toLowerCase() !== cleanQuery.toLowerCase()) {
      queries.push({ q: cleanQuery, lang: 'en' });
    }

    const results = await Promise.all(
      queries.map(async ({ q, lang }) => {
        try {
          const list = await searchRecipes(q, { language: lang, without, limit });
          return { ok: true, list };
        } catch (err) {
          return { ok: false, err, list: [] };
        }
      })
    );

    const allFailed = results.every((r) => !r.ok);
    if (allFailed && results[0]?.err) {
      throw results[0].err;
    }

    const seen = new Set();
    const combined = [];
    for (const r of results) {
      for (const recipe of r.list) {
        if (!seen.has(recipe.id)) {
          seen.add(recipe.id);
          combined.push(recipe);
        }
      }
    }
    return combined;
  }

  const key = ['search', language, [...without].sort().join('+'), limit, normalize(cleanQuery)].join(':');
  return cached(key, async () => {
    const data = await request('search', { query: cleanQuery, limit, language, without: without.join(',') });
    return (data.results || []).map(remember);
  });
}

// /popular: las mejor puntuadas
export async function popularRecipes({ language = 'both', limit = 12 } = {}) {
  if (language === 'both' || language === 'all') {
    const [es, en] = await Promise.all([
      popularRecipes({ language: 'es', limit }).catch(() => []),
      popularRecipes({ language: 'en', limit }).catch(() => []),
    ]);
    const seen = new Set();
    const combined = [];
    for (const r of [...es, ...en]) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        combined.push(r);
      }
    }
    return combined;
  }

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
