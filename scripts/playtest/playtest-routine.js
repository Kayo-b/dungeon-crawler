#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const nowIso = () => new Date().toISOString();

function parseArgs(argv) {
  const args = {
    url: 'http://127.0.0.1:8081',
    runDir: '',
    headed: false,
    timeoutMs: 90000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--url' && argv[i + 1]) {
      args.url = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--run-dir' && argv[i + 1]) {
      args.runDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--timeout-ms' && argv[i + 1]) {
      args.timeoutMs = Number(argv[i + 1]) || args.timeoutMs;
      i += 1;
      continue;
    }
    if (token === '--headed') {
      args.headed = true;
    }
  }

  if (!args.runDir) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    args.runDir = path.resolve(process.cwd(), 'output', 'playwright', `playtest-${stamp}`);
  } else {
    args.runDir = path.resolve(process.cwd(), args.runDir);
  }

  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function appendLine(filePath, line) {
  fs.appendFileSync(filePath, `${line}\n`, 'utf8');
}

async function clickFirstVisible(page, labels) {
  for (const label of labels) {
    const locator = page.getByText(label, { exact: true }).first();
    if (await locator.count()) {
      if (await locator.isVisible()) {
        await locator.click();
        return label;
      }
    }
  }
  return null;
}

async function clickContinueIfAvailable(page) {
  const continueBtn = page.getByText('Continue Game', { exact: true }).first();
  if (!(await continueBtn.count())) return false;
  if (!(await continueBtn.isVisible())) return false;
  if (!(await continueBtn.isEnabled())) return false;
  await continueBtn.click();
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDir = args.runDir;
  const logsDir = path.join(runDir, 'logs');
  const screensDir = path.join(runDir, 'screenshots');
  const videoDir = path.join(runDir, 'video');

  ensureDir(runDir);
  ensureDir(logsDir);
  ensureDir(screensDir);
  ensureDir(videoDir);

  const actionsLogPath = path.join(logsDir, 'actions.log');
  const consoleLogPath = path.join(logsDir, 'console.log');
  const networkLogPath = path.join(logsDir, 'network.log');
  const errorsLogPath = path.join(logsDir, 'errors.log');

  writeText(actionsLogPath, '');
  writeText(consoleLogPath, '');
  writeText(networkLogPath, '');
  writeText(errorsLogPath, '');

  const action = (message) => appendLine(actionsLogPath, `[${nowIso()}] ${message}`);
  const report = {
    startedAt: nowIso(),
    url: args.url,
    runDir,
    screenshots: [],
    assertions: {},
    stats: {
      consoleErrors: 0,
      requestFailures: 0,
      httpErrors: 0,
      pageErrors: 0,
    },
    warnings: [],
  };

  action(`Launching Chromium (${args.headed ? 'headed' : 'headless'})`);
  const browser = await chromium.launch({
    headless: !args.headed,
    args: ['--window-size=1280,720'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    const type = msg.type();
    appendLine(consoleLogPath, `[${nowIso()}] [${type}] ${msg.text()}`);
    if (type === 'error') {
      report.stats.consoleErrors += 1;
    }
  });

  page.on('pageerror', (err) => {
    appendLine(errorsLogPath, `[${nowIso()}] [pageerror] ${String(err)}`);
    report.stats.pageErrors += 1;
  });

  page.on('requestfailed', (req) => {
    appendLine(
      networkLogPath,
      `[${nowIso()}] [failed] ${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'unknown'}`
    );
    report.stats.requestFailures += 1;
  });

  page.on('response', (res) => {
    const status = res.status();
    if (status >= 400) {
      appendLine(networkLogPath, `[${nowIso()}] [http-${status}] ${res.request().method()} ${res.url()}`);
      report.stats.httpErrors += 1;
    }
  });

  let videoPath = null;

  const warn = (message) => {
    report.warnings.push(message);
    appendLine(errorsLogPath, `[${nowIso()}] [warn] ${message}`);
  };

  try {
    action(`Navigating to ${args.url}`);
    await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: args.timeoutMs });
    await page.waitForTimeout(3000);

    const screenshot1 = path.join(screensDir, '01-start-screen.png');
    await page.screenshot({ path: screenshot1, fullPage: false });
    report.screenshots.push(screenshot1);
    action('Captured start-screen screenshot');

    const startMenuDetectedInitial = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      return all.some((el) => {
        const text = el.textContent ? el.textContent.trim() : '';
        return text === 'Dungeon Crawler' || text === 'Create Character';
      });
    });

    const usedContinue = await clickContinueIfAvailable(page).catch(() => false);
    if (usedContinue) {
      action('Clicked "Continue Game"');
      await page.waitForTimeout(1200);
    } else {
      const openedFrom = await clickFirstVisible(page, ['New Game']);
      if (openedFrom) {
        action(`Clicked "${openedFrom}"`);
        await page.waitForTimeout(1200);
      }
    }

    const isCreateFlow = await page.getByText('Create Character', { exact: true }).first().isVisible().catch(() => false);
    if (isCreateFlow) {
      action('Detected Create Character screen');
      const nameInput = page.getByPlaceholder('Character name').first();
      if (await nameInput.count()) {
        await nameInput.fill(`PT-${Date.now().toString().slice(-5)}`);
      }
      const startBtn = page.getByText('Start Adventure', { exact: true }).first();
      if (await startBtn.count()) {
        await startBtn.click();
        action('Started adventure from create flow');
      }
      await page.waitForTimeout(1500);
    }

    const screenshot2 = path.join(screensDir, '02-after-menu-flow.png');
    await page.screenshot({ path: screenshot2, fullPage: false });
    report.screenshots.push(screenshot2);
    action('Captured post-menu screenshot');

    action('Driving gameplay inputs: ArrowUp, ArrowLeft, ArrowRight, ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(500);

    const primarySkill = page.locator('[data-testid="skill-primary-button"]').first();
    if (await primarySkill.count()) {
      try {
        await primarySkill.click({ timeout: 2500 });
        action('Clicked primary skill button');
      } catch (error) {
        warn(`Primary skill click skipped: ${String(error)}`);
      }
    }

    const beltFirstSlot = page.locator('[data-testid="belt-slot-0"]').first();
    if (await beltFirstSlot.count()) {
      try {
        await beltFirstSlot.click({ timeout: 2500, force: true });
        action('Clicked belt slot 0');
      } catch (error) {
        warn(`Belt click skipped: ${String(error)}`);
      }
    }

    await page.waitForTimeout(1000);

    const screenshot3 = path.join(screensDir, '03-after-gameplay-inputs.png');
    await page.screenshot({ path: screenshot3, fullPage: false });
    report.screenshots.push(screenshot3);
    action('Captured gameplay screenshot');

    const finalUiAssertions = await page.evaluate(() => {
      const q = (selector) => Array.from(document.querySelectorAll(selector));
      const beltSlots = q('[data-testid^="belt-slot-"]');
      const skillPrimary = q('[data-testid="skill-primary-button"]')[0] || null;
      const skillSecondary = q('[data-testid="skill-secondary-button"]')[0] || null;

      const styleOf = (el) => (el ? getComputedStyle(el).opacity : null);

      return {
        inGameUiDetected:
          q('[data-testid="skill-primary-button"]').length > 0 ||
          q('[data-testid="skill-secondary-button"]').length > 0,
        beltSlotCount: beltSlots.length,
        skillPrimaryOpacity: styleOf(skillPrimary),
        skillSecondaryOpacity: styleOf(skillSecondary),
      };
    });
    report.assertions = {
      startMenuDetected: startMenuDetectedInitial,
      ...finalUiAssertions,
    };

    action(`Assertions collected: ${JSON.stringify(report.assertions)}`);

    const screenshot4 = path.join(screensDir, '04-final-state.png');
    await page.screenshot({ path: screenshot4, fullPage: false });
    report.screenshots.push(screenshot4);
    action('Captured final screenshot');
  } catch (error) {
    const msg = error instanceof Error ? error.stack || error.message : String(error);
    appendLine(errorsLogPath, `[${nowIso()}] [fatal] ${msg}`);
    report.fatalError = msg;
  } finally {
    const video = page.video();
    await context.close();
    if (video) {
      videoPath = await video.path().catch(() => null);
    }
    await browser.close();
  }

  report.finishedAt = nowIso();
  report.videoPath = videoPath;

  const summaryPath = path.join(runDir, 'summary.json');
  writeText(summaryPath, `${JSON.stringify(report, null, 2)}\n`);

  const analysis = [
    '# Playtest Analysis',
    '',
    `- URL: ${report.url}`,
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt}`,
    `- Video: ${report.videoPath || 'not captured'}`,
    `- Console errors: ${report.stats.consoleErrors}`,
    `- Page errors: ${report.stats.pageErrors}`,
    `- Network failures: ${report.stats.requestFailures}`,
    `- HTTP errors: ${report.stats.httpErrors}`,
    `- Warnings: ${report.warnings.length}`,
    '',
    '## UI Checks',
    `- Start screen detected: ${String(report.assertions.startMenuDetected)}`,
    `- In-game UI detected: ${String(report.assertions.inGameUiDetected)}`,
    `- Belt slots detected: ${String(report.assertions.beltSlotCount)}`,
    `- Primary skill opacity: ${String(report.assertions.skillPrimaryOpacity)}`,
    `- Secondary skill opacity: ${String(report.assertions.skillSecondaryOpacity)}`,
    '',
    '## Artifacts',
    ...report.screenshots.map((p) => `- ${p}`),
    `- ${summaryPath}`,
    `- ${actionsLogPath}`,
    `- ${consoleLogPath}`,
    `- ${networkLogPath}`,
    `- ${errorsLogPath}`,
  ].join('\n');

  const analysisPath = path.join(runDir, 'analysis.md');
  writeText(analysisPath, `${analysis}\n`);

  process.stdout.write(`${JSON.stringify({ ok: !report.fatalError, runDir, summaryPath, analysisPath, videoPath }, null, 2)}\n`);
  process.exit(report.fatalError ? 1 : 0);
}

main();
