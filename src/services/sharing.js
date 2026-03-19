/**
 * Native share service for Dugout IQ
 * 
 * On native platforms: opens the iOS/Android share sheet
 * On web: falls back to Web Share API or clipboard copy
 * 
 * Usage:
 *   import { shareLink } from '../services/sharing';
 *   shareLink({ title: 'Game Stats', text: 'Check out the stats!', url: 'https://...' });
 */

import { isNative } from './platform';

let SharePlugin = null;

async function getShare() {
  if (SharePlugin) return SharePlugin;
  if (!isNative()) return null;
  try {
    const mod = await import('@capacitor/share');
    SharePlugin = mod.Share;
    return SharePlugin;
  } catch {
    return null;
  }
}

/**
 * Share a link using the best available method:
 * 1. Native share sheet (Capacitor - iOS/Android)
 * 2. Web Share API (modern mobile browsers)
 * 3. Clipboard copy (fallback)
 * 
 * @param {Object} opts
 * @param {string} opts.title - Share title
 * @param {string} opts.text - Share body text
 * @param {string} opts.url - URL to share
 * @returns {Promise<{method: string}>} which method was used
 */
export async function shareLink({ title, text, url }) {
  // Try native share first
  const share = await getShare();
  if (share) {
    try {
      await share.share({ title, text, url, dialogTitle: title });
      return { method: 'native' };
    } catch (err) {
      // User cancelled — that's fine
      if (err?.message?.includes('cancel')) return { method: 'cancelled' };
    }
  }

  // Try Web Share API (works on mobile Safari, Chrome, etc.)
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return { method: 'web-share' };
    } catch {
      // User cancelled
      return { method: 'cancelled' };
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(url);
    return { method: 'clipboard' };
  } catch {
    // Last resort: old-school copy
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return { method: 'clipboard' };
  }
}
