// Turns recipe ingredients into a tidy shopping list: merges variants, converts units, rounds up.
const N = (en, nb) => ({ en, nb });

// [pattern on the English ingredient name, shopping name, unit to buy in, grams/ml per recipe unit]
const BUY = [
  [/egg/, N('Eggs', 'Egg'), 'pcs'],
  [/lactose-free (whole )?milk/, N('Lactose-free milk', 'Laktosefri melk'), 'ml'],
  [/lactose-free natural yogurt/, N('Lactose-free yogurt', 'Laktosefri yoghurt'), 'g'],
  [/lactose-free sour cream/, N('Lactose-free sour cream', 'Laktosefri rømme'), 'g'],
  [/^butter/, N('Butter', 'Smør'), 'g'],
  [/garlic-infused/, N('Garlic-infused oil', 'Hvitløksolje'), 'tbsp'],
  [/olive oil/, N('Olive oil', 'Olivenolje'), 'tbsp'],
  [/carrot/, N('Carrots', 'Gulrøtter'), 'pcs'],
  [/rolled oats/, N('Rolled oats', 'Havregryn'), 'g'],
  [/cucumber/, N('Cucumber', 'Agurk'), 'pcs'],
  [/cheddar|norvegia|grated cheese/, N('Cheese (cheddar or Norvegia)', 'Ost (cheddar eller Norvegia)'), 'g'],
  [/parmesan/, N('Parmesan', 'Parmesan'), 'g'],
  [/spelt sourdough/, N('Spelt sourdough bread', 'Speltsurdeigsbrød'), 'slices'],
  [/rice cakes/, N('Rice cakes, plain', 'Riskaker naturell'), 'pcs'],
  [/rice crackers/, N('Rice crackers, plain', 'Riskjeks naturell'), 'g'],
  [/porridge rice/, N('Porridge rice', 'Grøtris'), 'g'],
  [/^rice/, N('Rice', 'Ris'), 'g'],
  [/tuna/, N('Tuna in water', 'Tunfisk i vann'), 'can'],
  [/stock/, N('Stock without onion or garlic', 'Buljong uten løk og hvitløk'), 'ml'],
  [/strawberr/, N('Strawberries', 'Jordbær'), 'g'],
  [/blueberr/, N('Blueberries', 'Blåbær'), 'g'],
  [/chives/, N('Chives', 'Gressløk'), 'bunch'],
  [/spring onion/, N('Spring onions (use the green part)', 'Vårløk (bruk det grønne)'), 'pcs'],
  [/potato/, N('Potatoes', 'Poteter'), 'g'],
  [/peanut butter/, N('Peanut butter', 'Peanøttsmør'), 'tbsp'],
  [/maple syrup/, N('Maple syrup', 'Lønnesirup'), 'tbsp'],
  [/gluten-free flour/, N('Gluten-free flour', 'Glutenfritt mel'), 'g'],
  [/gluten-free pasta/, N('Gluten-free pasta', 'Glutenfri pasta'), 'g'],
  [/soy sauce/, N('Soy sauce', 'Soyasaus'), 'tbsp'],
  [/mayonnaise/, N('Mayonnaise', 'Majones'), 'tbsp'],
  [/salmon/, N('Salmon fillet', 'Laksefilet'), 'g'],
  [/chicken breast/, N('Chicken breast', 'Kyllingfilet'), 'g'],
  [/chicken thighs/, N('Chicken thighs, boneless', 'Kyllinglårfilet'), 'g'],
  [/minced beef/, N('Minced beef', 'Kjøttdeig'), 'g'],
  [/^ham/, N('Ham', 'Skinke'), 'g'],
  [/banana/, N('Firm bananas', 'Faste bananer'), 'pcs'],
  [/walnut/, N('Walnuts', 'Valnøtter'), 'g'],
  [/peanuts/, N('Salted peanuts', 'Saltede peanøtter'), 'g'],
  [/dark chocolate/, N('Dark chocolate (70%)', 'Mørk sjokolade (70 %)'), 'g'],
  [/iceberg/, N('Iceberg lettuce', 'Isbergsalat'), 'pcs'],
  [/tomato/, N('Tomatoes', 'Tomater'), 'pcs'],
  [/corn tortilla/, N('Corn tortillas', 'Maistortillas'), 'pcs'],
  [/bean sprouts/, N('Bean sprouts', 'Bønnespirer'), 'g'],
  [/spinach/, N('Baby spinach', 'Babyspinat'), 'g'],
  [/ginger/, N('Fresh ginger', 'Fersk ingefær'), 'pcs'],
];

const PANTRY = /salt|pepper|cinnamon|nutmeg|ground ginger|paprika|cumin|oregano|chili|rosemary|sugar|sesame|water|lemon|dill|parsley/;

// How many grams/ml one recipe unit is, per target unit.
function convert(q, unit, target, nameEn) {
  if (q == null) return null;
  if (unit === target) return q;
  const n = nameEn;
  if (unit === 'l' && target === 'ml') return q * 1000;
  if (unit === 'tbsp' && target === 'ml') return q * 15;
  if (unit === 'tsp' && target === 'ml') return q * 5;
  if (unit === 'tsp' && target === 'tbsp') return q / 3;
  if (unit === 'tbsp' && target === 'g') return q * (/butter/.test(n) ? 14 : /flour/.test(n) ? 8 : 15);
  if (unit === 'pcs' && target === 'g' && /potato/.test(n)) return q * (/large/.test(n) ? 300 : 150);
  if (target === 'bunch') return null;
  if (target === 'pcs' && unit === 'cm') return q > 0 ? 1 : null;
  return null; // unknown conversion: list without amount
}

function roundBuy(q, unit) {
  if (q == null) return null;
  if (['pcs', 'slices', 'can'].includes(unit)) return Math.max(1, Math.ceil(q - 0.05));
  if (unit === 'g') return q >= 200 ? Math.ceil(q / 50) * 50 : Math.max(10, Math.ceil(q / 10) * 10);
  if (unit === 'ml') return q >= 200 ? Math.ceil(q / 50) * 50 : Math.max(10, Math.ceil(q / 10) * 10);
  if (unit === 'tbsp') return Math.max(1, Math.ceil(q));
  return q;
}

// items: [{ q, unit, name: {en, nb} }] (already scaled to what is needed)
export function buildShopping(items) {
  const buy = new Map();
  const pantry = new Map();
  for (const it of items) {
    const en = it.name.en.toLowerCase();
    const rule = BUY.find(([re]) => re.test(en));
    if (!rule && PANTRY.test(en)) {
      pantry.set(en, it.name);
      continue;
    }
    if (rule) {
      const [, name, unit] = rule;
      const key = name.en;
      const cur = buy.get(key) || { key, name, unit, q: 0, has: false, unknown: false };
      const c = convert(it.q, it.unit, unit, en);
      if (c != null) { cur.q += c; cur.has = true; } else if (it.q != null) cur.unknown = true;
      buy.set(key, cur);
    } else {
      const key = `${it.name.en}|${it.unit}`;
      const cur = buy.get(key) || { key, name: it.name, unit: it.unit, q: 0, has: false };
      if (it.q != null) { cur.q += it.q; cur.has = true; }
      buy.set(key, cur);
    }
  }
  const list = [...buy.values()].map((x) => ({ ...x, q: x.has ? roundBuy(x.q, x.unit) : null }));
  return { list, pantry: [...pantry.values()] };
}
