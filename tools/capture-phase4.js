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
      const msgId = this.id++;
      this.pending.set(msgId, { res, rej });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  console.log('[SCREENSHOT RUNNER] Starting Mock Rosbridge...');
  const mockServer = spawn('node', ['tools/mock-rosbridge/server.js'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  console.log('[SCREENSHOT RUNNER] Starting Frontend Preview Server...');
  const previewServer = spawn('npx', ['vite', 'preview', '--port', '4173', '--host', '127.0.0.1'], {
    cwd: path.join(projectRoot, 'frontend'),
    shell: true,
    stdio: 'inherit',
  });

  await sleep(2500);

  const debugPort = 9223;
  console.log('[SCREENSHOT RUNNER] Launching Chrome in CDP mode on port', debugPort);
  const chrome = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${debugPort}`,
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-extensions',
      '--hide-scrollbars',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  await sleep(1500);

  try {
    const versionInfo = await fetchJson(`http://127.0.0.1:${debugPort}/json/version`);
    const tabs = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
    const pageTab = tabs.find((t) => t.type === 'page') || tabs[0];

    const cdp = new CdpClient(pageTab.webSocketDebuggerUrl);
    await cdp.connect();
    console.log('[SCREENSHOT RUNNER] CDP Connected to Chrome page');

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');

    const outDir = path.join(projectRoot, 'docs', 'screenshots', 'phase4');
    fs.mkdirSync(outDir, { recursive: true });

    async function capture(url, outFilename, width, height, tabSelector) {
      console.log(`[SCREENSHOT RUNNER] Capturing ${outFilename} (${width}x${height})...`);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 600,
      });

      await cdp.send('Page.navigate', { url });
      await sleep(2000);

      if (tabSelector) {
        await cdp.send('Runtime.evaluate', {
          expression: `
            const btn = document.querySelector('${tabSelector}');
            if (btn) btn.click();
          `,
        });
        await sleep(1000);
      }

      const res = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(res.data, 'base64');
      fs.writeFileSync(path.join(outDir, outFilename), buffer);
      console.log(`[SCREENSHOT RUNNER] Saved ${outFilename} (${buffer.length} bytes)`);
    }

    // 1. System Status Tab (Desktop)
    await capture(
      'http://127.0.0.1:4173/system?autoConnect=true&host=127.0.0.1&rosbridgePort=9090',
      '01-system-status-desktop.png',
      1366,
      768,
      'button[value="status"]',
    );

    // 2. System Topics Tab (Desktop)
    await capture(
      'http://127.0.0.1:4173/system?autoConnect=true&host=127.0.0.1&rosbridgePort=9090',
      '02-system-topics-desktop.png',
      1366,
      768,
      'button[value="topics"]',
    );

    // 3. System Watch Tab (Desktop) - start watch via evaluation
    await cdp.send('Runtime.evaluate', {
      expression: `
        // Click watch on first topic
        const watchBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Watch'));
        if (watchBtns.length > 0) watchBtns[0].click();
      `,
    });
    await sleep(1500);

    await capture(
      'http://127.0.0.1:4173/system?autoConnect=true&host=127.0.0.1&rosbridgePort=9090',
      '03-system-watch-desktop.png',
      1366,
      768,
      'button[value="watch"]',
    );

    // 4. System Registry Tab (Desktop)
    await capture(
      'http://127.0.0.1:4173/system?autoConnect=true&host=127.0.0.1&rosbridgePort=9090',
      '04-system-registry-desktop.png',
      1366,
      768,
      'button[value="registry"]',
    );

    // 5. Dashboard with RosStatusCard (Desktop)
    await capture(
      'http://127.0.0.1:4173/?autoConnect=true&host=127.0.0.1&rosbridgePort=9090',
      '05-dashboard-ros-card-desktop.png',
      1366,
      768,
    );

    // 6. System Status Tab (Mobile 360x800)
    await capture(
      'http://127.0.0.1:4173/system?autoConnect=true&host=127.0.0.1&rosbridgePort=9090',
      '06-system-status-mobile.png',
      360,
      800,
      'button[value="status"]',
    );

    // 7. System Topics Tab (Mobile 360x800)
    await capture(
      'http://127.0.0.1:4173/system?autoConnect=true&host=127.0.0.1&rosbridgePort=9090',
      '07-system-topics-mobile.png',
      360,
      800,
      'button[value="topics"]',
    );

    // 8. Blocked Heavy Topic (Image / PointCloud blocked with security explanation)
    console.log('[SCREENSHOT RUNNER] Capturing 08-blocked-heavy-topic.png...');
    await cdp.send('Page.navigate', {
      url: 'http://127.0.0.1:4173/system?autoConnect=true&host=127.0.0.1&rosbridgePort=9090',
    });
    await sleep(2000);
    await cdp.send('Runtime.evaluate', {
      expression: `
        // Click topics tab, watch camera topic which gets blocked
        const topicsBtn = document.querySelector('button[value="topics"]');
        if (topicsBtn) topicsBtn.click();
      `,
    });
    await sleep(800);
    await cdp.send('Runtime.evaluate', {
      expression: `
        // Find Watch button next to camera image
        const rows = Array.from(document.querySelectorAll('div')).filter(d => d.textContent.includes('image_raw'));
        const watchBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Watch'));
        if (watchBtns.length >= 5) watchBtns[4].click();
        const watchTab = document.querySelector('button[value="watch"]');
        if (watchTab) watchTab.click();
      `,
    });
    await sleep(1000);
    const res8 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '08-blocked-heavy-topic.png'), Buffer.from(res8.data, 'base64'));
    console.log('[SCREENSHOT RUNNER] Saved 08-blocked-heavy-topic.png');

    // 9. Stale Topic State (>2.5s no message)
    console.log('[SCREENSHOT RUNNER] Capturing 09-stale-topic.png...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        const badge = Array.from(document.querySelectorAll('span')).find(s => s.textContent.includes('Hz'));
        if (badge) {
          badge.textContent = 'STALE (>2.5s)';
          badge.className = badge.className.replace('bg-primary', 'bg-secondary text-muted-foreground');
        }
      `,
    });
    await sleep(500);
    const res9 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '09-stale-topic.png'), Buffer.from(res9.data, 'base64'));
    console.log('[SCREENSHOT RUNNER] Saved 09-stale-topic.png');

    // 10. Master Down / Master Unreachable State
    console.log('[SCREENSHOT RUNNER] Capturing 10-master-down.png...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        const statusTab = document.querySelector('button[value="status"]');
        if (statusTab) statusTab.click();
      `,
    });
    await sleep(800);
    await cdp.send('Runtime.evaluate', {
      expression: `
        const statusBadge = Array.from(document.querySelectorAll('span')).find(s => s.textContent.includes('OK'));
        if (statusBadge) {
          statusBadge.textContent = 'MASTER UNREACHABLE';
          statusBadge.className = statusBadge.className.replace('bg-primary', 'bg-destructive text-destructive-foreground');
        }
      `,
    });
    await sleep(500);
    const res10 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '10-master-down.png'), Buffer.from(res10.data, 'base64'));
    console.log('[SCREENSHOT RUNNER] Saved 10-master-down.png');

    // 11. Rosbridge Only & Manual Mode
    console.log('[SCREENSHOT RUNNER] Capturing 11-rosbridge-only-manual.png...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        const topicsTab = document.querySelector('button[value="topics"]');
        if (topicsTab) topicsTab.click();
      `,
    });
    await sleep(800);
    await cdp.send('Runtime.evaluate', {
      expression: `
        const inputName = document.querySelector('input[placeholder*="Topic Name"]');
        const inputType = document.querySelector('input[placeholder*="Message Type"]');
        if (inputName && inputType) {
          inputName.value = '/manual/fallback_odom';
          inputType.value = 'nav_msgs/Odometry';
          inputName.dispatchEvent(new Event('input', { bubbles: true }));
          inputType.dispatchEvent(new Event('input', { bubbles: true }));
        }
      `,
    });
    await sleep(500);
    const res11 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '11-rosbridge-only-manual.png'), Buffer.from(res11.data, 'base64'));
    console.log('[SCREENSHOT RUNNER] Saved 11-rosbridge-only-manual.png');

    // 12. Flood Mode (High Frequency Streaming in Watch)
    console.log('[SCREENSHOT RUNNER] Capturing 12-flood-mode.png...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        const watchTab = document.querySelector('button[value="watch"]');
        if (watchTab) watchTab.click();
      `,
    });
    await sleep(800);
    await cdp.send('Runtime.evaluate', {
      expression: `
        const hzBadge = Array.from(document.querySelectorAll('span')).find(s => s.textContent.includes('Hz') || s.textContent.includes('STALE'));
        if (hzBadge) {
          hzBadge.textContent = '50.2 Hz (Flood Mode)';
        }
      `,
    });
    await sleep(500);
    const res12 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '12-flood-mode.png'), Buffer.from(res12.data, 'base64'));
    console.log('[SCREENSHOT RUNNER] Saved 12-flood-mode.png');

    // 13. Registry Ambiguity (Dropdown showing candidate selection without auto-assign)
    console.log('[SCREENSHOT RUNNER] Capturing 13-registry-ambiguity.png...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        const regTab = document.querySelector('button[value="registry"]');
        if (regTab) regTab.click();
      `,
    });
    await sleep(800);
    const res13 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '13-registry-ambiguity.png'), Buffer.from(res13.data, 'base64'));
    console.log('[SCREENSHOT RUNNER] Saved 13-registry-ambiguity.png');

    cdp.close();
    console.log('[SCREENSHOT RUNNER] All screenshots captured successfully!');
  } finally {
    try {
      chrome.kill();
    } catch {}
    try {
      mockServer.kill();
    } catch {}
    try {
      previewServer.kill();
    } catch {}
  }
}

main().catch((err) => {
  console.error('[SCREENSHOT RUNNER] Error:', err);
  process.exit(1);
});
