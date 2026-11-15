import { MenuItem, Announcement } from '../types';

export interface SheetColumnMapping {
  rowTypeCol: string;
  nameCol: string;
  categoryCol: string;
  priceCol: string;
  descriptionCol: string;
  imageCol: string;
  availableCol: string;
  lahorePriceCol: string;
  islamabadPriceCol: string;
  karachiPriceCol: string;
  badgeTagCol: string;
  subtitleCol: string;
}

export interface ParsedSheetDeal {
  rowKind: 'banner' | 'deal_card' | 'announcement';
  title: string;
  subtitle: string;
  badgeOrTag: string;
  price: string;
  categoryLink: string;
  imageUrl: string;
  type?: 'deal' | 'notice' | 'event';
}

export interface ParsedSheetResult {
  headers: string[];
  rawRows: Record<string, string>[];
  detectedMapping: SheetColumnMapping;
  categoriesToCreate: string[];
  allCategoriesInSheet: string[];
  menuItemsToUpsert: {
    action: 'create' | 'update';
    item: MenuItem;
  }[];
  dealsAndBanners: ParsedSheetDeal[];
  appliedRulesSummary: string[];
}

const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  'biryani & rice': '/food-biryani.jpg',
  'burgers & sandwiches': '/food-burger.jpg',
  'pizza & italian': '/food-pizza.jpg',
  'desserts & beverages': '/food-dessert.jpg',
  'starters & sides': '/food-rolls.jpg',
  'bbq & grills': '/food-tikka.jpg',
  'karahi & handi': '/food-karahi.jpg',
  'chinese & wok': '/food-chowmein.jpg',
  'rolls & wraps': '/food-rolls.jpg',
  'drinks & shakes': '/food-karak-chai.jpg',
};

export function inferDefaultImageForCategory(category: string, dishName: string): string {
  const lowerCat = (category || '').toLowerCase();
  const lowerName = (dishName || '').toLowerCase();

  for (const [key, img] of Object.entries(DEFAULT_CATEGORY_IMAGES)) {
    if (lowerCat.includes(key) || key.includes(lowerCat)) {
      return img;
    }
  }
  if (lowerName.includes('biryani') || lowerName.includes('pulao') || lowerName.includes('rice')) return '/food-biryani.jpg';
  if (lowerName.includes('burger') || lowerName.includes('zinger') || lowerName.includes('sandwich')) return '/food-burger.jpg';
  if (lowerName.includes('pizza') || lowerName.includes('pasta')) return '/food-pizza.jpg';
  if (lowerName.includes('roll') || lowerName.includes('paratha') || lowerName.includes('wings')) return '/food-rolls.jpg';
  if (lowerName.includes('chai') || lowerName.includes('tea') || lowerName.includes('coffee') || lowerName.includes('drink') || lowerName.includes('lassi')) return '/food-karak-chai.jpg';
  if (lowerName.includes('cake') || lowerName.includes('kheer') || lowerName.includes('gulab') || lowerName.includes('dessert') || lowerName.includes('sweet')) return '/food-dessert.jpg';
  if (lowerName.includes('karahi') || lowerName.includes('handi') || lowerName.includes('nihari')) return '/food-karahi.jpg';
  if (lowerName.includes('tikka') || lowerName.includes('kabab') || lowerName.includes('seekh') || lowerName.includes('bbq')) return '/food-tikka.jpg';
  return '/food-biryani.jpg';
}

export function parseDelimitedText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const trimmed = (text || '').trim();
  if (!trimmed) return { headers: [], rows: [] };

  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object') {
        const headerSet = new Set<string>();
        arr.forEach((obj) => Object.keys(obj || {}).forEach((k) => headerSet.add(k)));
        const headers = Array.from(headerSet);
        const rows = arr.map((obj) => {
          const rec: Record<string, string> = {};
          headers.forEach((h) => {
            rec[h] = obj[h] !== undefined && obj[h] !== null ? String(obj[h]).trim() : '';
          });
          return rec;
        });
        return { headers, rows };
      }
    } catch {
      // fall through
    }
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  let delimiter = ',';
  if (tabCount > commaCount && tabCount >= semiCount) delimiter = '\t';
  else if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const rawHeaders = parseLine(lines[0]).map((h, idx) => h || `Column_${idx + 1}`);
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < lines.length; r++) {
    const vals = parseLine(lines[r]);
    if (vals.every((v) => !v)) continue;
    const rec: Record<string, string> = {};
    rawHeaders.forEach((h, idx) => {
      rec[h] = vals[idx] !== undefined ? vals[idx] : '';
    });
    rows.push(rec);
  }

  return { headers: rawHeaders, rows };
}

