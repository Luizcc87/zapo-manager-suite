import axios from "axios";

import { saveToken } from "../token";

interface VerifyCredsParams {
  url: string;
  token: string;
}

export const verifyCreds = async ({ url, token }: VerifyCredsParams) => {
  try {
    const { data } = await axios.post(`${url}/verify-creds`, {}, { headers: { apikey: token } });

    saveToken({
      facebookAppId: data.facebookAppId,
      facebookConfigId: data.facebookConfigId,
      facebookUserToken: data.facebookUserToken,
    });

    return data;
  } catch (error) {
    return null;
  }
};
