/**
 * Single source of truth for customer-facing dish photos.
 *
 * Menu rows in production often carry generic placeholders ("/food-biryani.jpg", "/hero-bg.jpg"),
 * which made burgers, naan and kulfi all show a biryani photo. Real uploaded images (http(s), data:,
 * or any other path) are always respected; placeholders/empty values fall back to a photo chosen by
 * dish id, then by dish-name keywords, then by category. Every Unsplash id below was visually verified.
 */
const u = (id: string) => `https://images.unsplash.com/${id}?w=800&auto=format&fit=crop&q=60`;

export const PHOTOS = {
  biryani: u('photo-1563379091339-03b21ab4a4f8'),
  biryaniPlatter: u('photo-1633945274405-b6c8069047b0'),
  pulao: u('photo-1589302168068-964664d93dc0'),
  karahi: u('photo-1603894584373-5ac82b2ae398'),
  handi: u('photo-1545247181-516773cae754'),
  bbqSkewers: u('photo-1555939594-58d7cb561ad1'),
  tandooriChicken: u('photo-1626074353765-517a681e40be'),
  ribs: u('photo-1544025162-d76694265947'),
  burger: u('photo-1568901346375-23c9450c58cd'),
  chickenBurger: u('photo-1521305916504-4a1121188589'),
  fries: u('photo-1541592106381-b31e9677c0e5'),
  pizza: u('photo-1513104890138-7c749659a591'),
  naan: u('photo-1565557623262-b51c2513a641'),
  samosa: u('photo-1601050690597-df0568f70950'),
  kulfi: u('photo-1505394033641-40c6ad1178d7'),
  dessert: u('photo-1563805042-7684c019e1cb'),
  iceCream: u('photo-1570197788417-0e82375c9371'),
  chai: u('photo-1576092768241-dec231879fc3'),
  mintDrink: u('photo-1513558161293-cdaf765ed2fd'),
  mocktail: u('photo-1544145945-f90425340c7e'),
  spread: '/hero-bg.jpg',
} as const;

/** Generic placeholder images that should never be shown as a specific dish's photo. */
const PLACEHOLDER_IMAGES = new Set(['/food-biryani.jpg', '/hero-bg.jpg', '/placeholder.png', '']);

const DISH_ID_PHOTOS: Record<string, string> = {
  m1: PHOTOS.biryani,
  m2: PHOTOS.karahi,
  m3: PHOTOS.bbqSkewers,
  m4: PHOTOS.chickenBurger,
  m5: PHOTOS.naan,
  m6: PHOTOS.chai,
  m7: PHOTOS.kulfi,
  m8: PHOTOS.biryani,
  m9: PHOTOS.pulao,
  m10: PHOTOS.pulao,
  m11: PHOTOS.handi,
  m12: PHOTOS.tandooriChicken,
  m13: PHOTOS.ribs,
  m14: PHOTOS.burger,
  m15: PHOTOS.fries,
  m16: PHOTOS.naan,
  m17: PHOTOS.naan,
  m18: PHOTOS.mintDrink,
  m19: PHOTOS.chai,
  m20: PHOTOS.dessert,
  'deal-1': PHOTOS.biryaniPlatter,
  'deal-2': PHOTOS.karahi,
  'deal-3': PHOTOS.burger,
  'deal-4': PHOTOS.bbqSkewers,
  'deal-home-1': PHOTOS.biryaniPlatter,
  'deal-home-2': PHOTOS.karahi,
  'deal-home-3': PHOTOS.burger,
  'deal-home-4': PHOTOS.bbqSkewers,
};

// Ordered: more specific keywords first.
const KEYWORD_PHOTOS: Array<[RegExp, string]> = [
  [/kulfi|popsicle|lolly/, PHOTOS.kulfi],
  [/ice ?cream|sundae/, PHOTOS.iceCream],
  [/gulab|jamun|kheer|rabri|halwa|dessert|sweet|brownie|cake/, PHOTOS.dessert],
  [/chai|tea|coffee|karak/, PHOTOS.chai],
  [/margarita|mint|lemonade|lassi|shake|juice|drink|beverage|soda|cola|mocktail/, PHOTOS.mintDrink],
  [/fries|wedges|loaded/, PHOTOS.fries],
  [/zinger|crunch|chicken burger|fillet/, PHOTOS.chickenBurger],
  [/burger|smash/, PHOTOS.burger],
  [/pizza/, PHOTOS.pizza],
  [/naan|roti|paratha|bread|tandoor|kulcha/, PHOTOS.naan],
  [/samosa|pakora|starter|appetizer/, PHOTOS.samosa],
  [/tikka|tandoori|malai boti|boti|wings/, PHOTOS.tandooriChicken],
  [/seekh|kebab|kabab|bbq|grill|skewer/, PHOTOS.bbqSkewers],
  [/ribs|steak/, PHOTOS.ribs],
  [/handi|qorma|korma|nihari|haleem/, PHOTOS.handi],
  [/karahi|shinwari|curry|masala/, PHOTOS.karahi],
  [/pulao|pilaf/, PHOTOS.pulao],
  [/biryani|rice/, PHOTOS.biryani],
  [/deal|combo|feast|platter|family/, PHOTOS.biryaniPlatter],
];

function isPlaceholder(image?: string | null): boolean {
  const v = (image || '').trim();
  return PLACEHOLDER_IMAGES.has(v);
}

/** Returns the best photo for a dish (or deal). Never returns a generic placeholder when a better match exists. */
export function resolveDishImage(image?: string | null, category?: string | null, idOrName?: string | null, name?: string | null): string {
  if (!isPlaceholder(image)) return String(image).trim();
  if (idOrName && DISH_ID_PHOTOS[idOrName]) return DISH_ID_PHOTOS[idOrName];
  const text = `${name || ''} ${idOrName || ''} ${category || ''}`.toLowerCase();
  for (const [re, url] of KEYWORD_PHOTOS) {
    if (re.test(text)) return url;
  }
  return PHOTOS.spread;
}
