# 🏢 蝦仔辦公室 - Dragon Quest 風格 RPG

一個像素風格嘅網頁遊戲，你可以喺辦公室入面行嚟行去，搵熱血宅男蝦仔傾計！

## 🎮 玩法

- **移動**：WASD 或方向鍵
- **對話**：行近蝦仔個 desk，按 SPACE 或 ENTER
- **關閉對話**：ESC 或再按一次 SPACE

## 🚀 部署到 GitHub Pages

### 方法一：直接上傳（簡單）

1. 去 GitHub 創建新 repository（例如叫 `office-rpg`）
2. 將呢三個檔案上傳到 root：
   - `index.html`
   - `game.js`
   - `README.md`
3. 去 repository Settings → Pages
4. Source 揀 **Deploy from a branch**
5. Branch 揀 **main**，folder 揀 **/(root)**
6. 等 1-2 分鐘，訪問 `https://你的用戶名.github.io/office-rpg`

### 方法二：用 Git 命令行

```bash
# 初始化 git
git init

# 加檔案
git add index.html game.js README.md

# 提交
git commit -m "Initial commit"

# 加 remote（換成你嘅 repository）
git remote add origin https://github.com/你的用戶名/office-rpg.git

# 推送
git push -u origin main
```

## 📝 檔案結構

```
office-rpg/
├── index.html      # 主頁面
├── game.js         # 遊戲邏輯
└── README.md       # 呢個檔案
```

## 🎨 特色

- Dragon Quest 風格像素畫
- 熱血宅男角色（眼鏡、呆毛、紅色 T-shirt）
- 辦公室場景：desk、會議室、茶水間
- RPG 風格對話框

## 🔮 未來功能

- [ ] 接駁真正 AI 後端
- [ ] 更多 NPC 同事
- [ ] 任務系統
- [ ] 存檔功能

---

Made with ❤️‍🔥 by 蝦仔
