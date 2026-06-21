/**
 * Fetches the current WhatsApp Business (iOS) version from iTunes Search API.
 *
 * WHY THIS EXISTS
 * ---------------
 * Baileys v6 was reverse-engineered from the iOS WA app. The registration UA
 * must say "iOS" and use a version matching the current iOS WA Business release.
 * Using an Android version (Play Store) in an iOS UA causes "blocked" responses
 * because WA validates version↔OS consistency during OTP registration.
 *
 * iOS versions look like "24.x.x" on App Store; we prepend "2." to match the
 * format WA uses in its User-Agent ("WhatsApp/2.24.x.x iOS/...").
 *
 * FAILURE BEHAVIOUR
 * -----------------
 * Returns null on any network/parse error. Caller falls back to the hardcoded
 * IOS_WA_FALLBACK_VERSION in device.ts.
 */

const ITUNES_URL = 'https://itunes.apple.com/lookup?id=1386412985&country=us';
const TIMEOUT_MS = 8_000;

export async function fetchLatestIosWaVersion(): Promise<string | null> {
  try {
    const res = await fetch(ITUNES_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const raw = json?.results?.[0]?.version as string | undefined;
    if (!raw || !/^\d+(\.\d+)+$/.test(raw)) return null;
    // App Store returns e.g. "24.17.80"; WA UA format is "2.24.17.80"
    return raw.startsWith('2.') ? raw : `2.${raw}`;
  } catch {
    return null;
  }
}
