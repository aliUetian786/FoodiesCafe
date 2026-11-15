import { NextResponse } from 'next/server';
import { inflateRawSync } from 'zlib';
import { withTransaction } from '@/lib/db';
import { cacheInvalidatePrefix } from '@/lib/redis';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { parseDelimitedText, ParsedSheetResult, ParsedSheetRow } from '@/lib/sheetParser';
import { requireAuth, writeAuditLog } from '@/lib/auth';

const MAX_ZIP_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_TOTAL_UNCOMPRESSED_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_SINGLE_ENTRY_UNCOMPRESSED = 10 * 1024 * 1024; // 10 MB

/**
 * Native .xlsx (ZIP + OpenXML) reader with strict decompression limits to prevent Zip-Bomb DoS
 */
function parseXlsxBuffer(buffer: Buffer): ParsedSheetResult {
  if (buffer.length > MAX_ZIP_FILE_SIZE) {
    throw new Error(`File size (${(buffer.length / 1024 / 1024).toFixed(1)}MB) exceeds 5MB limit.`);
  }

  const files = new Map<string, string>();
  let totalUncompressed = 0;

  // Scan Local File Headers (0x04034b50) in the ZIP archive
  let offset = 0;
  while (offset + 30 <= buffer.length && files.size < 50) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      offset++;
      continue;
    }

    const generalPurposeFlag = buffer.readUInt16LE(offset + 6);
    const compressionMethod = buffer.readUInt16LE(offset + 8);
    let compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);

    const fileNameStart = offset + 30;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > buffer.length) break;

    const fileName = buffer.subarray(fileNameStart, fileNameEnd).toString('utf8');
    const dataStart = fileNameEnd + extraFieldLength;

    if ((generalPurposeFlag & 0x08) !== 0 && compressedSize === 0) {
      offset = dataStart;
      continue;
    }

    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) break;

    if (fileName.endsWith('.xml') || fileName.endsWith('.rels')) {
      try {
        const rawSlice = buffer.subarray(dataStart, dataEnd);
        let xmlString = '';
        if (compressionMethod === 0) {
          totalUncompressed += rawSlice.length;
          if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) break;
          xmlString = rawSlice.toString('utf8');
        } else if (compressionMethod === 8) {
          const uncompressedBuf = inflateRawSync(rawSlice, {
            maxOutputLength: MAX_SINGLE_ENTRY_UNCOMPRESSED,
          });
          totalUncompressed += uncompressedBuf.length;
          if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) break;
          xmlString = uncompressedBuf.toString('utf8');
        }
        if (xmlString) {
          files.set(fileName.replace(/\\/g, '/'), xmlString);
        }
      } catch {}
    }

    offset = dataEnd;
  }

  // Fallback: also scan Central Directory at the end of the ZIP if data descriptors were used
  if (files.size === 0) {
    let eocdOffset = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
      if (buffer.readUInt32LE(i) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset >= 0) {
      const cdEntries = buffer.readUInt16LE(eocdOffset + 10);
      let cdOffset = buffer.readUInt32LE(eocdOffset + 16);
      for (let e = 0; e < cdEntries && cdOffset + 46 <= buffer.length; e++) {
        if (buffer.readUInt32LE(cdOffset) !== 0x02014b50) break;
        const compMethod = buffer.readUInt16LE(cdOffset + 10);
        const compSize = buffer.readUInt32LE(cdOffset + 20);
        const fnLen = buffer.readUInt16LE(cdOffset + 28);
        const exLen = buffer.readUInt16LE(cdOffset + 30);
        const cmLen = buffer.readUInt16LE(cdOffset + 32);
        const localHeaderOffset = buffer.readUInt32LE(cdOffset + 42);
        const fn = buffer.subarray(cdOffset + 46, cdOffset + 46 + fnLen).toString('utf8');

        if (fn.endsWith('.xml') && localHeaderOffset + 30 <= buffer.length) {
          const lFnLen = buffer.readUInt16LE(localHeaderOffset + 26);
          const lExLen = buffer.readUInt16LE(localHeaderOffset + 28);
          const dStart = localHeaderOffset + 30 + lFnLen + lExLen;
          const dEnd = dStart + compSize;
          if (dEnd <= buffer.length) {
            try {
              const rawSlice = buffer.subarray(dStart, dEnd);
              const xmlStr =
                compMethod === 0
                  ? rawSlice.toString('utf8')
                  : compMethod === 8
                  ? inflateRawSync(rawSlice).toString('utf8')
                  : '';
              if (xmlStr) files.set(fn.replace(/\\/g, '/'), xmlStr);
            } catch {}
          }
        }
        cdOffset += 46 + fnLen + exLen + cmLen;
      }
    }
  }

  const decodeXmlEntities = (str: string) =>
    str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#10;/g, '\n')
      .replace(/&#13;/g, '');

  // 1. Parse Shared Strings (`xl/sharedStrings.xml`)
  const sharedStrings: string[] = [];
  const sstXml = files.get('xl/sharedStrings.xml') || '';
  if (sstXml) {
    const siMatches = sstXml.match(/<si[\s>][\s\S]*?<\/si>/gi) || [];
    siMatches.forEach((si) => {
      const tMatches = si.match(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/gi) || [];
      const text = tMatches
        .map((t) => decodeXmlEntities(t.replace(/<[^>]+>/g, '')))
        .join('');
      sharedStrings.push(text);
    });
  }

  // 2. Parse Sheet Names (`xl/workbook.xml`)
  const sheetNames: string[] = [];
  const wbXml = files.get('xl/workbook.xml') || '';
  if (wbXml) {
    const sheetTags = wbXml.match(/<sheet\s+[^>]*?>/gi) || [];
    sheetTags.forEach((tag) => {
      const m = tag.match(/name="([^"]+)"/i);
      if (m && m[1]) sheetNames.push(decodeXmlEntities(m[1]));
    });
  }

  // 3. Parse Worksheets (`xl/worksheets/sheet1.xml`, etc.)
  const worksheetKeys = Array.from(files.keys())
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || '1', 10);
      const nb = parseInt(b.match(/\d+/)?.[0] || '1', 10);
      return na - nb;
    });

  const colLettersToIndex = (letters: string): number => {
    let col = 0;
    for (let i = 0; i < letters.length; i++) {
      col = col * 26 + (letters.toUpperCase().charCodeAt(i) - 64);
    }
    return Math.max(0, col - 1);
  };

  const allHeadersSet = new Set<string>();
  const allRows: ParsedSheetRow[] = [];

  worksheetKeys.forEach((wsKey, sheetIdx) => {
    const wsXml = files.get(wsKey) || '';
    const sheetName = sheetNames[sheetIdx] || `Sheet${sheetIdx + 1}`;
    const rowMatches = wsXml.match(/<row[\s>][\s\S]*?<\/row>/gi) || [];
    const matrix: string[][] = [];

    rowMatches.forEach((rowXml) => {
      const cellMatches = rowXml.match(/<c[\s>][\s\S]*?(?:<\/c>|\/>)/gi) || [];
      if (cellMatches.length === 0) return;

      const rowCells: string[] = [];
      cellMatches.forEach((cellXml, fallbackIdx) => {
        const refMatch = cellXml.match(/\br="([A-Z]+)\d+"/i);
        const colIdx = refMatch ? colLettersToIndex(refMatch[1]) : fallbackIdx;
        const typeMatch = cellXml.match(/\bt="([^"]+)"/i);
        const cellType = typeMatch ? typeMatch[1] : '';

        let val = '';
        if (cellType === 'inlineStr') {
          const tMatches = cellXml.match(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/gi) || [];
          val = tMatches.map((t) => decodeXmlEntities(t.replace(/<[^>]+>/g, ''))).join('');
        } else {
          const vMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/i);
          const rawV = vMatch ? vMatch[1].trim() : '';
          if (cellType === 's') {
            const sstIdx = parseInt(rawV, 10);
            val = !isNaN(sstIdx) && sharedStrings[sstIdx] !== undefined ? sharedStrings[sstIdx] : rawV;
          } else if (cellType === 'b') {
            val = rawV === '1' ? 'true' : 'false';
          } else {
            val = decodeXmlEntities(rawV);
          }
        }

        while (rowCells.length <= colIdx) {
          rowCells.push('');
        }
        rowCells[colIdx] = val.trim();
      });

      if (rowCells.some((c) => c.length > 0)) {
        matrix.push(rowCells);
      }
    });

    if (matrix.length > 0) {
      const sheetHeaders = matrix[0].map((h, i) => h.trim() || `Column_${i + 1}`);
      sheetHeaders.forEach((h) => allHeadersSet.add(h));

      for (let r = 1; r < matrix.length; r++) {
        const cells = matrix[r];
        if (cells.every((c) => !c.trim())) continue;
        const rowObj: ParsedSheetRow = { _sheetName: sheetName };
        sheetHeaders.forEach((h, cIdx) => {
          rowObj[h] = (cells[cIdx] || '').trim();
        });
        allRows.push(rowObj);
      }
    }
  });

  return {
    headers: Array.from(allHeadersSet),
    rows: allRows,
    sheetNames: sheetNames.length > 0 ? sheetNames : ['Sheet1'],
  };
}

