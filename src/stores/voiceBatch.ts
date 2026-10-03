import { create } from 'zustand';

import type { VoiceRecord } from '@/lib/voiceRecords';

// The records one voice recording produced, while the user reviews them (capture/review-all).
// Not persisted: it only lives for one flow. `key` keeps a card's identity when others are removed.
export type BatchRecord = VoiceRecord & { key: string; error?: string };

type VoiceBatch = {
  transcript: string;
  records: BatchRecord[];
  start: (transcript: string, records: VoiceRecord[]) => void;
  update: (key: string, patch: Partial<VoiceRecord> & { error?: string }) => void;
  remove: (key: string) => void;
};

export const useVoiceBatch = create<VoiceBatch>((set) => ({
  transcript: '',
  records: [],
  start: (transcript, records) => set({ transcript, records: records.map((r, i) => ({ ...r, key: String(i) })) }),
  update: (key, patch) =>
    set((s) => ({ records: s.records.map((r) => (r.key === key ? ({ ...r, ...patch } as BatchRecord) : r)) })),
  remove: (key) => set((s) => ({ records: s.records.filter((r) => r.key !== key) })),
}));
