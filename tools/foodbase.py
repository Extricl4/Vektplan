#!/usr/bin/env python3
"""Builds js/data/foodbase.js from the Norwegian food composition table (Matvaretabellen 2026, Mattilsynet).

Get the data:  git clone --depth 1 https://github.com/mattilsynet/matvaretabellen-deux /tmp/mvt/repo
Run:           python3 tools/foodbase.py /tmp/mvt/repo/data

Values are per 100 g edible part: kcal, protein, fat, carbohydrate, fibre, sugar.
FODMAP ratings, defaults and names are ours (Monash University guidance); nutrition is Matvaretabellen's.
"""
import json, sys, os

DATA = sys.argv[1] if len(sys.argv) > 1 else '/tmp/mvt/repo/data'
OUT = os.path.join(os.path.dirname(__file__), '..', 'js', 'data', 'foodbase.js')

# Units: app unit -> Matvaretabellen portion type (or grams as a number).
# Spec: id, mvt id, English, Norwegian, category, fodmap, default (amount, unit), units, extra
NEW = [
    # ---- Meat and poultry (weigh raw before cooking, or cooked after)
    ('chicken-breast-raw', '03.205', 'Chicken breast, raw', 'Kyllingfilet, rå', 'meat', 'low', (150, 'g'), [('piece', 125)], {'pair': 'chicken-breast'}),
    ('chicken-thigh-raw', '03.333', 'Chicken thigh, no skin, raw', 'Kyllinglår (overlår) uten skinn, rå', 'meat', 'low', (2, 'piece'), [('piece', 'stk')], {'pair': 'chicken-thigh'}),
    ('chicken-drumstick', '03.395', 'Chicken drumstick, roasted', 'Kyllinglårklubbe, ovnsstekt', 'meat', 'low', (2, 'piece'), [('piece', 'stk')], {}),
    ('chicken-whole', '03.007', 'Chicken with skin, roasted', 'Kylling med skinn, ovnsstekt', 'meat', 'low', (150, 'g'), [], {}),
    ('chicken-mince-raw', '03.366', 'Chicken mince 8 %, raw', 'Kyllingkjøttdeig 8 %, rå', 'meat', 'low', (150, 'g'), [], {}),
    ('turkey-breast-raw', '03.204', 'Turkey breast, raw', 'Kalkunbryst, rå', 'meat', 'low', (150, 'g'), [], {}),
    ('turkey-slices', '03.323', 'Turkey slices (cold cuts)', 'Kalkunfilet, pålegg', 'meat', 'low', (3, 'slice'), [('slice', 'skive')], {}),
    ('beef-raw', '03.476', 'Beef, lean meat, raw', 'Storfekjøtt, magert, rå', 'meat', 'low', (150, 'g'), [], {'pair': 'beef-cooked'}),
    ('beef-cooked', '03.280', 'Beef, cooked', 'Storfekjøtt, kokt/stekt', 'meat', 'low', (120, 'g'), [], {'pair': 'beef-raw'}),
    ('mince-raw', '03.127', 'Beef mince 14 %, raw', 'Kjøttdeig av storfe 14 %, rå', 'meat', 'low', (150, 'g'), [], {'pair': 'mince'}),
    ('mince-lean-raw', '03.397', 'Beef mince 13 %, pure, raw', 'Karbonadedeig/kjøttdeig 13 %, rå', 'meat', 'low', (150, 'g'), [], {}),
    ('steak-raw', '03.054', 'Rib-eye steak (entrecôte), raw', 'Entrecôte, rå', 'meat', 'low', (200, 'g'), [], {'pair': 'steak'}),
    ('steak', '03.268', 'Rib-eye steak (entrecôte), fried', 'Entrecôte, stekt', 'meat', 'low', (160, 'g'), [], {'pair': 'steak-raw'}),
    ('beef-lean-raw', '03.056', 'Beef steak, lean (flatbiff), raw', 'Flatbiff av storfe, rå', 'meat', 'low', (150, 'g'), [], {}),
    ('pork-tenderloin-raw', '03.209', 'Pork tenderloin, raw', 'Svinefilet (indrefilet), rå', 'meat', 'low', (150, 'g'), [], {}),
    ('pork-chop', '03.274', 'Pork neck chop, fried', 'Nakkekotelett, stekt', 'meat', 'low', (1, 'piece'), [('piece', 'stk')], {}),
    ('pork-mince-raw', '03.348', 'Pork mince 9 %, raw', 'Svinekjøttdeig 9 %, rå', 'meat', 'low', (150, 'g'), [], {}),
    ('meatballs', '03.133', 'Meat cakes (kjøttkaker), bought', 'Kjøttkaker, kjøpt', 'meat', 'check', (3, 'piece'), [('piece', 'stk')], {'why': ('Often has onion and breadcrumbs.', 'Har ofte løk og brødsmuler.'), 'tags': ['garlic_onion', 'wheat']}),
    ('wiener', '03.150', 'Hot dog sausage (wiener)', 'Wienerpølse', 'meat', 'check', (1, 'piece'), [('piece', 'stk')], {'why': ('Check the label for onion and garlic.', 'Sjekk etiketten for løk og hvitløk.'), 'tags': ['garlic_onion']}),
    # ---- Fish and seafood
    ('salmon-raw', '04.220', 'Salmon, raw', 'Laks, rå', 'fish', 'low', (1, 'fillet'), [('fillet', 'filet')], {'pair': 'salmon'}),
    ('salmon-smoked', '04.018', 'Smoked salmon', 'Røkelaks', 'fish', 'low', (2, 'slice'), [('slice', 'skive')], {}),
    ('cod-raw', '04.326', 'Cod, raw', 'Torsk, rå', 'fish', 'low', (1, 'fillet'), [('fillet', 'filet')], {'pair': 'cod'}),
    ('saithe-raw', '04.029', 'Saithe (sei), raw', 'Sei, rå', 'fish', 'low', (150, 'g'), [], {}),
    ('trout-raw', '04.256', 'Trout, raw', 'Ørret, rå', 'fish', 'low', (1, 'fillet'), [('fillet', 'filet')], {}),
    ('mackerel-tomato', '04.097', 'Mackerel in tomato', 'Makrell i tomat', 'fish', 'check', (2, 'tbsp'), [('tbsp', 20), ('can', 'boks')], {'why': ('The tomato sauce can have onion. Check the label.', 'Tomatsausen kan ha løk. Sjekk etiketten.'), 'tags': ['garlic_onion']}),
    # ---- Eggs
    ('egg-boiled', '02.026', 'Egg, boiled', 'Egg, kokt', 'egg', 'low', (2, 'piece'), [('piece', 'stk')], {}),
    ('egg-fried', '02.025', 'Egg, fried', 'Egg, stekt', 'egg', 'low', (2, 'piece'), [('piece', 'stk')], {}),
    ('egg-white', '02.002', 'Egg white', 'Eggehvite', 'egg', 'low', (2, 'piece'), [('piece', 'stk')], {}),
    ('scrambled', '02.008', 'Scrambled eggs', 'Eggerøre', 'egg', 'low', (1, 'portion'), [('portion', 'porsjon')], {}),
    # ---- Dairy
    ('lf-yogurt-vanilla', '01.279', 'Lactose-free vanilla yogurt', 'Laktosefri vaniljeyoghurt', 'dairy', 'low', (1.5, 'dl'), [('dl', 'dl')], {}),
    ('greek-yogurt', '01.334', 'Greek yogurt 2 %', 'Gresk yoghurt 2 %', 'dairy', 'check', (1, 'dl'), [('dl', 'dl'), ('tbsp', 18)], {'why': ('Has some lactose. Fine in small amounts for many.', 'Har litt laktose. Går fint i små mengder for mange.'), 'tags': ['lactose']}),
    ('skyr', '01.233', 'Skyr', 'Skyr', 'dairy', 'check', (1, 'tub'), [('tub', 'beger')], {'why': ('Has a little lactose.', 'Har litt laktose.'), 'tags': ['lactose', 'protein']}),
    ('quark', '01.036', 'Quark 1 % (kesam)', 'Kvarg 1 % (Kesam)', 'dairy', 'check', (1, 'dl'), [('dl', 'dl'), ('tbsp', 'spiseskje')], {'why': ('Has some lactose.', 'Har litt laktose.'), 'tags': ['lactose', 'protein']}),
    ('cheese-light', '01.040', 'Cheese, light (Norvegia lett)', 'Norvegia lett', 'dairy', 'low', (2, 'slice'), [('slice', 'skive')], {}),
    ('mozzarella', '01.066', 'Mozzarella', 'Mozzarella', 'dairy', 'low', (30, 'g'), [], {}),
    ('feta', '01.188', 'Feta', 'Fetaost', 'dairy', 'low', (30, 'g'), [], {}),
    ('cream', '01.015', 'Whipping cream', 'Kremfløte', 'dairy', 'low', (2, 'tbsp'), [('tbsp', 'spiseskje'), ('dl', 'dl')], {'lowMax': 40}),
    ('choc-milk', '01.008', 'Chocolate milk', 'Sjokolademelk', 'drink', 'high', (1, 'glass'), [('glass', 'glass'), ('dl', 'dl')], {'liquid': True, 'why': ('Regular milk: lactose.', 'Vanlig melk: laktose.'), 'tags': ['lactose']}),
    # ---- Grains, rice, pasta, potatoes
    ('rice-raw', '05.212', 'White rice, uncooked', 'Hvit ris, ukokt', 'grain', 'low', (70, 'g'), [('dl', 'dl')], {'pair': 'rice'}),
    ('basmati-raw', '05.305', 'Basmati rice, uncooked', 'Basmatiris, ukokt', 'grain', 'low', (70, 'g'), [('dl', 'dl')], {'pair': 'basmati'}),
    ('basmati', '05.337', 'Basmati rice, cooked', 'Basmatiris, kokt', 'grain', 'low', (180, 'g'), [('dl', 75)], {'pair': 'basmati-raw'}),
    ('jasmine-raw', '05.306', 'Jasmine rice, uncooked', 'Jasminris, ukokt', 'grain', 'low', (70, 'g'), [('dl', 'dl')], {'pair': 'jasmine'}),
    ('jasmine', '05.338', 'Jasmine rice, cooked', 'Jasminris, kokt', 'grain', 'low', (180, 'g'), [('dl', 75)], {'pair': 'jasmine-raw'}),
    ('brown-rice', '05.255', 'Brown rice, cooked', 'Naturris, kokt', 'grain', 'low', (180, 'g'), [('dl', 75)], {}),
    ('pasta-raw', '05.016', 'Pasta, dry', 'Pasta, tørr', 'grain', 'check', (75, 'g'), [], {'pair': 'pasta', 'lowMax': 30, 'why': ('Wheat: low FODMAP up to about 30 g dry (½ cup cooked).', 'Hvete: lav-FODMAP opp til ca. 30 g tørr (½ kopp kokt).'), 'tags': ['wheat']}),
    ('gf-pasta-raw', '05.421', 'Gluten-free pasta, dry', 'Glutenfri pasta, tørr', 'grain', 'low', (75, 'g'), [], {'pair': 'gf-pasta'}),
    ('rice-noodles', '05.334', 'Rice noodles, cooked', 'Risnudler, kokt', 'grain', 'low', (180, 'g'), [], {}),
    ('rice-noodles-raw', '05.331', 'Rice noodles, dry', 'Risnudler, tørre', 'grain', 'low', (70, 'g'), [], {}),
    ('egg-noodles', '05.522', 'Egg noodles, cooked', 'Eggnudler, kokt', 'grain', 'check', (180, 'g'), [], {'why': ('Wheat noodles. Small portions are usually fine.', 'Nudler av hvete. Små porsjoner går som regel fint.'), 'tags': ['wheat']}),
    ('quinoa-raw', '06.663', 'Quinoa, uncooked', 'Quinoa, ukokt', 'grain', 'low', (60, 'g'), [('dl', 'dl')], {'pair': 'quinoa'}),
    ('potatoes-raw', '06.004', 'Potatoes, raw', 'Poteter, rå', 'grain', 'low', (250, 'g'), [('piece', 'stk_middels')], {'pair': 'potatoes'}),
    ('sweet-potato', '06.101', 'Sweet potato, cooked', 'Søtpotet, kokt', 'grain', 'check', (75, 'g'), [('piece', 'stk')], {'lowMax': 75, 'why': ('Low FODMAP up to about 75 g (mannitol above that).', 'Lav-FODMAP opp til ca. 75 g (mannitol over det).'), 'tags': ['polyol']}),
    ('lompe', '05.084', 'Potato flatbread (lompe)', 'Lompe', 'grain', 'check', (2, 'piece'), [('piece', 'stk_liten')], {'why': ('Has some wheat flour.', 'Har litt hvetemel.'), 'tags': ['wheat']}),
    ('french-fries', '06.006', 'French fries, oven', 'Pommes frites, ovn', 'grain', 'low', (150, 'g'), [('portion', 'porsjon')], {}),
    ('roll-white', '05.064', 'Bread roll, white', 'Rundstykke, fint', 'grain', 'high', (1, 'piece'), [('piece', 'stk')], {'why': ('Wheat bread: fructans.', 'Hvetebrød: fruktaner.'), 'tags': ['wheat']}),
    # ---- Vegetables
    ('kale', '06.035', 'Kale', 'Grønnkål', 'veg', 'low', (1, 'dl'), [('dl', 'dl')], {}),
    ('aubergine', '06.015', 'Aubergine (eggplant)', 'Aubergine', 'veg', 'low', (75, 'g'), [('slice', 'skive')], {'lowMax': 75}),
    ('pepper-green', '06.047', 'Green bell pepper', 'Grønn paprika', 'veg', 'low', (75, 'g'), [('piece', 'stk')], {'lowMax': 75}),
    ('corn', '06.736', 'Sweet corn, canned', 'Mais, hermetisk', 'veg', 'check', (2, 'tbsp'), [('tbsp', 'spiseskje'), ('dl', 'dl')], {'lowMax': 38, 'why': ('Low FODMAP up to about 2–3 tbsp.', 'Lav-FODMAP opp til ca. 2–3 ss.'), 'tags': ['polyol']}),
    ('peas', '06.027', 'Green peas, frozen', 'Erter, fryste', 'veg', 'check', (2, 'tbsp'), [('tbsp', 'spiseskje'), ('dl', 'dl')], {'lowMax': 15, 'why': ('GOS and fructans: keep it to a small spoonful.', 'GOS og fruktaner: hold det til en liten skje.'), 'tags': ['gos']}),
    ('iceberg', '06.059', 'Iceberg lettuce', 'Isbergsalat', 'veg', 'low', (2, 'piece'), [('piece', 'blad')], {}),
    # ---- Fruit
    ('clementine', '06.526', 'Clementine', 'Klementin', 'fruit', 'low', (1, 'piece'), [('piece', 'stk')], {}),
    ('honeydew', '06.610', 'Honeydew melon', 'Honningmelon', 'fruit', 'check', (90, 'g'), [('slice', 'skive')], {'lowMax': 90}),
    ('lemon', '06.550', 'Lemon', 'Sitron', 'fruit', 'low', (1, 'slice'), [('slice', 'skive'), ('piece', 'stk')], {}),
    # ---- Nuts, seeds, legumes, tofu
    ('macadamia', '06.617', 'Macadamia nuts', 'Macadamianøtter', 'nuts', 'low', (1, 'handful'), [('handful', 'neve')], {}),
    ('pecans', '06.593', 'Pecan nuts', 'Pekannøtter', 'nuts', 'low', (1, 'handful'), [('handful', 'neve')], {}),
    ('pumpkin-seeds', '05.170', 'Pumpkin seeds', 'Gresskarkjerner', 'nuts', 'low', (2, 'tbsp'), [('tbsp', 'spiseskje')], {}),
    ('sunflower-seeds', '05.126', 'Sunflower seeds', 'Solsikkefrø', 'nuts', 'check', (1, 'tbsp'), [('tbsp', 'spiseskje')], {'lowMax': 6, 'why': ('Low FODMAP in small amounts (about 2 tsp).', 'Lav-FODMAP i små mengder (ca. 2 ts).')}),
    ('chia', '05.380', 'Chia seeds', 'Chiafrø', 'nuts', 'low', (1, 'tbsp'), [('tbsp', 'spiseskje')], {}),
    ('lentils', '06.130', 'Lentils, canned', 'Linser, hermetisk', 'nuts', 'check', (46, 'g'), [('tbsp', 'spiseskje'), ('dl', 'dl')], {'lowMax': 46, 'why': ('Canned and rinsed: low FODMAP up to about ¼ cup (46 g).', 'Hermetiske og skylt: lav-FODMAP opp til ca. ½ dl (46 g).'), 'tags': ['gos']}),
    ('chickpeas', '06.128', 'Chickpeas, canned', 'Kikerter, hermetisk', 'nuts', 'check', (42, 'g'), [('tbsp', 'spiseskje'), ('dl', 'dl')], {'lowMax': 42, 'why': ('Canned and rinsed: low FODMAP up to about ¼ cup (42 g).', 'Hermetiske og skylt: lav-FODMAP opp til ca. ½ dl (42 g).'), 'tags': ['gos']}),
    # ---- Fats, sauces, spreads, sweet things
    ('rapeseed-oil', '08.235', 'Rapeseed oil', 'Rapsolje', 'fat', 'low', (1, 'tbsp'), [('tbsp', 'spiseskje')], {}),
    ('mayo-light', '08.011', 'Mayonnaise, light', 'Lettmajones', 'fat', 'low', (1, 'tbsp'), [('tbsp', 14)], {}),
    ('sugar', '09.002', 'Sugar', 'Sukker', 'sweet', 'low', (1, 'tsp'), [('tsp', 'teskje'), ('tbsp', 'spiseskje')], {}),
    ('white-choc', '09.134', 'White chocolate', 'Hvit sjokolade', 'sweet', 'check', (20, 'g'), [], {'lowMax': 25, 'why': ('Milk solids: lactose in bigger amounts.', 'Melkepulver: laktose i større mengder.'), 'tags': ['lactose']}),
    ('chocolate-bar', '09.159', 'Snickers', 'Snickers', 'sweet', 'check', (1, 'piece'), [('piece', 'stk')], {'why': ('Milk chocolate: some lactose.', 'Melkesjokolade: litt laktose.'), 'tags': ['lactose']}),
    # ---- Drinks
    ('oat-drink', '13.068', 'Oat drink', 'Havredrikk', 'drink', 'check', (1, 'glass'), [('glass', 'glass'), ('dl', 'dl')], {'liquid': True, 'lowMax': 125, 'why': ('Low FODMAP up to about ½ glass (125 ml).', 'Lav-FODMAP opp til ca. ½ glass (125 ml).'), 'tags': ['gos']}),
    ('energy-zero', '13.065', 'Energy drink, sugar-free', 'Energidrikk, sukkerfri', 'drink', 'low', (1, 'can'), [('can', 'boks_liten')], {'liquid': True}),
]