export async function POST(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['platform_owner', 'branch_manager']);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { action } = body;

    // 1. Parse uploaded file (XLSX, XLS, CSV, TSV, JSON)
    if (action === 'parse_file') {
      const { fileName = 'sheet.xlsx', base64Content = '', textContent = '' } = body;

      if (textContent && !base64Content) {
        const parsed = parseDelimitedText(textContent, fileName.replace(/\.[^.]+$/, ''));
        return NextResponse.json({ success: true, ...parsed });
      }

      const rawBase64 = base64Content.includes(',')
        ? base64Content.split(',')[1]
        : base64Content;
      const buffer = Buffer.from(rawBase64, 'base64');

      // Check ZIP magic bytes (PK\x03\x04 -> 0x04034b50) for .xlsx
      if (buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50) {
        const parsedXlsx = parseXlsxBuffer(buffer);
        return NextResponse.json({ success: true, ...parsedXlsx });
      }

      // Otherwise treat as UTF-8 CSV / TSV / XML / HTML .xls
      const decodedText = buffer.toString('utf8');
      const parsedText = parseDelimitedText(decodedText, fileName.replace(/\.[^.]+$/, ''));
      return NextResponse.json({ success: true, ...parsedText });
    }

    // 2. Commit extracted Categories, Menu Items, Announcements/Deals, Hero Banners & DealCard to PostgreSQL in a single transaction
    if (action === 'commit_import') {
      const {
        categories = [],
        menuItems = [],
        announcements = [],
        heroBanners = [],
        dealCard = null,
      } = body;

      await withTransaction(async (client) => {
        // A. Insert Categories
        for (const catName of categories) {
          if (!catName || typeof catName !== 'string') continue;
          const catId = `cat-${catName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          await client.query(
            `INSERT INTO categories (id, name, display_order)
             VALUES ($1, $2, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM categories))
             ON CONFLICT (name) DO NOTHING`,
            [catId, catName.trim()]
          );
        }

        // B. Insert / Update Menu Items
        for (const item of menuItems) {
          if (!item || !item.name || !item.category) continue;
          const itemId = item.id || `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          await client.query(
            `INSERT INTO menu_items (
               id, name, category, description, base_price, image,
               is_available, branch_availability, branch_price_overrides,
               sizes, extras
             ) VALUES (
               $1, $2, $3, $4, $5, $6,
               $7, $8::jsonb, $9::jsonb,
               $10::jsonb, $11::jsonb
             ) ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               category = EXCLUDED.category,
               description = EXCLUDED.description,
               base_price = EXCLUDED.base_price,
               image = EXCLUDED.image,
               is_available = EXCLUDED.is_available,
               branch_availability = EXCLUDED.branch_availability,
               branch_price_overrides = EXCLUDED.branch_price_overrides,
               sizes = EXCLUDED.sizes,
               extras = EXCLUDED.extras,
               updated_at = CURRENT_TIMESTAMP`,
            [
              itemId,
              item.name,
              item.category,
              item.description || '',
              Number(item.basePrice) || 0,
              item.image || '/food-biryani.jpg',
              Boolean(item.isAvailable ?? true),
              JSON.stringify(item.branchAvailability || {}),
              JSON.stringify(item.branchPriceOverrides || {}),
              JSON.stringify(item.sizes || []),
              JSON.stringify(item.extras || []),
            ]
          );
        }

        // C. Insert Announcements / Deals
        for (const ann of announcements) {
          if (!ann || !ann.title) continue;
          const annId = ann.id || `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          await client.query(
            `INSERT INTO announcements (
               id, title, tag, description, valid_until, branch_id, branch_name, badge_color
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
               title = EXCLUDED.title,
               tag = EXCLUDED.tag,
               description = EXCLUDED.description,
               valid_until = EXCLUDED.valid_until,
               branch_id = EXCLUDED.branch_id,
               branch_name = EXCLUDED.branch_name,
               badge_color = EXCLUDED.badge_color`,
            [
              annId,
              ann.title,
              ann.tag || 'HOT DEAL',
              ann.description || '',
              ann.validUntil || 'Valid this week',
              ann.branchId || null,
              ann.branchName || null,
              ann.badgeColor || '#EF4444',
            ]
          );
        }

        // D. Insert Hero Banners
        for (const banner of heroBanners) {
          if (!banner || !banner.title) continue;
          const bannerId = banner.id || `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          await client.query(
            `INSERT INTO hero_banners (id, title, subtitle, badge, image_url, category_link, active)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET
               title = EXCLUDED.title,
               subtitle = EXCLUDED.subtitle,
               badge = EXCLUDED.badge,
               image_url = EXCLUDED.image_url,
               category_link = EXCLUDED.category_link,
               active = EXCLUDED.active`,
            [
              bannerId,
              banner.title,
              banner.subtitle || '',
              banner.badge || 'SPECIAL',
              banner.imageUrl || '/hero-bg.jpg',
              banner.categoryLink || 'Biryani & Rice',
              banner.active !== false,
            ]
          );
        }

        // E. Update Deal Card if provided
        if (dealCard && dealCard.title) {
          await client.query(
            `INSERT INTO deal_cards (id, title, subtitle, price, tag, image_url, category_link)
             VALUES ('default-deal', $1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               title = EXCLUDED.title,
               subtitle = EXCLUDED.subtitle,
               price = EXCLUDED.price,
               tag = EXCLUDED.tag,
               image_url = EXCLUDED.image_url,
               category_link = EXCLUDED.category_link`,
            [
              dealCard.title,
              dealCard.subtitle || '',
              dealCard.price || 'Rs. 1,450',
              dealCard.tag || 'CHEF SPECIAL',
              dealCard.imageUrl || '/food-biryani.jpg',
              dealCard.categoryLink || 'Biryani & Rice',
            ]
          );
        }
      });

      await Promise.all([
        cacheInvalidatePrefix('menu:'),
        cacheInvalidatePrefix('marketing:'),
        cacheInvalidatePrefix('announcements:'),
        cacheInvalidatePrefix('catalog:'),
      ]);

      try {
        broadcastRealtimeEvent({ type: 'MENU_UPDATED' });
      } catch {}

      return NextResponse.json({
        success: true,
        importedCategories: categories.length,
        importedMenuItems: menuItems.length,
        importedAnnouncements: announcements.length,
        importedBanners: heroBanners.length,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Sheet import failed', details: err?.message },
      { status: 500 }
    );
  }
}

