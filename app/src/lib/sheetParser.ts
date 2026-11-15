import { MenuItem, Announcement, HeroBanner, DealCard } from '@/types/cafe';

export interface ParsedSheetRow {
  [key: string]: string;
}

export interface ParsedSheetResult {
  headers: string[];
  rows: ParsedSheetRow[];
  sheetNames: string[];
}

export interface SheetColumnMapping {
  recordTypeCol: string;
  nameCol: string;
  categoryCol: string;
  priceCol: string;
  descriptionCol: string;
  imageCol: string;
  availableCol: string;
  gulbergPriceCol: string;
  f7PriceCol: string;
  cliftonPriceCol: string;
  tagCol: string;
  validityCol: string;
  branchScopeCol: string;
}

export interface ExtractedSheetCatalog {
  categoriesToCreate: string[];
  allCategoriesInSheet: string[];
  menuItems: Array<{
    item: MenuItem;
    isUpdate: boolean;
  }>;
  announcements: Omit<Announcement, 'id'>[];
  heroBanners: Omit<HeroBanner, 'id'>[];
  dealCard?: DealCard;
  summary: {
    totalRowsProcessed: number;
    newCategoriesCount: number;
    newDishesCount: number;
    updatedDishesCount: number;
    dealsAndAnnouncementsCount: number;
    bannersCount: number;
  };
}

const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  biryani: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
  karahi: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80',
  shinwari: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80',
  bbq: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop&q=80',
  kebab: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80',
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80',
  bread: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80',
  tandoor: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80',
  naan: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80',
  dessert: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80',
  beverage: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&auto=format&fit=crop&q=80',
  drink: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&auto=format&fit=crop&q=80',
  chai: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&auto=format&fit=crop&q=80',
  appetizer: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=800&auto=format&fit=crop&q=80',
  starter: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=800&auto=format&fit=crop&q=80',
};

export function resolveSmartImage(rawImage: string, category: string, dishName: string): string {
  const trimmed = (rawImage || '').trim();
  if (trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/'))) {
    return trimmed;
  }
  const combined = `${category} ${dishName}`.toLowerCase();
  for (const [key, url] of Object.entries(DEFAULT_CATEGORY_IMAGES)) {
    if (combined.includes(key)) {
      return url;
    }
  }
  return '/food-biryani.jpg';
}

/**
 * Parses CSV / TSV / Delimited text into headers and rows
 */
export function parseDelimitedText(text: string, defaultSheetName = 'Sheet1'): ParsedSheetResult {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    return { headers: [], rows: [], sheetNames: [defaultSheetName] };
  }

  // Check if JSON array
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    try {
      const arr = JSON.parse(cleaned);
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object') {
        const headerSet = new Set<string>();
        arr.forEach((obj) => {
          if (obj && typeof obj === 'object') {
            Object.keys(obj).forEach((k) => headerSet.add(k));
          }
        });
        const headers = Array.from(headerSet);
        const rows: ParsedSheetRow[] = arr.map((obj) => {
          const r: ParsedSheetRow = { _sheetName: defaultSheetName };
          headers.forEach((h) => {
            r[h] = obj[h] !== undefined && obj[h] !== null ? String(obj[h]).trim() : '';
          });
          return r;
        });
        return { headers, rows, sheetNames: [defaultSheetName] };
      }
    } catch {}
  }

  // Check if HTML table or XML Spreadsheet 2003 (.xls export)
  if (cleaned.includes('<table') || cleaned.includes('<Row') || cleaned.includes('<tr')) {
    const xmlResult = parseXmlOrHtmlTable(cleaned, defaultSheetName);
    if (xmlResult.headers.length > 0) return xmlResult;
  }

  // Detect delimiter (Tab vs Comma vs Semicolon)
  const firstLineEnd = cleaned.indexOf('\n');
  const firstLine = firstLineEnd >= 0 ? cleaned.slice(0, firstLineEnd) : cleaned;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  let delimiter = ',';
  if (tabCount > commaCount && tabCount >= semiCount) delimiter = '\t';
  else if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';

  const matrix = parseDelimitedMatrix(cleaned, delimiter);
  if (matrix.length === 0) {
    return { headers: [], rows: [], sheetNames: [defaultSheetName] };
  }

  const rawHeaders = matrix[0].map((h, i) => h.trim() || `Column_${i + 1}`);
  const rows: ParsedSheetRow[] = [];

  for (let rIdx = 1; rIdx < matrix.length; rIdx++) {
    const cells = matrix[rIdx];
    if (cells.every((c) => !c.trim())) continue;
    const rowObj: ParsedSheetRow = { _sheetName: defaultSheetName };
    rawHeaders.forEach((h, cIdx) => {
      rowObj[h] = (cells[cIdx] || '').trim();
    });
    rows.push(rowObj);
  }

  return {
    headers: rawHeaders,
    rows,
    sheetNames: [defaultSheetName],
  };
}

