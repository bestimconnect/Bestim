import { create } from 'zustand';

// The car a voice flow is about (quick-add sheet / offline queue → capture/voice → review-all). Not persisted: it only lives for one flow.
type LogDraft = {
  vehicleId: string | null;
  reset: (patch?: { vehicleId: string | null }) => void;
};

export const useLogDraft = create<LogDraft>((set) => ({
  vehicleId: null,
  reset: (patch) => set({ vehicleId: null, ...patch }),
}));
