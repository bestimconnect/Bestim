import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// The Notifications page (decisions Q92): every alert the phone has shown, kept on the phone.
// `scheduled` holds what syncNotifications() asked the OS to show; once its time has passed it moves to `items`.
// Server push (Phase 6) can add to `items` the same way.

export type InboxKind = 'soon' | 'overdue' | 'odometer' | 'weekly' | 'voice';
export type InboxItem = { id: string; kind: InboxKind; title: string; body: string; url: string; at: string; read: boolean };

const MAX_ITEMS = 100;

type Inbox = {
  items: InboxItem[]; // newest first
  scheduled: Omit<InboxItem, 'read'>[];
  add: (items: Omit<InboxItem, 'read'>[]) => void;
  /** Move every scheduled alert whose time has passed into the list. */
  deliver: (now?: Date) => void;
  setScheduled: (items: Omit<InboxItem, 'read'>[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
};

export const useInbox = create<Inbox>()(
  persist(
    (set, get) => ({
      items: [],
      scheduled: [],
      add: (fresh) =>
        set(({ items }) => {
          const known = new Set(items.map((i) => i.id));
          const added = fresh.filter((i) => !known.has(i.id)).map((i) => ({ ...i, read: false }));
          return { items: [...added, ...items].sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_ITEMS) };
        }),
      deliver: (now = new Date()) => {
        const due = get().scheduled.filter((s) => new Date(s.at) <= now);
        if (!due.length) return;
        get().add(due);
        set(({ scheduled }) => ({ scheduled: scheduled.filter((s) => new Date(s.at) > now) }));
      },
      setScheduled: (scheduled) => set({ scheduled }),
      markRead: (id) => set(({ items }) => ({ items: items.map((i) => (i.id === id ? { ...i, read: true } : i)) })),
      markAllRead: () => set(({ items }) => ({ items: items.map((i) => ({ ...i, read: true })) })),
      clear: () => set({ items: [], scheduled: [] }),
    }),
    { name: 'notifyInbox', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
