// ponytail: Google needs OAuth client IDs from a Google Cloud project (web + iOS + Android) wired
// through @react-native-google-signin/google-signin, and Apple needs an Apple developer account
// plus expo-apple-authentication — both are native modules, so they also need a dev build (no
// Expo Go). Wire signInWithIdToken() per docs/BESTIM-TECH-PLAN.md §6 once those exist.
export async function signInWithGoogle(): Promise<never> {
  throw new Error('not configured');
}

export async function signInWithApple(): Promise<never> {
  throw new Error('not configured');
}
