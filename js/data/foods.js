// Everyday foods for quick logging. kcal per the portion shown (typical values).
// f = FODMAP status at that portion: low | moderate | high | check (depends on the product).
// tags feed the pattern finder: wheat, lactose, garlic_onion, fructose, polyol, gos, fatty, spicy, caffeine, fizzy

const N = (en, nb) => ({ en, nb });
const F = (id, n, p, kcal, f = 'low', tags = [], why = null) => ({ id, n, p, kcal, f, tags, why });

export const FOODS = [
  // Grains, bread, potatoes
  F('rice', N('White rice, cooked', 'Hvit ris, kokt'), N('1 cup (180 g)', '1 kopp (180 g)'), 235),
  F('potatoes', N('Potatoes, boiled', 'Poteter, kokte'), N('3 medium (250 g)', '3 middels (250 g)'), 195),
  F('fries', N('Oven fries', 'Ovnspommes frites'), N('150 g', '150 g'), 240, 'check', ['fatty'], N('Check the seasoning for onion or garlic.', 'Sjekk krydderet for løk eller hvitløk.')),
  F('oats', N('Oats (dry)', 'Havregryn (tørre)'), N('½ cup (45 g)', '1 dl (45 g)'), 170),
  F('porridge', N('Oatmeal made with lactose-free milk', 'Havregrøt med laktosefri melk'), N('1 bowl', '1 bolle'), 310),
  F('spelt-bread', N('Spelt sourdough bread', 'Speltsurdeigsbrød'), N('1 slice (40 g)', '1 skive (40 g)'), 100),
  F('gf-bread', N('Gluten-free bread', 'Glutenfritt brød'), N('1 slice (35 g)', '1 skive (35 g)'), 90),
  F('bread', N('Regular bread (wheat or rye)', 'Vanlig brød (hvete eller rug)'), N('1 slice (40 g)', '1 skive (40 g)'), 100, 'high', ['wheat'], N('Wheat and rye contain fructans.', 'Hvete og rug inneholder fruktaner.')),
  F('crispbread', N('Rye crispbread', 'Knekkebrød (rug)'), N('2 pieces (25 g)', '2 stk (25 g)'), 85, 'check', ['wheat'], N('Rye has fructans; small portions may be fine.', 'Rug har fruktaner; små porsjoner kan gå fint.')),
  F('rice-cakes', N('Rice cakes', 'Riskaker'), N('3 pieces', '3 stk'), 105),
  F('rice-crackers', N('Rice crackers', 'Riskjeks'), N('25 g', '25 g'), 100),
  F('corn-tortilla', N('Corn tortilla', 'Maistortilla'), N('1 piece', '1 stk'), 55),
  F('wheat-tortilla', N('Wheat tortilla', 'Hvetetortilla'), N('1 piece (40 g)', '1 stk (40 g)'), 120, 'high', ['wheat'], N('Wheat contains fructans.', 'Hvete inneholder fruktaner.')),
  F('gf-pasta', N('Gluten-free pasta, cooked', 'Glutenfri pasta, kokt'), N('1 cup (140 g)', '1 kopp (140 g)'), 220),
  F('pasta', N('Regular pasta, cooked', 'Vanlig pasta, kokt'), N('1 cup (140 g)', '1 kopp (140 g)'), 220, 'high', ['wheat'], N('Wheat pasta is only low FODMAP in small portions (about ½ cup).', 'Hvetepasta er bare lav-FODMAP i små porsjoner (ca. ½ kopp).')),
  F('quinoa', N('Quinoa, cooked', 'Quinoa, kokt'), N('1 cup (185 g)', '1 kopp (185 g)'), 220),
  F('cornflakes', N('Corn flakes', 'Cornflakes'), N('1 bowl (30 g)', '1 bolle (30 g)'), 110),
  F('granola', N('Granola or muesli', 'Granola eller müsli'), N('45 g', '45 g'), 200, 'check', ['fructose'], N('Often has honey, dried fruit or inulin.', 'Har ofte honning, tørket frukt eller inulin.')),

  // Protein
  F('egg', N('Egg', 'Egg'), N('1 large', '1 stort'), 80),
  F('chicken-breast', N('Chicken breast, cooked', 'Kyllingfilet, stekt'), N('150 g', '150 g'), 250),
  F('chicken-thigh', N('Chicken thigh, cooked', 'Kyllinglår, stekt'), N('120 g', '120 g'), 250),
  F('salmon', N('Salmon, cooked', 'Laks, stekt'), N('150 g', '150 g'), 310),
  F('cod', N('Cod or white fish', 'Torsk eller hvit fisk'), N('150 g', '150 g'), 160),
  F('tuna', N('Tuna in water', 'Tunfisk i vann'), N('1 can (120 g)', '1 boks (120 g)'), 130),
  F('mince', N('Minced beef, cooked', 'Kjøttdeig, stekt'), N('100 g', '100 g'), 250, 'low', ['fatty']),
  F('shrimp', N('Shrimp', 'Reker'), N('100 g', '100 g'), 100),
  F('tofu', N('Firm tofu', 'Fast tofu'), N('100 g', '100 g'), 145),
  F('bacon', N('Bacon', 'Bacon'), N('3 slices (30 g)', '3 skiver (30 g)'), 160, 'low', ['fatty']),
  F('ham', N('Sliced ham', 'Skinkepålegg'), N('2 slices (30 g)', '2 skiver (30 g)'), 35, 'check', [], N('Some contain garlic or onion. Check the label.', 'Noen inneholder hvitløk eller løk. Sjekk etiketten.')),
  F('sausage', N('Sausage (pølse)', 'Pølse'), N('1 (100 g)', '1 stk (100 g)'), 250, 'check', ['fatty', 'garlic_onion'], N('Usually seasoned with onion or garlic.', 'Krydres som regel med løk eller hvitløk.')),
  F('whey', N('Protein powder (whey isolate)', 'Proteinpulver (whey isolat)'), N('1 scoop (30 g)', '1 skje (30 g)'), 115, 'check', [], N('Whey isolate is usually fine. Check the label for inulin, chicory root and sweeteners ending in -ol.', 'Whey isolat går som regel fint. Sjekk etiketten for inulin, sikorirot og søtstoffer som slutter på -ol.')),
  F('fishcakes', N('Fish cakes (fiskekaker)', 'Fiskekaker'), N('2 pieces (130 g)', '2 stk (130 g)'), 210, 'check', ['wheat', 'garlic_onion'], N('Often contain onion and wheat flour.', 'Inneholder ofte løk og hvetemel.')),

  // Dairy
  F('lf-milk', N('Lactose-free milk (whole)', 'Laktosefri helmelk'), N('1 glass (250 ml)', '1 glass (2,5 dl)'), 160),
  F('lf-milk-light', N('Lactose-free milk (light)', 'Laktosefri lettmelk'), N('1 glass (250 ml)', '1 glass (2,5 dl)'), 110),
  F('milk', N('Regular milk', 'Vanlig melk'), N('1 glass (250 ml)', '1 glass (2,5 dl)'), 160, 'high', ['lactose'], N('Lactose.', 'Laktose.')),
  F('lf-yogurt', N('Lactose-free yogurt', 'Laktosefri yoghurt'), N('1 cup (200 g)', '1 beger (200 g)'), 130),
  F('yogurt', N('Regular yogurt', 'Vanlig yoghurt'), N('1 cup (200 g)', '1 beger (200 g)'), 140, 'high', ['lactose'], N('Lactose.', 'Laktose.')),
  F('cheese', N('Cheese (Norvegia, cheddar)', 'Gulost (Norvegia, cheddar)'), N('2 slices (30 g)', '2 skiver (30 g)'), 105),
  F('brie', N('Brie or camembert', 'Brie eller camembert'), N('30 g', '30 g'), 100),
  F('parmesan', N('Parmesan', 'Parmesan'), N('2 tbsp (10 g)', '2 ss (10 g)'), 40),
  F('brunost', N('Brown cheese (brunost)', 'Brunost'), N('2 slices (20 g)', '2 skiver (20 g)'), 90, 'high', ['lactose'], N('Brunost is high in lactose. Lactose-free versions exist.', 'Brunost har mye laktose. Det finnes laktosefrie varianter.')),
  F('cottage', N('Cottage cheese', 'Cottage cheese'), N('100 g', '100 g'), 98, 'check', ['lactose'], N('Some lactose. Small portions are usually fine.', 'Litt laktose. Små porsjoner går som regel fint.')),
  F('butter', N('Butter', 'Smør'), N('1 tbsp (14 g)', '1 ss (14 g)'), 100),
  F('lf-sourcream', N('Lactose-free sour cream', 'Laktosefri rømme'), N('2 tbsp (30 g)', '2 ss (30 g)'), 55),
  F('lf-cream', N('Lactose-free cream', 'Laktosefri fløte'), N('2 tbsp (30 g)', '2 ss (30 g)'), 100),
  F('icecream', N('Ice cream', 'Iskrem'), N('2 scoops (100 g)', '2 kuler (100 g)'), 210, 'high', ['lactose', 'fatty'], N('Lactose.', 'Laktose.')),

  // Fruit & berries
  F('banana-firm', N('Banana, firm', 'Banan, fast'), N('1 medium', '1 middels'), 100),
  F('banana-ripe', N('Banana, ripe and spotty', 'Banan, moden med prikker'), N('1 medium', '1 middels'), 105, 'high', ['fructose'], N('Ripe bananas are high in fructans.', 'Modne bananer har mye fruktaner.')),
  F('strawberries', N('Strawberries', 'Jordbær'), N('5 medium (65 g)', '5 middels (65 g)'), 20),
  F('blueberries', N('Blueberries', 'Blåbær'), N('a handful (60 g)', 'en håndfull (60 g)'), 35),
  F('raspberries', N('Raspberries', 'Bringebær'), N('a handful (60 g)', 'en håndfull (60 g)'), 30),
  F('orange', N('Orange', 'Appelsin'), N('1 medium', '1 middels'), 60),
  F('kiwi', N('Kiwi', 'Kiwi'), N('2 small', '2 små'), 90),
  F('grapes', N('Grapes', 'Druer'), N('1 cup (150 g)', '1 kopp (150 g)'), 100),
  F('pineapple', N('Pineapple', 'Ananas'), N('1 cup (140 g)', '1 kopp (140 g)'), 70),
  F('apple', N('Apple', 'Eple'), N('1 medium', '1 middels'), 95, 'high', ['fructose', 'polyol'], N('Fructose and sorbitol.', 'Fruktose og sorbitol.')),
  F('pear', N('Pear', 'Pære'), N('1 medium', '1 middels'), 100, 'high', ['fructose', 'polyol'], N('Fructose and sorbitol.', 'Fruktose og sorbitol.')),
  F('mango', N('Mango', 'Mango'), N('1 cup', '1 kopp'), 100, 'high', ['fructose'], N('Fructose.', 'Fruktose.')),
  F('watermelon', N('Watermelon', 'Vannmelon'), N('1 cup', '1 kopp'), 45, 'high', ['fructose', 'polyol'], N('Fructose and polyols.', 'Fruktose og polyoler.')),

  // Vegetables
  F('carrot', N('Carrot', 'Gulrot'), N('1 medium', '1 middels'), 25),
  F('cucumber', N('Cucumber', 'Agurk'), N('½ (100 g)', '½ (100 g)'), 15),
  F('tomato', N('Tomato', 'Tomat'), N('1 small (65 g)', '1 liten (65 g)'), 12),
  F('pepper', N('Red bell pepper', 'Rød paprika'), N('¼ (40 g)', '¼ (40 g)'), 12),
  F('lettuce', N('Lettuce', 'Salat'), N('1 cup', '1 kopp'), 5),
  F('spinach', N('Baby spinach', 'Babyspinat'), N('1 cup (30 g)', '1 kopp (30 g)'), 7),
  F('zucchini', N('Zucchini', 'Squash'), N('½ cup (65 g)', '½ kopp (65 g)'), 11),
  F('green-beans', N('Green beans', 'Aspargesbønner'), N('15 beans (75 g)', '15 stk (75 g)'), 25),
  F('broccoli', N('Broccoli florets', 'Brokkolibuketter'), N('¾ cup (75 g)', '¾ kopp (75 g)'), 25),
  F('onion', N('Onion', 'Løk'), N('½ onion', '½ løk'), 20, 'high', ['garlic_onion'], N('Onion is high in fructans.', 'Løk har mye fruktaner.')),
  F('garlic', N('Garlic', 'Hvitløk'), N('1 clove', '1 fedd'), 5, 'high', ['garlic_onion'], N('Garlic is high in fructans. Use garlic-infused oil instead.', 'Hvitløk har mye fruktaner. Bruk hvitløksolje i stedet.')),
  F('mushrooms', N('Mushrooms', 'Sopp'), N('1 cup', '1 kopp'), 15, 'high', ['polyol'], N('Polyols (mannitol).', 'Polyoler (mannitol).')),
  F('cauliflower', N('Cauliflower', 'Blomkål'), N('1 cup', '1 kopp'), 25, 'high', ['polyol'], N('Polyols (mannitol).', 'Polyoler (mannitol).')),
  F('avocado', N('Avocado', 'Avokado'), N('¼ avocado', '¼ avokado'), 80, 'check', ['polyol'], N('Small portions (⅛) are low FODMAP.', 'Små porsjoner (⅛) er lav-FODMAP.')),
  F('beans', N('Beans or lentils', 'Bønner eller linser'), N('½ cup', '½ kopp'), 115, 'high', ['gos'], N('Beans and lentils are high in GOS.', 'Bønner og linser har mye GOS.')),

  // Nuts, spreads, sweets
  F('peanut-butter', N('Peanut butter', 'Peanøttsmør'), N('1 tbsp (16 g)', '1 ss (16 g)'), 95),
  F('peanuts', N('Peanuts', 'Peanøtter'), N('a handful (30 g)', 'en håndfull (30 g)'), 175),
  F('walnuts', N('Walnuts', 'Valnøtter'), N('a handful (30 g)', 'en håndfull (30 g)'), 195),
  F('almonds', N('Almonds', 'Mandler'), N('10 nuts', '10 stk'), 70),
  F('cashews', N('Cashews', 'Cashewnøtter'), N('a handful (30 g)', 'en håndfull (30 g)'), 165, 'high', ['gos'], N('Cashews are high in GOS and fructans.', 'Cashewnøtter har mye GOS og fruktaner.')),
  F('dark-choc', N('Dark chocolate', 'Mørk sjokolade'), N('30 g', '30 g'), 170),
  F('milk-choc', N('Milk chocolate', 'Melkesjokolade'), N('30 g', '30 g'), 160, 'check', ['lactose'], N('Some lactose. About 20 g is usually fine.', 'Litt laktose. Ca. 20 g går som regel fint.')),
  F('jam', N('Strawberry jam', 'Jordbærsyltetøy'), N('1 tbsp', '1 ss'), 40),
  F('maple', N('Maple syrup', 'Lønnesirup'), N('1 tbsp', '1 ss'), 52),
  F('honey', N('Honey', 'Honning'), N('1 tbsp', '1 ss'), 64, 'high', ['fructose'], N('Honey is high in fructose.', 'Honning har mye fruktose.')),
  F('mayo', N('Mayonnaise', 'Majones'), N('1 tbsp', '1 ss'), 100, 'check', [], N('Some brands add garlic.', 'Noen merker har hvitløk.')),
  F('ketchup', N('Ketchup', 'Ketchup'), N('1 tbsp', '1 ss'), 20, 'check', ['garlic_onion'], N('Usually has onion or garlic.', 'Har som regel løk eller hvitløk.')),
  F('hummus', N('Hummus', 'Hummus'), N('2 tbsp', '2 ss'), 70, 'high', ['gos', 'garlic_onion'], N('Chickpeas and garlic.', 'Kikerter og hvitløk.')),
  F('oil', N('Oil (olive, garlic-infused)', 'Olje (oliven, hvitløksolje)'), N('1 tbsp', '1 ss'), 120),
  F('chips', N('Potato chips, plain salted', 'Potetgull, salt'), N('30 g', '30 g'), 160, 'low', ['fatty']),
  F('chips-flavour', N('Potato chips, flavoured', 'Potetgull med smak'), N('30 g', '30 g'), 160, 'high', ['fatty', 'garlic_onion'], N('Flavourings usually contain onion and garlic powder.', 'Smakstilsetninger har som regel løk- og hvitløkspulver.')),
  F('protein-bar', N('Protein bar', 'Proteinbar'), N('1 bar (55 g)', '1 bar (55 g)'), 200, 'check', ['polyol'], N('Often sweetened with polyols or has inulin.', 'Søtes ofte med polyoler eller har inulin.')),

  // Meals out
  F('pizza', N('Pizza', 'Pizza'), N('2 slices', '2 stykker'), 570, 'high', ['wheat', 'garlic_onion', 'fatty'], N('Wheat dough, garlic and onion.', 'Hvetedeig, hvitløk og løk.')),
  F('burger', N('Burger with bun', 'Hamburger med brød'), N('1', '1 stk'), 520, 'high', ['wheat', 'garlic_onion', 'fatty'], N('Wheat bun and often onion.', 'Hvetebrød og ofte løk.')),
  F('kebab', N('Kebab in pita', 'Kebab i pita'), N('1', '1 stk'), 650, 'high', ['wheat', 'garlic_onion', 'fatty'], N('Wheat bread, garlic sauce and onion.', 'Hvetebrød, hvitløkssaus og løk.')),
  F('sushi', N('Sushi', 'Sushi'), N('8 pieces', '8 biter'), 350, 'check', [], N('Rice, fish and soy sauce are fine. Check sauces for garlic or onion.', 'Ris, fisk og soyasaus er fint. Sjekk sauser for hvitløk eller løk.')),

  // Drinks
  F('coffee', N('Coffee, black', 'Kaffe, svart'), N('1 cup', '1 kopp'), 2, 'low', ['caffeine']),
  F('latte', N('Latte with lactose-free milk', 'Caffe latte med laktosefri melk'), N('1 large (300 ml)', '1 stor (3 dl)'), 150, 'low', ['caffeine']),
  F('tea', N('Tea (black, green or peppermint)', 'Te (svart, grønn eller peppermynte)'), N('1 cup', '1 kopp'), 2),
  F('ginger-tea', N('Ginger tea', 'Ingefærte'), N('1 cup', '1 kopp'), 5),
  F('oj', N('Orange juice', 'Appelsinjuice'), N('1 glass (250 ml)', '1 glass (2,5 dl)'), 110, 'check', ['fructose'], N('Fine in a small glass (125 ml).', 'Greit i et lite glass (1,25 dl).')),
  F('apple-juice', N('Apple juice', 'Eplejuice'), N('1 glass (250 ml)', '1 glass (2,5 dl)'), 115, 'high', ['fructose', 'polyol'], N('Fructose and sorbitol.', 'Fruktose og sorbitol.')),
  F('soda', N('Soft drink with sugar', 'Brus med sukker'), N('0.5 l', '0,5 l'), 210, 'check', ['fizzy'], N('The bubbles can cause bloating.', 'Kullsyre kan gi oppblåsthet.')),
  F('soda-zero', N('Soft drink, sugar-free', 'Brus uten sukker'), N('0.5 l', '0,5 l'), 2, 'check', ['fizzy'], N('The bubbles can cause bloating.', 'Kullsyre kan gi oppblåsthet.')),
  F('energy', N('Energy drink', 'Energidrikk'), N('0.5 l', '0,5 l'), 230, 'check', ['caffeine', 'fizzy'], N('Caffeine and bubbles can irritate the stomach.', 'Koffein og kullsyre kan irritere magen.')),
];

export const foodById = (id) => FOODS.find((f) => f.id === id);
