import { io, Socket } from "socket.io-client";

import { getToken, TOKEN_ID } from "@/lib/queries/token";

export interface SocketAuth {
  apikey: string;
  instanceName: string;
}

export interface WebSocketConnection {
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string) => void;
  connect: () => void;
  disconnect: () => void;
}

// Key: `${serverUrl}::${instanceName}`
const activeSockets = new Map<string, Socket>();

function makeKey(serverUrl: string, instanceName: string) {
  return `${serverUrl}::${instanceName}`;
}

export const connectSocket = (serverUrl: string, auth?: Partial<SocketAuth>): WebSocketConnection => {
  const instanceName = auth?.instanceName ?? "";
  const apikey = auth?.apikey ?? getToken(TOKEN_ID.INSTANCE_TOKEN) ?? getToken(TOKEN_ID.TOKEN) ?? "";

  const key = makeKey(serverUrl, instanceName);

  if (activeSockets.has(key)) {
    return createSocketWrapper(key, activeSockets.get(key)!);
  }

  const socket = io(serverUrl, {
    auth: { apikey, instanceName },
    transports: ["websocket", "polling"],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
  });

  activeSockets.set(key, socket);

  socket.on("connect", () => {
    console.log(`[WS] Connected to ${serverUrl} (instance: ${instanceName})`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[WS] Disconnected from ${serverUrl}:`, reason);
  });

  socket.on("connect_error", (error) => {
    console.error(`[WS] Connection error to ${serverUrl}:`, error.message);
  });

  return createSocketWrapper(key, socket);
};

export const disconnectSocket = (connection: WebSocketConnection): void => {
  const wrapper = connection as SocketWrapper;
  const socket = activeSockets.get(wrapper._key);
  if (socket) {
    socket.disconnect();
    activeSockets.delete(wrapper._key);
  }
};

export const disconnectAllSockets = (): void => {
  for (const socket of activeSockets.values()) {
    socket.disconnect();
  }
  activeSockets.clear();
};

interface SocketWrapper extends WebSocketConnection {
  _key: string;
}

function createSocketWrapper(key: string, socket: Socket): SocketWrapper {
  return {
    _key: key,
    on: (event, callback) => { socket.on(event, callback); },
    off: (event) => { socket.off(event); },
    connect: () => { if (!socket.connected) socket.connect(); },
    disconnect: () => { socket.disconnect(); },
  };
}

export const getActiveSockets = () => activeSockets;
