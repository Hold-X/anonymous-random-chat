
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, ChatMessage, AppState } from './types';
import { Avatar } from './components/Avatar';
import { NeonButton } from './components/NeonButton';
import { 
  User as UserIcon, 
  Send, 
  LogOut, 
  RefreshCcw, 
  Search, 
  Check, 
  X, 
  Radio, 
  AlertCircle,
  MessageCircle
} from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [partner, setPartner] = useState<User | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.REGISTRATION);
  const [nickname, setNickname] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showExitModal, setShowExitModal] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初始化头像种子
  useEffect(() => {
    const saved = localStorage.getItem('neonchat_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      setNickname(parsed.nickname);
      setAvatarSeed(parsed.id);
    } else {
      setAvatarSeed(Math.random().toString(36).substring(7));
    }
  }, []);

  // 连接 WebSocket
  const connectSocket = useCallback((profile: User) => {
    // 自动判断环境：开发环境使用 3001 端口，生产环境使用当前 host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const isDev = import.meta.env.DEV;
    const host = window.location.host;
    
    const url = import.meta.env.VITE_WEBSOCKET_URL || 
      (isDev ? `${protocol}//${window.location.hostname}:3001` : `${protocol}//${host}`);
      
    const socket = new WebSocket(url);
    
    socket.onopen = () => {
      socket.send(JSON.stringify({ 
        type: 'REGISTER', 
        nickname: profile.nickname, 
        avatar: profile.avatar 
      }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'REGISTERED':
          setUser(prev => prev ? { ...prev, id: data.id } : null);
          setAppState(AppState.LOBBY);
          break;
        case 'ONLINE_COUNT':
          setOnlineCount(data.count);
          break;
        case 'MATCH_FOUND':
          setPartner(data.partner);
          setAppState(AppState.CHAT);
          setMessages([]);
          break;
        case 'MESSAGE_RECEIVED':
          setMessages(prev => [...prev, {
            id: Math.random().toString(),
            senderId: data.senderId,
            text: data.text,
            timestamp: data.timestamp
          }]);
          break;
        case 'PARTNER_DISCONNECTED':
          setAppState(AppState.DISCONNECTED);
          break;
      }
    };

    socket.onclose = () => {
      if (appState !== AppState.REGISTRATION) {
        setAppState(AppState.REGISTRATION);
      }
    };

    socketRef.current = socket;
  }, [appState]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRegister = () => {
    if (!nickname.trim()) return;
    const profile: User = {
      id: avatarSeed,
      nickname,
      avatar: `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${avatarSeed}`
    };
    setUser(profile);
    localStorage.setItem('neonchat_user', JSON.stringify(profile));
    connectSocket(profile);
  };

  const handleStartMatching = () => {
    setAppState(AppState.MATCHING);
    socketRef.current?.send(JSON.stringify({ type: 'START_MATCHING' }));
  };

  const handleStopMatching = () => {
    socketRef.current?.send(JSON.stringify({ type: 'STOP_MATCHING' }));
    setAppState(AppState.LOBBY);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !user) return;
    
    const msg = {
      id: Date.now().toString(),
      senderId: user.id,
      text: inputValue,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, msg]);
    socketRef.current?.send(JSON.stringify({ type: 'SEND_MESSAGE', text: inputValue }));
    setInputValue('');
  };

  const handleLogout = () => {
    socketRef.current?.send(JSON.stringify({ type: 'DISCONNECT_CHAT' }));
    setShowExitModal(false);
    setAppState(AppState.LOBBY);
    setPartner(null);
  };

  // 模块一：注册
  const renderRegistration = () => (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <div className="w-full max-w-md glass p-10 rounded-[2.5rem] flex flex-col items-center gap-8 shadow-2xl animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black italic tracking-tighter bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">NEON</h1>
          <p className="text-slate-500 font-medium tracking-widest text-xs uppercase">Anonymous Void</p>
        </div>
        
        <div className="relative group">
          <Avatar 
            src={`https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${avatarSeed}`} 
            size="xl" 
            isBlinking 
            onClick={() => setAvatarSeed(Math.random().toString(36).substring(7))}
          />
          <button 
            onClick={() => setAvatarSeed(Math.random().toString(36).substring(7))}
            className="absolute -bottom-2 -right-2 p-3 bg-gradient-to-tr from-purple-600 to-pink-600 rounded-full shadow-lg shadow-purple-500/50 hover:scale-110 active:scale-95 transition-all"
          >
            <RefreshCcw size={20} className="text-white" />
          </button>
        </div>

        <div className="w-full space-y-4">
          <div className="relative group">
            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="你的代号..." 
              className="w-full pl-12 pr-4 py-4 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-cyan-500/50 transition-all text-white"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
            />
          </div>
          <NeonButton onClick={handleRegister} className="w-full py-4 text-lg" icon={<Radio size={22} />}>
            ENTER THE VOID
          </NeonButton>
        </div>
      </div>
    </div>
  );

  // 模块二：大厅
  const renderLobby = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="fixed top-8 flex items-center gap-2 glass px-6 py-2 rounded-full border border-white/10 animate-in slide-in-from-top duration-700">
        <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></span>
        <span className="text-xs font-bold tracking-widest text-slate-300">{onlineCount} 人在线</span>
      </div>

      <div className="text-center space-y-12">
        <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-[80px] animate-pulse"></div>
          <Avatar src={user?.avatar || ''} size="xl" isBlinking />
        </div>
        
        <div className="space-y-4">
          <h2 className="text-3xl font-bold">准备好连接了吗？</h2>
          <p className="text-slate-500 max-w-xs mx-auto">你的信号正在向黑暗中扩散，谁会捕捉到它？</p>
          <NeonButton onClick={handleStartMatching} variant="secondary" className="w-64" icon={<Search size={20} />}>
            寻找灵魂
          </NeonButton>
        </div>
      </div>
    </div>
  );

  // 匹配中
  const renderMatching = () => (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-16">
      <div className="relative w-72 h-72 flex items-center justify-center">
        <div className="radar-wave"></div>
        <div className="radar-wave"></div>
        <div className="radar-wave"></div>
        <div className="z-10 p-6 glass rounded-full shadow-[0_0_50px_rgba(34,211,238,0.2)]">
          <Avatar src={user?.avatar || ''} size="xl" isBlinking />
        </div>
      </div>
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-widest uppercase animate-pulse">Scanning...</h2>
          <p className="text-cyan-400 text-sm font-medium">正在建立加密隧道</p>
        </div>
        <NeonButton variant="danger" onClick={handleStopMatching} className="px-10">
          取消匹配
        </NeonButton>
      </div>
    </div>
  );

  // 模块三：聊天界面
  const renderChat = () => (
    <div className="h-screen flex flex-col relative overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-30 glass px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <Avatar src={partner?.avatar || ''} size="sm" isBlinking />
          <div>
            <h4 className="font-bold text-white text-sm">{partner?.nickname}</h4>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              <span className="text-[10px] text-slate-400 font-bold tracking-tight">ENCRYPTED</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowExitModal(true)}
          className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto pt-24 pb-32 px-6 no-scrollbar space-y-6 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-${isMe ? 'right' : 'left'}-5`}>
              <div className={`max-w-[75%] space-y-1`}>
                <div className={`
                  px-5 py-3 rounded-2xl text-sm leading-relaxed
                  ${isMe ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-tr-none shadow-lg shadow-purple-500/20' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'}
                `}>
                  {msg.text}
                </div>
                <p className={`text-[9px] font-bold text-slate-600 uppercase ${isMe ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer Input */}
      <footer className="fixed bottom-0 inset-x-0 p-6 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-3 glass p-2 pl-6 rounded-full border border-white/10 shadow-2xl">
          <input 
            type="text" 
            placeholder="在虚空中低语..." 
            className="flex-1 bg-transparent py-3 focus:outline-none text-white text-sm"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button 
            type="submit"
            disabled={!inputValue.trim()}
            className={`p-3.5 rounded-full transition-all duration-500 ${inputValue.trim() ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/50 rotate-0' : 'bg-slate-800 text-slate-600 -rotate-45 opacity-50'}`}
          >
            <Send size={20} />
          </button>
        </form>
      </footer>

      {/* Exit Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="w-full max-w-sm glass rounded-3xl p-8 flex flex-col items-center text-center gap-6 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">断开连接？</h3>
              <p className="text-slate-400 text-sm">这次奇遇将永远消失在静电中。</p>
            </div>
            <div className="flex gap-4 w-full">
              <button onClick={() => setShowExitModal(false)} className="flex-1 py-4 bg-slate-800 rounded-2xl text-sm font-bold">返回</button>
              <button onClick={handleLogout} className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-red-600/30">确认离开</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDisconnected = () => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md glass p-12 rounded-[2.5rem] flex flex-col items-center text-center gap-10 shadow-2xl animate-in zoom-in">
        <div className="relative">
          <div className="absolute inset-0 bg-slate-500/20 blur-2xl rounded-full"></div>
          <div className="grayscale opacity-50 scale-90">
            <Avatar src={partner?.avatar || ''} size="xl" />
          </div>
          <X className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500 w-16 h-16" />
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-black tracking-tight text-slate-300">信号中断</h2>
          <p className="text-slate-500 text-sm">对方已漂回虚空深处。</p>
        </div>
        <NeonButton onClick={() => setAppState(AppState.LOBBY)} className="w-full" icon={<RefreshCcw size={20} />}>
          回到大厅
        </NeonButton>
      </div>
    </div>
  );

  return (
    <div className="w-full h-screen font-sans selection:bg-cyan-500 selection:text-white">
      {appState === AppState.REGISTRATION && renderRegistration()}
      {appState === AppState.LOBBY && renderLobby()}
      {appState === AppState.MATCHING && renderMatching()}
      {appState === AppState.CHAT && renderChat()}
      {appState === AppState.DISCONNECTED && renderDisconnected()}
    </div>
  );
};

export default App;
