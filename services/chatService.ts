
import { User, ChatMessage } from '../types';

// Mock service simulating a WebSocket connection
class ChatService {
  private static instance: ChatService;
  private listeners: Set<(data: any) => void> = new Set();
  private matchTimeout: any = null;

  static getInstance() {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  // Simulated subscription
  subscribe(callback: (data: any) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(data: any) {
    this.listeners.forEach(cb => cb(data));
  }

  // Simulate finding a random partner
  startMatching(currentUser: User) {
    this.matchTimeout = setTimeout(() => {
      const partner: User = {
        id: Math.random().toString(36).substr(2, 9),
        nickname: ['CyberGhost', 'NeonDrifter', 'EchoVibe', 'StaticVoid'][Math.floor(Math.random() * 4)],
        avatar: `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${Math.random()}`,
      };
      this.emit({ type: 'MATCH_FOUND', partner });
    }, 3000);
  }

  stopMatching() {
    if (this.matchTimeout) {
      clearTimeout(this.matchTimeout);
    }
  }

  sendMessage(message: ChatMessage) {
    // Simulate auto-reply from bot
    setTimeout(() => {
      const reply: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        senderId: 'partner',
        text: this.getRandomReply(),
        timestamp: Date.now(),
      };
      this.emit({ type: 'MESSAGE_RECEIVED', message: reply });
    }, 1500 + Math.random() * 2000);
  }

  private getRandomReply() {
    const replies = [
      "The void is quiet tonight.",
      "Neon lights are all I see.",
      "Who are you in the real world?",
      "That's interesting... tell me more.",
      "Do you believe in digital ghosts?",
      "The signal is strong between us.",
      "Wait, did you hear that static?",
      "Nice nickname by the way.",
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }
}

export const chatService = ChatService.getInstance();
