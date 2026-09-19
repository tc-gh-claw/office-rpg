# AI總管 :: WORKFORCE NODE

Matrix 風格 **終端指揮中心**：綠黑畫面、等寬字、ASCII 邊框，用嚟睇 AI 員工隊伍——邊個閒置／忙碌／暫停／離線／錯誤、今日 token 對預算、最近事件、單一員工檢查視窗。

畫面係 **純靜態網站**（HTML / CSS / JS），GitHub Pages 開到就得，**唔需要後端**。資料由 `data/office-data.json` 讀入。

## 視覺：Style D · Matrix terminal command-center

近黑底（`#000` / `#050505`）、Matrix 綠（`#00ff41`）、直角、monospace、輕掃描線。背景係 Canvas **Matrix rain**（低對比，唔蓋過 HUD）。參考 [nocoo/matrix](https://github.com/nocoo/matrix) 嘅綠黑終端看板，**唔再**係 Dragon Quest 像素 RPG、牧場暖色辦公室、或者霓虹賽博像素枱。

四個節點：**AI總管**、**閃一**、**閃二**、**智一**。暫停（例如智一）用虛線框、暗綠 `[PAUSED]`、`// HALT` 標示，同閒置／忙碌明顯分開。

## 畫面面板

| 面板 | 內容 |
|------|------|
| ROSTER / 員工名單 | 狀態、模型、今日用量 ASCII bar |
| INSPECTOR / 檢查視窗 | 揀中員工：最後回覆、模型、token、事件 |
| TOKEN BUDGETS | 每日／每月用量對預算 |
| EVENT LOG | 捲動終端 feed；撳一行會揀對應員工 |

## 操作

- **揀人**：撳名單；或 `1`–`4`；或 `↑` `↓` / `j` `k`
- **檢查**：揀中後右側 inspector 即時更新
- **事件**：撳 log 一行會跳去嗰位員工
- **關閉選取**：`Esc`
- inspector 入面可選「模擬對話」：靜態站唔會 Call 真 LLM；若 Vercel／本機 `/api/chat` 存在會先試

## 本機開啟

唔好直接雙擊 `index.html`（`fetch` 讀 JSON 喺 `file://` 會失敗）。喺 repo 根目錄開一個靜態伺服器：

```bash
# 方法 A：Python（最簡單，GitHub Pages 同一套檔）
python3 -m http.server 4173
# 瀏覽器開 http://localhost:4173
```

```bash
# 方法 B：沿用原本 Express（同時保留 /api/chat，方便 Vercel／本機 API）
npm install
npm start
# 瀏覽器開 http://localhost:3000
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

## Vercel（可選，唔影響 Pages）

如果已經接咗 Vercel：前端靜態檔照常睇指揮中心；`/api/chat` 仍然可用（inspector 入面「可選模擬對話」會先試 API，失敗就用離線模擬）。**純瀏覽唔需要 API。**

## 檔案結構

```
office-rpg/
├── index.html              # Matrix 終端殼
├── style.css               # 綠黑主題 token / HUD
├── app.js                  # 載入 JSON、名單、預算、log、inspector
├── data/office-data.json   # 公開員工快照（請定期覆蓋）
├── data/README.md          # 資料格式同更新方法
├── api/index.js            # Vercel／本機可選 API（唔係 Pages 必需）
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

資料快照唔包含密鑰。畫面只讀公開 JSON。
