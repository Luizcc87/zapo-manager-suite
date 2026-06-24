import { apiGlobal } from "../api";

export interface RequestCodeParams {
  instanceName: string;
  phoneNumber: string; // E.164: "+5511999999999"
  method: "sms" | "voice";
}

export interface RequestCodeResponse {
  status: "success" | "error";
  message?: string;
}

export interface ConfirmCodeParams {
  instanceName: string;
  code: string; // 6 dígitos
}

export interface ConfirmCodeResponse {
  status: "success" | "error";
  message?: string;
}

export const requestRegistrationCode = async (
  params: RequestCodeParams,
): Promise<RequestCodeResponse> => {
  console.groupCollapsed("[PrimaryRegistration][Browser] requestRegistrationCode");
  console.debug("[PrimaryRegistration][Browser] request payload", {
    instanceName: params.instanceName,
    phoneNumber: params.phoneNumber,
    method: params.method,
  });
  const response = await apiGlobal.post<RequestCodeResponse>(
    "/instance/register/requestCode",
    params,
  );
  console.debug("[PrimaryRegistration][Browser] request response", {
    status: response.status,
    data: response.data,
  });
  console.groupEnd();
  return response.data;
};

export const confirmRegistrationCode = async (
  params: ConfirmCodeParams,
): Promise<ConfirmCodeResponse> => {
  console.groupCollapsed("[PrimaryRegistration][Browser] confirmRegistrationCode");
  console.debug("[PrimaryRegistration][Browser] confirm payload", {
    instanceName: params.instanceName,
    codeLength: params.code?.length,
  });
  const response = await apiGlobal.post<ConfirmCodeResponse>(
    "/instance/register/confirmCode",
    params,
  );
  console.debug("[PrimaryRegistration][Browser] confirm response", {
    status: response.status,
    data: response.data,
  });
  console.groupEnd();
  return response.data;
};
