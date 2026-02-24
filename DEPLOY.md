# 🚀 蝦仔辦公室 - 部署指南

## 快速開始

### 本地測試

```bash
# 安裝依賴（其實冇依賴，純 Node.js）
cd office-rpg-game

# 啟動後端伺服器
node server.js

# 開瀏覽器去 http://localhost:3000
```

### 連接 OpenClaw

後端會自動嘗試用 `openclaw` CLI 發送訊息。確保：

1. OpenClaw gateway 正在運行
2. `openclaw` 命令可用
3. 設定正確嘅 session key

可以改環境變數：
```bash
SESSION_KEY=your-session-key node server.js
```

## GitHub Pages + 後端方案

GitHub Pages 只支援靜態檔案，唔支援後端。有幾個選擇：

### 方案 1：Vercel（推薦）

1. 去 https://vercel.com 註冊（免費）
2. 連接 GitHub repository
3. 自動部署，有免費後端

### 方案 2：Render

1. 去 https://render.com 註冊
2. 新建 Web Service
3. 連接 GitHub，自動部署

### 方案 3：自建伺服器

如果你部機長開著：

```bash
# 用 screen 或 tmux 保持運行
tmux new -s office-rpg
node server.js
# 按 Ctrl+B 然後 D 分離
```

然後用 ngrok 公開：
```bash
ngrok http 3000
```

## 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PORT` | `3000` | 伺服器端口 |
| `SESSION_KEY` | `office-rpg-session` | OpenClaw session key |
| `OPENCLAW_URL` | `http://localhost:8080` | OpenClaw gateway URL |

## 檔案結構

```
office-rpg-game/
├── index.html          # 主頁面
├── game.js             # 遊戲邏輯
├── server.js           # 後端 API
├── package.json        # Node.js 設定
├── README.md           # 說明文件
└── DEPLOY.md           # 呢個檔案
```

## API 端點

### POST /api/chat
發送訊息俾蝦仔

**Request:**
```json
{
  "message": "你好蝦仔！"
}
```

**Response:**
```json
{
  "response": "嘿！歡迎嚟到辦公室！",
  "timestamp": "2026-02-24T14:30:00.000Z"
}
```

### GET /api/health
健康檢查

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-24T14:30:00.000Z"
}
```

---

有問題隨時問！
