// Platform detection for Dugout IQ
// Works whether Capacitor is installed or not.
// On web builds, Capacitor won't be available — all functions return web defaults.

let _capacitor = null;
let _loaded = false;

function getCapacitor() {
  if (_loaded) return _capacitor;
  _loaded = true;
  try {
    // window.Capacitor is injected by the native shell at runtime
    if (typeof window !== 'undefined' && window.Capacitor) {
      _capacitor = window.Capacitor;
    }
  } catch {}
  return _capacitor;
}

export const isNative = () => {
  const cap = getCapacitor();
  return cap ? cap.isNativePlatform() : false;
};

export const isIOS = () => {
  const cap = getCapacitor();
  return cap ? cap.getPlatform() === 'ios' : false;
};

export const isAndroid = () => {
  const cap = getCapacitor();
  return cap ? cap.getPlatform() === 'android' : false;
};

export const isWeb = () => {
  const cap = getCapacitor();
  return cap ? cap.getPlatform() === 'web' : true;
};

export const getPlatform = () => {
  const cap = getCapacitor();
  return cap ? cap.getPlatform() : 'web';
};

// Canonical public web domain. Links we generate to be opened by SOMEONE
// ELSE in a browser (scorer/log-assistant, parent portal, team invite) must
// point here. On the native app the WebView origin is capacitor://localhost,
// so building a link from window.location would produce an unopenable
// capacitor://localhost/... URL — use this instead.
export const PUBLIC_WEB_ORIGIN = 'https://lineupman.com';

// Base URL for a shareable link. Native → the public domain; web → the live
// origin (works for both localhost dev and production).
export const shareBaseUrl = () =>
  isNative()
    ? PUBLIC_WEB_ORIGIN
    : window.location.origin + window.location.pathname.replace(/\/$/, '');
