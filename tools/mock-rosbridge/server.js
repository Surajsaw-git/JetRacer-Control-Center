#!/usr/bin/env node
/**
 * Mock Rosbridge Server for JetRacer Control Center
 * DEV ONLY — NOT A REAL ROBOT.
 * Speaks the rosbridge v2 protocol over WebSocket on port 9090.
 *
 * Implements fake ROS 1 computation graph using strictly non-robot mock names (/mock_world/*),
 * rosapi introspection services, rate-throttled synthetic publishers, and failure flags.
 */

import wsPkg from '../../frontend/node_modules/ws/index.js';
const { WebSocketServer } = wsPkg;
import http from 'http';

const args = process.argv.slice(2);
const flagRefuse = args.includes('--refuse');
const flagHang = args.includes('--hang');
const flagDrop = args.includes('--drop');
const flagNoRosapi = args.includes('--no-rosapi');
const flagFlood = args.includes('--flood');

let artificialDelayMs = 0;
const delayIndex = args.indexOf('--delay');
if (delayIndex !== -1 && args[delayIndex + 1]) {
  artificialDelayMs = parseInt(args[delayIndex + 1], 10) || 0;
}

const PORT = parseInt(process.env.MOCK_ROSBRIDGE_PORT || '9090', 10);
const HOST = process.env.MOCK_ROSBRIDGE_HOST || '127.0.0.1';

// Synthetic Graph Definition (strictly non-robot fake names)
const MOCK_TOPICS = [
  { name: '/mock_world/odom', type: 'nav_msgs/Odometry' },
  { name: '/mock_world/scan', type: 'sensor_msgs/LaserScan' },
  { name: '/mock_world/imu', type: 'sensor_msgs/Imu' },
  { name: '/mock_world/battery', type: 'sensor_msgs/BatteryState' },
  { name: '/mock_world/camera/image_raw', type: 'sensor_msgs/Image' },
  { name: '/mock_world/cmd_vel', type: 'geometry_msgs/Twist' },
  { name: '/mock_world/tf', type: 'tf2_msgs/TFMessage' },
  { name: '/mock_world/tf_static', type: 'tf2_msgs/TFMessage' },
  { name: '/mock_world/test_nan', type: 'sensor_msgs/Imu' },
];

const MOCK_NODES = [
  '/mock_world/base_controller',
  '/mock_world/lidar_node',
  '/mock_world/camera_driver',
  '/mock_world/imu_filter',
  '/mock_world/rosapi',
];

const MOCK_SERVICES = [
  '/rosapi/get_time',
  '/rosapi/topics',
  '/rosapi/topic_type',
  '/rosapi/topics_and_raw_types',
  '/rosapi/nodes',
  '/rosapi/node_details',
  '/rosapi/services',
  '/rosapi/service_type',
  '/rosapi/publishers',
  '/rosapi/subscribers',
  '/rosapi/message_details',
  '/mock_world/status',
  '/mock_world/reset_sim',
];

console.log('================================================================');
console.log(`[MOCK ROSBRIDGE] DEV ONLY — NOT A REAL ROBOT — listening on ws://${HOST}:${PORT}`);
if (flagRefuse) console.log('  [FLAG] --refuse active: incoming sockets will be closed immediately.');
if (flagHang) console.log('  [FLAG] --hang active: connections will hang and never reply.');
if (flagDrop) console.log('  [FLAG] --drop active: connections will close 1 second after first reply.');
if (flagNoRosapi) console.log('  [FLAG] --no-rosapi active: rosapi services will return failure.');
if (flagFlood) console.log('  [FLAG] --flood active: publishers will stream at 50 Hz.');
if (artificialDelayMs > 0) console.log(`  [FLAG] --delay active: ${artificialDelayMs}ms latency applied to responses.`);
console.log('================================================================');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Mock Rosbridge Server (Dev Only)\n');
});

