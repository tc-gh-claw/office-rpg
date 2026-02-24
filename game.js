/**
 * 蝦仔辦公室 - Dragon Quest V 風格 RPG
 */

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const TILE_SIZE = 32;
const PLAYER_SPEED = 3;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let gameState = 'playing';
let lastTime = 0;

const player = { x: 400, y: 300, width: 24, height: 32, direction: 'down', isMoving: false, animFrame: 0, animTimer: 0 };
const claw = { x: 600, y: 200, width: 24, height: 32, direction: 'left', animFrame: 0, animTimer: 0, bobOffset: 0 };

const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, ' ': false, Enter: false };
let isNearClaw = false;
const API_URL = window.API_URL || '';

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        document.getElementById('loading').style.display = 'none';
    }, 2000);
    
    window.addEventListener('keydown', function(e) {
        if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
        if ((e.key === ' ' || e.key === 'Enter') && isNearClaw && gameState === 'playing') {
            e.preventDefault();
            toggleDialogue();
        }
        if (e.key === 'Escape' && gameState === 'dialogue') {
            toggleDialogue();
        }
    });
    
    window.addEventListener('keyup', function(e) {
        if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
    });
    
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('dialogue-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
    
    requestAnimationFrame(gameLoop);
});

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    if (gameState === 'playing') update(deltaTime);
    render();
    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    let dx = 0, dy = 0;
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
    
    if (!checkCollision(newX, player.y, player.width, player.height)) player.x = newX;
    if (!checkCollision(player.x, newY, player.width, player.height)) player.y = newY;
    
    player.x = Math.max(40, Math.min(CANVAS_WIDTH - 40 - player.width, player.x));
    player.y = Math.max(40, Math.min(CANVAS_HEIGHT - 40 - player.height, player.y));
    
    const distToClaw = Math.sqrt(Math.pow(player.x - claw.x, 2) + Math.pow(player.y - claw.y, 2));
    isNearClaw = distToClaw < 70;
    
    const hint = document.getElementById('interaction-hint');
    if (isNearClaw && gameState === 'playing') {
        hint.style.display = 'block';
        hint.style.left = claw.x + 'px';
        hint.style.top = (claw.y - 40) + 'px';
    } else {
        hint.style.display = 'none';
    }
    
    claw.animTimer += deltaTime;
    if (claw.animTimer > 400) {
        claw.animFrame = (claw.animFrame + 1) % 2;
        claw.bobOffset = claw.animFrame === 0 ? 0 : 2;
        claw.animTimer = 0;
    }
}

function checkCollision(x, y, w, h) {
    const objects = [
        {x: 0, y: 0, w: 800, h: 40}, {x: 0, y: 560, w: 800, h: 40},
        {x: 0, y: 0, w: 40, h: 600}, {x: 760, y: 0, w: 40, h: 600},
        {x: 80, y: 80, w: 100, h: 70}, {x: 220, y: 80, w: 100, h: 70},
        {x: 80, y: 180, w: 100, h: 70}, {x: 220, y: 180, w: 100, h: 70},
        {x: 550, y: 160, w: 120, h: 80}, {x: 380, y: 320, w: 240, h: 140},
        {x: 60, y: 420, w: 140, h: 100}
    ];
    for (const obj of objects) {
        if (x < obj.x + obj.w && x + w > obj.x && y < obj.y + obj.h && y + h > obj.y) return true;
    }
    return false;
}

function render() {
    ctx.fillStyle = '#2d3a4a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    for (let y = 40; y < CANVAS_HEIGHT - 40; y += TILE_SIZE) {
        for (let x = 40; x < CANVAS_WIDTH - 40; x += TILE_SIZE) {
            const isEven = ((x / TILE_SIZE) + (y / TILE_SIZE)) % 2 === 0;
            ctx.fillStyle = isEven ? '#4a5568' : '#3d4852';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = '#5a6578';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        }
    }
    
    drawObject(80, 80, 100, 70, '#8b5a2b');
    drawObject(220, 80, 100, 70, '#8b5a2b');
    drawObject(80, 180, 100, 70, '#8b5a2b');
    drawObject(220, 180, 100, 70, '#8b5a2b');
    drawObject(550, 160, 120, 80, '#744210');
    drawObject(380, 320, 240, 140, '#5c4033');
    drawObject(60, 420, 140, 100, '#4a5568');
    drawObject(700, 380, 40, 40, '#48bb78');
    drawObject(340, 60, 40, 40, '#48bb78');
    drawObject(60, 60, 40, 40, '#48bb78');
    
    drawShadow(claw.x + 4, claw.y + claw.height - 4, claw.width - 8, 6);
    drawShadow(player.x + 4, player.y + player.height - 4, player.width - 8, 6);
    
    drawClaw();
    drawPlayer();
}