# Existing foods whose nutrition now comes from Matvaretabellen (names, units and FODMAP stay as they are).
OVERRIDE = {
    'rice': '05.289', 'potatoes': '06.096', 'oats': '05.003', 'gf-bread': '05.468', 'bread': '05.360', 'crispbread': '05.070',
    'rice-cakes': '05.193', 'corn-tortilla': '05.248', 'wheat-tortilla': '05.381', 'gf-pasta': '05.498', 'pasta': '05.130', 'quinoa': '05.456',
    'egg': '02.001', 'chicken-breast': '03.481', 'chicken-thigh': '03.394', 'salmon': '04.342', 'cod': '04.347', 'tuna': '04.108',
    'mince': '03.138', 'shrimp': '04.057', 'tofu': '06.704', 'bacon': '03.509', 'ham': '03.106', 'sausage': '03.144', 'fishcakes': '04.061',
    'lf-milk': '01.272', 'lf-milk-light': '01.215', 'milk': '01.236', 'lf-yogurt': '01.275', 'yogurt': '01.011', 'cheese': '01.039',
    'brie': '01.136', 'parmesan': '01.200', 'brunost': '01.186', 'cottage': '01.028', 'butter': '08.005', 'lf-cream': '01.273', 'icecream': '01.018',
    'banana-firm': '06.525', 'banana-ripe': '06.525', 'strawberries': '06.504', 'blueberries': '06.502', 'raspberries': '06.503', 'orange': '06.520',
    'kiwi': '06.539', 'pineapple': '06.517', 'apple': '06.758', 'pear': '06.760', 'mango': '06.542', 'watermelon': '06.543',
    'carrot': '06.036', 'cucumber': '06.010', 'tomato': '06.754', 'pepper': '06.048', 'lettuce': '06.207', 'spinach': '06.064', 'zucchini': '06.085',
    'broccoli': '06.725', 'onion': '06.042', 'garlic': '06.038', 'mushrooms': '06.062', 'cauliflower': '06.853', 'avocado': '06.524',
    'peanut-butter': '06.559', 'peanuts': '06.558', 'walnuts': '06.560', 'almonds': '06.107', 'cashews': '06.582',
    'dark-choc': '09.133', 'milk-choc': '09.017', 'jam': '06.763', 'honey': '09.003', 'mayo': '08.009', 'ketchup': '06.079', 'oil': '08.019',
    'chips': '06.007', 'coffee': '13.009', 'latte': '13.141', 'tea': '13.010', 'oj': '06.568', 'apple-juice': '06.571', 'soda': '13.045',
    'soda-zero': '13.047', 'energy': '13.064',
}

