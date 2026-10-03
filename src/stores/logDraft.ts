import { create } from 'zustand';

// One maintenance log in progress: manual entry → review → save. Also used by the correction form (logId set)
// and to edit one card of the voice review list (stores/voiceBatch.ts). Not persisted: it only lives for one flow.
type LogDraft = {
  logId: string | null; // set when correcting an existing log
  vehicleId: string | null;
  serviceTypeId: string | null;
  title: string;
  odometer: number | null;
  cost: number | null;
  serviceDate: string; // ISO date
  location: string;
  source: 'manual' | 'voice';
  transcript: string | null;
  parts: { name: string }[];
  intervalKm: number | null;
  photoUri: string | null; // local receipt photo, uploaded on save
  set: (patch: Partial<Omit<LogDraft, 'set' | 'reset'>>) => void;
  reset: (patch?: Partial<Omit<LogDraft, 'set' | 'reset'>>) => void;
};

const initial = () => ({
  logId: null,
  vehicleId: null,
  serviceTypeId: null,
  title: '',
  odometer: null,
  cost: null,
  serviceDate: new Date().toLocaleDateString('en-CA'),
  location: '',
  source: 'manual' as const,
  transcript: null,
  parts: [],
  intervalKm: null,
  photoUri: null,
});

export const useLogDraft = create<LogDraft>((set) => ({
  ...initial(),
  set: (patch) => set(patch),
  reset: (patch) => set({ ...initial(), ...patch }),
}));