export function autoDetectColumnMapping(headers: string[]): SheetColumnMapping {
  const findCol = (keywords: string[]): string => {
    const lowerHeaders = headers.map((h) => ({ raw: h, clean: h.toLowerCase().replace(/[^a-z0-9]/g, '') }));
    for (const kw of keywords) {
      const cleanKw = kw.toLowerCase().replace(/[^a-z0-9]/g, '');
      const exact = lowerHeaders.find((h) => h.clean === cleanKw);
      if (exact) return exact.raw;
    }
    for (const kw of keywords) {
      const cleanKw = kw.toLowerCase().replace(/[^a-z0-9]/g, '');
      const partial = lowerHeaders.find((h) => h.clean.includes(cleanKw));
      if (partial) return partial.raw;
    }
    return '';
  };

  return {
    rowTypeCol: findCol(['type', 'rowtype', 'recordtype', 'section', 'kind', 'itemtype']),
    nameCol: findCol(['dishname', 'itemname', 'name', 'title', 'dish', 'product', 'productname', 'menuitem']),
    categoryCol: findCol(['category', 'categories', 'cat', 'group', 'department', 'menucategory', 'foodcategory']),
    priceCol: findCol(['baseprice', 'price', 'rate', 'cost', 'pkr', 'amount', 'unitprice', 'mrp']),
    descriptionCol: findCol(['description', 'desc', 'details', 'ingredients', 'summary', 'notes', 'about']),
    imageCol: findCol(['image', 'imageurl', 'photo', 'picture', 'img', 'thumbnail']),
    availableCol: findCol(['available', 'availability', 'stock', 'instock', 'status', 'active', 'isavailable']),
    lahorePriceCol: findCol(['lahoreprice', 'gulbergprice', 'lahore', 'gulberg', 'lhrprice']),
    islamabadPriceCol: findCol(['islamabadprice', 'f7price', 'islamabad', 'isbprice', 'f7']),
    karachiPriceCol: findCol(['karachiprice', 'cliftonprice', 'karachi', 'khiprice', 'clifton']),
    badgeTagCol: findCol(['badge', 'tag', 'label', 'promo', 'offer', 'highlight']),
    subtitleCol: findCol(['subtitle', 'subtext', 'tagline', 'caption']),
  };
}

export interface InstructionRules {
  columnOverrides: Partial<SheetColumnMapping>;
  defaultCategory?: string;
  onlyCategories?: string[];
  priceMarkupPercent?: number;
  priceMarkupFlat?: number;
  forceAllAvailable?: boolean;
  appliedNotes: string[];
}

