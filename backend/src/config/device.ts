export const DEFAULT_MOBILE_DEVICE = {
  manufacturer: 'samsung',
  device: 'SM-S911B',
  osVersion: '15',
  osBuildNumber: 'BP1A.250505.001',
  // ponytail: updated at startup by fetchAndroidWaVersion; hardcoded as safe fallback
  appVersion: '2.26.23.73',
};

let _appVersion = DEFAULT_MOBILE_DEVICE.appVersion;

export const getCurrentAppVersion = () => _appVersion;
export const setAppVersion = (v: string) => { _appVersion = v; };

/** Returns device config with the runtime-resolved appVersion. */
export const getMobileDevice = () => ({ ...DEFAULT_MOBILE_DEVICE, appVersion: _appVersion });

// iOS WA Business version for Baileys OTP registration (separate from Android TCP version).
// App Store format is "24.x.x"; we store with "2." prefix to match WA UA format "2.24.x.x".
// Hardcoded 2026-06-21; updated at startup by fetchIosWaVersion.
let _iosVersion = '2.24.17.80';
export const getCurrentIosVersion = () => _iosVersion;
export const setIosVersion = (v: string) => { _iosVersion = v; };

export const buildIosMobileUserAgent = (iosVersion: string) =>
  `WhatsApp/${iosVersion} iOS/17.5.1 Device/Apple-iPhone_15`;

export const buildIosMobileToken = (iosVersion: string) => {
  const { createHash } = require('crypto');
  const versionHash = createHash('md5').update(iosVersion).digest('hex');
  return Buffer.from('0a1mLfGUIBVrMKF1RdvLI5lkRBvof6vn0fD2QRSM' + versionHash);
};
