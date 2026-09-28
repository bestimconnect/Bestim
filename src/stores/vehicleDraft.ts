import { create } from 'zustand';

type VehicleDraft = {
  make: string;
  model: string;
  year: number | null;
  currentOdometer: number | null;
  odometerUnit: 'km' | 'mi';
  serviceTypeId: string | null;
  serviceCost: number | null;
  serviceDate: string | null; // ISO date, defaults to today when omitted
  set: (patch: Partial<Omit<VehicleDraft, 'set' | 'reset'>>) => void;
  reset: () => void;
};

const initial = {
  make: '',
  model: '',
  year: null,
  currentOdometer: null,
  odometerUnit: 'km' as const,
  serviceTypeId: null,
  serviceCost: null,
  serviceDate: null,
};

// Not persisted: the draft only needs to survive the 3 onboarding steps in memory.
export const useVehicleDraft = create<VehicleDraft>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  reset: () => set(initial),
}));
