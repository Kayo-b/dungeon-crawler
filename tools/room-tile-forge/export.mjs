/**
 * Room Tile Forge - headless batch export.
 *
 * Renders every variant from a preset through the same renderer.mjs the editor
 * uses, so the batch output is pixel-identical to what you tuned on screen.
 *
 *   node tools/room-tile-forge/export.mjs
 *   node tools/room-tile-forge/export.mjs --preset presets/default.json --out src/resources/generated
 *   node tools/room-tile-forge/export.mjs --only corridor,threeWay
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer, REPO_ROOT } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
    const args = { preset: path.join(HERE, 'presets', 'default.json'), out: path.join(REPO_ROOT, 'src', 'resources', 'generated'), only: null };
    for (let i = 0; i < argv.length; i++) {
        const next = () => argv[++i];
        if (argv[i] === '--preset') args.preset = path.resolve(process.cwd(), next());
        else if (argv[i] === '--out') args.out = path.resolve(process.cwd(), next());
        else if (argv[i] === '--only') args.only = next().split(',').map(s => s.trim()).filter(Boolean);
        else if (argv[i] === '--help' || argv[i] === '-h') { console.log(HELP); process.exit(0); }
    }
    return args;
}

const HELP = `
Room Tile Forge - batch export

  --preset <file>   preset JSON to render        (default: presets/default.json)
  --out <dir>       output directory             (default: src/resources/generated)
  --only <ids>      comma-separated variant ids  (default: all)
`;

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const preset = JSON.parse(await fs.readFile(args.preset, 'utf8'));

    const server = createServer();
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;

    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    try {
        // The forge page loads every texture and the renderer module for us; we then
        // drive it directly instead of reimplementing any of it here.
        await page.goto(`http://localhost:${port}/tools/room-tile-forge/index.html`);
        await page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('textures loaded'), null, { timeout: 30000 });

        const results = await page.evaluate(async ({ preset, only }) => {
            const { renderCell } = await import('/tools/room-tile-forge/renderer.mjs');
            const { VARIANTS, configForVariant } = await import('/tools/room-tile-forge/variants.mjs');

            // Re-load textures in this evaluation context, keyed the same way.
            const list = await (await fetch('/api/textures')).json();
            const textures = {};
            for (const t of list) {
                try { const img = new Image(); img.src = t.url; await img.decode(); textures[t.name] = img; } catch {}
            }

            const wanted = only ? VARIANTS.filter(v => only.includes(v.id)) : VARIANTS;
            const canvas = document.createElement('canvas');
            const out = [];
            for (const v of wanted) {
                renderCell(canvas, configForVariant(preset, v.id), textures);
                out.push({ file: v.file, id: v.id, dataUrl: canvas.toDataURL('image/png') });
            }
            return out;
        }, { preset, only: args.only });

        if (!results.length) throw new Error('no variants matched --only');

        await fs.mkdir(args.out, { recursive: true });
        for (const r of results) {
            const buf = Buffer.from(r.dataUrl.split(',')[1], 'base64');
            await fs.writeFile(path.join(args.out, r.file), buf);
            console.log(`  ${r.file.padEnd(18)} ${(buf.length / 1024).toFixed(0)} KB`);
        }
        console.log(`\n${results.length} tiles -> ${path.relative(REPO_ROOT, args.out)}`);
        if (errors.length) console.warn('page errors:', errors.join(' | '));
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch(err => { console.error(err); process.exit(1); });
