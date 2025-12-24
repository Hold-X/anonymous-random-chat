
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// 内存存储
const clients = new Map(); // id -> socket
const waitingQueue = [];   // ids
const activePairs = new Map(); // idA -> idB, idB -> idA
const userProfiles = new Map(); // id -> {nickname, avatar}

// 房间管理系统
const rooms = new Map(); // roomId -> { id, name, creator, clients: Set, maxSize, createdAt }
const userRooms = new Map(); // userId -> roomId (用户当前所在房间)

// 托管静态文件
app.use(express.static(path.join(__dirname, 'dist')));

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    switch (data.type) {
      case 'REGISTER':
        userProfiles.set(clientId, {
          nickname: data.nickname,
          avatar: data.avatar
        });
        ws.send(JSON.stringify({ type: 'REGISTERED', id: clientId }));
        broadcastOnlineCount();
        break;

      case 'START_MATCHING':
        // 确保用户不在房间中
        if (!userRooms.has(clientId) && !waitingQueue.includes(clientId)) {
          waitingQueue.push(clientId);
          tryMatch();
        }
        break;

      case 'STOP_MATCHING':
        const index = waitingQueue.indexOf(clientId);
        if (index > -1) waitingQueue.splice(index, 1);
        break;

      case 'SEND_MESSAGE':
        const partnerId = activePairs.get(clientId);
        if (partnerId && clients.has(partnerId)) {
          clients.get(partnerId).send(JSON.stringify({
            type: 'MESSAGE_RECEIVED',
            senderId: clientId,
            text: data.text,
            timestamp: Date.now()
          }));
        }
        break;

      case 'DISCONNECT_CHAT':
        handleChatBreakup(clientId);
        break;

      // 房间相关操作
      case 'GET_ROOMS':
        sendRoomList(clientId);
        break;

      case 'CREATE_ROOM':
        createRoom(clientId, data.name, data.maxSize);
        break;

      case 'JOIN_ROOM':
        joinRoom(clientId, data.roomId);
        break;

      case 'LEAVE_ROOM':
        leaveRoom(clientId);
        break;

      case 'SEND_ROOM_MESSAGE':
        sendRoomMessage(clientId, data.text);
        break;
    }
  });

  ws.on('close', () => {
    handleChatBreakup(clientId);
    leaveRoom(clientId); // 离开房间
    const qIdx = waitingQueue.indexOf(clientId);
    if (qIdx > -1) waitingQueue.splice(qIdx, 1);
    clients.delete(clientId);
    userProfiles.delete(clientId);
    broadcastOnlineCount();
  });
});

function tryMatch() {
  while (waitingQueue.length >= 2) {
    const idA = waitingQueue.shift();
    const idB = waitingQueue.shift();

    activePairs.set(idA, idB);
    activePairs.set(idB, idA);

    const profileA = userProfiles.get(idA);
    const profileB = userProfiles.get(idB);

    clients.get(idA).send(JSON.stringify({ type: 'MATCH_FOUND', partner: { ...profileB, id: idB } }));
    clients.get(idB).send(JSON.stringify({ type: 'MATCH_FOUND', partner: { ...profileA, id: idA } }));
  }
}

function handleChatBreakup(id) {
  const partnerId = activePairs.get(id);
  if (partnerId) {
    if (clients.has(partnerId)) {
      clients.get(partnerId).send(JSON.stringify({ type: 'PARTNER_DISCONNECTED' }));
    }
    activePairs.delete(id);
    activePairs.delete(partnerId);
  }
}

function broadcastOnlineCount() {
  const count = clients.size;
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'ONLINE_COUNT', count }));
    }
  });
}

// 房间管理函数
function sendRoomList(clientId) {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    currentSize: room.clients.size,
    maxSize: room.maxSize,
    createdAt: room.createdAt
  }));
  
  const client = clients.get(clientId);
  if (client && client.readyState === 1) {
    client.send(JSON.stringify({ 
      type: 'ROOM_LIST', 
      rooms: roomList 
    }));
  }
}

