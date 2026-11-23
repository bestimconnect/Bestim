import * as ImagePicker from 'expo-image-picker';

import i18n from './i18n';
import { sheet } from './sheet';
import { toastError } from '@/components/Toast';

/** v2 flow 13 "photo source": Take photo / Choose from library, then the photo's uri (null when cancelled). A denied camera says so instead of failing silently. */
export function pickPhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    const go = (from: 'camera' | 'library') => async () => {
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
      if (from === 'camera') {
        const ok = await ImagePicker.requestCameraPermissionsAsync();
        if (!ok.granted) {
          toastError(i18n.t('account.photo.denied'));
          return resolve(null);
        }
      }
      const r = await (from === 'camera' ? ImagePicker.launchCameraAsync(opts) : ImagePicker.launchImageLibraryAsync(opts));
      resolve(r.canceled ? null : r.assets[0].uri);
    };
    sheet(i18n.t('restore.photoTitle'), undefined, [
      { text: i18n.t('account.photo.take'), onPress: go('camera') },
      { text: i18n.t('account.photo.choose'), onPress: go('library') },
      { text: i18n.t('account.cancel'), style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}