export function parseFetchInstructions(instructions: string, headers: string[]): InstructionRules {
  const rules: InstructionRules = {
    columnOverrides: {},
    appliedNotes: [],
  };
  if (!instructions || !instructions.trim()) return rules;

  const text = instructions.trim();
  const findHeaderByMention = (mention: string): string | undefined => {
    const cleanM = mention.trim().toLowerCase().replace(/['"`]/g, '');
    return headers.find((h) => h.toLowerCase() === cleanM || h.toLowerCase().includes(cleanM));
  };

  const mapPatterns: { field: keyof SheetColumnMapping; label: string; regex: RegExp }[] = [
    { field: 'nameCol', label: 'Dish/Title', regex: /(?:use|map|fetch|take|set)\s+["']?([^"',.\n]+?)["']?\s+(?:as|for|to)\s+(?:dish\s*name|item\s*name|name|title|dish|product)/i },
    { field: 'categoryCol', label: 'Category', regex: /(?:use|map|fetch|take|set)\s+["']?([^"',.\n]+?)["']?\s+(?:as|for|to)\s+(?:category|categories|cat|group)/i },
    { field: 'priceCol', label: 'Price', regex: /(?:use|map|fetch|take|set)\s+["']?([^"',.\n]+?)["']?\s+(?:as|for|to)\s+(?:base\s*price|price|rate|cost)/i },
    { field: 'descriptionCol', label: 'Description', regex: /(?:use|map|fetch|take|set)\s+["']?([^"',.\n]+?)["']?\s+(?:as|for|to)\s+(?:description|desc|details|ingredients)/i },
  ];

  for (const pat of mapPatterns) {
    const m = text.match(pat.regex);
    if (m && m[1]) {
      const matchedH = findHeaderByMention(m[1]);
      if (matchedH) {
        rules.columnOverrides[pat.field] = matchedH;
        rules.appliedNotes.push(`Mapped column "${matchedH}" → ${pat.label}`);
      }
    }
  }

  const pctMatch = text.match(/(?:increase|add|markup|raise)\s+(?:all\s+)?prices?\s+by\s+(\d+(?:\.\d+)?)\s*%/i);
  if (pctMatch) {
    rules.priceMarkupPercent = parseFloat(pctMatch[1]);
    rules.appliedNotes.push(`Applied +${rules.priceMarkupPercent}% price markup`);
  }

  const discountMatch = text.match(/(?:decrease|reduce|discount)\s+(?:all\s+)?prices?\s+by\s+(\d+(?:\.\d+)?)\s*%/i);
  if (discountMatch) {
    rules.priceMarkupPercent = -parseFloat(discountMatch[1]);
    rules.appliedNotes.push(`Applied ${rules.priceMarkupPercent}% price discount`);
  }

  const flatMatch = text.match(/(?:increase|add)\s+(?:rs\.?\s*|pkr\s*)?(\d+)\s+to\s+(?:all\s+)?prices?/i);
  if (flatMatch) {
    rules.priceMarkupFlat = parseInt(flatMatch[1], 10);
    rules.appliedNotes.push(`Added Rs. ${rules.priceMarkupFlat} to all prices`);
  }

  const defCatMatch = text.match(/default\s+category\s*(?:is|=|:|to)\s*["']?([^"',.\n]+)["']?/i);
  if (defCatMatch && defCatMatch[1]) {
    rules.defaultCategory = defCatMatch[1].trim();
    rules.appliedNotes.push(`Default fallback category set to "${rules.defaultCategory}"`);
  }

  const onlyCatMatch = text.match(/(?:only\s+import|only\s+fetch|filter\s+categories?\s+to)\s+["']?([^.\n]+)["']?/i);
  if (onlyCatMatch && onlyCatMatch[1]) {
    rules.onlyCategories = onlyCatMatch[1]
      .split(/,|and/i)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    rules.appliedNotes.push(`Filtered categories to: ${rules.onlyCategories.join(', ')}`);
  }

  if (/mark\s+all\s+(?:items?\s+)?(?:available|in\s*stock)/i.test(text)) {
    rules.forceAllAvailable = true;
    rules.appliedNotes.push('Forced all imported items to Available (In Stock)');
  }

  return rules;
}

function parseNumberPrice(raw: string | undefined, fallback = 500): number {
  if (!raw) return fallback;
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  const num = Math.round(parseFloat(cleaned));
  return isNaN(num) || num <= 0 ? fallback : num;
}

function parseBooleanAvailability(raw: string | undefined): boolean {
  if (!raw || !raw.trim()) return true;
  const v = raw.trim().toLowerCase();
  if (['false', 'no', '0', 'out of stock', 'unavailable', 'sold out', 'inactive', 'closed'].includes(v)) {
    return false;
  }
  return true;
}

export function extractStructuredDataFromSheet(params: {
  headers: string[];
  rows: Record<string, string>[];
  mapping?: Partial<SheetColumnMapping>;
  instructions?: string;
  existingCategories: string[];
  existingMenuItems: MenuItem[];
  targetBranchId?: string;
}): ParsedSheetResult {
  const {
    headers,
    rows,
    mapping: userMapping,
    instructions = '',
    existingCategories,
    existingMenuItems,
    targetBranchId,
  } = params;

  const autoMap = autoDetectColumnMapping(headers);
  const instructionRules = parseFetchInstructions(instructions, headers);

  const finalMapping: SheetColumnMapping = {
    ...autoMap,
    ...userMapping,
    ...instructionRules.columnOverrides,
  };

  if (!finalMapping.nameCol && headers.length > 0) finalMapping.nameCol = headers[0];
  if (!finalMapping.categoryCol && headers.length > 1) finalMapping.categoryCol = headers[1];
  if (!finalMapping.priceCol && headers.length > 2) finalMapping.priceCol = headers[2];

  const existingCatLower = new Map<string, string>();
  existingCategories.forEach((c) => existingCatLower.set(c.toLowerCase().trim(), c));

  const allCategoriesSet = new Set<string>();
  const newCategoriesSet = new Set<string>();
  const menuItemsToUpsert: { action: 'create' | 'update'; item: MenuItem }[] = [];
  const dealsAndBanners: ParsedSheetDeal[] = [];

  rows.forEach((row, index) => {
    const rawType = (finalMapping.rowTypeCol ? row[finalMapping.rowTypeCol] : '')?.trim().toLowerCase() || '';
    const rawName = (finalMapping.nameCol ? row[finalMapping.nameCol] : '')?.trim() || '';
    const rawCat =
      (finalMapping.categoryCol ? row[finalMapping.categoryCol] : '')?.trim() ||
      instructionRules.defaultCategory ||
      existingCategories[0] ||
      'Chef Specials';
    const rawPrice = (finalMapping.priceCol ? row[finalMapping.priceCol] : '')?.trim() || '';
    const rawDesc = (finalMapping.descriptionCol ? row[finalMapping.descriptionCol] : '')?.trim() || '';
    const rawImg = (finalMapping.imageCol ? row[finalMapping.imageCol] : '')?.trim() || '';
    const rawAvail = (finalMapping.availableCol ? row[finalMapping.availableCol] : '')?.trim() || '';
    const rawBadge = (finalMapping.badgeTagCol ? row[finalMapping.badgeTagCol] : '')?.trim() || '';
    const rawSubtitle = (finalMapping.subtitleCol ? row[finalMapping.subtitleCol] : '')?.trim() || '';

    if (!rawName) return;

    const isDealOrBanner =
      rawType.includes('banner') ||
      rawType.includes('deal') ||
      rawType.includes('promo') ||
      rawType.includes('announcement') ||
      rawType.includes('notice') ||
      rawCat.toLowerCase() === 'banner' ||
      rawCat.toLowerCase() === 'hero banner' ||
      rawCat.toLowerCase() === 'deal card' ||
      rawCat.toLowerCase() === 'announcement';

    if (isDealOrBanner) {
      let rowKind: 'banner' | 'deal_card' | 'announcement' = 'announcement';
      if (rawType.includes('banner') || rawCat.toLowerCase().includes('banner')) {
        rowKind = 'banner';
      } else if (rawType.includes('deal_card') || rawType.includes('chef') || rawCat.toLowerCase().includes('deal card')) {
        rowKind = 'deal_card';
      }

      const numP = parseNumberPrice(rawPrice, 0);
      dealsAndBanners.push({
        rowKind,
        title: rawName,
        subtitle: rawSubtitle || rawDesc || 'Special limited-time offer at Foodies Cafe.',
        badgeOrTag: rawBadge || 'SPECIAL OFFER',
        price: numP > 0 ? `Rs. ${numP.toLocaleString()}` : rawPrice || 'Special Deal',
        categoryLink: existingCategories[0] || 'Biryani & Rice',
        imageUrl: rawImg || '/hero-bg.jpg',
        type: rawType.includes('event') ? 'event' : rawType.includes('notice') ? 'notice' : 'deal',
      });
      return;
    }

    const canonicalCategory = existingCatLower.get(rawCat.toLowerCase()) || rawCat;

    if (
      instructionRules.onlyCategories &&
      instructionRules.onlyCategories.length > 0 &&
      !instructionRules.onlyCategories.some((allowed) => canonicalCategory.toLowerCase().includes(allowed))
    ) {
      return;
    }

    allCategoriesSet.add(canonicalCategory);
    if (!existingCatLower.has(canonicalCategory.toLowerCase())) {
      newCategoriesSet.add(canonicalCategory);
    }

    let computedPrice = parseNumberPrice(rawPrice, 550);
    if (instructionRules.priceMarkupPercent) {
      computedPrice = Math.round(computedPrice * (1 + instructionRules.priceMarkupPercent / 100));
    }
    if (instructionRules.priceMarkupFlat) {
      computedPrice += instructionRules.priceMarkupFlat;
    }

    const isAvailable = instructionRules.forceAllAvailable ? true : parseBooleanAvailability(rawAvail);
    const existingItem = existingMenuItems.find(
      (m) => m.name.toLowerCase().trim() === rawName.toLowerCase().trim()
    );

    const branchPriceOverrides: Record<string, number> = {
      ...(existingItem?.branchPriceOverrides || {}),
    };

    if (targetBranchId && targetBranchId !== 'all') {
      branchPriceOverrides[targetBranchId] = computedPrice;
    }
    if (finalMapping.lahorePriceCol && row[finalMapping.lahorePriceCol]) {
      branchPriceOverrides['gulberg-lahore'] = parseNumberPrice(row[finalMapping.lahorePriceCol], computedPrice);
    }
    if (finalMapping.islamabadPriceCol && row[finalMapping.islamabadPriceCol]) {
      branchPriceOverrides['f7-islamabad'] = parseNumberPrice(row[finalMapping.islamabadPriceCol], computedPrice);
    }
    if (finalMapping.karachiPriceCol && row[finalMapping.karachiPriceCol]) {
      branchPriceOverrides['clifton-karachi'] = parseNumberPrice(row[finalMapping.karachiPriceCol], computedPrice);
    }

    const resolvedImg =
      rawImg && (rawImg.startsWith('/') || rawImg.startsWith('http') || rawImg.startsWith('data:'))
        ? rawImg
        : existingItem?.image || inferDefaultImageForCategory(canonicalCategory, rawName);

    const itemObj: MenuItem = {
      id: existingItem ? existingItem.id : `m-sheet-${Date.now()}-${index}`,
      name: rawName,
      category: canonicalCategory,
      description: rawDesc || existingItem?.description || `Freshly prepared ${rawName} under ${canonicalCategory}.`,
      basePrice: targetBranchId && targetBranchId !== 'all' && existingItem ? existingItem.basePrice : computedPrice,
      image: resolvedImg,
      isAvailable,
      branchAvailability: existingItem?.branchAvailability || {
        'gulberg-lahore': isAvailable,
        'f7-islamabad': isAvailable,
        'clifton-karachi': isAvailable,
      },
      branchPriceOverrides,
    };

    menuItemsToUpsert.push({
      action: existingItem ? 'update' : 'create',
      item: itemObj,
    });
  });

  return {
    headers,
    rawRows: rows,
    detectedMapping: finalMapping,
    categoriesToCreate: Array.from(newCategoriesSet),
    allCategoriesInSheet: Array.from(allCategoriesSet),
    menuItemsToUpsert,
    dealsAndBanners,
    appliedRulesSummary: instructionRules.appliedNotes,
  };
}

export const SAMPLE_SHEET_CSV = `Type,Dish Name,Category,Base Price,Description,Available,Lahore Price,Islamabad Price,Karachi Price,Badge,Image
Dish,Royal Mughlai Zafrani Biryani,Biryani & Rice,950,Aromatic basmati rice layered with saffron-infused tender mutton and roasted nuts.,Yes,950,980,920,CHEF SPECIAL,/food-biryani.jpg
Dish,Smoky Beef Melt Smash Burger,Burgers & Sandwiches,890,Double smashed prime beef patties with caramelized onions and house truffle sauce.,Yes,890,920,880,BESTSELLER,/food-burger.jpg
Dish,Lahori Chargha Platter,BBQ & Grills,1450,Whole marinated chicken steamed and flash-fried with traditionalLahori spices and mint chutney.,Yes,1450,1500,1400,NEW CATEGORY,/food-tikka.jpg
Dish,Peshawari Charsi Mutton Karahi,Karahi & Handi,2400,Authentic wok-seared tender mutton cooked in fresh tomatoes and green chilies.,Yes,2400,2500,2350,SIGNATURE,/food-karahi.jpg
Dish,Lotus Biscoff Tres Leches,Desserts & Beverages,680,Velvety sponge soaked in three milks topped with caramelized Lotus Biscoff cream.,Yes,680,700,650,MUST TRY,/food-dessert.jpg
Banner,Grand BBQ & Karahi Festival,Hero Banner,1450,Experience our newly launched BBQ & Grills and Karahi & Handi categories across all branches!,Yes,,,,LIMITED TIME,/hero-bg.jpg
Announcement,Weekend Family Feast 20% Off,Announcement,1999,Order from our new sheet categories this weekend and enjoy complimentary desserts!,Yes,,,,WEEKEND DEAL,/food-biryani.jpg`;

