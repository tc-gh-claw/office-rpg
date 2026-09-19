# 部署指南（GitHub Pages 為主）

瀏覽辦公室 **唔需要後端**。優先用 GitHub Pages 派靜態檔。Vercel 只係可選（舊有 `/api/chat`）。

## 本機（靜態，同 Pages 一樣）

```bash
python3 -m http.server 4173
# http://localhost:4173
```

## GitHub Pages

1. Settings → Pages → Deploy from a branch
2. Branch：`main`，folder：`/` (root)
3. 公開網址：`https://<user-or-org>.github.io/<repo>/`

更新員工畫面：覆蓋 `data/office-data.json` 再 push。唔好提交 API key。

## Vercel（可選）

`vercel.json` 會：

- `/api/*` → `api/index.js`（舊 chat／health，OpenClaw 可選）
- 前端 `index.html`、`game.js`、`style.css`、`data/office-data.json` 以靜態檔提供

純睇員工狀態唔會打 API。檢查器入面嘅可選對話若 API 唔在，會用離線模擬。

本機開 Express：

```bash
npm install
npm start
# http://localhost:3000
```

環境變數（只影響 API，唔影響靜態瀏覽）：

| 變數 | 預設 | 說明 |
|------|------|------|
| `PORT` | `3000` | 本機端口 |
| `SESSION_KEY` | `office-rpg-session` | OpenClaw session 名稱（唔係雲端 API key） |
| `API_URL` | （空） | 若前端同 API 唔同網域先要設 |

## 檔案

```
├── index.html
├── style.css
├── game.js
├── data/office-data.json
├── api/index.js
└── vercel.json
```
