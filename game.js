/**
 * 蝦仔辦公室 - Dragon Quest風格 RPG
 * 熱血宅男智慧 Buddy 在辦公室等你
 */

// 遊戲設定
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const TILE_SIZE = 32;
const PLAYER_SPEED = 3;

// 獲取 canvas
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// 遊戲狀態
let gameState = 'playing'; // playing, dialogue
let lastTime = 0;

// 玩家（用戶角色）
const player = {
    x: 400,
    y: 300,
    width: 24,
    height: 32,
    direction: 'down', // up, down, left, right
    isMoving: false,
    animFrame: 0,
    animTimer: 0
};

// 蝦仔（NPC）
const claw = {
    x: 600,
    y: 200,
    width: 24,
    height: 32,
    direction: 'left',
    animFrame: 0,
    animTimer: 0
};

// 辦公室佈置
const officeObjects = [
    // 牆壁邊界
    {x: 0, y: 0, w: 800, h: 32, type: 'wall', color: '#4a4a6a'},
    {x: 0, y: 568, w: 800, h: 32, type: 'wall', color: '#4a4a6a'},
    {x: 0, y: 0, w: 32, h: 600, type: 'wall', color: '#4a4a6a'},
    {x: 768, y: 0, w: 32, h: 600, type: 'wall', color: '#4a4a6a'},
    
    // 辦公桌
    {x: 100, y: 100, w: 80, h: 60, type: 'desk', color: '#8b6f47'},
    {x: 250, y: 100, w: 80, h: 60, type: 'desk', color: '#8b6f47'},
    {x: 100, y: 200, w: 80, h: 60, type: 'desk', color: '#8b6f47'},
    {x: 250, y: 200, w: 80, h: 60, type: 'desk', color: '#8b6f47'},
    
    // 蝦仔的 desk（特別標記）
    {x: 550, y: 180, w: 100, h: 70, type: 'claw-desk', color: '#6b5f47'},
    
    // 會議桌
    {x: 400, y: 350, w: 200, h: 120, type: 'table', color: '#7a6a57'},
    
    // 茶水間
    {x: 50, y: 450, w: 120, h: 80, type: 'kitchen', color: '#5a7a6a'},
    
    // 植物裝飾
    {x: 700, y: 400, w: 30, h: 30, type: 'plant', color: '#4a9a4a'},
    {x: 350, y: 80, w: 30, h: 30, type: 'plant', color: '#4a9a4a'},
];

// 鍵盤輸入
const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    ' ': false, Enter: false
};

// 對話系統
let dialogueHistory = [];
let isNearClaw = false;

// API 設定 - 從環境變數或預設值
const API_URL = window.API_URL || '';

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 隱藏載入畫面
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
    }, 1000);
    
    // 鍵盤事件
    window.addEventListener('keydown', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = true;
        }
        
        // 開啟/關閉對話
        if ((e.key === ' ' || e.key === 'Enter') && isNearClaw && gameState === 'playing') {
            e.preventDefault();
            toggleDialogue();
        }
        
        // ESC 關閉對話
        if (e.key === 'Escape' && gameState === 'dialogue') {
            toggleDialogue();
        }
    });
    
    window.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = false;
        }
    });
    
    // 對話框按鈕
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('dialogue-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // 開始遊戲循環
    requestAnimationFrame(gameLoop);
});

// 遊戲主循環
function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    if (gameState === 'playing') {
        update(deltaTime);
    }
    
    render();
    
    requestAnimationFrame(gameLoop);
}

// 更新邏輯
function update(deltaTime) {
    // 玩家移動
    let dx = 0;
    let dy = 0;
    
    if (keys.w || keys.ArrowUp) dy = -PLAYER_SPEED;
    if (keys.s || keys.ArrowDown) dy = PLAYER_SPEED;
    if (keys.a || keys.ArrowLeft) dx = -PLAYER_SPEED;
    if (keys.d || keys.ArrowRight) dx = PLAYER_SPEED;
    
    // 更新方向
    if (dy < 0) player.direction = 'up';
    if (dy > 0) player.direction = 'down';
    if (dx < 0) player.direction = 'left';
    if (dx > 0) player.direction = 'right';
    
    player.isMoving = dx !== 0 || dy !== 0;
    
    // 更新動畫幀
    if (player.isMoving) {
        player.animTimer += deltaTime;
        if (player.animTimer > 150) {
            player.animFrame = (player.animFrame + 1) % 4;
            player.animTimer = 0;
        }
    } else {
        player.animFrame = 0;
    }
    
    // 嘗試移動並檢查碰撞
    const newX = player.x + dx;
    const newY = player.y + dy;
    
    if (!checkCollision(newX, player.y, player.width, player.height)) {
        player.x = newX;
    }
    if (!checkCollision(player.x, newY, player.width, player.height)) {
        player.y = newY;
    }
    
    // 邊界檢查
    player.x = Math.max(32, Math.min(CANVAS_WIDTH - 32 - player.width, player.x));
    player.y = Math.max(32, Math.min(CANVAS_HEIGHT - 32 - player.height, player.y));
    
    // 檢查是否靠近蝦仔
    const distToClaw = Math.sqrt(
        Math.pow(player.x - claw.x, 2) + 
        Math.pow(player.y - claw.y, 2)
    );
    
    isNearClaw = distToClaw < 60;
    
    // 更新互動提示
    const hint = document.getElementById('interaction-hint');
    if (isNearClaw && gameState === 'playing') {
        hint.style.display = 'block';
        hint.style.left = (claw.x + 10) + 'px';
        hint.style.top = (claw.y - 30) + 'px';
    } else {
        hint.style.display = 'none';
    }
    
    // 蝦仔動畫（待機動作）
    claw.animTimer += deltaTime;
    if (claw.animTimer > 500) {
        claw.animFrame = (claw.animFrame + 1) % 2;
        claw.animTimer = 0;
    }
}

