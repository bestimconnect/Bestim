import { router } from 'expo-router';

// The website hosts the pages the stores require (the same text the app shows) and the page a shared link opens.
export const SITE = 'https://bestim-eg.com';

/** Opens the page inside the app (text from the dashboard's Pages editor, cached for offline). */
export const openPage = (page: 'privacy' | 'terms' | 'support' | 'about') => router.push({ pathname: '/page/[slug]', params: { slug: page } });
