export type ModuleType = 'corp_income' | 'vat' | 'personal_income' | 'labor_nhi' | 'withholding';

export interface ModuleField {
  key: string;
  label: string;
  defaultValue: number;
}

export const moduleConfig: Record<ModuleType, { title: string; fields: ModuleField[] }> = {
  corp_income: {
    title: '營利事業所得稅',
    fields: [
      { key: 'revenue', label: '營業收入淨額', defaultValue: 0 },
      { key: 'cost', label: '營業成本', defaultValue: 0 },
      { key: 'expense', label: '營業費用', defaultValue: 0 },
      { key: 'nonOperatingIncome', label: '非營業收入', defaultValue: 0 },
      { key: 'nonOperatingLoss', label: '非營業損失', defaultValue: 0 },
    ],
  },
  vat: {
    title: '營業稅',
    fields: [
      { key: 'outputSales', label: '銷售額', defaultValue: 0 },
      { key: 'inputPurchases', label: '進貨額', defaultValue: 0 },
    ],
  },
  personal_income: {
    title: '綜合所得稅',
    fields: [
      { key: 'totalIncome', label: '所得總額', defaultValue: 0 },
      { key: 'deductions', label: '扣除額', defaultValue: 0 },
      { key: 'exemptions', label: '免稅額', defaultValue: 0 },
    ],
  },
  labor_nhi: {
    title: '勞健保',
    fields: [
      { key: 'salary', label: '員工月薪', defaultValue: 0 },
    ],
  },
  withholding: {
    title: '扣繳申報',
    fields: [
      { key: 'paymentAmount', label: '給付金額', defaultValue: 0 },
      { key: 'rate', label: '扣繳率(%)', defaultValue: 10 },
    ],
  },
};
