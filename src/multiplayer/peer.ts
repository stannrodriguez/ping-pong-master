import Peer, { DataConnection } from 'peerjs';

export type MessageType =
  | { type: 'paddle-move'; x: number }
  | { type: 'ball-hit'; spinType: string; paddleX: number }
  | { type: 'serve'; spinType: string }
  | { type: 'ball-state'; position: { x: number; y: number; z: number }; velocity: { x: number; y: number; z: number } }
  | { type: 'score'; player: number; opponent: number }
  | { type: 'ready' }
  | { type: 'ping' };

let peer: Peer | null = null;
let connection: DataConnection | null = null;
let messageHandler: ((msg: MessageType) => void) | null = null;
let statusHandler: ((status: string) => void) | null = null;

function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'spinpong-';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function onMessage(handler: (msg: MessageType) => void) {
  messageHandler = handler;
}

export function onStatus(handler: (status: string) => void) {
  statusHandler = handler;
}

function setupConnection(conn: DataConnection) {
  connection = conn;
  conn.on('data', (data) => {
    if (messageHandler) messageHandler(data as MessageType);
  });
  conn.on('close', () => {
    if (statusHandler) statusHandler('disconnected');
    connection = null;
  });
  conn.on('error', (err) => {
    console.error('Connection error:', err);
    if (statusHandler) statusHandler('error');
  });
}

export function createRoom(): Promise<string> {
  return new Promise((resolve, reject) => {
    const roomId = generateRoomId();

    peer = new Peer(roomId);

    peer.on('open', (id) => {
      if (statusHandler) statusHandler('waiting');
      resolve(id);
    });

    peer.on('connection', (conn) => {
      setupConnection(conn);
      if (statusHandler) statusHandler('connected');
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      reject(err);
    });
  });
}

export function joinRoom(roomId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    peer = new Peer();

    peer.on('open', () => {
      const conn = peer!.connect(roomId);

      conn.on('open', () => {
        setupConnection(conn);
        if (statusHandler) statusHandler('connected');
        resolve();
      });

      conn.on('error', (err) => {
        reject(err);
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      reject(err);
    });
  });
}

export function sendMessage(msg: MessageType) {
  if (connection && connection.open) {
    connection.send(msg);
  }
}

export function disconnect() {
  if (connection) {
    connection.close();
    connection = null;
  }
  if (peer) {
    peer.destroy();
    peer = null;
  }
  messageHandler = null;
  statusHandler = null;
}

export function isConnected(): boolean {
  return connection !== null && connection.open;
}
