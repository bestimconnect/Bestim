import { onlineManager } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';

import i18n from './i18n';
import { supabase } from './supabase';
import { useInbox } from '@/stores/notifyInbox';
import { useVoiceQueue, type QueuedVoice } from '@/stores/voiceQueue';

// Sending a recording to the `process-voice-log` Edge Function, for the live voice screen and the offline queue.
export const MAX_AUDIO_BYTES = 2_900_000; // the function refuses more than ~3 MB
const TIMEOUT_MS = 60_000; // the function gives the AI 45 s

export type VoiceResult =
  | { ok: true; transcript: string; records: unknown; ms?: unknown }
  | { ok: false; reason: 'offline' | 'limit' | 'ai' };

/** `audio`: base64 or null (then `text` is sent). Never throws. "offline" means it never reached the function. */
export async function sendVoice(input: { audio: string | null; mime: string | null; text: string; vehicleId: string; lang: string }): Promise<VoiceResult> {
  if (!onlineManager.isOnline()) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await supabase.functions.invoke('process-voice-log', {
      body: { ...(input.audio ? { audio_base64: input.audio, mime: input.mime } : { transcript: input.text }), vehicle_id: input.vehicleId, lang: input.lang },
      timeout: TIMEOUT_MS,
    });
    if (error) {
      if (error.name === 'FunctionsFetchError') return { ok: false, reason: 'offline' }; // no answer at all: the connection dropped
      return { ok: false, reason: error.context?.status === 429 ? 'limit' : 'ai' }; // Q64, Q65
    }
    return { ok: true, transcript: String(data?.transcript ?? ''), records: data?.records, ms: data?.ms };
  } catch {
    return { ok: false, reason: onlineManager.isOnline() ? 'ai' : 'offline' };
  }
}

const folder = () => new Directory(Paths.document, 'voice-queue');
const fileOf = (name: string) => new File(folder(), name);

/** Keep a recording for later: moves the audio into the queue folder (when it fits the upload limit). */
export function queueVoice(input: { uri: string | null; mime: string | null; text: string; vehicleId: string; lang: string }) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let file: string | null = null;
  try {
    const source = input.uri && input.mime ? new File(input.uri) : null;
    if (source?.exists && source.size > 0 && source.size <= MAX_AUDIO_BYTES) {
      const dir = folder();
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      file = `${id}.${input.uri!.split('.').pop()}`;
      source.moveSync(fileOf(file));
    }
  } catch {
    file = null; // fall back to the live text below
  }
  if (!file && !input.text.trim()) return false;
  useVoiceQueue.getState().add({
    id,
    vehicleId: input.vehicleId,
    lang: input.lang,
    file,
    mime: file ? input.mime : null,
    text: input.text.trim(),
    createdAt: new Date().toISOString(),
    status: 'waiting',
  });
  return true;
}

/** Delete a queued recording and its audio. */
export function dropVoice(id: string) {
  const item = useVoiceQueue.getState().items.find((i) => i.id === id);
  deleteAudio(item);
  useVoiceQueue.getState().remove(id);
}

function deleteAudio(item?: QueuedVoice) {
  try {
    if (item?.file) fileOf(item.file).delete();
  } catch {}
}

let running = false;
/** Send every waiting recording, one at a time. Called on reconnect and when the app comes back. Never throws. */
export async function processVoiceQueue() {
  if (running) return;
  running = true;
  try {
    for (const item of useVoiceQueue.getState().items.filter((i) => i.status === 'waiting')) {
      if (!onlineManager.isOnline()) break;
      const q = useVoiceQueue.getState();
      q.update(item.id, { status: 'sending' });
      let audio: string | null = null;
      try {
        if (item.file) audio = await fileOf(item.file).base64();
      } catch {}
      if (!audio && !item.text) {
        dropVoice(item.id); // nothing left to send (the file is gone)
        continue;
      }
      const res = await sendVoice({ audio, mime: item.mime, text: item.text, vehicleId: item.vehicleId, lang: item.lang });
      if (!res.ok) {
        if (res.reason === 'offline') {
          q.update(item.id, { status: 'waiting' });
          break;
        }
        q.update(item.id, { status: 'failed', reason: res.reason });
        continue;
      }
      deleteAudio(item); // the recording is never kept once written up (Q70)
      q.update(item.id, { status: 'ready', file: null, transcript: res.transcript || item.text, records: res.records });
      useInbox.getState().add([
        { id: `voice-${item.id}`, kind: 'voice', title: i18n.t('voiceQueue.readyTitle'), body: i18n.t('voiceQueue.readyBody'), url: '/', at: new Date().toISOString() },
      ]);
    }
  } finally {
    running = false;
  }
}
