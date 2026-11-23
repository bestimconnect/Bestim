import * as Sentry from '@sentry/react-native';

// Crash reports (Sentry). Off until EXPO_PUBLIC_SENTRY_DSN is set in the EAS build env, so nothing is sent from dev or before launch.
// Privacy: no default PII, no session replay, no screenshots; emails are masked and URL query strings dropped before anything leaves.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

const mask = (s: string) => s.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]').replace(/\?[^"\s\\]*/g, '?[query]');

export function initMonitoring() {
  if (!dsn || __DEV__) return;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    attachScreenshot: false,
    beforeBreadcrumb: (b) => (b.category === 'console' ? null : b), // console lines can hold anything a developer logged
    beforeSend: (event) => JSON.parse(mask(JSON.stringify(event))),
  });
}

/** Send a handled error that would otherwise only reach the console. Does nothing when monitoring is off. */
export function reportError(e: unknown, where: string) {
  if (dsn && !__DEV__) Sentry.captureException(e, { tags: { where } });
  else console.warn(where, e);
}

export const wrapRoot = Sentry.wrap;
