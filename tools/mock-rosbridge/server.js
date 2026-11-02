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
import url from 'url';
import jpegPkg from '../../frontend/node_modules/jpeg-js/index.js';
const jpeg = jpegPkg.default || jpegPkg;

const args = process.argv.slice(2);
const flagRefuse = args.includes('--refuse');
const flagHang = args.includes('--hang');
const flagDrop = args.includes('--drop');
const flagNoRosapi = args.includes('--no-rosapi');
const flagFlood = args.includes('--flood');
const flagCameraStall = args.includes('--camera-stall');
const flagCameraFail = args.includes('--camera-fail');
const flagCameraCorsBlock = args.includes('--camera-cors-block');

// LiDAR fault injection flags
const flagLidarInfNanBare = args.includes('--lidar-inf-nan-bare');
const flagLidarInfNanStr = args.includes('--lidar-inf-nan-str');
const flagLidarInfNanNull = args.includes('--lidar-inf-nan-null');
const flagLidarStall = args.includes('--lidar-stall');
const flagLidarFlood = args.includes('--lidar-flood');
const flagLidarFrozen = args.includes('--lidar-frozen');
const flagLidarAllInvalid = args.includes('--lidar-all-invalid');
const flagLidarOversized = args.includes('--lidar-oversized');

let artificialDelayMs = 0;
const delayIndex = args.indexOf('--delay');
if (delayIndex !== -1 && args[delayIndex + 1]) {
  artificialDelayMs = parseInt(args[delayIndex + 1], 10) || 0;
}

const PORT = parseInt(process.env.MOCK_ROSBRIDGE_PORT || '9090', 10);
const WEB_VIDEO_PORT = parseInt(process.env.MOCK_WEB_VIDEO_PORT || '8080', 10);
const HOST = process.env.MOCK_ROSBRIDGE_HOST || '127.0.0.1';

// Synthetic Graph Definition (strictly non-robot fake names)
const MOCK_TOPICS = [
  { name: '/mock_world/odom', type: 'nav_msgs/Odometry' },
  { name: '/mock_world/scan', type: 'sensor_msgs/LaserScan' },
  { name: '/mock_world/lidar_main/scan', type: 'sensor_msgs/LaserScan' },
  { name: '/mock_world/lidar_secondary/scan', type: 'sensor_msgs/LaserScan' },
  { name: '/mock_world/imu', type: 'sensor_msgs/Imu' },
  { name: '/mock_world/battery', type: 'sensor_msgs/BatteryState' },
  { name: '/mock_world/camera/image_raw', type: 'sensor_msgs/Image' },
  { name: '/mock_world/camera/image_raw/compressed', type: 'sensor_msgs/CompressedImage' },
  { name: '/mock_world/cmd_vel', type: 'geometry_msgs/Twist' },
  { name: '/mock_world/tf', type: 'tf2_msgs/TFMessage' },
  { name: '/mock_world/tf_static', type: 'tf2_msgs/TFMessage' },
  { name: '/mock_world/test_nan', type: 'sensor_msgs/Imu' },
];