function createRoom(clientId, name, maxSize = 10) {
  // 验证参数
  if (!name || name.trim().length === 0 || name.length > 15) {
    const client = clients.get(clientId);
    if (client && client.readyState === 1) {
      client.send(JSON.stringify({ 
        type: 'ERROR', 
        message: '房间名称必须在1-15字符之间' 
      }));
    }
    return;
  }

  const roomId = uuidv4();
  const room = {
    id: roomId,
    name: name.trim(),
    creator: clientId,
    clients: new Set([clientId]),
    maxSize: Math.min(Math.max(maxSize || 10, 2), 20), // 限制2-20人
    createdAt: Date.now()
  };

  rooms.set(roomId, room);
  userRooms.set(clientId, roomId);

  // 通知创建者进入房间
  const profile = userProfiles.get(clientId);
  const client = clients.get(clientId);
  if (client && client.readyState === 1) {
    client.send(JSON.stringify({
      type: 'ROOM_JOINED',
      room: {
        id: room.id,
        name: room.name,
        creator: room.creator,
        maxSize: room.maxSize
      },
      members: [{
        id: clientId,
        nickname: profile.nickname,
        avatar: profile.avatar,
        isCreator: true
      }]
    }));
  }

  // 广播房间列表更新
  broadcastRoomListUpdate();
}

function joinRoom(clientId, roomId) {
  const room = rooms.get(roomId);
  
  if (!room) {
    const client = clients.get(clientId);
    if (client && client.readyState === 1) {
      client.send(JSON.stringify({ 
        type: 'ERROR', 
        message: '房间不存在' 
      }));
    }
    return;
  }

  if (room.clients.size >= room.maxSize) {
    const client = clients.get(clientId);
    if (client && client.readyState === 1) {
      client.send(JSON.stringify({ 
        type: 'ERROR', 
        message: '房间已满' 
      }));
    }
    return;
  }

  // 添加用户到房间
  room.clients.add(clientId);
  userRooms.set(clientId, roomId);

  // 获取所有成员信息
  const members = Array.from(room.clients).map(id => {
    const profile = userProfiles.get(id);
    return {
      id,
      nickname: profile.nickname,
      avatar: profile.avatar,
      isCreator: id === room.creator
    };
  });

  // 通知新加入的用户
  const client = clients.get(clientId);
  if (client && client.readyState === 1) {
    client.send(JSON.stringify({
      type: 'ROOM_JOINED',
      room: {
        id: room.id,
        name: room.name,
        creator: room.creator,
        maxSize: room.maxSize
      },
      members
    }));
  }

  // 通知房间内其他人有新成员加入
  const joinerProfile = userProfiles.get(clientId);
  broadcastToRoom(roomId, {
    type: 'USER_JOINED',
    user: {
      id: clientId,
      nickname: joinerProfile.nickname,
      avatar: joinerProfile.avatar,
      isCreator: false
    }
  }, clientId); // 排除自己

  // 广播房间列表更新
  broadcastRoomListUpdate();
}

function leaveRoom(clientId) {
  const roomId = userRooms.get(clientId);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) {
    userRooms.delete(clientId);
    return;
  }

  // 从房间移除用户
  room.clients.delete(clientId);
  userRooms.delete(clientId);

  const userProfile = userProfiles.get(clientId);

  // 通知房间内其他人
  if (room.clients.size > 0) {
    broadcastToRoom(roomId, {
      type: 'USER_LEFT',
      userId: clientId,
      nickname: userProfile?.nickname || 'Unknown'
    });
  }

  // 如果房间为空，销毁房间
  if (room.clients.size === 0) {
    rooms.delete(roomId);
  }

  // 广播房间列表更新
  broadcastRoomListUpdate();
}

function sendRoomMessage(clientId, text) {
  const roomId = userRooms.get(clientId);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  const senderProfile = userProfiles.get(clientId);
  
  // 广播消息给房间内所有人（包括自己）
  broadcastToRoom(roomId, {
    type: 'ROOM_MESSAGE_RECEIVED',
    senderId: clientId,
    sender: {
      id: clientId,
      nickname: senderProfile.nickname,
      avatar: senderProfile.avatar
    },
    text,
    timestamp: Date.now()
  });
}

function broadcastToRoom(roomId, message, excludeId = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.clients.forEach(clientId => {
    if (clientId === excludeId) return;
    
    const client = clients.get(clientId);
    if (client && client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
}

function broadcastRoomListUpdate() {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    currentSize: room.clients.size,
    maxSize: room.maxSize,
    createdAt: room.createdAt
  }));

  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ 
        type: 'ROOM_LIST_UPDATE', 
        rooms: roomList 
      }));
    }
  });
}

// 处理所有未匹配的路由请求，返回 index.html
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`NeonChat Server running on port ${PORT}`);
});