function parseDelimitedMatrix(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function parseXmlOrHtmlTable(xmlText: string, defaultSheetName: string): ParsedSheetResult {
  const rowMatches = xmlText.match(/<(?:tr|Row)[\s\S]*?<\/(?:tr|Row)>/gi) || [];
  const matrix: string[][] = [];

  rowMatches.forEach((rowXml) => {
    const cellMatches = rowXml.match(/<(?:td|th|Cell)[\s\S]*?<\/(?:td|th|Cell)>/gi) || [];
    if (cellMatches.length > 0) {
      const cells = cellMatches.map((cellXml) =>
        cellXml
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim()
      );
      if (cells.some((c) => c.length > 0)) {
        matrix.push(cells);
      }
    }
  });

  if (matrix.length === 0) {
    return { headers: [], rows: [], sheetNames: [defaultSheetName] };
  }

  const headers = matrix[0].map((h, i) => h || `Column_${i + 1}`);
  const rows: ParsedSheetRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const rowObj: ParsedSheetRow = { _sheetName: defaultSheetName };
    headers.forEach((h, idx) => {
      rowObj[h] = matrix[i][idx] || '';
    });
    rows.push(rowObj);
  }

  return { headers, rows, sheetNames: [defaultSheetName] };
}

/**
 * Auto-detects column mapping based on header names and custom user instructions
 */
export function autoDetectColumnMapping(
  headers: string[],
  designInstructions = ''
): SheetColumnMapping {
  const findCol = (patterns: RegExp[]): string => {
    for (const pat of patterns) {
      const match = headers.find((h) => pat.test(h.trim()));
      if (match) return match;
    }
    return '';
  };

  const mapping: SheetColumnMapping = {
    recordTypeCol: findCol([/^(record[_\s-]*type|type|entry[_\s-]*type|kind|section[_\s-]*type)$/i]),
    nameCol: findCol([
      /^(dish[_\s-]*name|item[_\s-]*name|product[_\s-]*name|name|title|dish|item|headline|menu[_\s-]*item)$/i,
      /name|title|dish|item/i,
    ]),
    categoryCol: findCol([
      /^(category|food[_\s-]*category|menu[_\s-]*category|group|section|department|cuisine)$/i,
      /category|group|section/i,
    ]),
    priceCol: findCol([
      /^(base[_\s-]*price|price|rate|cost|amount|pkr|rs|unit[_\s-]*price|menu[_\s-]*price)$/i,
      /price|rate|pkr|amount/i,
    ]),
    descriptionCol: findCol([
      /^(description|desc|details|recipe|ingredients|subtitle|summary|notes)$/i,
      /desc|detail|ingredient|recipe/i,
    ]),
    imageCol: findCol([/^(image|image[_\s-]*url|photo|photo[_\s-]*url|picture|img|thumbnail)$/i, /image|photo|img/i]),
    availableCol: findCol([/^(available|availability|in[_\s-]*stock|stock|status|active|is[_\s-]*available)$/i]),
    gulbergPriceCol: findCol([/gulberg|lahore/i]),
    f7PriceCol: findCol([/f-?7|islamabad/i]),
    cliftonPriceCol: findCol([/clifton|karachi/i]),
    tagCol: findCol([/^(tag|badge|deal[_\s-]*tag|promo[_\s-]*tag|label|offer[_\s-]*tag)$/i]),
    validityCol: findCol([/^(validity|valid[_\s-]*until|duration|expiry|schedule)$/i]),
    branchScopeCol: findCol([/^(branch|branch[_\s-]*id|branch[_\s-]*name|target[_\s-]*branch|store|location)$/i]),
  };

  // Parse explicit user mapping instructions if provided (e.g. "fetch name from Product, price from Rate, category from Group")
  if (designInstructions.trim()) {
    const instr = designInstructions.trim();
    const applyExplicitRule = (fieldKey: keyof SheetColumnMapping, fieldAliases: string[]) => {
      for (const alias of fieldAliases) {
        const regex1 = new RegExp(`(?:fetch|map|use|get|set)\\s+${alias}\\s+(?:from|to|=|:|as)\\s+["']?([^"',;\\n]+)["']?`, 'i');
        const regex2 = new RegExp(`["']?([^"',;\\n]+)["']?\\s*(?:->|=>|=)\\s*${alias}`, 'i');
        const m = instr.match(regex1) || instr.match(regex2);
        if (m && m[1]) {
          const targetHeader = m[1].trim();
          const matchedHeader = headers.find((h) => h.toLowerCase() === targetHeader.toLowerCase()) ||
            headers.find((h) => h.toLowerCase().includes(targetHeader.toLowerCase()));
          if (matchedHeader) {
            mapping[fieldKey] = matchedHeader;
          }
        }
      }
    };

    applyExplicitRule('nameCol', ['name', 'dish name', 'item name', 'dish', 'title']);
    applyExplicitRule('categoryCol', ['category', 'categories', 'group', 'section']);
    applyExplicitRule('priceCol', ['price', 'base price', 'rate', 'cost', 'pkr']);
    applyExplicitRule('descriptionCol', ['description', 'details', 'recipe', 'ingredients']);
    applyExplicitRule('availableCol', ['availability', 'stock', 'status', 'available']);
    applyExplicitRule('imageCol', ['image', 'photo', 'picture']);
    applyExplicitRule('tagCol', ['tag', 'badge']);
    applyExplicitRule('validityCol', ['validity', 'duration']);
  }

  // Fallback if nameCol is still empty and headers exist
  if (!mapping.nameCol && headers.length > 0) {
    mapping.nameCol = headers[0];
  }
  if (!mapping.categoryCol && headers.length > 1) {
    const second = headers[1];
    if (second !== mapping.nameCol && second !== mapping.priceCol) {
      mapping.categoryCol = second;
    }
  }
  if (!mapping.priceCol && headers.length > 2) {
    const third = headers[2];
    if (third !== mapping.nameCol && third !== mapping.categoryCol) {
      mapping.priceCol = third;
    }
  }

  return mapping;
}

