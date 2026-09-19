/**
 * WORKFORCE NODE API — Vercel serverless + 本機 Express
 *
 * 產品路徑：POST /api/manager-command（叫醒 AI總管 Grok Bot webhook）
 * 純靜態 GitHub Pages 唔需要呢個檔；密鑰只可以放 Vercel env，唔好寫入前端。
 */

const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const MAX_COMMAND_CHARS = 4000;
const WEBHOOK_TIMEOUT_MS = 5000;
const GITHUB_TIMEOUT_MS = 4000;
const DEFAULT_REPO = 'tc-gh-claw/office-rpg';
const ISSUE_LABEL = 'ai-manager-cmd';
const PORT = process.env.PORT || 3000;
const STATIC_ROOT = path.join(__dirname, '..');

function log(level, message) {
    console.log(`[${new Date().toISOString()}] [${level}] ${message}`);
}

function applyCors(req, res) {
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
}

function postJson(urlString, payload, timeoutMs, extraHeaders) {
    return new Promise((resolve, reject) => {
        let parsed;
        try {
            parsed = new URL(urlString);
        } catch (err) {
            reject(err);
            return;
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            reject(new Error('unsupported protocol'));
            return;
        }
        const lib = parsed.protocol === 'http:' ? http : https;
        const body = JSON.stringify(payload);
        const headers = Object.assign({
            'Content-Type': 'application/json; charset=utf-8',
            Accept: 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'User-Agent': 'office-rpg-manager-command'
        }, extraHeaders || {});

        const req = lib.request({
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
            path: parsed.pathname + parsed.search,
            method: 'POST',
            headers: headers,
            timeout: timeoutMs
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    body: text
                });
            });
        });
        req.on('timeout', () => {
            req.destroy(new Error('timeout'));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function truncateTitle(command) {
    const oneLine = String(command || '').replace(/\s+/g, ' ').trim() || '主管指令';
    if (oneLine.length <= 72) return oneLine;
    return oneLine.slice(0, 71) + '…';
}

function ackReply({ webhookConfigured, webhookOk, githubOpened }) {
    if (webhookOk) {
        return '已接收。指令已轉送至 AI總管 webhook。呢個 ACK 唔代表工作已完成。';
    }
    if (!webhookConfigured && githubOpened) {
        return '已接收 // ACK LOCAL QUEUE。webhook 未設定；已開 GitHub issue 作佇列。工作未執行。';
    }
    if (webhookConfigured && githubOpened) {
        return '已接收 // ACK LOCAL QUEUE。webhook 未能送達；已開 GitHub issue 作佇列。工作未執行。';
    }
    if (webhookConfigured) {
        return '已接收 // ACK LOCAL QUEUE。webhook 呼叫失敗，未叫醒主管。工作未執行。';
    }
    return '已接收 // ACK LOCAL-ONLY。MANAGER_WEBHOOK_URL 未設定，未叫醒 Grok Bot。工作未執行。';
}

async function deliverWebhook(payload) {
    const url = String(process.env.MANAGER_WEBHOOK_URL || '').trim();
    if (!url) {
        return { configured: false, ok: false };
    }
    try {
        const result = await postJson(url, payload, WEBHOOK_TIMEOUT_MS);
        if (!result.ok) {
            log('WARN', `manager webhook HTTP ${result.status}`);
        }
        return { configured: true, ok: result.ok };
    } catch (err) {
        log('WARN', `manager webhook failed: ${err && err.message ? err.message : 'error'}`);
        return { configured: true, ok: false };
    }
}

async function openGithubIssue(payload) {
    const token = String(process.env.GITHUB_TOKEN || '').trim();
    if (!token) {
        return { opened: false };
    }
    const repo = String(process.env.GITHUB_REPO || DEFAULT_REPO).trim() || DEFAULT_REPO;
    const issue = {
        title: truncateTitle(payload.command),
        body: [
            '## 主管指令（office-rpg）',
            '',
            '```',
            payload.command,
            '```',
            '',
            `- source: \`${payload.source}\``,
            `- ts: \`${payload.ts}\``,
            '',
            `由 \`POST /api/manager-command\` 自動開出（label \`${ISSUE_LABEL}\`）。`,
            '呢張 issue 係佇列／備忘，**唔代表** AI總管已經做完工作。'
        ].join('\n'),
        labels: [ISSUE_LABEL]
    };
    const url = `https://api.github.com/repos/${repo}/issues`;
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
    };
    try {
        let result = await postJson(url, issue, GITHUB_TIMEOUT_MS, headers);
        if (!result.ok) {
            delete issue.labels;
            result = await postJson(url, issue, GITHUB_TIMEOUT_MS, headers);
        }
        if (!result.ok) {
            log('WARN', `github issue HTTP ${result.status}`);
            return { opened: false };
        }
        log('INFO', 'github issue opened (best-effort)');
        return { opened: true };
    } catch (err) {
        log('WARN', `github issue failed: ${err && err.message ? err.message : 'error'}`);
        return { opened: false };
    }
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

    app.use((req, res, next) => {
        if (req.body !== undefined && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
            return next();
        }
        express.json({ limit: '32kb' })(req, res, next);
    });

    app.get(['/api/health', '/health'], (req, res) => {
        res.json({
            status: 'ok',
            service: 'office-rpg',
            webhookConfigured: Boolean(String(process.env.MANAGER_WEBHOOK_URL || '').trim()),
            timestamp: new Date().toISOString()
        });
    });

    app.post(['/api/manager-command', '/manager-command'], async (req, res) => {
        try {
            const body = req.body && typeof req.body === 'object' ? req.body : {};
            const command = typeof body.command === 'string' ? body.command.trim() : '';
            if (!command) {
                return res.status(400).json({
                    ok: false,
                    delivered: false,
                    error: 'empty_command',
                    reply: '指令係空嘅。'
                });
            }
            if (command.length > MAX_COMMAND_CHARS) {
                return res.status(400).json({
                    ok: false,
                    delivered: false,
                    error: 'too_long',
                    reply: `指令超過 ${MAX_COMMAND_CHARS} 字。`
                });
            }

            const payload = {
                command: command,
                source: typeof body.source === 'string' && body.source.trim()
                    ? body.source.trim()
                    : 'office-rpg',
                ts: typeof body.ts === 'string' && body.ts.trim()
                    ? body.ts.trim()
                    : new Date().toISOString()
            };

            log('INFO', `manager-command chars=${command.length} source=${payload.source}`);

            const webhook = await deliverWebhook(payload);
            const github = await openGithubIssue(payload);
            const delivered = Boolean(webhook.ok);
            const reply = ackReply({
                webhookConfigured: webhook.configured,
                webhookOk: webhook.ok,
                githubOpened: github.opened
            });

            return res.status(200).json({
                ok: true,
                delivered: delivered,
                reply: reply
            });
        } catch (err) {
            log('ERROR', `manager-command failed: ${err && err.message ? err.message : 'error'}`);
            return res.status(200).json({
                ok: true,
                delivered: false,
                reply: '已接收 // ACK LOCAL QUEUE。伺服器處理出錯，未叫醒主管。工作未執行。'
            });
        }
    });

    if (!process.env.VERCEL) {
        app.get('/', (req, res) => {
            const indexPath = path.join(STATIC_ROOT, 'index.html');
            if (!fs.existsSync(indexPath)) {
                return res.status(404).send('index.html not found');
            }
            let html = fs.readFileSync(indexPath, 'utf8');
            const apiBase = String(process.env.API_BASE || process.env.API_URL || '').replace(/["<>\\]/g, '');
            if (apiBase) {
                const injection = `<script>window.API_BASE = ${JSON.stringify(apiBase)};</script>\n    `;
                html = html.replace('<script src="app.js"></script>', `${injection}<script src="app.js"></script>`);
            }
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
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
        log('INFO', `webhook ${String(process.env.MANAGER_WEBHOOK_URL || '').trim() ? 'configured' : 'unset (local-only ACK)'}`);
    });
}
