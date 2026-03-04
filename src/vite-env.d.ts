/// <reference types="vite/client" />

type ModuleType = 'corp_income' | 'vat' | 'personal_income' | 'labor_nhi' | 'withholding';

interface CalculationPayload {
  moduleType: ModuleType;
  year: number;
  input: Record<string, number>;
}

interface CalculationResult {
  year: number;
  moduleType: string;
  summary: Record<string, number>;
  steps: string[];
  legalBasis?: string[];
}

interface CalculationRecord {
  clientId?: number;
  moduleType: ModuleType;
  year: number;
  payload: Record<string, number>;
  result: CalculationResult;
}

interface TaxClient {
  id: number;
  tax_id: string;
  name: string;
  type: string;
  created_at: string;
}

interface HistoryRow {
  id: number;
  client_id: number | null;
  module_type: string;
  year: number;
  payload: string;
  result: string;
  created_at: string;
}

interface LawResult {
  id: number;
  law_name: string;
  article_number: string;
  title: string;
  content: string;
}

interface PublicRegistryItem {
  seqNo?: string;
  itemCode?: string;
  itemDesc?: string;
  seq_no?: string;
  item_code?: string;
  item_desc?: string;
}

interface PublicRegistryData {
  taxId?: string;
  tax_id?: string;
  entityType?: string;
  entity_type?: string;
  entityName?: string;
  entity_name?: string;
  statusDesc?: string;
  status_desc?: string;
  responsibleName?: string;
  responsible_name?: string;
  address?: string;
  authorityDesc?: string;
  authority_desc?: string;
  setupDate?: string;
  setup_date?: string;
  latestChangeDate?: string;
  latest_change_date?: string;
  businessItems?: PublicRegistryItem[];
  business_items?: PublicRegistryItem[];
}

interface DashboardStats {
  clients: number;
  history: number;
  laws: number;
  registryCache?: number;
}

declare global {
  interface Window {
    electronAPI: {
      listClients: () => Promise<TaxClient[]>;
      createClient: (client: { taxId: string; name: string; type?: string }) => Promise<TaxClient>;
      runCalculation: (payload: CalculationPayload) => Promise<CalculationResult>;
      saveCalculation: (record: CalculationRecord) => Promise<{ id: number }>;
      listHistory: (clientId?: number) => Promise<HistoryRow[]>;
      searchLaws: (query: { keyword?: string; lawName?: string }) => Promise<LawResult[]>;
      listLawNames: () => Promise<string[]>;
      getDashboardStats: () => Promise<DashboardStats>;
      lookupRegistryByTaxId: (taxId: string) => Promise<{ ok: boolean; cached?: boolean; message?: string; data?: PublicRegistryData }>;
      getCachedRegistryByTaxId: (taxId: string) => Promise<{ ok: boolean; data?: PublicRegistryData }>;
      syncRegistryForAllClients: () => Promise<{ ok: boolean; total: number; success: number; failed: number; details: Array<{ taxId: string; ok: boolean; source: string; message?: string }> }>;
      syncRegistryByTaxIds: (taxIds: string[]) => Promise<{ ok: boolean; total: number; success: number; failed: number; details: Array<{ taxId: string; ok: boolean; source: string; message?: string }> }>;
      exportPdf: (input: unknown) => Promise<{ ok: boolean; filePath?: string; message?: string }>;
      exportExcel: (input: unknown) => Promise<{ ok: boolean; filePath?: string; message?: string }>;
      verifyUpdate: (zipPath: string) => Promise<{ ok: boolean; message: string; manifest?: Record<string, unknown> }>;
      applyUpdate: (zipPath: string) => Promise<{ ok: boolean; message: string; manifest?: Record<string, unknown> }>;
      getDataPath: () => Promise<string>;
      backupDb: () => Promise<{ ok: boolean; backupPath?: string }>;
      downloadOfficialLaborForm: (formKey: string) => Promise<{ ok: boolean; filePath?: string; label?: string; sourceUrl?: string; message?: string }>;
      getLaborFormSchemas: () => Promise<Record<string, { label: string; officialDownloadKeys: string[]; fields: Array<{ key: string; label: string }> }>>;
      exportLaborNhiMappedWord: (formType: string, payload: Record<string, string>) => Promise<{ ok: boolean; filePath?: string; message?: string }>;
      exportLaborNhiDraftWord: (formType: string, payload: Record<string, string>) => Promise<{ ok: boolean; filePath?: string; message?: string }>;
      exportLaborNhiPdf: (formType: string, payload: Record<string, string>) => Promise<{ ok: boolean; filePath?: string; message?: string }>;
      exportLaborNhiOverlayPdf: (formType: string, payload: Record<string, string>) => Promise<{ ok: boolean; filePath?: string; message?: string }>;
    };
  }
}

export {};
