const WebSocket = require('ws');
const fs = require('fs');
const WebSocketServer = WebSocket.Server;

const webSocketServer = new WebSocketServer({
  port: 3600
});

webSocketServer.nextFrame = 0;
webSocketServer.on('connection', (webSocketClient) => {
  webSocketClient.on('message', async (data) => {
    const frame = JSON.parse(data);
    if (frame.index === webSocketServer.nextFrame) {
      console.group('Success');
      console.log(`Received Frame ${frame.index}`);
      console.groupEnd();
      let fId = frame.index;
      setTimeout(() => {
        const data = JSON.stringify({
          event: 'acknowledge',
          data: fId
        });
        webSocketClient.send(data);
      }, 100);
      webSocketServer.nextFrame++;
    } else {
      console.group('Failure');
      console.log(`received ${frame.index} instead of ${webSocketServer.nextFrame}`);
      console.groupEnd();
    }
  });
});

const webSocketClient = new WebSocket('ws://localhost:3600');

webSocketClient.frames = JSON.parse(fs.readFileSync('frames.json')).map(f => {f.acknowledged = false; return f});

webSocketClient.nextFrame = 0;
webSocketClient.resetTo = null;
webSocketClient.on('open', async () => {
  while (true) {
    if (webSocketClient.resetTo !== null) {
      webSocketClient.nextFrame = webSocketClient.resetTo;
      webSocketClient.resetTo = null;
    }
    if (!webSocketClient.frames[webSocketClient.nextFrame]) {
      await new Promise(r => setTimeout(() => r(), 100));
      continue;
    }

    const frameToSend = webSocketClient.nextFrame

    webSocketClient.send(JSON.stringify(webSocketClient.frames[webSocketClient.nextFrame]));
    setTimeout(() => {
      let frameToCheck = frameToSend;
      if (!webSocketClient.frames[frameToCheck]) return;
      if (webSocketClient.frames[frameToCheck].acknowledged === false) {
        webSocketClient.resetTo = frameToCheck;
      }
    }, 500);

    await new Promise(r => setTimeout(() => {
      webSocketClient.nextFrame++;
      r();
    }, 100));
  }
});

webSocketClient.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.event === 'acknowledge') {
    webSocketClient.frames[msg.data].acknowledged = true;
  }
});
