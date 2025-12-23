
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
        if (!waitingQueue.includes(clientId)) {
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
    }
  });

  ws.on('close', () => {
    handleChatBreakup(clientId);
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

// 处理所有未匹配的路由请求，返回 index.html
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`NeonChat Server running on port ${PORT}`);
});