/**
 * Extracts and categorizes all rows into Categories, Menu Items, Announcements/Deals, and Hero Banners
 * honoring both the column mapping and custom natural-language instructions.
 */
export function extractStructuredDataFromSheet(
  rows: ParsedSheetRow[],
  mapping: SheetColumnMapping,
  existingCategories: string[],
  existingMenuItems: MenuItem[],
  options: {
    designInstructions?: string;
    role?: string;
    activeBranchId?: string;
  } = {}
): ExtractedSheetCatalog {
  const instr = (options.designInstructions || '').trim();
  const instrLower = instr.toLowerCase();

  // Check instruction modifiers
  // 1. Price adjustment in instructions: e.g. "increase price by 10%", "+10%", "discount 5%", "add 50 to price"
  let priceMultiplier = 1;
  let priceOffset = 0;
  const pctMatch = instr.match(/(?:increase|markup|add|\+)\s*(?:price\s*(?:by\s*)?)?(\d+(?:\.\d+)?)\s*%/i);
  const discMatch = instr.match(/(?:decrease|discount|reduce|-)\s*(?:price\s*(?:by\s*)?)?(\d+(?:\.\d+)?)\s*%/i);
  const flatAddMatch = instr.match(/(?:add|\+)\s*(?:rs\.?\s*)?(\d+)\s*(?:to\s*price|pkr|rs)/i);
  if (pctMatch) {
    priceMultiplier = 1 + parseFloat(pctMatch[1]) / 100;
  } else if (discMatch) {
    priceMultiplier = Math.max(0.1, 1 - parseFloat(discMatch[1]) / 100);
  }
  if (flatAddMatch) {
    priceOffset = parseInt(flatAddMatch[1], 10) || 0;
  }

  // 2. Default category in instructions: e.g. "default category: Chef Specials"
  let defaultCategory = existingCategories[0] || 'Biryani & Rice';
  const defCatMatch = instr.match(/default\s+category\s*(?:is|=|:)\s*["']?([^"',;\n]+)["']?/i);
  if (defCatMatch && defCatMatch[1]?.trim()) {
    defaultCategory = defCatMatch[1].trim();
  }

  // 3. Category filter in instructions: e.g. "only category Burgers" or "filter category: Biryani, BBQ"
  let allowedCategoryKeywords: string[] | null = null;
  const filterCatMatch = instr.match(/(?:only\s+import\s+category|only\s+category|filter\s+category)\s*(?::|=)?\s*([^\n.;]+)/i);
  if (filterCatMatch && filterCatMatch[1]?.trim()) {
    allowedCategoryKeywords = filterCatMatch[1]
      .split(/,|and/i)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  // 4. Branch-only pricing rule
  const applyToActiveBranchOnly =
    options.role === 'branch_manager' ||
    instrLower.includes('my branch only') ||
    instrLower.includes('current branch only');

  const forceAllAsMenuItems = instrLower.includes('all as menu items') || instrLower.includes('dishes only');

  const existingCatMap = new Map<string, string>();
  existingCategories.forEach((c) => existingCatMap.set(c.toLowerCase().trim(), c));

  const discoveredCategoriesSet = new Set<string>();
  const categoriesToCreateSet = new Set<string>();

  const menuItemsResult: Array<{ item: MenuItem; isUpdate: boolean }> = [];
  const announcementsResult: Omit<Announcement, 'id'>[] = [];
  const heroBannersResult: Omit<HeroBanner, 'id'>[] = [];
  let extractedDealCard: DealCard | undefined;

  const parsePriceNumber = (val: string | undefined): number => {
    if (!val) return 0;
    const cleaned = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num) || num < 0) return 0;
    return Math.round(num * priceMultiplier + priceOffset);
  };

  const parseAvailability = (val: string | undefined): boolean => {
    if (!val || !val.trim()) return true;
    const v = val.trim().toLowerCase();
    if (['false', 'no', '0', 'out of stock', 'unavailable', 'sold out', 'inactive', 'disabled'].includes(v)) {
      return false;
    }
    return true;
  };

  const normalizeBranchKey = (raw: string): string | undefined => {
    const v = (raw || '').toLowerCase().trim();
    if (!v || v === 'all' || v === 'all branches' || v === 'global') return undefined;
    if (v.includes('gulberg') || v.includes('lahore')) return 'gulberg-lahore';
    if (v.includes('f-7') || v.includes('f7') || v.includes('islamabad')) return 'f7-islamabad';
    if (v.includes('clifton') || v.includes('karachi')) return 'clifton-karachi';
    return undefined;
  };

  rows.forEach((row, idx) => {
    const sheetName = (row._sheetName || '').trim();
    const rawName = (mapping.nameCol ? row[mapping.nameCol] : '')?.trim() || '';
    if (!rawName) return;

    const rawRecordType = (mapping.recordTypeCol ? row[mapping.recordTypeCol] : '')?.trim().toLowerCase() || '';
    const rawCat = (mapping.categoryCol ? row[mapping.categoryCol] : '')?.trim() || '';
    const rawDesc = (mapping.descriptionCol ? row[mapping.descriptionCol] : '')?.trim() || '';
    const rawPriceStr = (mapping.priceCol ? row[mapping.priceCol] : '')?.trim() || '';
    const rawImage = (mapping.imageCol ? row[mapping.imageCol] : '')?.trim() || '';
    const rawAvail = (mapping.availableCol ? row[mapping.availableCol] : '')?.trim() || '';
    const rawTag = (mapping.tagCol ? row[mapping.tagCol] : '')?.trim() || '';
    const rawValidity = (mapping.validityCol ? row[mapping.validityCol] : '')?.trim() || '';
    const rawBranchScope = (mapping.branchScopeCol ? row[mapping.branchScopeCol] : '')?.trim() || '';

    // Determine whether this row is a Deal/Announcement, a Hero Banner, or a Menu Item
    const sheetLower = sheetName.toLowerCase();
    const catLower = rawCat.toLowerCase();

    const isBannerRow =
      !forceAllAsMenuItems &&
      (rawRecordType.includes('banner') ||
        rawRecordType.includes('hero') ||
        catLower === 'banner' ||
        catLower === 'hero banner' ||
        sheetLower.includes('banner'));

    const isChefDealRow =
      !forceAllAsMenuItems &&
      (rawRecordType === 'chef deal' ||
        rawRecordType === 'deal card' ||
        catLower === 'chef deal' ||
        catLower === 'featured deal');

    const isAnnouncementOrDealRow =
      !forceAllAsMenuItems &&
      !isBannerRow &&
      !isChefDealRow &&
      (rawRecordType.includes('deal') ||
        rawRecordType.includes('announcement') ||
        rawRecordType.includes('promo') ||
        rawRecordType.includes('offer') ||
        catLower === 'deal' ||
        catLower === 'deals' ||
        catLower === 'announcement' ||
        catLower === 'announcements' ||
        catLower === 'promo' ||
        sheetLower.includes('announcement') ||
        sheetLower === 'deals');

    if (isBannerRow) {
      heroBannersResult.push({
        title: rawName,
        subtitle: rawDesc || 'Freshly prepared signature dishes across all branches.',
        badge: rawTag || 'CHEF SPECIAL',
        imageUrl: resolveSmartImage(rawImage, rawCat || 'biryani', rawName),
        categoryLink: existingCategories[0] || 'Biryani & Rice',
        active: parseAvailability(rawAvail),
      });
      return;
    }

    if (isChefDealRow) {
      extractedDealCard = {
        title: rawName,
        subtitle: rawDesc || '',
        price: rawPriceStr ? `Rs. ${parsePriceNumber(rawPriceStr).toLocaleString()}` : 'Rs. 1,450',
        tag: rawTag || 'CHEF SPECIAL',
        imageUrl: resolveSmartImage(rawImage, rawCat, rawName),
        categoryLink: existingCategories[0] || 'Biryani & Rice',
      };
      return;
    }

    if (isAnnouncementOrDealRow) {
      const targetBranchId =
        options.role === 'branch_manager'
          ? options.activeBranchId
          : normalizeBranchKey(rawBranchScope);
      const badgeTag = (rawTag || (catLower.includes('deal') ? 'HOT DEAL' : 'ANNOUNCEMENT')).toUpperCase();
      announcementsResult.push({
        title: rawName,
        tag: badgeTag,
        description:
          rawDesc ||
          (rawPriceStr
            ? `Special promotional offer at Rs. ${parsePriceNumber(rawPriceStr).toLocaleString()}.`
            : 'Limited time special offer at Foodies Cafe.'),
        validUntil: rawValidity || 'Valid this week',
        branchId: targetBranchId,
        branchName:
          targetBranchId === 'gulberg-lahore'
            ? 'Gulberg Lahore'
            : targetBranchId === 'f7-islamabad'
            ? 'F-7 Islamabad'
            : targetBranchId === 'clifton-karachi'
            ? 'Clifton Karachi'
            : undefined,
        badgeColor: badgeTag.includes('HOT') || badgeTag.includes('DEAL') ? '#EF4444' : '#F59E0B',
      });
      return;
    }

    // Otherwise, it's a Menu Item!
    // Resolve category: use explicit category column -> or worksheet tab name (if meaningful) -> or defaultCategory
    let resolvedCategory = rawCat;
    if (!resolvedCategory) {
      if (
        sheetName &&
        !['sheet1', 'sheet', 'menu', 'items', 'data', 'template', 'export'].includes(sheetLower)
      ) {
        resolvedCategory = sheetName;
      } else {
        resolvedCategory = defaultCategory;
      }
    }

    // Match case-insensitively with existing category names to avoid near-duplicate casing
    const existingCanonical = existingCatMap.get(resolvedCategory.toLowerCase());
    if (existingCanonical) {
      resolvedCategory = existingCanonical;
    } else {
      categoriesToCreateSet.add(resolvedCategory);
      existingCatMap.set(resolvedCategory.toLowerCase(), resolvedCategory);
    }

    // Check category filter from instructions if specified
    if (allowedCategoryKeywords && allowedCategoryKeywords.length > 0) {
      const matchesFilter = allowedCategoryKeywords.some((kw) =>
        resolvedCategory.toLowerCase().includes(kw)
      );
      if (!matchesFilter) return;
    }

    discoveredCategoriesSet.add(resolvedCategory);

    const parsedBasePrice = parsePriceNumber(rawPriceStr) || 550;
    const isAvail = parseAvailability(rawAvail);
    const gulbergPrice = mapping.gulbergPriceCol ? parsePriceNumber(row[mapping.gulbergPriceCol]) : 0;
    const f7Price = mapping.f7PriceCol ? parsePriceNumber(row[mapping.f7PriceCol]) : 0;
    const cliftonPrice = mapping.cliftonPriceCol ? parsePriceNumber(row[mapping.cliftonPriceCol]) : 0;

    // Check if dish already exists in menuItems (by ID or case-insensitive Name)
    const existingItem = existingMenuItems.find(
      (m) => m.name.toLowerCase().trim() === rawName.toLowerCase()
    );

    const branchPriceOverrides: Record<string, number> = {
      ...(existingItem?.branchPriceOverrides || {}),
    };
    const branchAvailability: Record<string, boolean> = {
      'gulberg-lahore': true,
      'f7-islamabad': true,
      'clifton-karachi': true,
      ...(existingItem?.branchAvailability || {}),
    };

    if (gulbergPrice > 0) branchPriceOverrides['gulberg-lahore'] = gulbergPrice;
    if (f7Price > 0) branchPriceOverrides['f7-islamabad'] = f7Price;
    if (cliftonPrice > 0) branchPriceOverrides['clifton-karachi'] = cliftonPrice;

    if (applyToActiveBranchOnly && options.activeBranchId && options.activeBranchId !== 'all') {
      branchPriceOverrides[options.activeBranchId] = parsedBasePrice;
      branchAvailability[options.activeBranchId] = isAvail;
    }

    const finalMenuItem: MenuItem = {
      id: existingItem ? existingItem.id : `m-sheet-${Date.now()}-${idx}`,
      name: rawName,
      category: resolvedCategory,
      description: rawDesc || existingItem?.description || `Freshly prepared ${rawName} (${resolvedCategory}).`,
      basePrice:
        applyToActiveBranchOnly && existingItem ? existingItem.basePrice : parsedBasePrice,
      image: rawImage
        ? resolveSmartImage(rawImage, resolvedCategory, rawName)
        : existingItem?.image || resolveSmartImage('', resolvedCategory, rawName),
      isAvailable: applyToActiveBranchOnly && existingItem ? existingItem.isAvailable : isAvail,
      branchAvailability,
      branchPriceOverrides,
      sizes: existingItem?.sizes || [],
      extras: existingItem?.extras || [],
    };

    menuItemsResult.push({
      item: finalMenuItem,
      isUpdate: Boolean(existingItem),
    });
  });

  return {
    categoriesToCreate: Array.from(categoriesToCreateSet),
    allCategoriesInSheet: Array.from(discoveredCategoriesSet),
    menuItems: menuItemsResult,
    announcements: announcementsResult,
    heroBanners: heroBannersResult,
    dealCard: extractedDealCard,
    summary: {
      totalRowsProcessed: rows.length,
      newCategoriesCount: categoriesToCreateSet.size,
      newDishesCount: menuItemsResult.filter((m) => !m.isUpdate).length,
      updatedDishesCount: menuItemsResult.filter((m) => m.isUpdate).length,
      dealsAndAnnouncementsCount: announcementsResult.length + (extractedDealCard ? 1 : 0),
      bannersCount: heroBannersResult.length,
    },
  };
}

