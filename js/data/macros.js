// Protein, fat and carbohydrate (grams) for the same portion the kcal in foods.js refers to,
// and per serving for recipes. Typical values from food tables, rounded: good for tracking, not lab-exact.
// [protein, fat, carbs]
export const FOOD_MACROS = {
  rice: [5, 0.5, 51], potatoes: [5, 0.3, 43], fries: [4, 9, 36], oats: [6, 3, 27], porridge: [13, 11, 39],
  'spelt-bread': [4, 1, 19], 'gf-bread': [1.5, 2, 16], bread: [4, 1.2, 18], crispbread: [2.3, 0.4, 17],
  'rice-cakes': [2.2, 0.8, 22], 'rice-crackers': [1.8, 0.8, 21], 'corn-tortilla': [1.4, 0.7, 11.5], 'wheat-tortilla': [3.3, 3, 20],
  'gf-pasta': [4, 1.5, 46], pasta: [8, 1.3, 43], quinoa: [8, 3.5, 39], cornflakes: [2, 0.3, 25], granola: [4.5, 7, 28],
  egg: [7, 5.5, 0.4], 'chicken-breast': [47, 6, 0], 'chicken-thigh': [30, 14, 0], salmon: [33, 19, 0], cod: [34, 1.5, 0],
  tuna: [29, 1, 0], mince: [25, 16, 0], shrimp: [22, 1, 0.5], tofu: [15, 9, 2], bacon: [11, 12.5, 0.4], ham: [5.5, 1, 0.5],
  sausage: [12, 21, 3], whey: [26, 0.5, 1.5], fishcakes: [12, 11, 15],
  'lf-milk': [8.5, 8.5, 12], 'lf-milk-light': [8.5, 2.5, 12], milk: [8.5, 8.5, 12], 'lf-yogurt': [7, 6, 12], yogurt: [7, 6, 13],
  cheese: [8, 8, 0], brie: [6, 8.5, 0], parmesan: [3.5, 3, 0], brunost: [2, 5.8, 7.4], cottage: [12, 4, 3], butter: [0.1, 11.3, 0.1],
  'lf-sourcream': [0.8, 5.4, 1], 'lf-cream': [0.6, 10.5, 0.9], icecream: [3.5, 11, 24],
  'banana-firm': [1.3, 0.4, 25], 'banana-ripe': [1.3, 0.4, 26], strawberries: [0.4, 0.2, 5], blueberries: [0.4, 0.2, 8.5],
  raspberries: [0.7, 0.4, 7], orange: [1.2, 0.2, 14], kiwi: [1.7, 0.8, 21], grapes: [1, 0.2, 26], pineapple: [0.8, 0.2, 18],
  apple: [0.5, 0.3, 25], pear: [0.7, 0.2, 27], mango: [1.4, 0.6, 25], watermelon: [0.9, 0.2, 11],
  carrot: [0.6, 0.2, 6], cucumber: [0.7, 0.1, 3], tomato: [0.6, 0.1, 2.5], pepper: [0.4, 0.1, 2.4], lettuce: [0.5, 0.1, 1],
  spinach: [0.9, 0.1, 1.1], zucchini: [0.8, 0.2, 2], 'green-beans': [1.4, 0.1, 5], broccoli: [2.1, 0.3, 5], onion: [0.6, 0.1, 5],
  garlic: [0.3, 0, 1.6], mushrooms: [2.2, 0.2, 2.3], cauliflower: [1.9, 0.3, 5], avocado: [1, 7.5, 4.3], beans: [8, 0.4, 19],
  'peanut-butter': [4, 8, 3], peanuts: [7.5, 14.5, 4.5], walnuts: [4.5, 19.5, 2], almonds: [2.5, 6, 2.5], cashews: [5.5, 13, 9],
  'dark-choc': [2.5, 12.5, 11], 'milk-choc': [2.2, 9, 17], jam: [0.1, 0, 10], maple: [0, 0, 13], honey: [0.1, 0, 17],
  mayo: [0.1, 11, 0.1], ketchup: [0.2, 0, 4.5], hummus: [2.4, 5.5, 4], oil: [0, 13.5, 0], chips: [2, 10, 15], 'chips-flavour': [2, 10, 15],
  'protein-bar': [20, 6, 18], pizza: [24, 22, 66], burger: [26, 26, 42], kebab: [32, 28, 65], sushi: [14, 6, 60],
  coffee: [0.3, 0, 0], latte: [8, 7, 11], tea: [0, 0, 0.3], 'ginger-tea': [0, 0, 1], oj: [1.7, 0.5, 25], 'apple-juice': [0.3, 0.3, 28],
  soda: [0, 0, 53], 'soda-zero': [0, 0, 0], energy: [0, 0, 55],
};

export const RECIPE_MACROS = {
  'overnight-oats': [18, 19, 56], 'eggs-sourdough': [29, 23, 39], pannekaker: [20, 22, 75], 'yogurt-bowl': [14, 18, 48],
  'pb-toast': [16, 16, 62], risgrot: [12, 11, 63], smoothie: [20, 14, 68], 'ricecakes-pb': [8, 13, 25], 'cheese-crackers': [11, 13, 26],
  'choc-peanuts': [10, 24, 22], 'eggs-toast': [13, 12, 26], 'tuna-ricecakes': [28, 13, 26], 'cheese-toast': [15, 17, 34],
  'salmon-bowl': [35, 25, 68], 'chicken-traybake': [42, 18, 46], fredagstaco: [38, 38, 70], kjottkaker: [36, 38, 60],
  'chicken-pasta': [45, 25, 80], 'laks-potet': [35, 30, 55], 'egg-fried-rice': [18, 20, 70], 'chicken-soup': [25, 8, 32],
  omelette: [28, 32, 10], 'baked-potato': [22, 26, 66], 'butter-rice': [5, 9, 48],
};
