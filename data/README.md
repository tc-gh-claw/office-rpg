# 辦公室公開資料（`office-data.json`）

呢份係 **公開安全** 嘅員工快照：名單、狀態、預算、用量、事件。**唔好**把 API key、token、內部 webhook 寫入呢個檔。

Matrix 終端指揮中心會用相對路徑載入：

```
data/office-data.json
```

GitHub Pages 同 Vercel 都由網站根目錄提供，瀏覽畫面 **唔需要** 後端 API。

## 點樣更新／取代

1. 喺 workforce／AI總管匯出一份 **公開安全** 快照（結構同呢份 seed 一致）。
2. 覆蓋本目錄嘅 `office-data.json`。
3. Commit 同 push 去 GitHub（Pages 會喺下一輪部署後更新）。
4. 如果用緊 Vercel，push 之後前端一樣會讀呢個檔。

本地預覽（喺 repo 根目錄）：

```bash
python3 -m http.server 4173
# 開 http://localhost:4173
```

更新時間欄位請填 `updated_at`（ISO 8601，建議 `+08:00`），頁面 HUD 會顯示。

## 欄位摘要

| 欄位 | 用途 |
|------|------|
| `office_name` | 辦公室標題 |
| `manager` | AI總管（派工） |
| `employees[]` | 員工：`id`、`display_name`、`model`、`status`、`desk` |
| `budgets.per_employee` | 每日／每月 token 上限 |
| `usage` | 今日／本月／累計用量 |
| `events[]` | 工作／測試紀錄（EVENT LOG 同 INSPECTOR 用） |
| `rooms[]` | 可選；而家終端 UI 唔用地圖，保留俾匯出格式相容 |

`status` 可用：`idle`（閒置）、`busy`（忙碌）、`paused`（暫停）、`offline`（離線）、`error`（錯誤）。
