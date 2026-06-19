import { io, Socket } from "socket.io-client";

// Store active sockets
const activeSockets = new Map<string, Socket>();

export interface WebSocketConnection {
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string) => void;
  connect: () => void;
  disconnect: () => void;
}

export const connectSocket = (serverUrl: string): WebSocketConnection => {
  // Check if socket already exists for this URL
  if (activeSockets.has(serverUrl)) {
    const existingSocket = activeSockets.get(serverUrl)!;
    return createSocketWrapper(existingSocket);
  }

  // Create new socket connection
  const socket = io(serverUrl, {
    transports: ["websocket", "polling"],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
  });

  // Store socket
  activeSockets.set(serverUrl, socket);

  // Set up connection event handlers
  socket.on("connect", () => {
    console.log(`✅ WebSocket connected to ${serverUrl}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ WebSocket disconnected from ${serverUrl}:`, reason);
  });

  socket.on("connect_error", (error) => {
    console.error(`🚫 WebSocket connection error to ${serverUrl}:`, error);
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log(`🔄 WebSocket reconnected to ${serverUrl} after ${attemptNumber} attempts`);
  });

  socket.on("reconnect_error", (error) => {
    console.error(`🔄❌ WebSocket reconnection error to ${serverUrl}:`, error);
  });

  return createSocketWrapper(socket);
};

export const disconnectSocket = (connection: WebSocketConnection | Socket): void => {
  // Find and remove from active sockets
  for (const [url, socket] of activeSockets.entries()) {
    if (socket === connection || (connection as any)._socket === socket) {
      console.log(`🔌 Disconnecting socket for ${url}`);
      socket.disconnect();
      activeSockets.delete(url);
      break;
    }
  }
};

// Create a wrapper that provides a consistent interface
const createSocketWrapper = (socket: Socket): WebSocketConnection => {
  return {
    on: (event: string, callback: (data: any) => void) => {
      socket.on(event, callback);
    },
    off: (event: string) => {
      socket.off(event);
    },
    connect: () => {
      if (!socket.connected) {
        socket.connect();
      }
    },
    disconnect: () => {
      socket.disconnect();
    },
  };
};

// Cleanup function to disconnect all sockets
export const disconnectAllSockets = (): void => {
  console.log("🧹 Disconnecting all websockets...");
  for (const [url, socket] of activeSockets.entries()) {
    console.log(`🔌 Disconnecting socket for ${url}`);
    socket.disconnect();
  }
  activeSockets.clear();
};

// Export for debugging
export const getActiveSockets = () => activeSockets;
