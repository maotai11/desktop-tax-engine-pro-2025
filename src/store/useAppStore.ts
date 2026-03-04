import { create } from 'zustand';
import type { CalculationResult } from '../types/app';
import type { ModuleType } from '../types/modules';

interface AppState {
  selectedClientId?: number;
  selectedModule: ModuleType;
  year: number;
  lastResult: CalculationResult | null;
  setSelectedClientId: (id?: number) => void;
  setSelectedModule: (module: ModuleType) => void;
  setYear: (year: number) => void;
  setLastResult: (result: CalculationResult | null) => void;
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
