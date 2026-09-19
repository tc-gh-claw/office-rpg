/**
 * WORKFORCE NODE 可選後端 API（Vercel／本機）
 * 純靜態 GitHub Pages 唔需要呢個檔。只提供 health；畫面由靜態 HTML 讀 data/office-data.json。
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const STATIC_ROOT = path.join(__dirname, '..');

function log(level, message) {
    console.log(`[${new Date().toISOString()}] [${level}] ${message}`);
}

function applyCors(req, res) {
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
}

function sendPublicFile(res, relPath, contentType) {
    const abs = path.normalize(path.join(STATIC_ROOT, relPath));
    const root = STATIC_ROOT.endsWith(path.sep) ? STATIC_ROOT : STATIC_ROOT + path.sep;
    if (abs !== STATIC_ROOT && !abs.startsWith(root)) {
        return res.status(403).send('Forbidden');
    }
    if (!fs.existsSync(abs)) {
        return res.status(404).send('Not found');
    }
    res.setHeader('Content-Type', contentType);
    if (relPath.endsWith('.json')) {
        res.setHeader('Cache-Control', 'no-store, must-revalidate');
    }
    res.sendFile(abs);
}

function createApp() {
    const app = express();

    app.use((req, res, next) => {
        applyCors(req, res);
        if (req.method === 'OPTIONS') {
            return res.status(204).end();
        }
        next();
    });

    app.get(['/api/health', '/health'], (req, res) => {
        res.json({
            status: 'ok',
            service: 'office-rpg',
            timestamp: new Date().toISOString()
        });
    });

    if (!process.env.VERCEL) {
        app.get('/', (req, res) => {
            sendPublicFile(res, 'index.html', 'text/html; charset=utf-8');
        });
        app.get('/app.js', (req, res) => {
            sendPublicFile(res, 'app.js', 'application/javascript; charset=utf-8');
        });
        app.get('/style.css', (req, res) => {
            sendPublicFile(res, 'style.css', 'text/css; charset=utf-8');
        });
        app.get('/data/office-data.json', (req, res) => {
            sendPublicFile(res, 'data/office-data.json', 'application/json; charset=utf-8');
        });
        app.get('/data/README.md', (req, res) => {
            sendPublicFile(res, 'data/README.md', 'text/markdown; charset=utf-8');
        });
    }

    app.use((req, res) => {
        res.status(404).json({ ok: false, error: 'not_found' });
    });

    return app;
}

const app = createApp();

function handler(req, res) {
    return app(req, res);
}

module.exports = handler;
module.exports.app = app;
module.exports.createApp = createApp;
module.exports.handler = handler;

if (require.main === module && !process.env.VERCEL) {
    app.listen(PORT, () => {
        log('INFO', `AI總管 :: WORKFORCE NODE API 於 http://localhost:${PORT}`);
        log('INFO', 'GET /api/health · 靜態畫面唔需要呢個後端');
    });
}
