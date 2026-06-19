// License helpers — mirror evolution-go-manager/src/services/api/license.ts.
// Standalone axios calls (no auth, no shared interceptors) because they need
// to work BEFORE the user is connected to the backend.

import axios from "axios";

export interface LicenseStatus {
  status: "active" | "inactive";
  instance_id?: string;
  api_key?: string;
}

export interface RegisterResponse {
  status: string;
  register_url?: string;
  message?: string;
}

export interface ActivateResponse {
  status: string;
  message?: string;
  error?: string;
}

const HTTP_TIMEOUT = 15000;

function buildUrl(apiUrl: string, path: string): string {
  const base = apiUrl.replace(/\/+$/, "");
  return `${base}${path}`;
}

export async function checkLicenseStatus(apiUrl: string, apiKey?: string): Promise<LicenseStatus> {
  const headers: Record<string, string> = {};
  if (apiKey) headers.apikey = apiKey;
  const res = await axios.get<LicenseStatus>(buildUrl(apiUrl, "/license/status"), {
    headers,
    timeout: HTTP_TIMEOUT,
  });
  return res.data;
}

export async function initRegister(redirectUri: string, apiUrl: string, apiKey?: string): Promise<RegisterResponse> {
  const headers: Record<string, string> = {};
  if (apiKey) headers.apikey = apiKey;
  const res = await axios.get<RegisterResponse>(buildUrl(apiUrl, "/license/register"), {
    headers,
    params: { redirect_uri: redirectUri },
    timeout: HTTP_TIMEOUT,
  });
  return res.data;
}

export async function activateLicense(code: string, apiUrl: string, apiKey?: string): Promise<ActivateResponse> {
  const headers: Record<string, string> = {};
  if (apiKey) headers.apikey = apiKey;
  const res = await axios.get<ActivateResponse>(buildUrl(apiUrl, "/license/activate"), {
    headers,
    params: { code },
    timeout: HTTP_TIMEOUT,
  });
  return res.data;
}
