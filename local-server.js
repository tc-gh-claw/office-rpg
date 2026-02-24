/**
 * 蝦仔辦公室後端 - 本地 Server + ngrok 版本
 * 你部機開 server，Vercel 網站透過 ngrok 連返嚟
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;
const SESSION_KEY = process.env.SESSION_KEY || 'office-rpg-session';

// 中間件
app.use(cors()); // 允許跨域
app.use(express.json());

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

// API 路由
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        log('INFO', `收到訊息: ${message}`);
        
        try {
            const response = await callOpenClaw(message);
            log('INFO', 'OpenClaw 回應成功');
            res.json({ 
                response,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            log('ERROR', `OpenClaw 呼叫失敗: ${err.message}`);
            res.status(500).json({ 
                error: 'OpenClaw error',
                response: '哎呀，我部機連接唔到，再試一次？'
            });
        }
    } catch (err) {
        log('ERROR', `處理請求失敗: ${err.message}`);
        res.status(500).json({ 
            error: 'Internal server error',
            response: '出錯咗！再試一次？'
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// 啟動 server
app.listen(PORT, () => {
    log('INFO', `🎮 蝦仔辦公室本地後端啟動於 http://localhost:${PORT}`);
    log('INFO', `📋 下一步：運行 ngrok http ${PORT} 取得公開網址`);
    log('INFO', `🔗 然後將 ngrok 網址填入 Vercel 環境變數 API_URL`);
});
