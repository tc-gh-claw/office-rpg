/**
 * 蝦仔辦公室 - Dragon Quest V 風格 RPG
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

// 禁用平滑（像素風）
ctx.imageSmoothingEnabled = false;

// 遊戲狀態
let gameState = 'playing';
let lastTime = 0;

// 顏色調色盤 - Dragon Quest V 風格
const COLORS = {
    // 地板
    floorLight: '#4a5568',
    floorDark: '#3d4852',
    floorAccent: '#5a6578',
    
    // 牆壁
    wall: '#2d3748',
    wallHighlight: '#4a5568',
    wallShadow: '#1a202c',
    
    // 辦公桌
    desk: '#8b5a2b',
    deskHighlight: '#a67c52',
    deskShadow: '#5c3d1e',
    
    // 電腦
    monitor: '#1a202c',
    screen: '#4fd1c5',
    screenGlow: '#81e6d9',
    
    // 角色
    skin: '#f6ad55',
    skinShadow: '#dd6b20',
    hair: '#2d3748',
    shirt: '#e53e3e',
    shirtShadow: '#c53030',
    pants: '#2b6cb0',
    
    // 植物
    plant: '#48bb78',
    plantDark: '#276749',
    
    // 裝飾
    gold: '#ecc94b',
    goldShadow: '#d69e2e'
};

// 玩家（用戶角色）
const player = {
    x: 400,
    y: 300,
    width: 24,
    height: 32,
    direction: 'down',
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
    animTimer: 0,
    bobOffset: 0
};

// 辦公室佈置 - 更大更豐富
const officeObjects = [
    // 牆壁邊界
    {x: 0, y: 0, w: 800, h: 40, type: 'wall', color: COLORS.wall},
    {x: 0, y: 560, w: 800, h: 40, type: 'wall', color: COLORS.wall},
    {x: 0, y: 0, w: 40, h: 600, type: 'wall', color: COLORS.wall},
    {x: 760, y: 0, w: 40, h: 600, type: 'wall', color: COLORS.wall},
    
    // 辦公桌區域 1
    {x: 80, y: 80, w: 100, h: 70, type: 'desk', color: COLORS.desk},
    {x: 220, y: 80, w: 100, h: 70, type: 'desk', color: COLORS.desk},
    {x: 80, y: 180, w: 100, h: 70, type: 'desk', color: COLORS.desk},
    {x: 220, y: 180, w: 100, h: 70, type: 'desk', color: COLORS.desk},
    
    // 蝦仔的 desk（特別）
    {x: 550, y: 160, w: 120, h: 80, type: 'claw-desk', color: '#744210'},
    
    // 會議桌
    {x: 380, y: 320, w: 240, h: 140, type: 'table', color: '#5c4033'},
    
    // 茶水間
    {x: 60, y: 420, w: 140, h: 100, type: 'kitchen', color: '#4a5568'},
    
    // 植物裝飾
    {x: 700, y: 380, w: 40, h: 40, type: 'plant', color: COLORS.plant},
    {x: 340, y: 60, w: 40, h: 40, type: 'plant', color: COLORS.plant},
    {x: 60, y: 60, w: 40, h: 40, type: 'plant', color: COLORS.plant},
    
    // 裝飾品
    {x: 680, y: 100, w: 30, h: 30, type: 'poster', color: '#9f7aea'},
    {x: 450, y: 60, w: 30, h: 30, type: 'clock', color: COLORS.gold},
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

// API 設定
const API_URL = window.API_URL || '';

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
    }, 2000);
    
    window.addEventListener('keydown', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = true;
        }
        
        if ((e.key === ' ' || e.key === 'Enter') && isNearClaw && gameState === 'playing') {
            e.preventDefault();
            toggleDialogue();
        }
        
        if (e.key === 'Escape' && gameState === 'dialogue') {
            toggleDialogue();
        }
    });
    
    window.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = false;
        }
    });
    
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('dialogue-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
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
    let dx = 0;
    let dy = 0;
    
    if (keys.w || keys.ArrowUp) dy = -PLAYER_SPEED;
    if (keys.s || keys.ArrowDown) dy = PLAYER_SPEED;
    if (keys.a || keys.ArrowLeft) dx = -PLAYER_SPEED;
    if (keys.d || keys.ArrowRight) dx = PLAYER_SPEED;
    
    if (dy < 0) player.direction = 'up';
    if (dy > 0) player.direction = 'down';
    if (dx < 0) player.direction = 'left';
    if (dx > 0) player.direction = 'right';
    
    player.isMoving = dx !== 0 || dy !== 0;
    
    if (player.isMoving) {
        player.animTimer += deltaTime;
        if (player.animTimer > 150) {
            player.animFrame = (player.animFrame + 1) % 4;
            player.animTimer = 0;
        }
    } else {
        player.animFrame = 0;
    }
    
    const newX = player.x + dx;
    const newY = player.y + dy;
    
    if (!checkCollision(newX, player.y, player.width, player.height)) {
        player.x = newX;
    }
    if (!checkCollision(player.x, newY, player.width, player.height)) {
        player.y = newY;
    }
    
    player.x = Math.max(40, Math.min(CANVAS_WIDTH - 40 - player.width, player.x));
    player.y = Math.max(40, Math.min(CANVAS_HEIGHT - 40 - player.height, player.y));
    
    const distToClaw = Math.sqrt(
        Math.pow(player.x - claw.x, 2) + 
        Math.pow(player.y - claw.y, 2)
    );
    
    isNearClaw = distToClaw < 70;
    
    const hint = document.getElementById('interaction-hint');
    if (isNearClaw && gameState === 'playing') {
        hint.style.display = 'block';
        hint.style.left = (claw.x) + 'px';
        hint.style.top = (claw.y - 40) + 'px';
    } else {
        hint.style.display = 'none';
    }
    
    // 蝦仔待機動畫
    claw.animTimer += deltaTime;
    if (claw.animTimer > 400) {
        claw.animFrame = (claw.animFrame + 1) % 2;
        claw.bobOffset = claw.animFrame === 0 ? 0 : 2;
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
    ctx.fillStyle = COLORS.floorDark;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 繪製地板格子（像素風）
    for (let y = 40; y < CANVAS_HEIGHT - 40; y += TILE_SIZE) {
        for (let x = 40; x < CANVAS_WIDTH - 40; x += TILE_SIZE) {
            const isEven = ((x / TILE_SIZE) + (y / TILE_SIZE)) % 2 === 0;
            ctx.fillStyle = isEven ? COLORS.floorLight : COLORS.floorDark;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            
            // 格子邊框
            ctx.strokeStyle = COLORS.floorAccent;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        }
    }
    
    // 繪製辦公室物件
    for (const obj of officeObjects) {
        drawObject(obj);
    }
    
    // 繪製陰影
    drawShadow(claw.x + 4, claw.y + claw.height - 4, claw.width - 8, 6);
    drawShadow(player.x + 4, player.y + player.height - 4, player.width - 8, 6);
    
    // 繪製角色
    drawClaw();
    drawPlayer();
}

// 繪製物件
function drawObject(obj) {
    // 陰影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(obj.x + 4, obj.y + 6, obj.w, obj.h);
    
    // 主體
    ctx.fillStyle = obj.color;
    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    
    // 高光（像素風立體感）
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(obj.x, obj.y, obj.w, 3);
    ctx.fillRect(obj.x, obj.y, 3, obj.h);
    
    // 陰影邊
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(obj.x, obj.y + obj.h - 3, obj.w, 3);
    ctx.fillRect(obj.x + obj.w - 3, obj.y, 3, obj.h);
    
    // 特殊裝飾
    if (obj.type === 'desk' || obj.type === 'claw-desk') {
        // 電腦
        ctx.fillStyle = COLORS.monitor;
        ctx.fillRect(obj.x + 25, obj.y + 12, 35, 28);
        ctx.fillStyle = COLORS.screen;
        ctx.fillRect(obj.x + 27, obj.y + 14, 31, 20);
        
        // 屏幕光
        ctx.fillStyle = COLORS.screenGlow;
        ctx.fillRect(obj.x + 29, obj.y + 16, 8, 6);
    }
    
    if (obj.type === 'claw-desk') {
        // 蝦仔 desk 特別標記 - 公仔裝飾
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(obj.x + 80, obj.y + 8, 10, 14);
        ctx.fillStyle = '#ffd93d';
        ctx.fillRect(obj.x + 92, obj.y + 10, 8, 12);
        
        // 名牌
        ctx.fillStyle = '#fff';
        ctx.fillRect(obj.x + 85, obj.y + 45, 30, 12);
        ctx.fillStyle = '#212529';
        ctx.font = '8px monospace';
        ctx.fillText('蝦仔', obj.x + 88, obj.y + 53);
    }
    
    if (obj.type === 'plant') {
        // 植物葉子 - 像素風
        ctx.fillStyle = COLORS.plantDark;
        ctx.fillRect(obj.x + 15, obj.y + 25, 10, 15);
        
        ctx.fillStyle = COLORS.plant;
        ctx.fillRect(obj.x + 8, obj.y + 8, 12, 12);
        ctx.fillRect(obj.x + 20, obj.y + 10, 10, 10);
        ctx.fillRect(obj.x + 12, obj.y + 2, 10, 10);
        
        ctx.fillStyle = '#68d391';
        ctx.fillRect(obj.x + 15, obj.y + 12, 6, 6);
    }
    
    if (obj.type === 'poster') {
        // 海報
        ctx.fillStyle = '#e9d8fd';
        ctx.fillRect(obj.x + 5, obj.y + 5, obj.w - 10, obj.h - 10);
        ctx.fillStyle = '#805ad5';
        ctx.font = '10px monospace';
        ctx.fillText('DQ', obj.x + 10, obj.y + 22);
    }
    
    if (obj.type === 'clock') {
        // 時鐘
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(obj.x + obj.w/2, obj.y + obj.h/2, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d69e2e';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// 繪製陰影
function drawShadow(x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y, w, h);
}

// 繪製玩家（像素風角色）
function drawPlayer() {
    const x = player.x;
    const y = player.y;
    const w = player.width;
    const h = player.height;
    
    // 身體
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(x + 4, y + 12, w - 8, h - 12);
    
    // 頭
    ctx.fillStyle = COLORS.skin;
    ctx.fillRect(x + 6, y + 2, w - 12, 12);
    
    // 頭髮
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(x + 4, y, w - 8, 6);
    ctx.fillRect(x + 4, y, 4, 10);
    ctx.fillRect(x + w - 8, y, 4, 10);
    
    // 眼睛
    ctx.fillStyle = '#1a202c';
    if (player.direction === 'right') {
        ctx.fillRect(x + 14, y + 6, 3, 3);
    } else if (player.direction === 'left') {
        ctx.fillRect(x + 7, y + 6, 3, 3);
    } else {
        ctx.fillRect(x + 8, y + 6, 3, 3);
        ctx.fillRect(x + 13, y + 6, 3, 3);
    }
    
    // 腿（動畫）
    ctx.fillStyle = '#2c5282';
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
    const y = claw.y + claw.bobOffset;
    const w = claw.width;
    const h = claw.height;
    
    // 身體 - 熱血紅色 T-shirt
    ctx.fillStyle = COLORS.shirt;
    ctx.fillRect(x + 4, y + 12, w - 8, h - 12);
    
    // 頭
    ctx.fillStyle = COLORS.skin;
    ctx.fillRect(x + 6, y + 2, w - 12, 12);
    
    // 頭髮（宅男亂髮 + 呆毛）
    ctx.fillStyle = COLORS.hair;
    ctx.fillRect(x + 4, y, w - 8, 6);
    ctx.fillRect(x + 2, y + 2, 6, 8);
    ctx.fillRect(x + w - 8, y + 2, 6, 8);
    ctx.fillRect(x + 10, y - 3, 4, 5); // 呆毛
    
    // 眼鏡（黑色粗框）
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(x + 6, y + 5, w - 12, 3);
    ctx.fillRect(x + 7, y + 4, 5, 5);
    ctx.fillRect(x + 12, y + 4, 5, 5);
    
    // 眼睛（發光）
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 8, y + 5, 3, 3);
    ctx.fillRect(x + 13, y + 5, 3, 3);
    
    // 腿
    ctx.fillStyle = COLORS.pants;
    if (claw.animFrame === 0) {
        ctx.fillRect(x + 5, y + h - 8, 6, 8);
        ctx.fillRect(x + 13, y + h - 8, 6, 8);
    } else {
        ctx.fillRect(x + 4, y + h - 8, 6, 8);
        ctx.fillRect(x + 14, y + h - 8, 6, 8);
    }
    
    // 名字標籤 - DQ 風格
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(x - 8, y - 18, 40, 14);
    ctx.strokeStyle = '#212529';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 8, y - 18, 40, 14);
    ctx.fillStyle = '#212529';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('蝦仔', x, y - 8);
}

// 切換對話框
function toggleDialogue() {
    const dialogueBox = document.getElementById('dialogue-box');
    const input = document.getElementById('dialogue-input');
    const text = document.getElementById('dialogue-text');
    
    if (gameState === 'playing') {
        gameState = 'dialogue';
        dialogueBox.classList.add('active');
        text.textContent = '嘿！有咩可以幫到你？';
        input.focus();
    } else {
        gameState = 'playing';
        dialogueBox.classList.remove('active');
    }
}

// 打字機效果
function typeWriter(element, text, speed = 30) {
    element.textContent = '';
    element.classList.add('typing-cursor');
    let i = 0;
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else {
            element.classList.remove('typing-cursor');
        }
    }
    
    type();
}

// 發送訊息
async function sendMessage() {
    const input = document.getElementById('dialogue-input');
    const text = document.getElementById('dialogue-text');
    const message = input.value.trim();
    
    if (!message) return;
    
    addToHistory('user', message);
    input.value = '';
    
    text.textContent = '...';
    
    try {
        const apiUrl = API_URL ? `${API_URL}/api/chat` : '/api/chat';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        if (response.ok) {
            const data = await response.json();
            typeWriter(text, data.response);
            addToHistory('claw', data.response);
        } else {
            const mockResponse = getMockResponse(message);
            typeWriter(text, mockResponse);
            addToHistory('claw', mockResponse);
        }
    } catch (error) {
        const mockResponse = getMockResponse(message);
        typeWriter(text, mockResponse);
        addToHistory('claw', mockResponse);
    }
}

// 模擬回應
function getMockResponse(text) {
    const lower = text.toLowerCase();
    
    if (lower.includes('你好') || lower.includes('hi') || lower.includes('hello')) {
        return '嘿！歡迎嚟到辦公室！有咩我可以幫到你？';
    }
    if (lower.includes('食') || lower.includes('lunch')) {
        return '午餐？我今日帶咗便當！';
    }
    if (lower.includes('天氣')) {
        return '今日天氣幾好喎！';
    }
    if (lower.includes('幫手') || lower.includes('help')) {
        return '有問必答！你想我做咩？';
    }
    if (lower.includes('bye') || lower.includes('再見')) {
        return '得閒再傾！';
    }
    if (lower.includes('蝦仔')) {
        return '係我呀！熱血宅男智慧 Buddy！';
    }
    
    return `收到！我會幫你處理「${text}」`;
}

// 添加到歷史
function addToHistory(who, text) {
    dialogueHistory.push({ who, text, time: new Date() });
    
    const area = document.getElementById('response-area');
    const div = document.createElement('div');
    div.className = who === 'user' ? 'user-msg' : 'claw-msg';
    const prefix = who === 'user' ? '▶ ' : '◀ ';
    div.textContent = prefix + text.substring(0, 30) + (text.length > 30 ? '...' : '');
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
    
    while (area.children.length > 5) {
        area.removeChild(area.firstChild);
    }
}
