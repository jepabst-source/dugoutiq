// Deep link handler for Dugout IQ native app
//
// When the native app is opened via a URL (e.g., lineupman.com/score/ABC123),
// Capacitor's App plugin captures it and we route it to the right page.
//
// Supported deep link patterns:
//   /score/{code}  → Scorer page
//   /portal/{id}   → Parent portal
//   /join/{code}   → Team invite
//
// On web this is handled by the existing URL parsing in App.jsx.
// On native, the App plugin intercepts the URL before the web router sees it.

import { isNative } from './platform';

let AppPlugin = null;

async function getAppPlugin() {
  if (AppPlugin) return AppPlugin;
  if (!isNative()) return null;
  try {
    const mod = await import('@capacitor/app');
    AppPlugin = mod.App;
    return AppPlugin;
  } catch {
    return null;
  }
}

/**
 * Initialize deep link handling for the native app.
 * Call once at app startup.
 * 
 * @param {Function} onDeepLink - callback with { path, type } where type is 'scorer'|'portal'|'invite'|'unknown'
 */
export async function initDeepLinks(onDeepLink) {
  const app = await getAppPlugin();
  if (!app) return;

  // Handle app opened via URL (cold start)
  try {
    const launchUrl = await app.getLaunchUrl();
    if (launchUrl?.url) {
      const parsed = parseDeepLink(launchUrl.url);
      if (parsed) onDeepLink(parsed);
    }
  } catch {}

  // Handle app opened via URL (already running)
  app.addListener('appUrlOpen', (event) => {
    const parsed = parseDeepLink(event.url);
    if (parsed) onDeepLink(parsed);
  });

  // Handle back button on Android
  app.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      app.minimizeApp();
    }
  });
}

/**
 * Parse a deep link URL into a route object.
 * @param {string} url - full URL like https://lineupman.com/score/ABC123
 * @returns {{ path: string, code: string, type: string } | null}
 */
function parseDeepLink(url) {
  try {
    const u = new URL(url);
    const path = u.pathname;

    const scorerMatch = path.match(/\/score\/([a-zA-Z0-9]+)/);
    if (scorerMatch) {
      return { path, code: scorerMatch[1], type: 'scorer' };
    }

    const portalMatch = path.match(/\/portal\/([a-zA-Z0-9]+)/);
    if (portalMatch) {
      return { path, code: portalMatch[1], type: 'portal' };
    }

    const inviteMatch = path.match(/\/join\/([a-zA-Z0-9]+)/);
    if (inviteMatch) {
      return { path, code: inviteMatch[1], type: 'invite' };
    }

    return { path, code: null, type: 'unknown' };
  } catch {
    return null;
  }
}

/**
 * Clean up deep link listeners. Call on app teardown.
 */
export async function cleanupDeepLinks() {
  const app = await getAppPlugin();
  if (app) {
    try { await app.removeAllListeners(); } catch {}
  }
}