// 碰撞檢測
function checkCollision(x, y, w, h) {
    for (const obj of officeObjects) {
        if (obj.type === 'wall' || obj.type === 'desk' || 
            obj.type === 'claw-desk' || obj.type === 'table' ||
            obj.type === 'kitchen') {
            if (x < obj.x + obj.w &&
                x + w > obj.x &&
                y < obj.y + obj.h &&
                y + h > obj.y) {
                return true;
            }
        }
    }
    return false;
}

// 渲染
function render() {
    // 清空畫布
    ctx.fillStyle = '#3d3d5c';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 繪製地板格子（像素風）
    ctx.fillStyle = '#454560';
    for (let y = 32; y < CANVAS_HEIGHT - 32; y += TILE_SIZE) {
        for (let x = 32; x < CANVAS_WIDTH - 32; x += TILE_SIZE) {
            if ((x + y) % 64 === 0) {
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            }
        }
    }
    
    // 繪製辦公室物件
    for (const obj of officeObjects) {
        // 陰影
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(obj.x + 4, obj.y + 4, obj.w, obj.h);
        
        // 主體
        ctx.fillStyle = obj.color;
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        
        // 高光（像素風立體感）
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(obj.x, obj.y, obj.w, 4);
        ctx.fillRect(obj.x, obj.y, 4, obj.h);
        
        // 特殊裝飾
        if (obj.type === 'desk' || obj.type === 'claw-desk') {
            // 電腦
            ctx.fillStyle = '#2a2a3a';
            ctx.fillRect(obj.x + 20, obj.y + 10, 30, 25);
            ctx.fillStyle = '#4a90d9';
            ctx.fillRect(obj.x + 22, obj.y + 12, 26, 18);
        }
        
        if (obj.type === 'claw-desk') {
            // 蝦仔 desk 特別標記 - 公仔裝飾
            ctx.fillStyle = '#ff6b6b';
            ctx.fillRect(obj.x + 70, obj.y + 5, 8, 12);
            ctx.fillStyle = '#ffd93d';
            ctx.fillRect(obj.x + 80, obj.y + 8, 6, 10);
        }
        
        if (obj.type === 'plant') {
            // 植物葉子
            ctx.fillStyle = '#3a8a3a';
            ctx.beginPath();
            ctx.arc(obj.x + 15, obj.y + 10, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2a6a2a';
            ctx.beginPath();
            ctx.arc(obj.x + 15, obj.y + 8, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // 繪製蝦仔
    drawClaw();
    
    // 繪製玩家
    drawPlayer();
}

// 繪製玩家（像素風角色）
function drawPlayer() {
    const x = player.x;
    const y = player.y;
    const w = player.width;
    const h = player.height;
    
    // 陰影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 2, y + h - 4, w, 4);
    
    // 身體顏色
    const bodyColor = '#4a90d9';
    const skinColor = '#fdbf60';
    const hairColor = '#4a3a2a';
    
    // 身體（簡單像素人）
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x + 4, y + 12, w - 8, h - 12);
    
    // 頭
    ctx.fillStyle = skinColor;
    ctx.fillRect(x + 6, y + 2, w - 12, 12);
    
    // 頭髮
    ctx.fillStyle = hairColor;
    ctx.fillRect(x + 4, y, w - 8, 6);
    ctx.fillRect(x + 4, y, 4, 10);
    ctx.fillRect(x + w - 8, y, 4, 10);
    
    // 眼睛
    ctx.fillStyle = '#000';
    if (player.direction === 'right') {
        ctx.fillRect(x + 14, y + 6, 3, 3);
    } else if (player.direction === 'left') {
        ctx.fillRect(x + 7, y + 6, 3, 3);
    } else {
        ctx.fillRect(x + 8, y + 6, 3, 3);
        ctx.fillRect(x + 13, y + 6, 3, 3);
    }
    
    // 腿（動畫）
    ctx.fillStyle = '#2a3a5a';
    if (player.isMoving && player.animFrame % 2 === 0) {
        ctx.fillRect(x + 5, y + h - 8, 6, 8);
        ctx.fillRect(x + 13, y + h - 6, 6, 6);
    } else if (player.isMoving) {
        ctx.fillRect(x + 5, y + h - 6, 6, 6);
        ctx.fillRect(x + 13, y + h - 8, 6, 8);
    } else {
        ctx.fillRect(x + 5, y + h - 8, 6, 8);
        ctx.fillRect(x + 13, y + h - 8, 6, 8);
    }
}

// 繪製蝦仔（熱血宅男智慧 Buddy）
function drawClaw() {
    const x = claw.x;
    const y = claw.y;
    const w = claw.width;
    const h = claw.height;
    
    // 陰影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 2, y + h - 4, w, 4);
    
    // 身體顏色 - 熱血宅男風格
    const shirtColor = '#ff6b6b'; // 熱血紅色 T-shirt
    const skinColor = '#fdbf60';
    const hairColor = '#2a2a3a'; // 深色頭髮
    const glassesColor = '#4a4a4a';
    
    // 身體
    ctx.fillStyle = shirtColor;
    ctx.fillRect(x + 4, y + 12, w - 8, h - 12);
    
    // 頭
    ctx.fillStyle = skinColor;
    ctx.fillRect(x + 6, y + 2, w - 12, 12);
    
    // 頭髮（宅男亂髮）
    ctx.fillStyle = hairColor;
    ctx.fillRect(x + 4, y, w - 8, 6);
    ctx.fillRect(x + 2, y + 2, 6, 8);
    ctx.fillRect(x + w - 8, y + 2, 6, 8);
    ctx.fillRect(x + 8, y - 2, 4, 4); // 呆毛
    
    // 眼鏡（宅男標配）
    ctx.fillStyle = glassesColor;
    ctx.fillRect(x + 6, y + 5, w - 12, 2);
    ctx.fillRect(x + 7, y + 4, 4, 4);
    ctx.fillRect(x + 13, y + 4, 4, 4);
    
    // 眼睛（發光智慧眼神）
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 8, y + 5, 2, 2);
    ctx.fillRect(x + 14, y + 5, 2, 2);
    
    // 腿（待機動畫 - 輕微抖動）
    ctx.fillStyle = '#3a3a4a';
    if (claw.animFrame === 0) {
        ctx.fillRect(x + 5, y + h - 8, 6, 8);
        ctx.fillRect(x + 13, y + h - 8, 6, 8);
    } else {
        ctx.fillRect(x + 4, y + h - 8, 6, 8);
        ctx.fillRect(x + 14, y + h - 8, 6, 8);
    }
    
    // 名字標籤
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 5, y - 15, 34, 12);
    ctx.fillStyle = '#ffd700';
    ctx.font = '10px sans-serif';
    ctx.fillText('蝦仔', x, y - 6);
}

// 切換對話框
function toggleDialogue() {
    const dialogueBox = document.getElementById('dialogue-box');
    const input = document.getElementById('dialogue-input');
    
    if (gameState === 'playing') {
        gameState = 'dialogue';
        dialogueBox.classList.add('active');
        input.focus();
    } else {
        gameState = 'playing';
        dialogueBox.classList.remove('active');
    }
}

// 發送訊息
async function sendMessage() {
    const input = document.getElementById('dialogue-input');
    const text = input.value.trim();
    
    if (!text) return;
    
    // 顯示用戶訊息
    addToHistory('user', text);
    input.value = '';
    
    // 顯示載入中
    document.getElementById('dialogue-text').textContent = '等等，我諗緊...';
    
    try {
        // 決定 API 網址
        const apiUrl = API_URL ? `${API_URL}/api/chat` : '/api/chat';
        
        // 發送到後端
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: text })
        });
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('dialogue-text').textContent = data.response;
            addToHistory('claw', data.response);
        } else {
            // 如果後端未連接，顯示模擬回應
            const mockResponse = getMockResponse(text);
            document.getElementById('dialogue-text').textContent = mockResponse;
            addToHistory('claw', mockResponse);
        }
    } catch (error) {
        // 模擬回應
        const mockResponse = getMockResponse(text);
        document.getElementById('dialogue-text').textContent = mockResponse;
        addToHistory('claw', mockResponse);
    }
}

// 模擬回應（測試用）
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
    
    return '明白！我記住咗。仲有咩可以幫到你？';
}

// 添加到歷史記錄
function addToHistory(who, text) {
    dialogueHistory.push({ who, text, time: new Date() });
    
    const area = document.getElementById('response-area');
    const div = document.createElement('div');
    div.className = who === 'user' ? 'user-msg' : 'claw-msg';
    div.textContent = (who === 'user' ? '你: ' : '蝦仔: ') + text.substring(0, 50) + (text.length > 50 ? '...' : '');
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
    
    // 限制歷史記錄數量
    while (area.children.length > 5) {
        area.removeChild(area.firstChild);
    }
}
