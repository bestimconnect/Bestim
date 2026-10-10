import { create } from 'zustand';

// Picker order (decisions Q52). Cars only (founder, 2026-10-10).
export const VEHICLE_TYPES = ['sedan', 'hatchback', 'suv', 'coupe', 'sports', 'convertible', 'pickup', 'van'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

type VehicleDraft = {
  nickname: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  carModelId: string | null; // the catalog model picked; null = typed by hand
  year: number | null;
  currentOdometer: number | null;
  serviceTypeId: string | null;
  serviceCost: number | null;
  serviceDate: string | null; // ISO date, defaults to today when omitted
  set: (patch: Partial<Omit<VehicleDraft, 'set' | 'reset'>>) => void;
  reset: () => void;
};

const initial = {
  nickname: '',
  vehicleType: 'sedan' as VehicleType,
  make: '',
  model: '',
  carModelId: null,
  year: null,
  currentOdometer: null,
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
