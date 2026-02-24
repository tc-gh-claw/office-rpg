/**
 * 蝦仔辦公室後端 API - WebSocket 版本
 * 連接 OpenClaw 同前端遊戲
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const SESSION_KEY = process.env.SESSION_KEY || 'office-rpg-session';

// 中間件
app.use(express.json());

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// 日誌
function log(level, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}

// 呼叫 OpenClaw API
async function callOpenClaw(message) {
    return new Promise((resolve, reject) => {
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

// 模擬回應
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

// WebSocket 連接處理
wss.on('connection', (ws) => {
    log('INFO', '新 WebSocket 連接');
    
    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);
            
            if (msg.type === 'chat') {
                const message = msg.content;
                log('INFO', `WebSocket 收到訊息: ${message}`);
                
                let response;
                try {
                    response = await callOpenClaw(message);
                    log('INFO', 'OpenClaw 回應成功');
                } catch (err) {
                    log('WARN', `OpenClaw 呼叫失敗: ${err.message}，使用模擬回應`);
                    response = getMockResponse(message);
                }
                
                ws.send(JSON.stringify({
                    type: 'response',
                    content: response,
                    timestamp: new Date().toISOString()
                }));
            }
        } catch (err) {
            log('ERROR', `WebSocket 處理失敗: ${err.message}`);
            ws.send(JSON.stringify({
                type: 'error',
                content: '處理訊息時出錯'
            }));
        }
    });
    
    ws.on('close', () => {
        log('INFO', 'WebSocket 連接關閉');
    });
});

// HTTP API 路由（備用）
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        log('INFO', `HTTP API 收到訊息: ${message}`);
        
        let response;
        try {
            response = await callOpenClaw(message);
            log('INFO', 'OpenClaw 回應成功');
        } catch (err) {
            log('WARN', `OpenClaw 呼叫失敗: ${err.message}，使用模擬回應`);
            response = getMockResponse(message);
        }
        
        res.json({ 
            response,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        log('ERROR', `處理請求失敗: ${err.message}`);
        res.status(500).json({ 
            error: 'Internal server error',
            response: '哎呀，出錯咗！再試一次？'
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        websocket: wss.clients.size,
        timestamp: new Date().toISOString()
    });
});

// 靜態檔案 - 主頁（注入 API_URL）
app.get("/", (req, res) => {
    const indexPath = path.join(__dirname, "../index.html");
    if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, "utf8");
        const apiUrl = process.env.API_URL || "";
        const scriptInjection = `<script>window.API_URL = "${apiUrl}";</script>`;
        html = html.replace('<script src="game.js"></script>', scriptInjection + "\n    <script src=\"game.js\"></script>");
        res.send(html);
    } else {
        res.status(404).send("index.html not found");
    }
});
app.get('/game.js', (req, res) => {
    const jsPath = path.join(__dirname, '../game.js');
    if (fs.existsSync(jsPath)) {
        res.setHeader('Content-Type', 'application/javascript');
        res.sendFile(jsPath);
    } else {
        res.status(404).send('game.js not found');
    }
});

// 本地開發
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    server.listen(PORT, () => {
        log('INFO', `🎮 蝦仔辦公室後端啟動於 http://localhost:${PORT}`);
        log('INFO', `🔌 WebSocket 已啟用`);
    });
}

// Vercel 需要導出
module.exports = server;