# Browsing categories for the older foods.
CATS = {
    'grain': 'rice potatoes fries oats porridge spelt-bread gf-bread bread crispbread rice-cakes rice-crackers corn-tortilla wheat-tortilla gf-pasta pasta quinoa cornflakes granola',
    'egg': 'egg', 'meat': 'chicken-breast chicken-thigh mince bacon ham sausage', 'fish': 'salmon cod tuna shrimp fishcakes',
    'dairy': 'lf-milk lf-milk-light milk lf-yogurt yogurt cheese brie parmesan brunost cottage butter lf-sourcream lf-cream icecream whey',
    'fruit': 'banana-firm banana-ripe strawberries blueberries raspberries orange kiwi grapes pineapple apple pear mango watermelon',
    'veg': 'carrot cucumber tomato pepper lettuce spinach zucchini green-beans broccoli onion garlic mushrooms cauliflower avocado',
    'nuts': 'beans peanut-butter peanuts walnuts almonds cashews tofu',
    'fat': 'oil mayo ketchup hummus jam maple honey lf-sourcream',
    'sweet': 'dark-choc milk-choc chips chips-flavour protein-bar icecream',
    'dish': 'pizza burger kebab sushi porridge',
    'drink': 'coffee latte tea ginger-tea oj apple-juice soda soda-zero energy',
}

