'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import {
  parseDelimitedText,
  autoDetectColumnMapping,
  extractStructuredDataFromSheet,
  SAMPLE_SHEET_CSV,
  ParsedSheetRow,
  SheetColumnMapping,
} from '@/lib/sheetParser';
import {
  FileSpreadsheet,
  Upload,
  Sparkles,
  Check,
  X,
  Download,
  Layers,
  UtensilsCrossed,
  Megaphone,
  Sliders,
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  RefreshCw,
} from 'lucide-react';

interface SheetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SheetImportModal: React.FC<SheetImportModalProps> = ({ isOpen, onClose }) => {
  const {
    categories,
    menuItems,
    currentRole,
    currentBranch,
    addCategory,
    addMenuItem,
    updateMenuItem,
    addAnnouncement,
    addHeroBanner,
    updateDealCard,
    addToast,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState<string>('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<ParsedSheetRow[]>([]);
  const [pastedText, setPastedText] = useState<string>('');
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);

  // Design & Fetch Instructions
  const [designInstructions, setDesignInstructions] = useState<string>(
    'Auto-detect all categories from sheet, create missing categories, populate dishes with prices & descriptions, and publish Deal/Announcement rows.'
  );

  // Column Mapping State
  const [columnMapping, setColumnMapping] = useState<SheetColumnMapping>({
    recordTypeCol: '',
    nameCol: '',
    categoryCol: '',
    priceCol: '',
    descriptionCol: '',
    imageCol: '',
    availableCol: '',
    gulbergPriceCol: '',
    f7PriceCol: '',
    cliftonPriceCol: '',
    tagCol: '',
    validityCol: '',
    branchScopeCol: '',
  });

  const [showMappingEditor, setShowMappingEditor] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [activePreviewCategory, setActivePreviewCategory] = useState<string>('ALL');

  const isManager = currentRole === 'branch_manager';

  // Apply parsed result and auto-detect column mapping
  const applyParsedSheet = (
    parsedHeaders: string[],
    parsedRows: ParsedSheetRow[],
    parsedSheets: string[],
    sourceLabel: string
  ) => {
    setHeaders(parsedHeaders);
    setRawRows(parsedRows);
    setSheetNames(parsedSheets);
    setFileName(sourceLabel);
    const detected = autoDetectColumnMapping(parsedHeaders, designInstructions);
    setColumnMapping(detected);
    setActivePreviewCategory('ALL');
  };

  // Handle File Upload (.xlsx, .xls, .csv, .tsv, .json)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (ext === 'xlsx' || ext === 'xls') {
        // Read as base64 and send to /api/sheets/import for native binary .xlsx / .xls parsing
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });

        const res = await fetch('/api/sheets/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'parse_file',
            fileName: file.name,
            base64Content: base64,
          }),
        });
        const data = await res.json();
        if (res.ok && data.rows && data.rows.length > 0) {
          applyParsedSheet(data.headers || [], data.rows || [], data.sheetNames || ['Sheet1'], file.name);
          addToast({
            type: 'success',
            title: 'Spreadsheet Loaded',
            message: `Parsed ${data.rows.length} rows across ${(data.sheetNames || ['Sheet1']).length} sheet(s) from ${file.name}.`,
          });
        } else {
          // Fallback: try reading as text
          const text = await file.text();
          const fallback = parseDelimitedText(text, file.name);
          applyParsedSheet(fallback.headers, fallback.rows, fallback.sheetNames, file.name);
        }
      } else {
        const text = await file.text();
        const parsed = parseDelimitedText(text, file.name.replace(/\.[^.]+$/, ''));
        applyParsedSheet(parsed.headers, parsed.rows, parsed.sheetNames, file.name);
        addToast({
          type: 'success',
          title: 'Sheet Parsed',
          message: `Extracted ${parsed.rows.length} rows from ${file.name}.`,
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Failed to Read Sheet',
        message: err?.message || 'Please check the file format (.xlsx, .xls, .csv, .tsv).',
      });
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Paste from Excel / Google Sheets
  const handleApplyPastedText = () => {
    if (!pastedText.trim()) return;
    const parsed = parseDelimitedText(pastedText, 'Pasted Sheet');
    if (parsed.rows.length === 0) {
      addToast({
        type: 'warning',
        title: 'No Rows Detected',
        message: 'Make sure the first line has column headers followed by data rows.',
      });
      return;
    }
    applyParsedSheet(parsed.headers, parsed.rows, parsed.sheetNames, 'Pasted Excel / Google Sheet');
    setShowPasteBox(false);
    addToast({
      type: 'success',
      title: 'Sheet Data Parsed',
      message: `Loaded ${parsed.rows.length} rows from pasted spreadsheet data.`,
    });
  };

  // Load Built-in Multi-Category Sample Sheet
  const handleLoadSampleSheet = () => {
    const parsed = parseDelimitedText(SAMPLE_SHEET_CSV, 'FoodiesCafe_Master_Sheet');
    applyParsedSheet(parsed.headers, parsed.rows, parsed.sheetNames, 'FoodiesCafe_Sample_Catalog.xlsx');
    addToast({
      type: 'info',
      title: 'Sample Sheet Loaded',
      message: 'Loaded sample multi-category dishes & deals sheet. Review categories below and click Populate!',
    });
  };

  // Download Sample CSV/Excel Template
  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_SHEET_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'FoodiesCafe_Sheet_Import_Template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Re-run auto-detect when user clicks "Re-Apply Instructions"
  const handleReapplyInstructions = () => {
    if (headers.length > 0) {
      const updatedMap = autoDetectColumnMapping(headers, designInstructions);
      setColumnMapping(updatedMap);
      addToast({
        type: 'info',
        title: 'Design Instructions Applied',
        message: 'Updated field extraction and category grouping based on your instructions.',
      });
    }
  };

  // Live extracted catalog based on current rows, mapping, and design instructions
  const extractedCatalog = useMemo(() => {
    if (rawRows.length === 0) return null;
    return extractStructuredDataFromSheet(rawRows, columnMapping, categories, menuItems, {
      designInstructions,
      role: currentRole,
      activeBranchId: isManager ? currentBranch.id : 'all',
    });
  }, [rawRows, columnMapping, categories, menuItems, designInstructions, currentRole, isManager, currentBranch.id]);

  // Execute Import: Populate all categories, menu items, deals, announcements, and banners
  const handleCommitImport = async () => {
    if (!extractedCatalog) return;
    setIsImporting(true);

    try {
      // 1. Create any new categories in AppContext
      extractedCatalog.categoriesToCreate.forEach((newCat) => {
        addCategory(newCat);
      });

      // 2. Add or Update Menu Items in AppContext
      extractedCatalog.menuItems.forEach(({ item, isUpdate }) => {
        if (isUpdate) {
          updateMenuItem(item);
        } else {
          addMenuItem(item);
        }
      });

      // 3. Add Announcements / Deals
      for (const ann of extractedCatalog.announcements) {
        await addAnnouncement(ann);
      }

      // 4. Add Hero Banners
      extractedCatalog.heroBanners.forEach((b) => {
        addHeroBanner(b);
      });

      // 5. Update Deal Card if extracted
      if (extractedCatalog.dealCard) {
        updateDealCard(extractedCatalog.dealCard);
      }

      // 6. Send single batch persistence request to PostgreSQL /api/sheets/import
      await fetch('/api/sheets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'commit_import',
          categories: extractedCatalog.allCategoriesInSheet,
          menuItems: extractedCatalog.menuItems.map((m) => m.item),
          announcements: extractedCatalog.announcements,
          heroBanners: extractedCatalog.heroBanners,
          dealCard: extractedCatalog.dealCard,
        }),
      }).catch(() => {});

      addToast({
        type: 'success',
        title: 'All Categories & Data Populated!',
        message: `Imported ${extractedCatalog.menuItems.length} dishes across ${extractedCatalog.allCategoriesInSheet.length} categories (${extractedCatalog.categoriesToCreate.length} new) and ${extractedCatalog.summary.dealsAndAnnouncementsCount} deals.`,
      });

      onClose();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Import Error',
        message: err?.message || 'Failed to populate data from sheet.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  const filteredPreviewItems =
    extractedCatalog?.menuItems.filter(
      (m) => activePreviewCategory === 'ALL' || m.item.category === activePreviewCategory
    ) || [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 12, 10, 0.58)',
        backdropFilter: 'blur(5px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '22px',
          border: '1px solid var(--border-color)',
          width: '100%',
          maxWidth: '940px',
          maxHeight: '92vh',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card-subtle)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 850, margin: 0, color: 'var(--text-main)' }}>
                Smart Excel & Spreadsheet Auto-Category Importer
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                {isManager
                  ? `Branch Manager Scope (${currentBranch.name}) • Auto-Fetch Categories, Dishes & Deals`
                  : 'Platform Owner Enterprise Scope • Auto-Fetch Categories, Dishes, Branch Prices & Deals'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-muted)',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '18px 22px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* STEP 1: Upload Excel / CSV / Paste / Sample */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '12px',
            }}
          >
            {/* Upload Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--primary)',
                borderRadius: '14px',
                padding: '16px',
                backgroundColor: 'var(--primary-light)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt,.json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Upload size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                  {isParsing ? 'Reading Spreadsheet...' : fileName ? `Loaded: ${fileName}` : 'Upload Excel / Sheet Document'}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Supports <strong>.xlsx, .xls, .csv, .tsv</strong> & multi-sheet workbooks
                </div>
              </div>
            </div>

            {/* Quick Actions: Paste from Excel / Google Sheets, Load Sample, Download Template */}
            <div
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '14px',
                backgroundColor: 'var(--bg-card-subtle)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                Quick Sheet Sources & Templates:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowPasteBox((v) => !v)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: showPasteBox ? 'var(--primary)' : 'var(--bg-card)',
                    color: showPasteBox ? '#FFFFFF' : 'var(--text-main)',
                    fontSize: '12px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ClipboardPaste size={14} />
                  <span>Paste Excel / Google Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadSampleSheet}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--primary)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--primary)',
                    fontSize: '12px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Sparkles size={14} />
                  <span>Load Sample Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Download size={14} />
                  <span>Template (.csv)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Optional Paste Box for Direct Copy-Paste from Excel or Google Sheets */}
          {showPasteBox && (
            <div
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '14px',
                backgroundColor: 'var(--bg-card-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Paste Cells Directly from Excel, Google Sheets, or CSV:
                </span>
                <button
                  type="button"
                  onClick={() => setPastedText(SAMPLE_SHEET_CSV)}
                  style={{
                    fontSize: '11.5px',
                    color: 'var(--primary)',
                    background: 'none',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Fill Example Data
                </button>
              </div>
              <textarea
                rows={5}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Copy rows from Excel or Google Sheets (including the header row) and paste here..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '12.5px',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowPasteBox(false)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyPastedText}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Parse Pasted Sheet
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Design & Fetch Instructions Box */}
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '14px 16px',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="var(--primary)" />
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Design & Data Fetch Instructions (Tell the System How to Map & Populate Categories)
                </span>
              </div>

              {headers.length > 0 && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowMappingEditor((v) => !v)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: showMappingEditor ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                      color: showMappingEditor ? 'var(--primary)' : 'var(--text-main)',
                      fontSize: '11.5px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Sliders size={13} />
                    <span>{showMappingEditor ? 'Hide Column Mapper' : 'Customize Column Mapping'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleReapplyInstructions}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--primary)',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      fontSize: '11.5px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Apply Design Rules</span>
                  </button>
                </div>
              )}
            </div>

            <input
              type="text"
              value={designInstructions}
              onChange={(e) => setDesignInstructions(e.target.value)}
              placeholder="e.g. Fetch dish name from 'Item', price from 'Rate', group by 'Category', default category: Chef Specials, increase price by 10%..."
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '9px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '12.5px',
                boxSizing: 'border-box',
              }}
            />

            {/* Preset Instruction Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                {
                  label: '⚡ Auto-Fetch All Categories, Dishes & Deals',
                  text: 'Auto-detect all categories from sheet, create missing categories, populate dishes with prices & descriptions, and publish Deal/Announcement rows.',
                },
                {
                  label: '🍽️ Dishes Only (Ignore Deals)',
                  text: 'Import all rows as menu items grouped by category.',
                },
                {
                  label: '🏢 Apply Prices to My Branch Only',
                  text: 'Apply imported prices and stock availability to my current branch only.',
                },
                {
                  label: '📈 +10% Price Markup',
                  text: 'Auto-detect all categories and increase price by 10%.',
                },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setDesignInstructions(preset.text)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: designInstructions === preset.text ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                    color: designInstructions === preset.text ? 'var(--primary)' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Interactive Column Mapping Overrides */}
            {showMappingEditor && headers.length > 0 && (
              <div
                style={{
                  marginTop: '6px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
                  gap: '10px',
                }}
              >
                {[
                  { key: 'nameCol', label: 'Dish Name / Deal Title *' },
                  { key: 'categoryCol', label: 'Food Category Column *' },
                  { key: 'priceCol', label: 'Base Price (PKR) *' },
                  { key: 'descriptionCol', label: 'Description / Recipe' },
                  { key: 'availableCol', label: 'Stock / Availability' },
                  { key: 'imageCol', label: 'Image / Photo URL' },
                  { key: 'recordTypeCol', label: 'Record Type (Dish/Deal)' },
                  { key: 'gulbergPriceCol', label: 'Gulberg Branch Price' },
                  { key: 'f7PriceCol', label: 'F-7 Islamabad Price' },
                  { key: 'cliftonPriceCol', label: 'Clifton Karachi Price' },
                  { key: 'tagCol', label: 'Deal / Promo Tag' },
                  { key: 'validityCol', label: 'Deal Validity' },
                ].map((field) => (
                  <div key={field.key}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 750, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {field.label}
                    </label>
                    <select
                      value={columnMapping[field.key as keyof SheetColumnMapping] || ''}
                      onChange={(e) =>
                        setColumnMapping((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '7px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-main)',
                        color: 'var(--text-main)',
                        fontSize: '12px',
                        fontWeight: 650,
                      }}
                    >
                      <option value="">-- Auto / None --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* STEP 3: Categorized Live Preview */}
          {!extractedCatalog ? (
            <div
              style={{
                border: '1px dashed var(--border-color)',
                borderRadius: '14px',
                padding: '36px 20px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-card-subtle)',
              }}
            >
              <FileSpreadsheet size={38} color="var(--text-muted)" style={{ margin: '0 auto 10px', opacity: 0.55 }} />
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                No Spreadsheet Loaded Yet
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '520px', margin: '4px auto 14px' }}>
                Upload an Excel (<code>.xlsx</code>, <code>.xls</code>) or <code>.csv</code> document, paste cells from Google Sheets, or click <strong>Load Sample Sheet</strong> to see automatic category extraction in action.
              </p>
              <button
                type="button"
                onClick={handleLoadSampleSheet}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px var(--primary-glow)',
                }}
              >
                <Sparkles size={15} />
                <span>Load Sample Multi-Category Sheet Now</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Summary KPIs */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Categories Populated</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--primary)', marginTop: '2px' }}>
                    {extractedCatalog.allCategoriesInSheet.length}{' '}
                    {extractedCatalog.summary.newCategoriesCount > 0 && (
                      <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 800 }}>
                        (+{extractedCatalog.summary.newCategoriesCount} New)
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>New Dishes to Add</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#16A34A', marginTop: '2px' }}>
                    {extractedCatalog.summary.newDishesCount}
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Existing Dishes Updated</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#D97706', marginTop: '2px' }}>
                    {extractedCatalog.summary.updatedDishesCount}
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Deals & Announcements</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
                    {extractedCatalog.summary.dealsAndAnnouncementsCount + extractedCatalog.summary.bannersCount}
                  </div>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                <button
                  type="button"
                  onClick={() => setActivePreviewCategory('ALL')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '999px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: activePreviewCategory === 'ALL' ? 'var(--primary)' : 'var(--bg-card-subtle)',
                    color: activePreviewCategory === 'ALL' ? '#FFFFFF' : 'var(--text-main)',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  All Categories ({extractedCatalog.menuItems.length})
                </button>
                {extractedCatalog.allCategoriesInSheet.map((cat) => {
                  const count = extractedCatalog.menuItems.filter((m) => m.item.category === cat).length;
                  const isNewCat = extractedCatalog.categoriesToCreate.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActivePreviewCategory(cat)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '999px',
                        border: isNewCat ? '1px solid #16A34A' : '1px solid var(--border-color)',
                        backgroundColor: activePreviewCategory === cat ? 'var(--primary)' : 'var(--bg-card)',
                        color: activePreviewCategory === cat ? '#FFFFFF' : 'var(--text-main)',
                        fontSize: '12px',
                        fontWeight: 750,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Layers size={12} />
                      <span>
                        {cat} ({count})
                      </span>
                      {isNewCat && (
                        <span
                          style={{
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: activePreviewCategory === cat ? '#FFFFFF' : '#DCFCE7',
                            color: '#15803D',
                            fontSize: '10px',
                            fontWeight: 900,
                          }}
                        >
                          + NEW CATEGORY
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Preview Table of Dishes */}
              {filteredPreviewItems.length > 0 && (
                <div
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    maxHeight: '240px',
                    overflowY: 'auto',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card-subtle)', zIndex: 2 }}>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                        <th style={{ padding: '8px 12px' }}>Action</th>
                        <th style={{ padding: '8px 12px' }}>Dish Name</th>
                        <th style={{ padding: '8px 12px' }}>Category</th>
                        <th style={{ padding: '8px 12px' }}>Price</th>
                        <th style={{ padding: '8px 12px' }}>Branch Overrides</th>
                        <th style={{ padding: '8px 12px' }}>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPreviewItems.map(({ item, isUpdate }, idx) => (
                        <tr key={`${item.id}-${idx}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <span
                              style={{
                                padding: '2px 7px',
                                borderRadius: '6px',
                                fontSize: '10.5px',
                                fontWeight: 800,
                                backgroundColor: isUpdate ? '#FEF3C7' : '#DCFCE7',
                                color: isUpdate ? '#B45309' : '#15803D',
                              }}
                            >
                              {isUpdate ? 'UPDATE' : '+ NEW'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 750, color: 'var(--text-main)' }}>
                            <div>{item.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.description}
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--primary)' }}>
                            {item.category}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-main)' }}>
                            Rs. {item.basePrice.toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {item.branchPriceOverrides && Object.keys(item.branchPriceOverrides).length > 0
                              ? Object.entries(item.branchPriceOverrides)
                                  .map(([bId, p]) => `${bId.split('-')[0].toUpperCase()}: Rs.${p}`)
                                  .join(' • ')
                              : 'Standard'}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 800,
                                color: item.isAvailable ? '#16A34A' : '#DC2626',
                              }}
                            >
                              {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Preview of Extracted Deals & Announcements */}
              {extractedCatalog.announcements.length > 0 && (
                <div
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '12px',
                    backgroundColor: 'var(--bg-card-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                    <Megaphone size={15} color="var(--primary)" />
                    <span>Deals & Announcements to Publish ({extractedCatalog.announcements.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {extractedCatalog.announcements.map((ann, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: ann.badgeColor || 'var(--primary)',
                              color: '#FFFFFF',
                              fontSize: '10px',
                              fontWeight: 800,
                            }}
                          >
                            {ann.tag}
                          </span>
                          <span style={{ fontWeight: 750, color: 'var(--text-main)' }}>{ann.title}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {ann.validUntil}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {extractedCatalog
              ? `Ready to populate ${extractedCatalog.allCategoriesInSheet.length} categories, ${extractedCatalog.menuItems.length} dishes & ${extractedCatalog.summary.dealsAndAnnouncementsCount} deals.`
              : 'Select an Excel/CSV file or load the sample sheet to preview.'}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!extractedCatalog || isImporting}
              onClick={handleCommitImport}
              style={{
                padding: '10px 22px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: extractedCatalog ? 'var(--primary)' : 'var(--border-color)',
                color: '#FFFFFF',
                fontSize: '13.5px',
                fontWeight: 850,
                cursor: extractedCatalog ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: extractedCatalog ? '0 4px 14px var(--primary-glow)' : 'none',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{isImporting ? 'Populating All Categories...' : 'Fetch & Populate All Categories'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

