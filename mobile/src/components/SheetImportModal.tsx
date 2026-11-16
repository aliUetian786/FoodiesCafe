import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { KeyboardSafeModal as Modal } from './KeyboardSafeModal';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../services/api';
import {
  parseDelimitedText,
  autoDetectColumnMapping,
  extractStructuredDataFromSheet,
  SheetColumnMapping,
  SAMPLE_SHEET_CSV,
} from '../utils/sheetParser';
import {
  FileSpreadsheet,
  Upload,
  Sparkles,
  CheckCircle2,
  Layers,
  Utensils,
  X,
  RefreshCw,
} from 'lucide-react-native';

interface SheetImportModalProps {
  visible: boolean;
  onClose: () => void;
  activeBranchScope?: string;
}

export function SheetImportModal({
  visible,
  onClose,
  activeBranchScope = 'all',
}: SheetImportModalProps) {
  const { categories, menuItems, role, currentBranch, importSheetCatalog, showToast, setBottomSheetOpen } = useApp();

  useEffect(() => {
    if (!visible) return;
    setBottomSheetOpen(true);
    return () => setBottomSheetOpen(false);
  }, [visible, setBottomSheetOpen]);

  const [sourceMode, setSourceMode] = useState<'paste' | 'sample' | 'upload'>('sample');
  const [fileName, setFileName] = useState<string>('foodies-sample-catalog.xlsx');
  const [rawText, setRawText] = useState<string>(SAMPLE_SHEET_CSV);
  const [parsedFromBinary, setParsedFromBinary] = useState<{
    headers: string[];
    rows: Record<string, string>[];
  } | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [instructions, setInstructions] = useState<string>('');
  const [customMapping, setCustomMapping] = useState<Partial<SheetColumnMapping>>({});

  const targetBranchId = role === 'branch_manager' ? currentBranch.id : activeBranchScope;

  const baseSheetData = useMemo(() => {
    if (parsedFromBinary && parsedFromBinary.headers.length > 0) {
      return parsedFromBinary;
    }
    return parseDelimitedText(rawText);
  }, [rawText, parsedFromBinary]);

  const detectedMapping = useMemo(() => {
    const auto = autoDetectColumnMapping(baseSheetData.headers);
    return { ...auto, ...customMapping };
  }, [baseSheetData.headers, customMapping]);

  const extractionPreview = useMemo(() => {
    if (baseSheetData.headers.length === 0 || baseSheetData.rows.length === 0) {
      return null;
    }
    return extractStructuredDataFromSheet({
      headers: baseSheetData.headers,
      rows: baseSheetData.rows,
      mapping: customMapping,
      instructions,
      existingCategories: categories,
      existingMenuItems: menuItems,
      targetBranchId,
    });
  }, [baseSheetData, customMapping, instructions, categories, menuItems, targetBranchId]);

  const handleWebFilePick = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      setSourceMode('paste');
      showToast('Paste your copied Excel or Google Sheets rows below, or use the Sample Sheet.', 'info');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv,.tsv,.txt,.json';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      setFileName(file.name);
      setIsParsingFile(true);
      setCustomMapping({});
      try {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.xlsx')) {
          const buf = await file.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          const res = await apiFetch('/api/sheets/import', {
            method: 'POST',
            body: JSON.stringify({
              action: 'parse_file',
              fileName: file.name,
              fileBase64: base64,
            }),
          });
          if (res.ok && res.data?.headers?.length > 0) {
            setParsedFromBinary({ headers: res.data.headers, rows: res.data.rows || [] });
            showToast(`Parsed ${res.data.rows?.length || 0} rows from ${file.name}`, 'success');
          } else {
            showToast('Could not parse binary Excel file; try CSV or Paste.', 'warning');
          }
        } else {
          const text = await file.text();
          setParsedFromBinary(null);
          setRawText(text);
          showToast(`Loaded ${file.name}`, 'success');
        }
      } catch {
        showToast('Failed to read file', 'danger');
      } finally {
        setIsParsingFile(false);
      }
    };
    input.click();
  };

  const handleExecuteImport = async () => {
    if (!extractionPreview) return;
    const totalCount =
      extractionPreview.menuItemsToUpsert.length +
      extractionPreview.categoriesToCreate.length +
      extractionPreview.dealsAndBanners.length;

    if (totalCount === 0) {
      showToast('No valid rows found in sheet', 'warning');
      return;
    }

    setIsImporting(true);
    try {
      await importSheetCatalog({
        categories: extractionPreview.allCategoriesInSheet,
        menuItems: extractionPreview.menuItemsToUpsert,
        dealsAndBanners: extractionPreview.dealsAndBanners,
      });
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.iconCircle}>
                <FileSpreadsheet size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Import Excel / Sheet Data</Text>
                <Text style={styles.modalSub}>
                  Auto-detect categories, dishes, prices & deals from your sheet
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            {/* Step 1: Source Selection */}
            <Text style={styles.sectionLabel}>1. SELECT SPREADSHEET SOURCE</Text>
            <View style={styles.modeTabsRow}>
              <TouchableOpacity
                style={[styles.modeTab, sourceMode === 'sample' && styles.modeTabActive]}
                onPress={() => {
                  setSourceMode('sample');
                  setParsedFromBinary(null);
                  setRawText(SAMPLE_SHEET_CSV);
                  setFileName('foodies-sample-catalog.xlsx');
                }}
              >
                <Sparkles size={14} color={sourceMode === 'sample' ? '#FFFFFF' : Colors.primary} />
                <Text style={[styles.modeTabText, sourceMode === 'sample' && styles.modeTabTextActive]}>
                  Sample Sheet
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeTab, sourceMode === 'paste' && styles.modeTabActive]}
                onPress={() => setSourceMode('paste')}
              >
                <FileSpreadsheet size={14} color={sourceMode === 'paste' ? '#FFFFFF' : Colors.primary} />
                <Text style={[styles.modeTabText, sourceMode === 'paste' && styles.modeTabTextActive]}>
                  Paste Excel / CSV
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeTab, sourceMode === 'upload' && styles.modeTabActive]}
                onPress={() => {
                  setSourceMode('upload');
                  handleWebFilePick();
                }}
              >
                <Upload size={14} color={sourceMode === 'upload' ? '#FFFFFF' : Colors.primary} />
                <Text style={[styles.modeTabText, sourceMode === 'upload' && styles.modeTabTextActive]}>
                  Upload File
                </Text>
              </TouchableOpacity>
            </View>

            {sourceMode === 'paste' ? (
              <View style={styles.pasteBoxWrap}>
                <Text style={styles.helperHint}>
                  Copy cells directly from Microsoft Excel, Google Sheets, or CSV and paste below:
                </Text>
                <TextInput
                  style={styles.pasteInput}
                  multiline
                  numberOfLines={5}
                  value={rawText}
                  onChangeText={(txt) => {
                    setParsedFromBinary(null);
                    setRawText(txt);
                  }}
                  placeholder="Type,Dish Name,Category,Base Price,Description..."
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            ) : (
              <View style={styles.activeFileBanner}>
                <CheckCircle2 size={16} color={Colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeFileTitle}>{fileName}</Text>
                  <Text style={styles.activeFileSub}>
                    {isParsingFile
                      ? 'Parsing spreadsheet...'
                      : `${baseSheetData.rows.length} rows • ${baseSheetData.headers.length} columns detected`}
                  </Text>
                </View>
              </View>
            )}

            {/* Step 2: Custom Design & Fetch Instructions */}
            <View style={styles.instructionCard}>
              <View style={styles.instructionHeader}>
                <Sparkles size={15} color={Colors.primary} />
                <Text style={styles.instructionTitle}>2. DESIGN & AUTO-FETCH INSTRUCTIONS</Text>
              </View>
              <Text style={styles.helperHint}>
                Instruct how categories, prices, or columns should be fetched and populated:
              </Text>
              <TextInput
                style={styles.instructionInput}
                multiline
                numberOfLines={2}
                value={instructions}
                onChangeText={setInstructions}
                placeholder='e.g. "Increase all prices by 10%. Default category is Chef Specials."'
                placeholderTextColor={Colors.textMuted}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                {[
                  'Increase all prices by 10%',
                  'Decrease all prices by 5%',
                  'Add Rs. 50 to all prices',
                  'Mark all items available',
                ].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={styles.presetChip}
                    onPress={() =>
                      setInstructions((prev) => (prev ? `${prev}. ${preset}` : preset))
                    }
                  >
                    <Text style={styles.presetChipText}>+ {preset}</Text>
                  </TouchableOpacity>
                ))}
                {instructions.length > 0 && (
                  <TouchableOpacity
                    style={[styles.presetChip, { borderColor: Colors.danger }]}
                    onPress={() => setInstructions('')}
                  >
                    <Text style={[styles.presetChipText, { color: Colors.danger }]}>Clear</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              {extractionPreview && extractionPreview.appliedRulesSummary.length > 0 && (
                <View style={styles.rulesAppliedBox}>
                  {extractionPreview.appliedRulesSummary.map((r, i) => (
                    <Text key={i} style={styles.rulesAppliedText}>
                      ✓ {r}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            {/* Step 3: Auto-Detected Categories & Preview */}
            {extractionPreview && (
              <View style={styles.previewSection}>
                <Text style={styles.sectionLabel}>3. AUTO-FETCHED CATEGORIES & ITEMS PREVIEW</Text>

                {/* Summary KPI Row */}
                <View style={styles.kpiRow}>
                  <View style={styles.kpiBox}>
                    <Text style={styles.kpiVal}>{extractionPreview.allCategoriesInSheet.length}</Text>
                    <Text style={styles.kpiLab}>Categories</Text>
                  </View>
                  <View style={styles.kpiBox}>
                    <Text style={[styles.kpiVal, { color: Colors.success }]}>
                      +{extractionPreview.categoriesToCreate.length}
                    </Text>
                    <Text style={styles.kpiLab}>New Cats</Text>
                  </View>
                  <View style={styles.kpiBox}>
                    <Text style={styles.kpiVal}>{extractionPreview.menuItemsToUpsert.length}</Text>
                    <Text style={styles.kpiLab}>Dishes</Text>
                  </View>
                  <View style={styles.kpiBox}>
                    <Text style={[styles.kpiVal, { color: '#D97706' }]}>
                      {extractionPreview.dealsAndBanners.length}
                    </Text>
                    <Text style={styles.kpiLab}>Deals/Promos</Text>
                  </View>
                </View>

                {/* Category Chips */}
                <View style={styles.catWrap}>
                  {extractionPreview.allCategoriesInSheet.map((cat) => {
                    const isNew = extractionPreview.categoriesToCreate.includes(cat);
                    const count = extractionPreview.menuItemsToUpsert.filter(
                      (m) => m.item.category === cat
                    ).length;
                    return (
                      <View
                        key={cat}
                        style={[
                          styles.previewCatBadge,
                          isNew && styles.previewCatBadgeNew,
                        ]}
                      >
                        <Layers size={12} color={isNew ? Colors.success : Colors.primary} />
                        <Text
                          style={[
                            styles.previewCatText,
                            isNew && { color: Colors.success },
                          ]}
                        >
                          {cat} ({count}) {isNew ? '• NEW' : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Preview Dish Cards */}
                {extractionPreview.menuItemsToUpsert.map(({ action, item }) => (
                  <View key={item.id} style={styles.previewItemRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.previewItemName}>{item.name}</Text>
                        <View
                          style={[
                            styles.actionTag,
                            { backgroundColor: action === 'create' ? '#DCFCE7' : '#DBEAFE' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.actionTagText,
                              { color: action === 'create' ? '#166534' : '#1E40AF' },
                            ]}
                          >
                            {action === 'create' ? 'NEW' : 'UPDATE'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.previewItemCat}>{item.category}</Text>
                    </View>
                    <Text style={styles.previewItemPrice}>Rs. {item.basePrice}</Text>
                  </View>
                ))}

                {/* Preview Deals & Announcements */}
                {extractionPreview.dealsAndBanners.map((d, idx) => (
                  <View key={idx} style={[styles.previewItemRow, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.previewItemName, { color: '#92400E' }]}>
                        ★ {d.title} ({d.rowKind.toUpperCase()})
                      </Text>
                      <Text style={styles.previewItemCat} numberOfLines={1}>
                        {d.subtitle}
                      </Text>
                    </View>
                    <Text style={[styles.previewItemPrice, { color: '#B45309' }]}>{d.price}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer Action Buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importBtn, isImporting && { opacity: 0.6 }]}
              onPress={handleExecuteImport}
              disabled={isImporting}
            >
              {isImporting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <CheckCircle2 size={16} color="#FFFFFF" />
                  <Text style={styles.importBtnText}>Populate All Categories</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  sheetCard: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
    backgroundColor: '#FFF7ED',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textMain,
  },
  modalSub: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  bodyScroll: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
  },
  modeTabActive: {
    backgroundColor: Colors.primary,
  },
  modeTabText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.primary,
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },
  pasteBoxWrap: {
    gap: 6,
  },
  helperHint: {
    fontSize: 11.5,
    color: Colors.textSecondary,
  },
  pasteInput: {
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 10,
    padding: 10,
    fontSize: 11.5,
    color: Colors.textMain,
    backgroundColor: '#F8FAFC',
    minHeight: 90,
    textAlignVertical: 'top',
  },
  activeFileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  activeFileTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  activeFileSub: {
    fontSize: 11.5,
    color: '#15803D',
  },
  instructionCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 6,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  instructionTitle: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#92400E',
  },
  instructionInput: {
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    color: Colors.textMain,
    backgroundColor: '#FFFFFF',
    minHeight: 46,
    textAlignVertical: 'top',
  },
  chipsScroll: {
    gap: 6,
    paddingTop: 4,
  },
  presetChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  presetChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#92400E',
  },
  rulesAppliedBox: {
    marginTop: 4,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    gap: 2,
  },
  rulesAppliedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  previewSection: {
    gap: 8,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiBox: {
    flex: 1,
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.borderColor,
    alignItems: 'center',
  },
  kpiVal: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primary,
  },
  kpiLab: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  catWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewCatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  previewCatBadgeNew: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  previewCatText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  previewItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  previewItemName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.textMain,
  },
  previewItemCat: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  previewItemPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.primary,
  },
  actionTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  actionTagText: {
    fontSize: 9,
    fontWeight: '900',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    backgroundColor: '#F8FAFC',
  },
  cancelBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  importBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  importBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
