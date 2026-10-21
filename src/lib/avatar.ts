import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

/** The profile picture as a link the phone can show (the bucket is private, so the link is signed and short-lived). */
export function useAvatarUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['avatar', path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** Take or choose a square photo, upload it, and point the profile at it. Returns false when the user cancelled. */
export function useAvatarActions(userId: string | undefined, current: string | null | undefined) {
  const qc = useQueryClient();
  const saveRow = async (avatar_url: string | null) => {
    const { error } = await supabase.from('profiles').update({ avatar_url }).eq('id', userId!);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ['profile'] });
  };
  const drop = (path: string | null | undefined) => (path ? supabase.storage.from('avatars').remove([path]) : undefined);

  const pick = async (from: 'camera' | 'library') => {
    if (!userId) return false;
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 };
    if (from === 'camera') {
      const ok = await ImagePicker.requestCameraPermissionsAsync();
      if (!ok.granted) throw new Error('camera permission denied');
    }
    const r = await (from === 'camera' ? ImagePicker.launchCameraAsync(opts) : ImagePicker.launchImageLibraryAsync(opts));
    if (r.canceled) return false;
    const path = `${userId}/avatar-${Date.now()}.jpg`;
    const body = await (await fetch(r.assets[0].uri)).arrayBuffer();
    const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType: 'image/jpeg' });
    if (error) throw error;
    try {
      await saveRow(path);
    } catch (e) {
      await drop(path); // the profile did not change: do not leave the new file behind
      throw e;
    }
    await drop(qc.getQueryData<{ avatar_url: string | null }>(['profile', userId])?.avatar_url === path ? current : (qc.getQueryData<{ avatar_url: string | null }>(['profile', userId])?.avatar_url ?? current));
    return true;
  };
  const remove = async () => {
    await saveRow(null);
    await drop(current);
  };
  return { pick, remove };
}
