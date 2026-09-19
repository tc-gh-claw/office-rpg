#!/usr/bin/env node
/**
 * Local tests for POST /api/manager-command
 * - no webhook → 200 delivered:false
 * - fake/unreachable webhook → still 200 delivered:false (attempted)
 * - local mock webhook → delivered:true and payload received
 */

const http = require('http');
const path = require('path');

const apiPath = path.join(__dirname, '..', 'api', 'index.js');

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function listen(server) {
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    });
}

function request(port, { method, url, body, origin, headers }) {
    return new Promise((resolve, reject) => {
        const payload = body == null ? null : JSON.stringify(body);
        const req = http.request({
            hostname: '127.0.0.1',
            port: port,
            path: url,
            method: method,
            headers: Object.assign({
                Accept: 'application/json',
                ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
                ...(origin ? { Origin: origin } : {})
            }, headers || {})
        }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                let json = null;
                try { json = JSON.parse(text); } catch (err) { json = null; }
                resolve({ status: res.statusCode, headers: res.headers, text: text, json: json });
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

function startMockWebhook(handler) {
    const received = [];
    const server = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let json = null;
            try { json = JSON.parse(text); } catch (err) { json = null; }
            const rec = { method: req.method, url: req.url, json: json, text: text };
            received.push(rec);
            if (handler) return handler(req, res, rec);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
        });
    });
    return listen(server).then((port) => ({ server, port, received }));
}

async function withApp(env, fn) {
    const prev = {
        MANAGER_WEBHOOK_URL: process.env.MANAGER_WEBHOOK_URL,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        GITHUB_REPO: process.env.GITHUB_REPO,
        VERCEL: process.env.VERCEL
    };
    Object.keys(env).forEach((key) => {
        if (env[key] == null) delete process.env[key];
        else process.env[key] = env[key];
    });
    delete require.cache[require.resolve(apiPath)];
    const mod = require(apiPath);
    const app = mod.createApp();
    const server = http.createServer(app);
    const port = await listen(server);
    try {
        await fn(port);
    } finally {
        await new Promise((resolve) => server.close(resolve));
        Object.keys(prev).forEach((key) => {
            if (prev[key] == null) delete process.env[key];
            else process.env[key] = prev[key];
        });
        delete require.cache[require.resolve(apiPath)];
    }
}

async function main() {
    const pagesOrigin = 'https://tc-gh-claw.github.io';

    await withApp({ MANAGER_WEBHOOK_URL: '', GITHUB_TOKEN: '', VERCEL: undefined }, async (port) => {
        const health = await request(port, { method: 'GET', url: '/api/health', origin: pagesOrigin });
        assert(health.status === 200, `health status ${health.status}`);
        assert(health.json && health.json.status === 'ok', 'health ok');
        assert(health.json.webhookConfigured === false, 'health should not claim webhook');
        assert(!JSON.stringify(health.json).includes('http'), 'health must not leak webhook URL');
        assert(health.headers['access-control-allow-origin'] === pagesOrigin, 'CORS github.io on health');

        const preflight = await request(port, {
            method: 'OPTIONS',
            url: '/api/manager-command',
            origin: pagesOrigin,
            headers: { 'Access-Control-Request-Method': 'POST' }
        });
        assert(preflight.status === 204, `preflight ${preflight.status}`);
        assert(preflight.headers['access-control-allow-origin'] === pagesOrigin, 'CORS github.io preflight');

        const empty = await request(port, {
            method: 'POST',
            url: '/api/manager-command',
            origin: pagesOrigin,
            body: { command: '   ', source: 'office-rpg', ts: new Date().toISOString() }
        });
        assert(empty.status === 400, `empty status ${empty.status}`);
        assert(empty.json && empty.json.delivered === false, 'empty not delivered');

        const local = await request(port, {
            method: 'POST',
            url: '/api/manager-command',
            origin: pagesOrigin,
            body: { command: '檢查閃一狀態', source: 'office-rpg', ts: '2026-09-19T14:00:00.000Z' }
        });
        assert(local.status === 200, `no-webhook status ${local.status}`);
        assert(local.json.ok === true, 'no-webhook ok');
        assert(local.json.delivered === false, 'no-webhook must be delivered:false');
        assert(/LOCAL-ONLY|未設定|未叫醒/i.test(local.json.reply), `no-webhook reply: ${local.json.reply}`);
        assert(/工作未執行|唔代表/.test(local.json.reply), 'must not pretend work finished');
        assert(!/https?:\/\//i.test(JSON.stringify(local.json)), 'response must not leak webhook URL');
        console.log('ok  no webhook → 200 delivered:false');
        console.log('    reply:', local.json.reply);
    });

    await withApp({
        MANAGER_WEBHOOK_URL: 'http://127.0.0.1:1/not-a-real-webhook',
        GITHUB_TOKEN: '',
        VERCEL: undefined
    }, async (port) => {
        const fake = await request(port, {
            method: 'POST',
            url: '/api/manager-command',
            body: { command: '假 webhook 測試', source: 'office-rpg', ts: new Date().toISOString() }
        });
        assert(fake.status === 200, `fake url status ${fake.status}`);
        assert(fake.json.ok === true, 'fake url ok');
        assert(fake.json.delivered === false, 'fake url delivered:false');
        assert(/webhook|失敗|未能|LOCAL QUEUE/i.test(fake.json.reply), `fake url reply: ${fake.json.reply}`);
        assert(/工作未執行|唔代表/.test(fake.json.reply), 'fake url must not pretend completion');
        console.log('ok  fake webhook URL attempted → 200 delivered:false');
        console.log('    reply:', fake.json.reply);
    });

    const mock = await startMockWebhook();
    try {
        await withApp({
            MANAGER_WEBHOOK_URL: `http://127.0.0.1:${mock.port}/wake`,
            GITHUB_TOKEN: '',
            VERCEL: undefined
        }, async (port) => {
            const payload = {
                command: '叫醒主管，巡一轉辦公室',
                source: 'office-rpg',
                ts: '2026-09-19T14:05:00.000Z'
            };
            const ok = await request(port, {
                method: 'POST',
                url: '/api/manager-command',
                body: payload
            });
            assert(ok.status === 200, `mock webhook status ${ok.status}`);
            assert(ok.json.delivered === true, 'mock webhook should deliver');
            assert(/webhook/i.test(ok.json.reply), `delivered reply: ${ok.json.reply}`);
            assert(/唔代表/.test(ok.json.reply), 'delivered ACK is not a completion');
            assert(mock.received.length === 1, `webhook hits ${mock.received.length}`);
            assert(mock.received[0].json.command === payload.command, 'webhook payload command');
            assert(mock.received[0].json.source === 'office-rpg', 'webhook payload source');
            assert(mock.received[0].json.ts === payload.ts, 'webhook payload ts');
            console.log('ok  mock webhook received payload → delivered:true');
            console.log('    reply:', ok.json.reply);
        });
    } finally {
        await new Promise((resolve) => mock.server.close(resolve));
    }

    console.log('all manager-command tests passed');
}

main().catch((err) => {
    console.error('FAIL', err && err.stack ? err.stack : err);
    process.exit(1);
});