function generateSyntheticLaserScan(tick = 0, options = {}) {
  const numRays = options.oversized ? 10000 : (options.numRays || 360);
  const angleMin = -Math.PI;
  const angleMax = Math.PI;
  const angleIncrement = (angleMax - angleMin) / numRays;
  const rangeMin = 0.15;
  const rangeMax = 12.0;

  const ranges = [];
  const intensities = [];

  // Effective tick: if frozen, tick is locked at 1
  const effTick = options.frozen ? 1 : tick;

  for (let i = 0; i < numRays; i++) {
    if (options.allInvalid) {
      ranges.push(null);
      intensities.push(0);
      continue;
    }

    const angle = angleMin + i * angleIncrement;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Default ray range against 6x4m room: X in [-2, 3], Y in [-2, 2]
    let dist = rangeMax + 1.0;

    // Front wall X = 3.0
    if (cosA > 0.001) {
      const t = 3.0 / cosA;
      const y = t * sinA;
      if (y >= -2.0 && y <= 2.0 && t < dist) dist = t;
    }
    // Back wall X = -2.0
    if (cosA < -0.001) {
      const t = -2.0 / cosA;
      const y = t * sinA;
      if (y >= -2.0 && y <= 2.0 && t < dist) dist = t;
    }
    // Left wall Y = 2.0
    if (sinA > 0.001) {
      const t = 2.0 / sinA;
      const x = t * cosA;
      if (x >= -2.0 && x <= 3.0 && t < dist) dist = t;
    }
    // Right wall Y = -2.0
    if (sinA < -0.001) {
      const t = -2.0 / sinA;
      const x = t * cosA;
      if (x >= -2.0 && x <= 3.0 && t < dist) dist = t;
    }

    // Front obstacle at X = 1.5, Y = 0.0 (radius 0.2m)
    // Ray from origin (0,0) towards (cosA, sinA)
    // Distance from center (1.5, 0) to line: |1.5 * sinA|
    if (cosA > 0 && Math.abs(1.5 * sinA) < 0.2) {
      const obstDist = 1.5 * cosA - Math.sqrt(0.04 - (1.5 * sinA) ** 2);
      if (obstDist > 0 && obstDist < dist) dist = obstDist;
    }

    // Left obstacle at X = 0.0, Y = 1.0 (radius 0.15m)
    if (sinA > 0 && Math.abs(1.0 * cosA) < 0.15) {
      const obstDist = 1.0 * sinA - Math.sqrt(0.0225 - (1.0 * cosA) ** 2);
      if (obstDist > 0 && obstDist < dist) dist = obstDist;
    }

    // Dynamic wave variation
    if (!options.frozen) {
      dist += 0.05 * Math.sin(angle * 4 + effTick * 0.1);
    }

    // Format range value based on fault flags
    if (i % 30 === 0 && (options.infNanBare || options.infNanStr || options.infNanNull)) {
      if (options.infNanBare) {
        // Will be replaced in raw JSON string with bare Infinity or NaN
        ranges.push(i % 60 === 0 ? 888888.88 : 999999.99);
      } else if (options.infNanStr) {
        ranges.push(i % 60 === 0 ? "NaN" : "Infinity");
      } else {
        ranges.push(null);
      }
      intensities.push(0);
    } else {
      ranges.push(Number(dist.toFixed(3)));
      intensities.push(Math.round(100 + 100 * Math.exp(-dist / 3)));
    }
  }

  const nowSecs = Math.floor(Date.now() / 1000);
  const nowNsecs = (Date.now() % 1000) * 1000000;

  return {
    header: {
      seq: tick,
      stamp: { secs: nowSecs, nsecs: nowNsecs },
      frame_id: options.frameId || 'laser_frame',
    },
    angle_min: angleMin,
    angle_max: angleMax,
    angle_increment: angleIncrement,
    time_increment: 0.00005,
    scan_time: 0.1,
    range_min: rangeMin,
    range_max: rangeMax,
    ranges,
    intensities,
  };
}

