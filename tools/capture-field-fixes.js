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

async function captureScreenshot(cdp, filePath, width = 1280, height = 800) {
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
  const outDir = path.join(projectRoot, 'docs', 'screenshots', 'field-fix-1');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Start mock server
  console.log('[Field Fixes Capture] Starting mock rosbridge...');
  let mockProc = spawn('node', ['tools/mock-rosbridge/server.js'], {
    cwd: projectRoot,
    stdio: 'pipe',
  });

  // 2. Start preview server for frontend dist
  console.log('[Field Fixes Capture] Starting vite preview server...');
  const previewProc = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: path.join(projectRoot, 'frontend'),
    shell: true,
    stdio: 'pipe',
  });

  await sleep(2500);

  // 3. Start headless Chrome
  console.log('[Field Fixes Capture] Launching headless Chrome...');
  const chromeProc = await startChrome(9334);

  try {
    const targets = await fetchJson('http://127.0.0.1:9334/json/list');
    const pageTarget = targets.find((t) => t.type === 'page');
    const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');

    // 1. System page dangerous buttons disabled (Bug 5)
    console.log('[1/4] Capturing System Page dangerous buttons...');
    await cdp.send('Page.navigate', { url: 'http://localhost:4173/#/system' });
    await sleep(1500);
    await captureScreenshot(cdp, path.join(outDir, '01-system-dangerous-buttons-disabled.png'));

    // 2. Connection settings & address hints (Bug 3, 6, 7)
    console.log('[2/4] Capturing Settings Page reachability hints and footer version...');
    await cdp.send('Page.navigate', { url: 'http://localhost:4173/#/settings' });
    await sleep(1500);
    await captureScreenshot(cdp, path.join(outDir, '02-settings-connection-hints.png'));

    // 3. Connect to mock rosbridge, verify latency and honest ROS status
    console.log('[3/4] Connecting to mock server...');
    await cdp.send('Page.navigate', { url: 'http://localhost:4173/#/settings?host=127.0.0.1&autoConnect=true' });
    await sleep(2500);
    await captureScreenshot(cdp, path.join(outDir, '03-connected-healthy-link.png'));

    // 4. Kill mock rosbridge to trigger drop: verify honest "disconnected" (NOT master_unreachable) + "Stop trying"
    console.log('[4/4] Killing mock server to trigger link drop and verify auto-reconnect...');
    mockProc.kill();
    await sleep(2500);
    await captureScreenshot(cdp, path.join(outDir, '04-link-down-reconnecting-stop-trying.png'));

    console.log('Field fixes capture completed successfully.');
  } finally {
    if (mockProc) mockProc.kill();
    if (previewProc) previewProc.kill();
    if (chromeProc) chromeProc.kill();
  }
}

main().catch((err) => {
  console.error('Error during field fixes capture:', err);
  process.exit(1);
});
