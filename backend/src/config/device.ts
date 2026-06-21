export const DEFAULT_MOBILE_DEVICE = {
  manufacturer: 'samsung',
  device: 'SM-S911B',
  osVersion: '16',
  osBuildNumber: 'BP1A.250505.001',
  // ponytail: updated at startup by fetchAndroidWaVersion; hardcoded as safe fallback
  appVersion: '2.24.4.76',
};

let _appVersion = DEFAULT_MOBILE_DEVICE.appVersion;

export const getCurrentAppVersion = () => _appVersion;
export const setAppVersion = (v: string) => { _appVersion = v; };

/** Returns device config with the runtime-resolved appVersion. */
export const getMobileDevice = () => ({ ...DEFAULT_MOBILE_DEVICE, appVersion: _appVersion });
