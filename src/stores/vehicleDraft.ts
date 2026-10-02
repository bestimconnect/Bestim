import { create } from 'zustand';

// Picker order (decisions Q52). The DB also still accepts the older 'car'.
export const VEHICLE_TYPES = ['sedan', 'hatchback', 'suv', 'coupe', 'sports', 'convertible', 'pickup', 'van', 'motorcycle', 'equipment'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

type VehicleDraft = {
  nickname: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  year: number | null;
  currentOdometer: number | null;
  odometerUnit: 'km' | 'h'; // 'h' = operating hours (equipment)
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