PORTION_MAP = {}

def load():
    nb = {f['id']: f for f in json.load(open(os.path.join(DATA, 'foodcase-food-nb.json')))['foods']}
    return nb

def num(f, k):
    v = (f.get(k) or {}).get('value')
    try:
        return round(float(v), 1)
    except (TypeError, ValueError):
        return 0.0

def portions(f):
    p = f.get('Portion') or {}
    refs = (p.get('ref') or '').split()
    vals = (p.get('value') or '').split()
    # refs like "glass (stort)" contain spaces: rebuild by matching counts
    raw = p.get('ref') or ''
    out = {}
    if not raw:
        return out
    tokens = []
    i = 0
    parts = raw.split(' ')
    while i < len(parts):
        t = parts[i]
        if i + 1 < len(parts) and parts[i + 1].startswith('('):
            t = t + ' ' + parts[i + 1]
            i += 1
        tokens.append(t)
        i += 1
    for t, v in zip(tokens, vals):
        try:
            out[t] = float(v)
        except ValueError:
            pass
    return out

def nutr(f):
    return {'k': round(num(f, 'Energi2')), 'p': num(f, 'Protein'), 'f': num(f, 'Fett'), 'c': num(f, 'Karbo'), 'fib': num(f, 'Fiber'), 'sug': num(f, 'Sukker')}

