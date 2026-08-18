/**
 * Zero-dependency static server for the Room Tile Forge editor.
 *
 * The editor has to read pixels back out of a canvas to export a PNG, and a page
 * opened over file:// taints the canvas as soon as it draws a file:// image. So
 * the tool is served over http instead - no build step, no dependencies.
 *
 *   node tools/room-tile-forge/serve.mjs
 *   -> http://localhost:5173/tools/room-tile-forge/
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
const RESOURCES = path.join(REPO_ROOT, 'src', 'resources');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.css': 'text/css; charset=utf-8',
};

/** Every texture the forge can assign to a surface. */
export async function listTextures() {
    const walk = async (dir, prefix = '') => {
        const out = [];
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                out.push(...(await walk(path.join(dir, entry.name), `${prefix}${entry.name}/`)));
            } else if (/\.(png|jpe?g)$/i.test(entry.name)) {
                out.push({ name: entry.name, url: `/src/resources/${prefix}${entry.name}` });
            }
        }
        return out;
    };
    const all = await walk(RESOURCES);
    // De-duplicate by file name; the forge keys textures by name, and the tree has
    // a couple of byte-identical copies (brickwall.png == Brick_Large.png).
    const seen = new Set();
    return all.filter(t => (seen.has(t.name) ? false : (seen.add(t.name), true)))
              .sort((a, b) => a.name.localeCompare(b.name));
}

export function createServer() {
    return http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost');

            if (url.pathname === '/api/textures') {
                res.writeHead(200, { 'content-type': MIME['.json'] });
                res.end(JSON.stringify(await listTextures()));
                return;
            }

            let rel = decodeURIComponent(url.pathname);
            if (rel === '/' ) rel = '/tools/room-tile-forge/index.html';
            if (rel.endsWith('/')) rel += 'index.html';

            const filePath = path.join(REPO_ROOT, rel);
            if (!filePath.startsWith(REPO_ROOT)) {
                res.writeHead(403).end('forbidden');
                return;
            }

            const body = await fs.readFile(filePath);
            res.writeHead(200, {
                'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
                'cache-control': 'no-store',
            });
            res.end(body);
        } catch (err) {
            res.writeHead(err.code === 'ENOENT' ? 404 : 500).end(String(err.message || err));
        }
    });
}

// Only listen when run directly, so export.mjs can reuse createServer() silently.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    const port = Number(process.env.PORT || 5173);
    createServer().listen(port, () => {
        console.log(`Room Tile Forge -> http://localhost:${port}/tools/room-tile-forge/`);
    });
}