function drawObject(x, y, w, h, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 4, y + 6, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x, y, w, 3);
    ctx.fillRect(x, y, 3, h);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x, y + h - 3, w, 3);
    ctx.fillRect(x + w - 3, y, 3, h);
}

function drawShadow(x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y, w, h);
}

function drawPlayer() {
    const x = player.x, y = player.y, w = player.width, h = player.height;
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(x + 4, y + 12, w - 8, h - 12);
    ctx.fillStyle = '#f6ad55';
    ctx.fillRect(x + 6, y + 2, w - 12, 12);
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(x + 4, y, w - 8, 6);
    ctx.fillRect(x + 4, y, 4, 10);
    ctx.fillRect(x + w - 8, y, 4, 10);
    ctx.fillStyle = '#1a202c';
    if (player.direction === 'right') ctx.fillRect(x + 14, y + 6, 3, 3);
    else if (player.direction === 'left') ctx.fillRect(x + 7, y + 6, 3, 3);
    else {
        ctx.fillRect(x + 8, y + 6, 3, 3);
        ctx.fillRect(x + 13, y + 6, 3, 3);
    }
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

function drawClaw() {
    const x = claw.x, y = claw.y + claw.bobOffset, w = claw.width, h = claw.height;
    ctx.fillStyle = '#e53e3e';
    ctx.fillRect(x + 4, y + 12, w - 8, h - 12);
    ctx.fillStyle = '#f6ad55';
    ctx.fillRect(x + 6, y + 2, w - 12, 12);
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(x + 4, y, w - 8, 6);
    ctx.fillRect(x + 2, y + 2, 6, 8);
    ctx.fillRect(x + w - 8, y + 2, 6, 8);
    ctx.fillRect(x + 10, y - 3, 4, 5);
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(x + 6, y + 5, w - 12, 3);
    ctx.fillRect(x + 7, y + 4, 5, 5);
    ctx.fillRect(x + 12, y + 4, 5, 5);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 8, y + 5, 3, 3);
    ctx.fillRect(x + 13, y + 5, 3, 3);
    ctx.fillStyle = '#2b6cb0';
    if (claw.animFrame === 0) {
        ctx.fillRect(x + 5, y + h - 8, 6, 8);
        ctx.fillRect(x + 13, y + h - 8, 6, 8);
    } else {
        ctx.fillRect(x + 4, y + h - 8, 6, 8);
        ctx.fillRect(x + 14, y + h - 8, 6, 8);
    }
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(x - 8, y - 18, 40, 14);
    ctx.strokeStyle = '#212529';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 8, y - 18, 40, 14);
    ctx.fillStyle = '#212529';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('蝦仔', x, y - 8);
}

function toggleDialogue() {
    const box = document.getElementById('dialogue-box');
    const input = document.getElementById('dialogue-input');
    const text = document.getElementById('dialogue-text');
    if (gameState === 'playing') {
        gameState = 'dialogue';
        box.classList.add('active');
        text.textContent = '嘿！有咩可以幫到你？';
        input.focus();
    } else {
        gameState = 'playing';
        box.classList.remove('active');
    }
}

function typeWriter(element, text, speed) {
    speed = speed || 30;
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

async function sendMessage() {
    const input = document.getElementById('dialogue-input');
    const text = document.getElementById('dialogue-text');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    text.textContent = '...';
    try {
        const apiUrl = API_URL ? API_URL + '/api/chat' : '/api/chat';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });
        if (response.ok) {
            const data = await response.json();
            typeWriter(text, data.response);
        } else {
            typeWriter(text, getMockResponse(message));
        }
    } catch (error) {
        typeWriter(text, getMockResponse(message));
    }
}

function getMockResponse(text) {
    const lower = text.toLowerCase();
    if (lower.indexOf('你好') >= 0 || lower.indexOf('hi') >= 0) return '嘿！歡迎嚟到辦公室！';
    if (lower.indexOf('食') >= 0 || lower.indexOf('lunch') >= 0) return '午餐？我帶咗便當！';
    if (lower.indexOf('天氣') >= 0) return '今日天氣幾好！';
    if (lower.indexOf('幫手') >= 0) return '有問必答！';
    if (lower.indexOf('bye') >= 0) return '得閒再傾！';
    if (lower.indexOf('蝦仔') >= 0) return '係我呀！熱血宅男！';
    return '收到！我會幫你處理。';
}
