/**
 * Fetches the current WhatsApp Business (Android) version from Google Play Store.
 *
 * WHY THIS EXISTS
 * ---------------
 * Mobile TCP transport (mobileTransport) identifies itself to WhatsApp servers
 * as a specific Android app version via deviceInfo.appVersion. If that version
 * is too old, WA disconnects with failure_client_too_old — and unlike the Web
 * transport, Zapo has NO built-in auto-recovery for the Android version space
 * (recoverFromClientTooOld only handles WA Web versions via fetchLatestWaWebVersion).
 *
 * This function runs once at startup to pull the latest published version and
 * update the runtime appVersion before any instance reconnects.
 *
 * FAILURE BEHAVIOUR
 * -----------------
 * Returns null on any network/parse error. Caller falls back to the hardcoded
 * DEFAULT_MOBILE_DEVICE.appVersion — the connection will still work until WA
 * rotates its minimum accepted version.
 *
 * REGEX FRAGILITY
 * ---------------
 * Google Play Store HTML is obfuscated and subject to change. If fetches start
 * returning null despite network access, inspect the raw HTML of:
 *   https://play.google.com/store/apps/details?id=com.whatsapp.w4b&hl=en&gl=US
 * and update VERSION_PATTERNS accordingly.
 */

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.whatsapp.w4b&hl=en&gl=US';
const TIMEOUT_MS = 8_000;

// Multiple patterns — Play Store HTML changes; first match wins
const VERSION_PATTERNS = [
  /\["(\d{1,2}\.\d{1,3}\.\d{1,3}\.\d{1,3})"\]/,
  /"softwareVersion"\s*:\s*"(\d+\.\d+\.\d+\.\d+)"/,
  /Current Version[^>]*>[\s\S]{0,200}>([\d.]+)</,
];

export async function fetchLatestAndroidWaVersion(): Promise<string | null> {
  try {
    const res = await fetch(PLAY_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    for (const pattern of VERSION_PATTERNS) {
      const match = pattern.exec(html);
      if (match?.[1]) return match[1];
    }
    return null;
  } catch {
    return null;
  }
}
