
export interface User {
  id: string;
  nickname: string;
  avatar: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export enum AppState {
  REGISTRATION = 'REGISTRATION',
  LOBBY = 'LOBBY',
  MATCHING = 'MATCHING',
  CHAT = 'CHAT',
  DISCONNECTED = 'DISCONNECTED'
}
