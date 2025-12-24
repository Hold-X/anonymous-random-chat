
export interface User {
  id: string;
  nickname: string;
  avatar: string;
  isCreator?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  sender?: {
    id: string;
    nickname: string;
    avatar: string;
  };
}

export interface Room {
  id: string;
  name: string;
  currentSize: number;
  maxSize: number;
  createdAt: number;
  creator?: string;
}

export interface RoomMember extends User {
  isCreator: boolean;
}

export enum AppState {
  REGISTRATION = 'REGISTRATION',
  LOBBY = 'LOBBY',
  MATCHING = 'MATCHING',
  CHAT = 'CHAT',
  DISCONNECTED = 'DISCONNECTED',
  ROOM_LIST = 'ROOM_LIST',
  ROOM_CHAT = 'ROOM_CHAT'
}
