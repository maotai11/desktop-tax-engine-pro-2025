import { create } from 'zustand';

type ModuleType = 'corp_income' | 'vat' | 'personal_income' | 'labor_nhi' | 'withholding';

interface AppState {
  selectedClientId?: number;
  selectedModule: ModuleType;
  year: number;
  lastResult: any;
  setSelectedClientId: (id?: number) => void;
  setSelectedModule: (module: ModuleType) => void;
  setYear: (year: number) => void;
  setLastResult: (result: any) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedClientId: undefined,
  selectedModule: 'corp_income',
  year: 2025,
  lastResult: null,
  setSelectedClientId: (id) => set({ selectedClientId: id }),
  setSelectedModule: (module) => set({ selectedModule: module }),
  setYear: (year) => set({ year }),
  setLastResult: (result) => set({ lastResult: result }),
}));