def js(v):
    return json.dumps(v, ensure_ascii=False)

def main():
    nb = load()
    lines = []
    lines.append('// GENERATED by tools/foodbase.py from Matvaretabellen 2026 (Mattilsynet, matvaretabellen.no, NLOD licence).')
    lines.append('// Nutrition per 100 g edible part: k = kcal, p = protein, f = fat, c = carbohydrate, fib = fibre, sug = sugar (g).')
    lines.append('// FODMAP ratings, names, units and defaults are Vektplan\'s, following Monash University guidance. Do not edit by hand.')
    lines.append('')
    lines.append('export const SOURCE = { en: "Nutrition: Matvaretabellen 2026, Mattilsynet", nb: "Næringsinnhold: Matvaretabellen 2026, Mattilsynet" };')
    lines.append('')
    lines.append('// id: [mvtId, k, p, f, c, fib, sug]')
    lines.append('export const NUTRITION = {')
    for fid, mvt in OVERRIDE.items():
        f = nb[mvt]; n = nutr(f)
        lines.append(f"  {js(fid)}: [{js(mvt)}, {n['k']}, {n['p']}, {n['f']}, {n['c']}, {n['fib']}, {n['sug']}],")
    for spec in NEW:
        fid, mvt = spec[0], spec[1]
        f = nb[mvt]; n = nutr(f)
        lines.append(f"  {js(fid)}: [{js(mvt)}, {n['k']}, {n['p']}, {n['f']}, {n['c']}, {n['fib']}, {n['sug']}],")
    lines.append('};')
    lines.append('')
    lines.append('// New base foods: { id, n, cat, f (FODMAP), d: [amount, unit], u: [[unit, grams]], liquid?, pair?, lowMax?, why?, tags? }')
    lines.append('export const BASE_FOODS = [')
    for fid, mvt, en, nbn, cat, fod, d, units, extra in NEW:
        f = nb[mvt]
        po = portions(f)
        u = []
        for unit, src in units:
            g = src if isinstance(src, (int, float)) else po.get(src)
            if g is None:
                raise SystemExit(f'{fid}: portion {src} missing in {mvt} ({po})')
            u.append([unit, g])
        item = {'id': fid, 'n': {'en': en, 'nb': nbn}, 'cat': cat, 'f': fod, 'd': list(d), 'u': u}
        for k in ('liquid', 'pair', 'lowMax', 'tags'):
            if k in extra:
                item[k] = extra[k]
        if 'why' in extra:
            item['why'] = {'en': extra['why'][0], 'nb': extra['why'][1]}
        lines.append('  ' + js(item) + ',')
    lines.append('];')
    lines.append('')
    lines.append('export const CATEGORY_OF = {')
    for cat, ids in CATS.items():
        for fid in ids.split():
            lines.append(f'  {js(fid)}: {js(cat)},')
    lines.append('};')
    open(OUT, 'w').write('\n'.join(lines) + '\n')
    print('wrote', OUT, len(OVERRIDE), 'overrides,', len(NEW), 'new foods')

main()
