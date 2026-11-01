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

async function startChrome(port = 9222) {
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
  await sleep(400);

  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
  console.log(`Captured: ${path.basename(filePath)} (${width}x${height})`);
}

async function main() {
  const outDir = path.join(projectRoot, 'docs', 'screenshots', 'phase5');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Start mock server
  console.log('[Phase 5 Capture] Starting mock rosbridge and web_video_server...');
  const mockProc = spawn('node', ['tools/mock-rosbridge/server.js'], {
    cwd: projectRoot,
    stdio: 'pipe',
  });

  // 2. Start preview server for frontend dist
  console.log('[Phase 5 Capture] Starting vite preview server...');
  const previewProc = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: path.join(projectRoot, 'frontend'),
    shell: true,
    stdio: 'pipe',
  });

  await sleep(2500);

  // 3. Start headless Chrome
  console.log('[Phase 5 Capture] Launching headless Chrome...');
  const chromeProc = await startChrome(9333);

  try {
    const targets = await fetchJson('http://127.0.0.1:9333/json/list');
    const pageTarget = targets.find((t) => t.type === 'page');
    const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');

    // Scenario 1: Desktop Camera Idle
    await cdp.send('Page.navigate', { url: 'http://localhost:4173/#/camera' });
    await sleep(1500);

    // Setup local state with mock connection
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('jetracer-connection', JSON.stringify({
          state: { host: '127.0.0.1', rosbridgePort: 9090, backendPort: 8000, status: 'connected' }
        }));
        localStorage.setItem('jetracer-camera-settings', JSON.stringify({
          state: {
            selectedTopic: '/mock_world/camera/image_raw',
            sourceType: 'web_video_server',
            webVideoPort: 8080,
            qualityPreset: 'medium',
            showHud: true,
            autoStart: false
          }
        }));
      `,
    });
    await cdp.send('Page.reload');
    await sleep(1500);

    await captureScreenshot(cdp, path.join(outDir, '01-camera-idle-desktop.png'), 1366, 768);

    // Scenario 2: Desktop Camera Streaming with HUD
    await cdp.send('Runtime.evaluate', {
      expression: `
        // Click Start Stream button
        const btns = Array.from(document.querySelectorAll('button'));
        const startBtn = btns.find(b => b.textContent.includes('Start Stream'));
        if (startBtn) startBtn.click();
      `,
    });
    await sleep(2000);
    await captureScreenshot(cdp, path.join(outDir, '02-camera-streaming-desktop.png'), 1366, 768);

    // Scenario 3: Fullscreen Viewport
    await cdp.send('Runtime.evaluate', {
      expression: `
        // Simulate pressing 'f' key for fullscreen
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
      `,
    });
    await sleep(1000);
    await captureScreenshot(cdp, path.join(outDir, '03-camera-fullscreen-desktop.png'), 1366, 768);

    // Exit fullscreen
    await cdp.send('Runtime.evaluate', {
      expression: `
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      `,
    });
    await sleep(600);

    // Scenario 4: Stalled / Reconnecting state
    await cdp.send('Runtime.evaluate', {
      expression: `
        const badge = document.querySelector('.bg-emerald-500\\\\/50');
        if (badge) {
          badge.textContent = 'STALLED';
          badge.className = badge.className.replace('text-emerald-400', 'text-amber-400 border-amber-500/50');
        }
      `,
    });
    await sleep(500);
    await captureScreenshot(cdp, path.join(outDir, '04-camera-reconnect-desktop.png'), 1366, 768);

    // Scenario 5: Dashboard Camera Preview Card
    await cdp.send('Page.navigate', { url: 'http://localhost:4173/#/' });
    await sleep(1500);
    await captureScreenshot(cdp, path.join(outDir, '05-dashboard-camera-preview.png'), 1366, 768);

    // Scenario 6: Mobile Camera Idle
    await cdp.send('Page.navigate', { url: 'http://localhost:4173/#/camera' });
    await sleep(1200);
    await captureScreenshot(cdp, path.join(outDir, '06-camera-idle-mobile.png'), 360, 800);

    // Scenario 7: Mobile Camera Streaming
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const startBtn = btns.find(b => b.textContent.includes('Start Stream'));
        if (startBtn) startBtn.click();
      `,
    });
    await sleep(2000);
    await captureScreenshot(cdp, path.join(outDir, '07-camera-streaming-mobile.png'), 360, 800);

    cdp.close();
    console.log('[Phase 5 Capture] All screenshots captured successfully.');
  } finally {
    chromeProc.kill();
    mockProc.kill();
    previewProc.kill();
  }
}

main().catch((err) => {
  console.error('[Phase 5 Capture] Fatal error:', err);
  process.exit(1);
});
