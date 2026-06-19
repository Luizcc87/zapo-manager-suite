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
  const response = await apiGlobal.post<RequestCodeResponse>(
    "/instance/register/requestCode",
    params,
  );
  return response.data;
};

export const confirmRegistrationCode = async (
  params: ConfirmCodeParams,
): Promise<ConfirmCodeResponse> => {
  const response = await apiGlobal.post<ConfirmCodeResponse>(
    "/instance/register/confirmCode",
    params,
  );
  return response.data;
};