function generateSyntheticJpeg(width = 320, height = 240, tick = 0) {
  const frameData = Buffer.alloc(width * height * 4);
  const barX = (tick * 12) % width;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (x >= barX && x < barX + 28) {
        frameData[i] = 16;      // R
        frameData[i + 1] = 185; // G (emerald accent)
        frameData[i + 2] = 129; // B
      } else if (x % 32 === 0 || y % 32 === 0) {
        frameData[i] = 45;
        frameData[i + 1] = 55;
        frameData[i + 2] = 72;
      } else {
        frameData[i] = 20;
        frameData[i + 1] = 24;
        frameData[i + 2] = 33;
      }
      frameData[i + 3] = 255;
    }
  }
  return jpeg.encode({ data: frameData, width, height }, 70).data;
}

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

        const isLidarTopic =
          topic === '/mock_world/scan' ||
          topic === '/mock_world/lidar_main/scan' ||
          topic === '/mock_world/lidar_secondary/scan';

        let publishRateMs = 200;
        if (isLidarTopic) {
          publishRateMs = flagLidarFlood ? 20 : (topic === '/mock_world/lidar_secondary/scan' ? 200 : 100);
        } else if (flagFlood) {
          publishRateMs = 20;
        }

        let tick = 0;

        const timer = setInterval(() => {
          if (ws.readyState !== ws.OPEN) {
            clearInterval(timer);
            return;
          }

          tick++;
          let messageData = {};
          let rawPayloadString = null;

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
          } else if (isLidarTopic) {
            if (flagLidarStall && tick > 5) {
              return; // Stall simulation for LiDAR
            }
            messageData = generateSyntheticLaserScan(tick, {
              infNanBare: flagLidarInfNanBare,
              infNanStr: flagLidarInfNanStr,
              infNanNull: flagLidarInfNanNull,
              frozen: flagLidarFrozen,
              allInvalid: flagLidarAllInvalid,
              oversized: flagLidarOversized,
              frameId: topic === '/mock_world/lidar_secondary/scan' ? 'laser_aux_frame' : 'laser_frame',
            });

            if (flagLidarInfNanBare) {
              const baseStr = JSON.stringify({
                op: 'publish',
                topic,
                msg: messageData,
              });
              // Emulate bare ECMAScript tokens without quotation marks
              rawPayloadString = baseStr
                .replace(/888888\.88/g, 'NaN')
                .replace(/999999\.99/g, 'Infinity');
            }
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
          } else if (topic === '/mock_world/camera/image_raw/compressed') {
            if (flagCameraStall && tick > 10) {
              return; // Stall simulation
            }
            const now = Date.now();
            const jpegBuf = generateSyntheticJpeg(320, 240, tick);
            messageData = {
              header: {
                seq: tick,
                stamp: { secs: Math.floor(now / 1000), nsecs: (now % 1000) * 1000000 },
                frame_id: 'camera_link',
              },
              format: 'jpeg',
              data: jpegBuf.toString('base64'),
            };
          } else {
            messageData = { seq: tick, message: 'mock payload' };
          }

          if (rawPayloadString) {
            ws.send(rawPayloadString);
          } else {
            ws.send(
              JSON.stringify({
                op: 'publish',
                topic,
                msg: messageData,
              }),
            );
          }
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
  console.log(`[MOCK ROSBRIDGE] Server bound to ws://${HOST}:${PORT}`);
});

// Mock web_video_server on port 8080
const videoServer = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (!flagCameraCorsBlock) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (flagCameraFail) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Mock Camera Server Error\n');
    return;
  }

  if (pathname === '/snapshot') {
    const jpegBuf = generateSyntheticJpeg(640, 480, 1);
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': jpegBuf.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(jpegBuf);
    return;
  }

  if (pathname === '/stream') {
    const boundary = 'boundarydonotcross';
    res.writeHead(200, {
      'Content-Type': `multipart/x-mixed-replace; boundary=--${boundary}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'close',
      'Pragma': 'no-cache',
    });

    let frameCount = 0;
    const interval = setInterval(() => {
      frameCount++;
      if (flagCameraStall && frameCount > 4) {
        clearInterval(interval);
        return; // Stall simulation: stops sending frames without closing socket
      }

      if (res.writableEnded || res.destroyed) {
        clearInterval(interval);
        return;
      }

      const jpegBuf = generateSyntheticJpeg(640, 480, frameCount);
      const header = `--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpegBuf.length}\r\n\r\n`;
      res.write(header);
      res.write(jpegBuf);
      res.write('\r\n');
    }, 50);

    req.on('close', () => {
      clearInterval(interval);
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found\n');
});

videoServer.listen(WEB_VIDEO_PORT, HOST, () => {
  console.log(`[MOCK WEB_VIDEO_SERVER] Listening on http://${HOST}:${WEB_VIDEO_PORT}`);
});

