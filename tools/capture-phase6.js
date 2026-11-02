import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    const wsPkg = await import('../frontend/node_modules/ws/index.js');
    const WebSocket = wsPkg.default || wsPkg;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id && this.pending.has(msg.id)) {
          const { res, rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      });
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = this.id++;
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function startChrome(port = 9334) {
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    'about:blank',
  ]);

  for (let i = 0; i < 30; i++) {
    try {
      await fetchJson(`http://127.0.0.1:${port}/json/version`);
      return chromeProc;
    } catch {
      await sleep(200);
    }
  }
  throw new Error('Chrome failed to start');
}

async function captureScreenshot(cdp, filePath, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await cdp.send('Emulation.setVisibleSize', { width, height });
  await sleep(500);

  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
  console.log(`Captured: ${path.basename(filePath)} (${width}x${height})`);
}

async function main() {
  const outDir = path.join(projectRoot, 'docs', 'screenshots', 'phase6');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('[Phase 6 Capture] Starting mock rosbridge...');
  const mockProc = spawn('node', ['tools/mock-rosbridge/server.js'], {
    cwd: projectRoot,
    stdio: 'pipe',
  });

  console.log('[Phase 6 Capture] Starting vite preview server...');
  const previewProc = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: path.join(projectRoot, 'frontend'),
    shell: true,
    stdio: 'pipe',
  });

  await sleep(2500);

  console.log('[Phase 6 Capture] Launching headless Chrome...');
  const chromeProc = await startChrome(9334);

  try {
    const targets = await fetchJson('http://127.0.0.1:9334/json/list');
    const pageTarget = targets.find((t) => t.type === 'page');
    const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');

    // Seed mock connection state
    await cdp.send('Page.navigate', { url: 'http://localhost:4173/#/lidar' });
    await sleep(1500);

    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('jetracer-connection', JSON.stringify({
          state: { host: '127.0.0.1', rosbridgePort: 9090, backendPort: 8000, status: 'connected' }
        }));
        localStorage.setItem('jetracer-lidar-settings', JSON.stringify({
          state: {
            selectedTopic: '/mock_world/lidar_main/scan',
            throttleRateMs: 100,
            displayConfig: {
              maxRangeM: 8.0,
              dangerZoneM: 0.35,
              cautionZoneM: 0.70,
              colorScheme: 'distance',
              pointSize: 3,
              decayTrailLength: 0,
              showGrid: true,
              showRobotFootprint: true,
              rotationDeg: 0,
              frontAngleOffsetDeg: 0,
              isFrontOffsetCalibrated: false
            }
          }
        }));
      `,
    });
    await cdp.send('Page.reload');
    await sleep(2000);

    // Scenario 1: Desktop LiDAR Idle
    await captureScreenshot(cdp, path.join(outDir, '01-lidar-idle-desktop.png'), 1366, 768);

    // Scenario 2: Start Stream -> Desktop Streaming Live Radar
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const startBtn = btns.find(b => b.textContent.includes('Start Stream'));
        if (startBtn) startBtn.click();
      `,
    });
    await sleep(2500);
    await captureScreenshot(cdp, path.join(outDir, '02-lidar-streaming-desktop.png'), 1366, 768);

    // Scenario 3: Calibration / Orientation Stepper Adjustments
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const btn90 = btns.find(b => b.textContent.trim().startsWith('90°'));
        if (btn90) btn90.click();
      `,
    });
    await sleep(1000);
    await captureScreenshot(cdp, path.join(outDir, '03-lidar-orientation-calibrated.png'), 1366, 768);

    // Reset back to 0
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const btn0 = btns.find(b => b.textContent.trim().startsWith('0°'));
        if (btn0) btn0.click();
      `,
    });
    await sleep(500);

    // Scenario 4: Mobile Portrait View (360x800)
    await captureScreenshot(cdp, path.join(outDir, '04-lidar-mobile-portrait.png'), 360, 800);

    // Scenario 5: Dashboard with LiDAR Card Live Preview
    await cdp.send('Page.navigate', { url: 'http://localhost:4173/#/' });
    await sleep(2000);

    // Start preview on dashboard
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const previewBtn = btns.find(b => b.textContent.includes('Preview'));
        if (previewBtn) previewBtn.click();
      `,
    });
    await sleep(2000);
    await captureScreenshot(cdp, path.join(outDir, '05-dashboard-lidar-preview.png'), 1366, 768);

    cdp.close();
    console.log('[Phase 6 Capture] All screenshots captured successfully.');
  } finally {
    chromeProc.kill();
    mockProc.kill();
    previewProc.kill();
  }
}

main().catch((err) => {
  console.error('[Phase 6 Capture] Fatal error:', err);
  process.exit(1);
});
