import { create } from 'zustand';

export const VEHICLE_TYPES = ['car', 'motorcycle', 'pickup', 'equipment'] as const;
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
  vehicleType: 'car' as const,
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
