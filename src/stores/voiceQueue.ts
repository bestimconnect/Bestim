import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Offline voice (decisions Q90, Q93): a recording made without a connection waits here (the audio file in
// Paths.document/voice-queue), is written up once the phone is back online, then waits for the owner's review.
// Processing: src/lib/voiceSend.ts.

export type QueuedVoice = {
  id: string;
  vehicleId: string;
  lang: string;
  file: string | null; // name in Paths.document/voice-queue (not a full path: the app folder can move on iOS updates)
  mime: string | null;
  text: string; // the phone's live text, sent when there is no audio
  createdAt: string;
  status: 'waiting' | 'sending' | 'ready' | 'failed';
  reason?: 'limit' | 'ai'; // failed
  transcript?: string; // ready
  records?: unknown; // ready: the raw answer, cleaned with normalizeRecords() when the owner opens it
};

type Queue = {
  items: QueuedVoice[];
  add: (item: QueuedVoice) => void;
  update: (id: string, patch: Partial<QueuedVoice>) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useVoiceQueue = create<Queue>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => set(({ items }) => ({ items: [...items, item] })),
      update: (id, patch) => set(({ items }) => ({ items: items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      remove: (id) => set(({ items }) => ({ items: items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'voiceQueue',
      storage: createJSONStorage(() => AsyncStorage),
      // A send cut off by closing the app is simply sent again.
      onRehydrateStorage: () => (s) => s?.items.forEach((i) => i.status === 'sending' && s.update(i.id, { status: 'waiting' })),
    },
  ),
);
