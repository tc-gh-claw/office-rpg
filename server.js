/**
 * 蝦仔辦公室後端 API
 * 連接 OpenClaw 同前端遊戲
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;
const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://localhost:8080';
const SESSION_KEY = process.env.SESSION_KEY || 'office-rpg-session';

// MIME 類型
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// 簡單日誌
function log(level, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}

// 讀取檔案
function serveFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}

// 呼叫 OpenClaw API
async function callOpenClaw(message) {
    return new Promise((resolve, reject) => {
        // 使用 openclaw CLI 發送訊息
        const openclaw = spawn('openclaw', [
            'sessions', 'send',
            '--session-key', SESSION_KEY,
            '--message', message,
            '--timeout-seconds', '30'
        ]);
        
        let output = '';
        let errorOutput = '';
        
        openclaw.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        openclaw.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        openclaw.on('close', (code) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                reject(new Error(`OpenClaw exited with code ${code}: ${errorOutput}`));
            }
        });
        
        openclaw.on('error', (err) => {
            reject(err);
        });
    });
}

// 模擬回應（當 OpenClaw 未連接時）
function getMockResponse(text) {
    const lower = text.toLowerCase();
    
    if (lower.includes('你好') || lower.includes('hi') || lower.includes('hello')) {
        return '嘿！歡迎嚟到辦公室！有咩我可以幫到你？';
    }
    if (lower.includes('食') || lower.includes('lunch') || lower.includes('午餐')) {
        return '午餐？我今日帶咗便當！不過如果你想叫外賣，我可以推介幾間好嘢～';
    }
    if (lower.includes('天氣')) {
        return '今日天氣幾好喎，適合放工去行下！';
    }
    if (lower.includes('幫手') || lower.includes('help')) {
        return '有問必答！你想我做咩？查資料？寫嘢？定係傾下計？';
    }
    if (lower.includes('bye') || lower.includes('再見')) {
        return '得閒再傾！記得飲多啲水啊！';
    }
    if (lower.includes('蝦仔')) {
        return '係我呀！熱血宅男智慧 Buddy，有咩可以幫到你？';
    }
    
    return `收到！你講咗：「${text}」。我會記住，然後幫你處理！`;
}

// 創建 HTTP 伺服器
const server = http.createServer(async (req, res) => {
    // CORS 標頭
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    log('INFO', `${req.method} ${pathname}`);
    
    // API 路由
    if (pathname === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const message = data.message;
                
                log('INFO', `收到訊息: ${message}`);
                
                let response;
                try {
                    // 嘗試呼叫 OpenClaw
                    response = await callOpenClaw(message);
                    log('INFO', 'OpenClaw 回應成功');
                } catch (err) {
                    log('WARN', `OpenClaw 呼叫失敗: ${err.message}，使用模擬回應`);
                    response = getMockResponse(message);
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    response,
                    timestamp: new Date().toISOString()
                }));
            } catch (err) {
                log('ERROR', `處理請求失敗: ${err.message}`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: 'Invalid request',
                    response: '哎呀，出錯咗！再試一次？'
                }));
            }
        });
        return;
    }
    
    // 健康檢查
    if (pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok',
            timestamp: new Date().toISOString()
        }));
        return;
    }
    
    // 靜態檔案
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, 'public', filePath);
    
    // 如果 public 資料夾不存在，用當前目錄
    if (!fs.existsSync(path.join(__dirname, 'public'))) {
        filePath = pathname === '/' ? '/index.html' : pathname;
        filePath = path.join(__dirname, filePath);
    }
    
    serveFile(res, filePath);
});

// 導出俾 Vercel（必須係最後）
module.exports = server;

// 啟動伺服器（本地開發時）
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    server.listen(PORT, () => {
        log('INFO', `🎮 蝦仔辦公室後端啟動於 http://localhost:${PORT}`);
        log('INFO', `📁 靜態檔案目錄: ${__dirname}`);
        log('INFO', `🔌 OpenClaw session: ${SESSION_KEY}`);
    });
}

// 優雅關閉
process.on('SIGTERM', () => {
    log('INFO', '收到 SIGTERM，正在關閉...');
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    log('INFO', '收到 SIGINT，正在關閉...');
    server.close(() => {
        process.exit(0);
    });
});
