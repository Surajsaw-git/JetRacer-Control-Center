#!/usr/bin/env node
/**
 * Mock Rosbridge Server for JetRacer Control Center
 * DEV ONLY — NOT A REAL ROBOT.
 * Speaks the rosbridge v2 protocol over WebSocket on port 9090.
 */

import { WebSocketServer } from 'ws';
import http from 'http';

const args = process.argv.slice(2);
const flagRefuse = args.includes('--refuse');
const flagHang = args.includes('--hang');
const flagDrop = args.includes('--drop');

let artificialDelayMs = 0;
const delayIndex = args.indexOf('--delay');
if (delayIndex !== -1 && args[delayIndex + 1]) {
  artificialDelayMs = parseInt(args[delayIndex + 1], 10) || 0;
}

const PORT = parseInt(process.env.MOCK_ROSBRIDGE_PORT || '9090', 10);
const HOST = process.env.MOCK_ROSBRIDGE_HOST || '127.0.0.1';

console.log('================================================================');
console.log(`[MOCK ROSBRIDGE] DEV ONLY — NOT A REAL ROBOT — listening on ws://${HOST}:${PORT}`);
if (flagRefuse) console.log('  [FLAG] --refuse active: incoming sockets will be closed immediately.');
if (flagHang) console.log('  [FLAG] --hang active: connections will hang and never reply.');
if (flagDrop) console.log('  [FLAG] --drop active: connections will close 1 second after first reply.');
if (artificialDelayMs > 0) console.log(`  [FLAG] --delay active: ${artificialDelayMs}ms latency applied to responses.`);
console.log('================================================================');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Mock Rosbridge Server (Dev Only)\n');
});

if (flagHang) {
  // If hang flag is active, listen on TCP but do not complete the WebSocket upgrade
  server.on('upgrade', (_req, socket) => {
    // Keep socket open without sending HTTP 101 Switching Protocols response
    socket.setTimeout(0);
  });
} else {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[MOCK ROSBRIDGE] Client connected from ${clientIp}`);

    if (flagRefuse) {
      console.log('[MOCK ROSBRIDGE] --refuse: Terminating connection immediately.');
      ws.close(1008, 'Refused by mock');
      return;
    }

    let hasReplied = false;

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch (err) {
        console.warn('[MOCK ROSBRIDGE] Invalid JSON received:', err);
        return;
      }

      console.log(`[MOCK ROSBRIDGE] Received op: "${msg.op}" (id: ${msg.id || 'none'})`);

      const respond = (responseObj) => {
        const payload = JSON.stringify(responseObj);
        const sendResponse = () => {
          if (ws.readyState === ws.OPEN) {
            ws.send(payload);
            console.log(`[MOCK ROSBRIDGE] Sent op: "${responseObj.op}" for service "${responseObj.service || ''}"`);
            if (flagDrop && !hasReplied) {
              hasReplied = true;
              console.log('[MOCK ROSBRIDGE] --drop: Scheduling connection drop in 1000ms.');
              setTimeout(() => {
                ws.terminate();
                console.log('[MOCK ROSBRIDGE] --drop: Connection terminated.');
              }, 1000);
            }
          }
        };

        if (artificialDelayMs > 0) {
          setTimeout(sendResponse, artificialDelayMs);
        } else {
          sendResponse();
        }
      };

      if (msg.op === 'call_service') {
        if (msg.service === '/rosapi/get_time') {
          const nowMs = Date.now();
          const secs = Math.floor(nowMs / 1000);
          const nsecs = (nowMs % 1000) * 1000000;

          respond({
            op: 'service_response',
            service: '/rosapi/get_time',
            id: msg.id,
            values: {
              time: {
                secs,
                nsecs,
              },
            },
            result: true,
          });
        } else {
          console.log(`[MOCK ROSBRIDGE] Service "${msg.service}" unknown. Returning polite failure.`);
          respond({
            op: 'service_response',
            service: msg.service,
            id: msg.id,
            values: {},
            result: false,
          });
        }
      } else if (msg.op === 'subscribe' || msg.op === 'unsubscribe') {
        console.log(`[MOCK ROSBRIDGE] Handled topic "${msg.op}" on topic "${msg.topic}" (mock no-op)`);
      } else if (msg.op === 'publish' || msg.op === 'advertise') {
        console.warn(`[MOCK ROSBRIDGE] CAUTION: Client attempted "${msg.op}" on "${msg.topic}". Phase 3 is read-only!`);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`[MOCK ROSBRIDGE] Client disconnected (code: ${code}, reason: "${reason}")`);
    });

    ws.on('error', (err) => {
      console.error('[MOCK ROSBRIDGE] Client socket error:', err.message);
    });
  });
}

server.listen(PORT, HOST, () => {
  // Server bound
});
