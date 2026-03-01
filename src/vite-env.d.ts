/// <reference types="vite/client" />

type ModuleType = 'corp_income' | 'vat' | 'personal_income' | 'labor_nhi' | 'withholding';

interface CalculationPayload {
  moduleType: ModuleType;
  year: number;
  input: Record<string, number>;
}

interface CalculationRecord {
  clientId?: number;
  moduleType: ModuleType;
  year: number;
  payload: Record<string, number>;
  result: unknown;
}

interface TaxClient {
  id: number;
  tax_id: string;
  name: string;
  type: string;
  created_at: string;
}

interface LawResult {
  id: number;
  law_name: string;
  article_number: string;
  title: string;
  content: string;
}

interface DashboardStats {
  clients: number;
  history: number;
  laws: number;
  registryCache?: number;
}

interface Window {
  electronAPI: {
    listClients: () => Promise<TaxClient[]>;
    createClient: (client: { taxId: string; name: string; type?: string }) => Promise<TaxClient>;
    runCalculation: (payload: CalculationPayload) => Promise<unknown>;
    saveCalculation: (record: CalculationRecord) => Promise<{ id: number }>;
    listHistory: (clientId?: number) => Promise<any[]>;
    searchLaws: (keyword: string) => Promise<LawResult[]>;
    getDashboardStats: () => Promise<DashboardStats>;
    lookupRegistryByTaxId: (taxId: string) => Promise<{ ok: boolean; cached?: boolean; message?: string; data?: any }>;
    getCachedRegistryByTaxId: (taxId: string) => Promise<{ ok: boolean; data?: any }>;
    syncRegistryForAllClients: () => Promise<{ ok: boolean; total: number; success: number; failed: number; details: Array<{ taxId: string; ok: boolean; source: string; message?: string }> }>;
    syncRegistryByTaxIds: (taxIds: string[]) => Promise<{ ok: boolean; total: number; success: number; failed: number; details: Array<{ taxId: string; ok: boolean; source: string; message?: string }> }>;
    exportPdf: (input: unknown) => Promise<{ ok: boolean; filePath?: string; message?: string }>;
    exportExcel: (input: unknown) => Promise<{ ok: boolean; filePath?: string; message?: string }>;
    verifyUpdate: (zipPath: string) => Promise<{ ok: boolean; message: string; manifest?: any }>;
    applyUpdate: (zipPath: string) => Promise<{ ok: boolean; message: string; manifest?: any }>;
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
