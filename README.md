# AI總管 · 員工辦公室

Dragon Quest 風格嘅像素辦公室，用嚟 **睇** AI 員工隊伍：邊個閒置／忙碌／暫停、最近事件、今日 token 用量對預算。

畫面係 **純靜態網站**（HTML / CSS / JS），GitHub Pages 開到就得，**唔需要後端**。資料由 `data/office-data.json` 讀入。

原本嗰個「蝦仔／claw」單人 NPC 辦公室已擴成 4 張枱：**AI總管**、**閃一**、**閃二**、**智一**。

## 玩法

- **移動**：`WASD` 或方向鍵（手機用畫面右下角十字鍵）
- **查看員工**：行近枱，撳 `空白鍵`／`Enter`；或喺側欄撳名單；或直接撳畫面上嘅人／枱
- **快速揀人**：`1`–`4`
- **關閉視窗**：`Esc` 或視窗右上 `X`
- 對話檢查器顯示：狀態、模型、今日 token、最後回覆預覽、事件備註（全部嚟自 JSON，唔會現場 Call LLM）

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

- 專案站：`https://<user-or-org>.github.io/<repo>/`
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

如果已經接咗 Vercel：前端靜態檔照常睇辦公室；`/api/chat` 仍然可用（檢查器入面「可選模擬對話」會先試 API，失敗就用離線模擬）。**純瀏覽唔需要 API。**

## 檔案結構

```
office-rpg/
├── index.html              # 畫面 + 側欄 HUD
├── style.css               # DQ 風格樣式
├── game.js                 # 地圖、角色、檢查器、HUD
├── data/office-data.json   # 公開員工快照（請定期覆蓋）
├── data/README.md          # 資料格式同更新方法
├── api/index.js            # Vercel／本機可選 API（唔係 Pages 必需）
├── vercel.json
└── README.md
```

## 狀態顏色

| 狀態 | 意思 |
|------|------|
| 閒置 idle | 綠色，輕微擺動 |
| 忙碌 busy | 黃色，打字／省略號 |
| 暫停 paused | 灰色，Zz |
| 離線 offline | 暗色 |
| 錯誤 error | 紅色閃爍 |

---

資料快照唔包含密鑰。畫面只讀公開 JSON。
