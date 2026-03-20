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
