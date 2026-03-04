export interface CalculationResult {
  year: number;
  moduleType: string;
  summary: Record<string, number>;
  steps: string[];
  legalBasis?: string[];
}

export interface TaxClient {
  id: number;
  tax_id: string;
  name: string;
  type: string;
  created_at: string;
}

export interface HistoryRow {
  id: number;
  client_id: number | null;
  module_type: string;
  year: number;
  payload: string;
  result: string;
  created_at: string;
}

export interface LawResult {
  id: number;
  law_name: string;
  article_number: string;
  title: string;
  content: string;
}

export interface PublicRegistryItem {
  seqNo?: string;
  itemCode?: string;
  itemDesc?: string;
  seq_no?: string;
  item_code?: string;
  item_desc?: string;
}

export interface PublicRegistryData {
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
