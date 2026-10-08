import i18n from './i18n';

const KEYS: Record<string, string> = {
  invalid_credentials: 'errors.invalidLogin',
  user_already_exists: 'errors.emailTaken',
  email_exists: 'errors.emailTaken',
  email_not_confirmed: 'errors.emailNotConfirmed',
  over_email_send_rate_limit: 'errors.tooMany',
  over_request_rate_limit: 'errors.tooMany',
  weak_password: 'errors.weakPassword',
  same_password: 'errors.samePassword',
};

/** What to show when something fails: our own words in the user's language, never the server's raw English (Q81). */
export function errorText(e: unknown, fallback: 'errors.generic' | 'errors.google' = 'errors.generic'): string {
  const { code, message, name } = (e ?? {}) as { code?: string; message?: string; name?: string };
  if (name === 'AuthRetryableFetchError' || /network|failed to fetch/i.test(message ?? '')) return i18n.t('errors.network');
  return i18n.t(KEYS[code ?? ''] ?? fallback);
}
