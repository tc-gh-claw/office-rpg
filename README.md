# AI總管 :: WORKFORCE NODE

Matrix 風格 **終端指揮中心**：綠黑畫面、等寬字、ASCII 邊框，用嚟睇 AI 員工隊伍——邊個閒置／忙碌／暫停／離線／錯誤、今日 token 對預算、最近事件、單一員工檢查視窗。Terry 可以喺 **主管指令** 控制台向 AI總管／主管落令。

畫面係 **純靜態網站**（HTML / CSS / JS），GitHub Pages 開到就得，**瀏覽唔需要後端**。資料由 `data/office-data.json` 讀入。發送主管指令會打去 Vercel API（`POST /api/manager-command`）；webhook URL **唔會**寫入前端 JS。

## 視覺：Style D · Matrix terminal command-center

近黑底（`#000` / `#050505`）、Matrix 綠（`#00ff41`）、直角、monospace、輕掃描線。背景係 Canvas **Matrix rain**（低對比，唔蓋過 HUD）。參考 [nocoo/matrix](https://github.com/nocoo/matrix) 嘅綠黑終端看板。

四個節點：**AI總管**、**閃一**、**閃二**、**智一**。暫停（例如智一）用虛線框、暗綠 `[PAUSED]`、`// HALT` 標示，同閒置／忙碌明顯分開。

## 畫面面板

| 面板 | 內容 |
|------|------|
| 01 ROSTER / 員工名單 | 狀態、模型、今日用量 ASCII bar |
| 02 INSPECTOR / 檢查視窗 | 揀中員工：最後回覆、模型、token、事件 |
| 03 TOKEN BUDGETS | 每日／每月用量對預算 |
| 04 EVENT LOG | 捲動終端 feed；主管指令會即時 echo |
| 05 主管指令 / `CMD >` | 向 AI總管落令；Enter 或「發送」 |

## 操作

- **揀人**：撳名單；或 `1`–`4`；或 `↑` `↓` / `j` `k`
- **檢查**：揀中後右側 inspector 即時更新
- **事件**：撳 log 一行會跳去嗰位員工
- **關閉選取**：`Esc`
- **主管指令**：喺 panel 05 輸入，Enter 送出。EVENT LOG 會即時出現 `> USER :: …`，然後 `< AI總管 :: 已接收…`（或錯誤）。ACK **唔代表**主管已經做完工作。

## 本機開啟

唔好直接雙擊 `index.html`（`fetch` 讀 JSON 喺 `file://` 會失敗）。喺 repo 根目錄開一個靜態伺服器：

```bash
# 方法 A：Python（同 GitHub Pages 一樣，只瀏覽）
python3 -m http.server 4173
# 瀏覽器開 http://localhost:4173
```

```bash
# 方法 B：本機 API（可以試主管指令，無 webhook 會回 delivered:false）
npm install
npm start
# 瀏覽器開 http://localhost:3000
npm test   # mock POST：無 webhook / 假 URL
```

## 啟用 GitHub Pages

1. 將呢個 repo push 去 GitHub（例如 `office-rpg`）。
2. 開 repository **Settings → Pages**。
3. Source 揀 **Deploy from a branch**。
4. Branch 揀 **`main`**（或你合併 PR 嘅預設分支），Folder 揀 **`/` (root)**。
5. 儲存後等一兩分鐘。

### 公開網址格式

- 專案站：`https://<user>.github.io/<repo>/`
- 例如本 repo：`https://tc-gh-claw.github.io/office-rpg/`
- 若 repo 名係 `<user>.github.io`：`https://<user>.github.io/`

資料用 **相對路徑** `data/office-data.json`，所以放喺 `/` 或子路徑（`/office-rpg/`）都讀到。根目錄有 `.nojekyll`，避免 Jekyll 食咗 `data/` 資料夾。

喺 `*.github.io` 開頁時，主管指令會 POST 去 `https://office-rpg.vercel.app/api/manager-command`（可用 `window.API_BASE` 覆寫）。靜態 Pages 仍然只負責顯示；真正轉送靠 Vercel。

## 點樣更新 `data/office-data.json`

Roster、預算、用量、派工歷史住喺呢個 repo 外面。公開安全快照（冇 API key）放到：

```
data/office-data.json
```

更新步驟：

1. 由 workforce／AI總管匯出一份 **唔含密鑰** 嘅 JSON（欄位同 seed 一致：`office_name`、`manager`、`employees`、`budgets`、`usage`、`events`）。
2. 覆蓋 `data/office-data.json`。
3. Commit + push。Pages／Vercel 下一輪部署就會顯示新狀態。

詳情見 [`data/README.md`](data/README.md)。

開發時可以用 `?data=data/office-data.json`（只接受 `data/` 開頭嘅相對路徑）。

## Vercel（主管指令 API）

前端靜態檔照常睇指揮中心。`POST /api/manager-command` 負責接收指令：

```json
{ "command": "…", "source": "office-rpg", "ts": "ISO-8601" }
```

行為：

1. 驗證指令（trim 後非空，最多約 4000 字）。
2. 若 Vercel env **`MANAGER_WEBHOOK_URL`** 有值，將同一份 JSON POST 過去（叫醒 Grok Bot routine）。**唔好**把呢個 URL 寫入 `app.js` 或任何前端檔。
3. webhook 未設或失敗時，仍然回 **200** `{ ok: true, delivered: false, reply: "…" }`——Matrix 風短 ACK，說明只係本機／排隊，**唔會假裝主管已經做完工作**。
4. 可選：若設咗 `GITHUB_TOKEN`，best-effort 喺 `tc-gh-claw/office-rpg` 開 issue（label `ai-manager-cmd`，title 係截短指令）。

### 環境變數（Vercel Project Settings → Environment Variables）

| 變數 | 必須 | 說明 |
|------|------|------|
| `MANAGER_WEBHOOK_URL` | 建議 | Grok Bot routine 面板入面嘅 webhook URL。設咗先會叫醒真正 AI總管。 |
| `GITHUB_TOKEN` | 可選 | 有權喺 `tc-gh-claw/office-rpg` 開 issue 嘅 token |
| `GITHUB_REPO` | 可選 | 預設 `tc-gh-claw/office-rpg` |
| `API_BASE` / `API_URL` | 可選 | 本機若要前端打去另一個 API origin 先要設 |

`GET /api/health` 只回 `status`、`webhookConfigured`（布林，唔會洩漏 URL）。

CORS 允許 `*.github.io`、`*.vercel.app`、localhost。

## 檔案結構

```
office-rpg/
├── index.html              # Matrix 終端殼（含 panel 05 主管指令）
├── style.css               # 綠黑主題 token / HUD
├── app.js                  # 載入 JSON、名單、預算、log、指令控制台
├── data/office-data.json   # 公開員工快照（請定期覆蓋）
├── data/README.md          # 資料格式同更新方法
├── api/index.js            # Vercel serverless：manager-command + health
├── scripts/test-manager-command.js
├── vercel.json
└── README.md
```

## 狀態

| 狀態 | 意思 |
|------|------|
| 閒置 idle | 亮綠 `[IDLE]` |
| 忙碌 busy | 亮綠閃爍 `[BUSY]` |
| 暫停 paused | 暗綠虛線框 `[PAUSED]` + HALT |
| 離線 offline | 更暗 `[OFFLINE]` |
| 錯誤 error | 紅 `[ERROR]` 閃爍 |

---

資料快照唔包含密鑰。畫面只讀公開 JSON。Webhook／token 只可以放 Vercel env。