if (flagHang) {
  server.on('upgrade', (_req, socket) => {
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
    const activePublishTimers = new Map();

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
        if (flagNoRosapi && msg.service.startsWith('/rosapi/')) {
          respond({
            op: 'service_response',
            service: msg.service,
            id: msg.id,
            values: {},
            result: false,
          });
          return;
        }

        if (msg.service === '/rosapi/get_time') {
          const nowMs = Date.now();
          const secs = Math.floor(nowMs / 1000);
          const nsecs = (nowMs % 1000) * 1000000;

          respond({
            op: 'service_response',
            service: '/rosapi/get_time',
            id: msg.id,
            values: { time: { secs, nsecs } },
            result: true,
          });
        } else if (msg.service === '/rosapi/topics') {
          respond({
            op: 'service_response',
            service: '/rosapi/topics',
            id: msg.id,
            values: { topics: MOCK_TOPICS.map((t) => t.name) },
            result: true,
          });
        } else if (msg.service === '/rosapi/topics_and_raw_types') {
          respond({
            op: 'service_response',
            service: '/rosapi/topics_and_raw_types',
            id: msg.id,
            values: {
              topics: MOCK_TOPICS.map((t) => t.name),
              types: MOCK_TOPICS.map((t) => t.type),
            },
            result: true,
          });
        } else if (msg.service === '/rosapi/topic_type') {
          const target = msg.args?.topic || '';
          const match = MOCK_TOPICS.find((t) => t.name === target);
          respond({
            op: 'service_response',
            service: '/rosapi/topic_type',
            id: msg.id,
            values: { type: match ? match.type : 'unknown' },
            result: Boolean(match),
          });
        } else if (msg.service === '/rosapi/nodes') {
          respond({
            op: 'service_response',
            service: '/rosapi/nodes',
            id: msg.id,
            values: { nodes: MOCK_NODES },
            result: true,
          });
        } else if (msg.service === '/rosapi/node_details') {
          const node = msg.args?.node || '';
          respond({
            op: 'service_response',
            service: '/rosapi/node_details',
            id: msg.id,
            values: {
              publishing: ['/mock_world/odom', '/mock_world/tf'],
              subscribing: ['/mock_world/cmd_vel'],
              services: ['/mock_world/status'],
            },
            result: true,
          });
        } else if (msg.service === '/rosapi/services') {
          respond({
            op: 'service_response',
            service: '/rosapi/services',
            id: msg.id,
            values: { services: MOCK_SERVICES },
            result: true,
          });
        } else if (msg.service === '/rosapi/publishers') {
          respond({
            op: 'service_response',
            service: '/rosapi/publishers',
            id: msg.id,
            values: { publishers: ['/mock_world/base_controller'] },
            result: true,
          });
        } else if (msg.service === '/rosapi/subscribers') {
          respond({
            op: 'service_response',
            service: '/rosapi/subscribers',
            id: msg.id,
            values: { subscribers: ['/mock_world/imu_filter'] },
            result: true,
          });
        } else {
          respond({
            op: 'service_response',
            service: msg.service,
            id: msg.id,
            values: {},
            result: false,
          });
        }
      } else if (msg.op === 'subscribe') {
        const topic = msg.topic;
        console.log(`[MOCK ROSBRIDGE] Client subscribed to "${topic}"`);

        // Stop existing timer for this topic if re-subscribed
        if (activePublishTimers.has(topic)) {
          clearInterval(activePublishTimers.get(topic));
        }

        const publishRateMs = flagFlood ? 20 : 200;
        let tick = 0;

        const timer = setInterval(() => {
          if (ws.readyState !== ws.OPEN) {
            clearInterval(timer);
            return;
          }

          tick++;
          let messageData = {};

          if (topic === '/mock_world/odom') {
            messageData = {
              header: { seq: tick, stamp: { secs: Math.floor(Date.now() / 1000), nsecs: 0 }, frame_id: 'odom' },
              pose: {
                pose: {
                  position: { x: (tick * 0.05).toFixed(2), y: 0.0, z: 0.0 },
                  orientation: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 },
                },
              },
              twist: {
                twist: {
                  linear: { x: 0.25, y: 0.0, z: 0.0 },
                  angular: { x: 0.0, y: 0.0, z: 0.05 },
                },
              },
            };
          } else if (topic === '/mock_world/scan') {
            // Generate synthetic 360-degree laser scan
            const ranges = [];
            for (let i = 0; i < 360; i++) {
              ranges.push(Number((1.5 + 0.3 * Math.sin((i * Math.PI) / 180 + tick * 0.1)).toFixed(2)));
            }
            messageData = {
              header: { seq: tick, stamp: { secs: Math.floor(Date.now() / 1000), nsecs: 0 }, frame_id: 'laser' },
              angle_min: -3.14159,
              angle_max: 3.14159,
              angle_increment: 0.01745,
              range_min: 0.15,
              range_max: 12.0,
              ranges,
              intensities: [],
            };
          } else if (topic === '/mock_world/imu') {
            messageData = {
              linear_acceleration: { x: 0.02, y: -0.01, z: 9.81 },
              angular_velocity: { x: 0.0, y: 0.0, z: 0.01 },
            };
          } else if (topic === '/mock_world/battery') {
            messageData = {
              voltage: 12.1 - (tick % 100) * 0.005,
              percentage: 0.85,
              power_supply_status: 2,
            };
          } else if (topic === '/mock_world/test_nan') {
            messageData = {
              linear_acceleration: { x: NaN, y: Infinity, z: -Infinity },
              angular_velocity: { x: null, y: 0.0, z: 'test_string' },
            };
          } else {
            messageData = { seq: tick, message: 'mock payload' };
          }

          ws.send(
            JSON.stringify({
              op: 'publish',
              topic,
              msg: messageData,
            }),
          );
        }, publishRateMs);

        activePublishTimers.set(topic, timer);
      } else if (msg.op === 'unsubscribe') {
        const topic = msg.topic;
        console.log(`[MOCK ROSBRIDGE] Client unsubscribed from "${topic}"`);
        if (activePublishTimers.has(topic)) {
          clearInterval(activePublishTimers.get(topic));
          activePublishTimers.delete(topic);
        }
      } else if (msg.op === 'publish' || msg.op === 'advertise') {
        console.warn(`[MOCK ROSBRIDGE] CAUTION: Client attempted "${msg.op}" on "${msg.topic}". Phase 4 is read-only!`);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`[MOCK ROSBRIDGE] Client disconnected (code: ${code}, reason: "${reason}")`);
      for (const timer of activePublishTimers.values()) {
        clearInterval(timer);
      }
      activePublishTimers.clear();
    });

    ws.on('error', (err) => {
      console.error('[MOCK ROSBRIDGE] Client socket error:', err.message);
    });
  });
}

server.listen(PORT, HOST, () => {
  // Server bound
});
