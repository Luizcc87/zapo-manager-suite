import { SendText, SendMedia, SendAudio, SendReaction, SendLocation, SendContact, SendPoll, RevokeMessage, SendEvent, SendStickerPack } from "@/types/evolution.types";

import { api } from "../api";
import { useManageMutation } from "../mutateQuery";

interface SendTextParams {
  instanceName: string;
  token: string;
  data: SendText;
}

interface SendMediaParams {
  instanceName: string;
  token: string;
  data: SendMedia;
}

interface SendAudioParams {
  instanceName: string;
  token: string;
  data: SendAudio;
}

interface SendReactionParams {
  instanceName: string;
  token: string;
  data: SendReaction;
}

interface SendLocationParams {
  instanceName: string;
  token: string;
  data: SendLocation;
}

interface SendContactParams {
  instanceName: string;
  token: string;
  data: SendContact;
}

interface SendPollParams {
  instanceName: string;
  token: string;
  data: SendPoll;
}

interface RevokeMessageParams {
  instanceName: string;
  token: string;
  data: RevokeMessage;
}

interface SendEventParams {
  instanceName: string;
  token: string;
  data: SendEvent;
}

interface SendStickerPackParams {
  instanceName: string;
  token: string;
  data: SendStickerPack;
}

const sendText = async ({ instanceName, token, data }: SendTextParams) => {
  const response = await api.post(`/message/sendText/${instanceName}`, data, {
    headers: {
      apikey: token,
      "content-type": "application/json",
    },
  });
  return response.data;
};

const sendMedia = async ({ instanceName, token, data }: SendMediaParams) => {
  try {
    // Send as flat structure as required by the newer API
    const jsonData = {
      number: data.number,
      mediatype: data.mediaMessage.mediatype,
      mimetype: data.mediaMessage.mimetype,
      caption: data.mediaMessage.caption,
      media: data.mediaMessage.media, // Base64 string
      fileName: data.mediaMessage.fileName,
    };

    const response = await api.post(`/message/sendMedia/${instanceName}`, jsonData, {
      headers: {
        apikey: token,
        "content-type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Erro ao enviar mídia:", error);
    throw error;
  }
};

const sendAudio = async ({ instanceName, token, data }: SendAudioParams) => {
  try {
    // Always send as JSON with base64 audio
    const jsonData = {
      number: data.number,
      audioMessage: {
        audio: data.audioMessage.audio, // Base64 string
      },
      options: data.options,
    };

    const response = await api.post(`/message/sendWhatsAppAudio/${instanceName}`, jsonData, {
      headers: {
        apikey: token,
        "content-type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Erro ao enviar áudio:", error);
    throw error;
  }
};

const sendReaction = async ({ instanceName, token, data }: SendReactionParams) => {
  const response = await api.post(`/message/sendReaction/${instanceName}`, data, {
    headers: { apikey: token, "content-type": "application/json" },
  });
  return response.data;
};

const sendLocation = async ({ instanceName, token, data }: SendLocationParams) => {
  const response = await api.post(`/message/sendLocation/${instanceName}`, data, {
    headers: { apikey: token, "content-type": "application/json" },
  });
  return response.data;
};

const sendContact = async ({ instanceName, token, data }: SendContactParams) => {
  const response = await api.post(`/message/sendContact/${instanceName}`, data, {
    headers: { apikey: token, "content-type": "application/json" },
  });
  return response.data;
};

const sendPoll = async ({ instanceName, token, data }: SendPollParams) => {
  const response = await api.post(`/message/sendPoll/${instanceName}`, data, {
    headers: { apikey: token, "content-type": "application/json" },
  });
  return response.data;
};

const revokeMessage = async ({ instanceName, token, data }: RevokeMessageParams) => {
  const response = await api.post(`/message/revoke/${instanceName}`, data, {
    headers: { apikey: token, "content-type": "application/json" },
  });
  return response.data;
};

const sendEvent = async ({ instanceName, token, data }: SendEventParams) => {
  const response = await api.post(`/message/sendEvent/${instanceName}`, data, {
    headers: { apikey: token, "content-type": "application/json" },
  });
  return response.data;
};

const sendStickerPack = async ({ instanceName, token, data }: SendStickerPackParams) => {
  const formData = new FormData();
  formData.append("number", data.number);
  formData.append("stickerPackId", data.stickerPackId);
  formData.append("name", data.name);
  formData.append("publisher", data.publisher);
  data.stickers.forEach((file) => formData.append("stickers", file));
  formData.append("cover", data.cover);

  const response = await api.post(`/message/sendStickerPack/${instanceName}`, formData, {
    headers: { apikey: token, "content-type": "multipart/form-data" },
  });
  return response.data;
};

export function useSendMessage() {
  const sendTextMutation = useManageMutation(sendText, {
    invalidateKeys: [
      ["chats", "findMessages"],
      ["chats", "findChats"],
    ],
  });

  return {
    sendText: sendTextMutation,
  };
}

const MESSAGES_INVALIDATE_KEYS = [
  ["chats", "findMessages"],
  ["chats", "findChats"],
];

export function useSendMedia() {
  const sendMediaMutation = useManageMutation(sendMedia, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });

  return {
    sendMedia: sendMediaMutation,
  };
}

export function useSendAudio() {
  const sendAudioMutation = useManageMutation(sendAudio, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });

  return {
    sendAudio: sendAudioMutation,
  };
}

export function useSendReaction() {
  const sendReactionMutation = useManageMutation(sendReaction, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });
  return { sendReaction: sendReactionMutation };
}

export function useSendLocation() {
  const sendLocationMutation = useManageMutation(sendLocation, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });
  return { sendLocation: sendLocationMutation };
}

export function useSendContact() {
  const sendContactMutation = useManageMutation(sendContact, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });
  return { sendContact: sendContactMutation };
}

export function useSendPoll() {
  const sendPollMutation = useManageMutation(sendPoll, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });
  return { sendPoll: sendPollMutation };
}

export function useRevokeMessage() {
  const revokeMessageMutation = useManageMutation(revokeMessage, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });
  return { revokeMessage: revokeMessageMutation };
}

export function useSendEvent() {
  const sendEventMutation = useManageMutation(sendEvent, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });
  return { sendEvent: sendEventMutation };
}

export function useSendStickerPack() {
  const sendStickerPackMutation = useManageMutation(sendStickerPack, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });
  return { sendStickerPack: sendStickerPackMutation };
}
