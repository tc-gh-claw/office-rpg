# 部署指南（GitHub Pages 瀏覽 + Vercel 主管指令）

瀏覽指揮中心 **唔需要後端**。優先用 GitHub Pages 派靜態檔。Vercel 提供 `POST /api/manager-command`，等 Terry 喺 Pages 向 AI總管落令。

## 本機（靜態，同 Pages 一樣）

```bash
python3 -m http.server 4173
# http://localhost:4173
```

靜態站可以睇 roster／log。發送主管指令需要 API（方法 B 或已部署嘅 Vercel）。

## 本機 API

```bash
npm install
npm start
# http://localhost:3000
npm test
```

未設 `MANAGER_WEBHOOK_URL` 時，POST 會 200 而且 `delivered: false`。

## GitHub Pages

1. Settings → Pages → Deploy from a branch
2. Branch：`main`，folder：`/` (root)
3. 公開網址：`https://<user-or-org>.github.io/<repo>/`

`*.github.io` 上嘅前端會把指令打去 `https://office-rpg.vercel.app`（可用 `window.API_BASE` 覆寫）。

更新員工畫面：覆蓋 `data/office-data.json` 再 push。唔好提交 API key、webhook URL、GitHub token。

## Vercel

`vercel.json` 會：

- `/api/*` → `api/index.js`（serverless handler：`/api/manager-command`、`/api/health`）
- 前端 `index.html`、`app.js`、`style.css`、`data/office-data.json` 以靜態檔提供

喺 Vercel 專案設定 **`MANAGER_WEBHOOK_URL`** = Grok Bot routine 面板入面嘅 webhook URL。可選 `GITHUB_TOKEN` 用嚟開 `ai-manager-cmd` issue。

環境變數（只影響 API，唔影響靜態瀏覽）：

| 變數 | 預設 | 說明 |
|------|------|------|
| `PORT` | `3000` | 本機端口 |
| `MANAGER_WEBHOOK_URL` | （空） | 叫醒 AI總管 Grok Bot 嘅 webhook（唔好寫入前端） |
| `GITHUB_TOKEN` | （空） | 可選；best-effort 開 GitHub issue |
| `API_BASE` / `API_URL` | （空） | 若前端同 API 唔同網域先要設 |

## 檔案

```
├── index.html
├── style.css
├── app.js
├── data/office-data.json
├── api/index.js
└── vercel.json
```