export const SAMPLE_SHEET_CSV = `Record Type,Dish Name,Category,Base Price,Gulberg Price,F-7 Price,Clifton Price,Description,Availability,Tag,Validity
Menu Item, Peshawari Chapli Kebab Platter,BBQ & Kebabs,1150,1150,1050,1100,Two sizzling charcoal-grilled minced beef chapli kebabs served with mint raita and roghni naan,In Stock,,
Menu Item,Malai Tikka Boti (12 Pcs),BBQ & Kebabs,1280,1280,1190,1250,Creamy boneless chicken cubes marinated in yogurt white pepper and green chilies,In Stock,,
Menu Item,Lahori Chargha Full Chicken,Karahi & Handi,1850,1850,1750,1800,Whole steamed and flash-fried chicken marinated in traditional Lahori spices with fries,In Stock,,
Menu Item,Prawn Masala Handi,Seafood & Platters,2200,2200,2100,2150,Fresh jumbo prawns simmered in clay handi with ginger garlic and crushed coriander,In Stock,,
Menu Item,Grilled Finger Fish & Tartar,Seafood & Platters,1650,1650,1550,1600,Crispy herb-crusted boneless fish fillets served with house garlic tartar sauce,In Stock,,
Menu Item,Double Jalapeno Melt Burger,Burgers & Fast Food,980,980,890,940,Double smashed beef patties with pickled jalapenos melted cheddar and chipotle glaze,In Stock,,
Menu Item,Saffron Pistachio Kulfi Falooda,Beverages & Desserts,520,520,480,500,Rich homemade Zafrani kulfi topped with rose vermicelli basil seeds and rabri,In Stock,,
Deal,Weekend BBQ & Seafood Festival: Flat 20% Off,Deals,1999,,,,Enjoy 20% off our brand new Seafood & Platters and BBQ range all weekend across all branches,In Stock,HOT DEAL,Valid This Weekend
Deal,Late Night Smash Burger & Fries Combo,Deals,850,,,,Get any Double Melt Burger with loaded fries and chilled drink at a special combo rate,In Stock,BRANCH SPECIAL,Every Night 10 PM - 2 AM`;

