
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, ChatMessage, AppState, Room, RoomMember } from './types';
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
  MessageCircle,
  Globe,
  Plus,
  Users,
  Crown,
  Hash,
  ArrowLeft
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
  
  // 房间相关状态
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomMaxSize, setRoomMaxSize] = useState(10);
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [showMemberList, setShowMemberList] = useState(false);
  
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
        // 房间相关消息
        case 'ROOM_LIST':
          setRooms(data.rooms);
          break;
        case 'ROOM_LIST_UPDATE':
          setRooms(data.rooms);
          break;
        case 'ROOM_JOINED':
          setCurrentRoom(data.room);
          setRoomMembers(data.members);
          setAppState(AppState.ROOM_CHAT);
          setMessages([]);
          break;
        case 'USER_JOINED':
          setRoomMembers(prev => [...prev, data.user]);
          setMessages(prev => [...prev, {
            id: Math.random().toString(),
            senderId: 'system',
            text: `⚡️ ${data.user.nickname} 接入了频段`,
            timestamp: Date.now()
          }]);
          break;
        case 'USER_LEFT':
          setRoomMembers(prev => prev.filter(m => m.id !== data.userId));
          setMessages(prev => [...prev, {
            id: Math.random().toString(),
            senderId: 'system',
            text: `🚫 ${data.nickname} 断开了连接`,
            timestamp: Date.now()
          }]);
          break;
        case 'ROOM_MESSAGE_RECEIVED':
          setMessages(prev => [...prev, {
            id: Math.random().toString(),
            senderId: data.senderId,
            text: data.text,
            timestamp: data.timestamp,
            sender: data.sender
          }]);
          break;
        case 'ERROR':
          alert(data.message);
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

  // 房间相关处理函数
  const handleEnterPlaza = () => {
    setAppState(AppState.ROOM_LIST);
    socketRef.current?.send(JSON.stringify({ type: 'GET_ROOMS' }));
  };

  const handleCreateRoom = () => {
    if (!roomName.trim() || roomName.length > 15) {
      alert('房间名称必须在1-15字符之间');
      return;
    }
    socketRef.current?.send(JSON.stringify({ 
      type: 'CREATE_ROOM', 
      name: roomName.trim(),
      maxSize: roomMaxSize
    }));
    setShowCreateModal(false);
    setRoomName('');
    setRoomMaxSize(10);
  };

  const handleJoinRoom = (roomId: string) => {
    socketRef.current?.send(JSON.stringify({ type: 'JOIN_ROOM', roomId }));
  };

  const handleLeaveRoom = () => {
    socketRef.current?.send(JSON.stringify({ type: 'LEAVE_ROOM' }));
    setShowExitModal(false);
    setAppState(AppState.ROOM_LIST);
    setCurrentRoom(null);
    setRoomMembers([]);
    socketRef.current?.send(JSON.stringify({ type: 'GET_ROOMS' }));
  };

  const handleSendRoomMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !user) return;
    
    socketRef.current?.send(JSON.stringify({ 
      type: 'SEND_ROOM_MESSAGE', 
      text: inputValue 
    }));
    setInputValue('');
  };

  const handleRefreshRooms = () => {
    socketRef.current?.send(JSON.stringify({ type: 'GET_ROOMS' }));
  };

  const handleBackToLobby = () => {
    setAppState(AppState.LOBBY);
    setRoomSearchQuery('');
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

  // 模块二：大厅（改造版）
  const renderLobby = () => (
    <div className="space-y-12 min-h-screen flex flex-col items-center justify-center p-6 pb-24 overflow-y-auto animate-in fade-in slide-in-from-bottom duration-500">
      <div className="top-8 flex items-center gap-2 glass px-6 py-2 rounded-full border border-white/10 animate-in slide-in-from-top duration-700 z-10">
        <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></span>
        <span className="text-xs font-bold tracking-widest text-slate-300">{onlineCount} 人在线</span>
      </div>

      <div className="w-full max-w-6xl space-y-12 my-auto">
        <div className="text-center space-y-4">
          <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-[60px] animate-pulse"></div>
            <Avatar src={user?.avatar || ''} size="xl" isBlinking />
          </div>
          <h2 className="text-3xl font-bold">选择你的路径</h2>
          <p className="text-slate-500">在虚空中寻找连接，或加入公开频道</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* 随机匹配卡片 */}
          <button
            onClick={handleStartMatching}
            className="group relative p-8 glass rounded-3xl border border-white/10 hover:border-purple-500/50 transition-all duration-500 hover:scale-105 hover:shadow-[0_0_40px_rgba(168,85,247,0.3)] active:scale-100"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-pink-600/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative space-y-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 transition-shadow">
                <Search size={36} className="text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tight">⚡️ 随机匹配</h3>
                <p className="text-slate-400 text-sm">1对1 匿名聊天<br/>雷达扫描，寻找灵魂伴侣</p>
              </div>
              <div className="pt-4">
                <div className="inline-flex items-center gap-2 text-purple-400 text-sm font-bold">
                  <span>开始匹配</span>
                  <Radio size={16} />
                </div>
              </div>
            </div>
          </button>

          {/* 公开频道卡片 */}
          <button
            onClick={handleEnterPlaza}
            className="group relative p-8 glass rounded-3xl border border-white/10 hover:border-cyan-500/50 transition-all duration-500 hover:scale-105 hover:shadow-[0_0_40px_rgba(34,211,238,0.3)] active:scale-100"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative space-y-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:shadow-cyan-500/50 transition-shadow">
                <Globe size={36} className="text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tight">🌐 公开频道</h3>
                <p className="text-slate-400 text-sm">加入群聊房间<br/>在赛博广场中自由交流</p>
              </div>
              <div className="pt-4">
                <div className="inline-flex items-center gap-2 text-cyan-400 text-sm font-bold">
                  <span>进入广场</span>
                  <Hash size={16} />
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  // 匹配中
  const renderMatching = () => (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-16 animate-in fade-in zoom-in duration-500">
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
    <div className="h-screen flex flex-col relative overflow-hidden animate-in fade-in slide-in-from-right duration-500">
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

  // 房间列表页
  const renderRoomList = () => {
    const filteredRooms = rooms.filter(room => 
      room.name.toLowerCase().includes(roomSearchQuery.toLowerCase())
    );

    return (
      <div className="min-h-screen p-6 pb-24 animate-in fade-in slide-in-from-right duration-500">
        {/* 顶部栏 */}
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button 
              onClick={handleBackToLobby}
              className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-all hover:gap-3 active:scale-95"
            >
              <ArrowLeft size={20} />
              <span className="font-bold text-sm">返回大厅</span>
            </button>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              赛博广场
            </h1>
            <div className="w-20"></div>
          </div>

          {/* 搜索和操作栏 */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
              <input
                type="text"
                placeholder="搜索房间..."
                className="w-full pl-12 pr-4 py-3 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-cyan-500/50 transition-all text-white"
                value={roomSearchQuery}
                onChange={(e) => setRoomSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={handleRefreshRooms}
              className="p-3 glass rounded-2xl border border-white/10 hover:border-cyan-500/50 transition-all hover:scale-105 active:scale-95"
            >
              <RefreshCcw size={20} className="text-cyan-400" />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl font-bold text-sm flex items-center gap-2 hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] transition-all hover:scale-105 active:scale-95"
            >
              <Plus size={20} />
              <span>创建房间</span>
            </button>
          </div>

          {/* 房间列表 */}
          {filteredRooms.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-24 h-24 mx-auto bg-slate-800/50 rounded-full flex items-center justify-center">
                <Hash size={48} className="text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-400">暂无信号</h3>
              <p className="text-slate-500 text-sm">创建一个新的据点？</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map(room => {
                const isFull = room.currentSize >= room.maxSize;
                const progress = (room.currentSize / room.maxSize) * 100;
                
                return (
                  <button
                    key={room.id}
                    onClick={() => !isFull && handleJoinRoom(room.id)}
                    disabled={isFull}
                    className={`group relative p-6 glass rounded-2xl border transition-all duration-300 text-left ${
                      isFull 
                        ? 'border-red-500/30 opacity-50 cursor-not-allowed' 
                        : 'border-white/10 hover:border-cyan-500/50 hover:scale-105 hover:shadow-[0_0_30px_rgba(34,211,238,0.2)] active:scale-100'
                    }`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-black tracking-tight line-clamp-1 flex-1">
                          {room.name}
                        </h3>
                        <span className={`w-2 h-2 rounded-full ${isFull ? 'bg-red-500' : 'bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]'}`}></span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-mono">{room.currentSize}/{room.maxSize} 人</span>
                          <span className="text-slate-500">{isFull ? '已满' : '可加入'}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              isFull ? 'bg-red-500' : 'bg-gradient-to-r from-cyan-500 to-blue-600'
                            }`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>

                      {!isFull && (
                        <div className="pt-2 flex items-center gap-2 text-cyan-400 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>点击加入</span>
                          <Users size={14} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 创建房间模态框 */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
            <div className="w-full max-w-md glass rounded-3xl p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black tracking-tight">创建房间</h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">房间名称 *</label>
                  <input
                    type="text"
                    placeholder="最多15个字符"
                    maxLength={15}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-cyan-500/50 transition-all text-white"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-500">{roomName.length}/15</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">最大人数</label>
                  <input
                    type="number"
                    min="2"
                    max="20"
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-cyan-500/50 transition-all text-white"
                    value={roomMaxSize}
                    onChange={(e) => setRoomMaxSize(Math.min(20, Math.max(2, parseInt(e.target.value) || 10)))}
                  />
                  <p className="mt-1 text-xs text-slate-500">2-20人之间</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 bg-slate-800 rounded-2xl font-bold text-sm hover:bg-slate-700 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleCreateRoom}
                  disabled={!roomName.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl font-bold text-sm hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  建立连接
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 群聊界面
  const renderRoomChat = () => {
    const getAvatarBorderColor = (userId: string) => {
      const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const colors = [
        'border-cyan-400',
        'border-purple-400',
        'border-pink-400',
        'border-green-400',
        'border-yellow-400',
        'border-orange-400',
        'border-blue-400',
        'border-red-400'
      ];
      return colors[hash % colors.length];
    };

    return (
      <div className="h-screen flex relative overflow-hidden animate-in fade-in slide-in-from-right duration-500">
        {/* 主聊天区域 */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="glass px-6 py-4 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-3">
              <Hash className="text-cyan-400" size={24} />
              <div>
                <h4 className="font-bold text-white">{currentRoom?.name}</h4>
                <div className="flex items-center gap-2 text-xs">
                  <Users size={12} className="text-slate-400" />
                  <span className="text-slate-400 font-bold">{roomMembers.length}/{currentRoom?.maxSize}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMemberList(!showMemberList)}
                className="md:hidden p-3 bg-cyan-500/10 text-cyan-400 rounded-2xl hover:bg-cyan-500/20 transition-all"
              >
                <Users size={20} />
              </button>
              <button 
                onClick={() => setShowExitModal(true)}
                className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
              >
                <LogOut size={20} />
              </button>
            </div>
          </header>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto pt-6 pb-32 px-6 no-scrollbar space-y-6 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
            {messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              const isSystem = msg.senderId === 'system';
              
              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <p className="text-xs font-mono text-green-600/70 px-4 py-1.5 bg-green-500/5 rounded-full border border-green-500/10">
                      {msg.text}
                    </p>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-${isMe ? 'right' : 'left'}-5`}>
                  <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!isMe && msg.sender && (
                      <div className="flex items-center gap-2 px-2">
                        <div className={`w-6 h-6 rounded-full border-2 ${getAvatarBorderColor(msg.senderId)} overflow-hidden`}>
                          <img src={msg.sender.avatar} alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-xs font-bold text-slate-400">{msg.sender.nickname}</span>
                      </div>
                    )}
                    <div className={`
                      px-5 py-3 rounded-2xl text-sm leading-relaxed
                      ${isMe ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-tr-none shadow-lg shadow-purple-500/20' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'}
                    `}>
                      {msg.text}
                    </div>
                    <p className={`text-[9px] font-bold text-slate-600 uppercase px-2 ${isMe ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <footer className="fixed bottom-0 left-0 right-0 md:right-80 p-6 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
            <form onSubmit={handleSendRoomMessage} className="max-w-4xl mx-auto flex items-center gap-3 glass p-2 pl-6 rounded-full border border-white/10 shadow-2xl">
              <input 
                type="text" 
                placeholder="在频道中发言..." 
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
        </div>

        {/* 成员列表侧边栏 (桌面端) */}
        <div className="hidden md:block w-80 glass border-l border-white/5 p-6 overflow-y-auto">
          <h3 className="text-sm font-black tracking-widest text-slate-400 uppercase mb-4">成员列表</h3>
          <div className="space-y-3">
            {roomMembers.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
                <div className={`w-10 h-10 rounded-full border-2 ${getAvatarBorderColor(member.id)} overflow-hidden`}>
                  <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold truncate">{member.nickname}</p>
                    {member.isCreator && <Crown size={14} className="text-yellow-400 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 font-mono truncate">{member.id.substring(0, 8)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 成员列表抽屉 (移动端) */}
        {showMemberList && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowMemberList(false)}>
            <div className="absolute right-0 top-0 bottom-0 w-80 glass p-6 overflow-y-auto animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black tracking-widest text-slate-400 uppercase">成员列表</h3>
                <button onClick={() => setShowMemberList(false)} className="p-2 hover:bg-white/10 rounded-xl">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-3">
                {roomMembers.map(member => (
                  <div key={member.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
                    <div className={`w-10 h-10 rounded-full border-2 ${getAvatarBorderColor(member.id)} overflow-hidden`}>
                      <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate">{member.nickname}</p>
                        {member.isCreator && <Crown size={14} className="text-yellow-400 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 font-mono truncate">{member.id.substring(0, 8)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Exit Modal */}
        {showExitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
            <div className="w-full max-w-sm glass rounded-3xl p-8 flex flex-col items-center text-center gap-6 shadow-2xl animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                <AlertCircle size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">离开房间？</h3>
                <p className="text-slate-400 text-sm">你将退出当前频道</p>
              </div>
              <div className="flex gap-4 w-full">
                <button onClick={() => setShowExitModal(false)} className="flex-1 py-4 bg-slate-800 rounded-2xl text-sm font-bold">返回</button>
                <button onClick={handleLeaveRoom} className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-red-600/30">确认离开</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDisconnected = () => (
    <div className="min-h-screen flex items-center justify-center p-6 animate-in fade-in zoom-in duration-500">
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
    <div className="w-full h-screen font-sans selection:bg-cyan-500 selection:text-white overflow-y-auto">
      {appState === AppState.REGISTRATION && renderRegistration()}
      {appState === AppState.LOBBY && renderLobby()}
      {appState === AppState.MATCHING && renderMatching()}
      {appState === AppState.CHAT && renderChat()}
      {appState === AppState.DISCONNECTED && renderDisconnected()}
      {appState === AppState.ROOM_LIST && renderRoomList()}
      {appState === AppState.ROOM_CHAT && renderRoomChat()}
    </div>
  );
};

export default App;
