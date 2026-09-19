/**
 * AI總管 · 員工辦公室
 * Dragon Quest 風格像素辦公室（純靜態，讀取 data/office-data.json）
 */

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const TILE_SIZE = 32;
const PLAYER_SPEED = 3;
const INTERACT_DIST = 72;
const DATA_FILE = 'data/office-data.json';

const STATUS_UI = {
    idle: { label: '閒置', color: '#51cf66', screen: '#69db7c' },
    busy: { label: '忙碌', color: '#ffd43b', screen: '#ffd43b' },
    paused: { label: '暫停', color: '#adb5bd', screen: '#495057' },
    offline: { label: '離線', color: '#495057', screen: '#1a1a1a' },
    error: { label: '錯誤', color: '#ff6b6b', screen: '#fa5252' }
};

const KIND_LABELS = {
    smoke_test: '煙霧測試',
    connectivity_test: '連線測試',
    dispatch: '派工',
    chat: '對話',
    failover: '備援切換'
};

const PALETTES = {
    player: { shirt: '#4a90d9', pants: '#2c5282', hair: '#2d3748', skin: '#f6ad55' },
    'ai-manager': { shirt: '#6b21a8', pants: '#1e1b4b', hair: '#111827', skin: '#f6ad55', accent: '#fbbf24' },
    'gemini-a': { shirt: '#eab308', pants: '#854d0e', hair: '#1c1917', skin: '#f6ad55', accent: '#fde047' },
    'gemini-b': { shirt: '#f97316', pants: '#9a3412', hair: '#1c1917', skin: '#fdba74', accent: '#fb923c' },
    'chatgpt-a': { shirt: '#14b8a6', pants: '#115e59', hair: '#0f172a', skin: '#f6ad55', accent: '#5eead4' }
};

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const API_URL = window.API_URL || '';

let gameState = 'playing';
let lastTime = 0;
let officeData = null;
let npcs = [];
let nearbyNpc = null;
let selectedId = null;
let loadError = null;

const player = {
    x: 390,
    y: 470,
    width: 24,
    height: 32,
    direction: 'up',
    isMoving: false,
    animFrame: 0,
    animTimer: 0
};

const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    ' ': false, Enter: false
};

const holdDir = { up: false, down: false, left: false, right: false };

const STATIC_FURNITURE = [
    { id: 'pantry', x: 56, y: 430, w: 140, h: 92 },
    { id: 'meeting', x: 560, y: 390, w: 186, h: 112 },
    { id: 'printer', x: 248, y: 448, w: 44, h: 40 }
];

function dataUrl() {
    const q = new URLSearchParams(window.location.search).get('data');
    if (q && q.startsWith('data/') && !q.includes('..')) {
        return q;
    }
    return new URL(DATA_FILE, document.baseURI).href;
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function statusInfo(status) {
    return STATUS_UI[status] || STATUS_UI.idle;
}

function kindLabel(kind) {
    return KIND_LABELS[kind] || kind || '事件';
}

function formatTime(iso) {
    try {
        return new Date(iso).toLocaleString('zh-HK', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch (err) {
        return iso || '';
    }
}

function formatTokens(n) {
    const v = Number(n) || 0;
    if (v >= 1000000) return (v / 1000000).toFixed(2) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
    return String(v);
}

function todayUsage(empId) {
    const u = (officeData && officeData.usage && officeData.usage[empId]) || {};
    const b = (officeData && officeData.budgets && officeData.budgets.per_employee && officeData.budgets.per_employee[empId]) || {};
    const used = (Number(u.day_input) || 0) + (Number(u.day_output) || 0);
    const limit = Number(b.daily_limit) || 0;
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    return { used, limit, pct, input: Number(u.day_input) || 0, output: Number(u.day_output) || 0, calls: Number(u.call_count) || 0 };
}

function eventsFor(empId) {
    const list = (officeData && officeData.events) || [];
    return list.filter(function (ev) { return ev.employee_id === empId; });
}

function lastEvent(empId) {
    const list = eventsFor(empId);
    if (!list.length) return null;
    return list[list.length - 1];
}

function deriveManagerStatus() {
    const employees = (officeData && officeData.employees) || [];
    if (employees.some(function (e) { return e.status === 'error'; })) return 'error';
    if (employees.some(function (e) { return e.status === 'busy'; })) return 'busy';
    if (employees.length && employees.every(function (e) { return e.status === 'paused' || e.status === 'offline'; })) return 'paused';
    return 'idle';
}

function deskPixel(entity, fallback) {
    const desk = (entity && entity.desk) || fallback;
    const isManager = entity && (entity.id === 'ai-manager' || entity.role === 'dispatcher');
    if (isManager) {
        return { x: 64, y: 132, w: 156, h: 86 };
    }
    const originX = 248;
    const originY = 88;
    const tile = 48;
    return {
        x: originX + (desk.x || 0) * tile,
        y: originY + (desk.y || 0) * tile,
        w: 108,
        h: 72
    };
}

function buildNpcs() {
    npcs = [];
    if (!officeData) return;

    const manager = Object.assign({
        id: 'ai-manager',
        display_name: 'AI總管',
        role: 'dispatcher',
        role_title: '派工總管',
        model: 'dispatcher',
        status: deriveManagerStatus()
    }, officeData.manager || {});

    if (!manager.status) manager.status = deriveManagerStatus();

    const roster = [manager].concat(officeData.employees || []);
    roster.forEach(function (raw, index) {
        const desk = deskPixel(raw, { x: 2 + index * 3, y: 2 });
        const palette = PALETTES[raw.id] || PALETTES['gemini-a'];
        npcs.push({
            id: raw.id,
            raw: raw,
            displayName: raw.display_name || raw.id,
            roleTitle: raw.role_title || (raw.role === 'dispatcher' ? '派工總管' : '員工'),
            model: raw.model || (raw.role === 'dispatcher' ? 'dispatcher' : '—'),
            provider: raw.provider || '',
            status: raw.status || 'idle',
            specialty: raw.specialty || [],
            desk: desk,
            x: desk.x + Math.floor(desk.w / 2) - 12,
            y: desk.y + desk.h - 18,
            width: 24,
            height: 32,
            palette: palette,
            animFrame: 0,
            animTimer: index * 90,
            bobOffset: 0,
            isManager: raw.id === 'ai-manager' || raw.role === 'dispatcher'
        });
    });
}

function collisionBoxes() {
    const boxes = [
        { x: 0, y: 0, w: 800, h: 36 },
        { x: 0, y: 564, w: 800, h: 36 },
        { x: 0, y: 0, w: 36, h: 600 },
        { x: 764, y: 0, w: 36, h: 600 }
    ];
    STATIC_FURNITURE.forEach(function (f) { boxes.push(f); });
    npcs.forEach(function (n) { boxes.push(n.desk); });
    return boxes;
}

function checkCollision(x, y, w, h) {
    const objects = collisionBoxes();
    for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        if (x < obj.x + obj.w && x + w > obj.x && y < obj.y + obj.h && y + h > obj.y) {
            return true;
        }
    }
    return false;
}

async function loadOfficeData() {
    const loading = document.getElementById('loading');
    const msg = document.getElementById('loading-msg');
    try {
        const res = await fetch(dataUrl(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        officeData = await res.json();
        buildNpcs();
        renderHud();
        loading.classList.add('hidden');
    } catch (err) {
        loadError = err;
        loading.classList.add('error');
        msg.textContent = '載入唔到 data/office-data.json。請用本機 HTTP 伺服器開啟（唔好直接雙擊 HTML）。';
        renderHud();
    }
}

function renderHud() {
    const nameEl = document.getElementById('office-name');
    const updatedEl = document.getElementById('updated-at');
    const listEl = document.getElementById('employee-list');
    const feedEl = document.getElementById('event-feed');

    if (loadError) {
        nameEl.textContent = '資料載入失敗';
        updatedEl.textContent = '';
        listEl.innerHTML = '<div class="data-error hud-section">請確認 GitHub Pages／本機伺服器可以讀到 data/office-data.json</div>';
        feedEl.innerHTML = '';
        return;
    }
    if (!officeData) return;

    nameEl.textContent = officeData.office_name || 'AI總管 · 員工辦公室';
    updatedEl.textContent = officeData.updated_at
        ? ('更新時間：' + formatTime(officeData.updated_at))
        : '未提供更新時間';

    listEl.innerHTML = npcs.map(function (npc) {
        const st = statusInfo(npc.status);
        const usage = npc.isManager ? null : todayUsage(npc.id);
        const warnAt = (officeData.budgets && officeData.budgets.warn_at_pct) || 80;
        const stopAt = (officeData.budgets && officeData.budgets.hard_stop_at_pct) || 100;
        let barClass = 'bar';
        let barWidth = 0;
        let usageLine = npc.isManager ? '負責分派工作' : '無預算資料';
        if (usage && usage.limit) {
            barWidth = Math.min(100, usage.pct);
            if (usage.pct >= stopAt) barClass += ' danger';
            else if (usage.pct >= warnAt) barClass += ' warn';
            usageLine = '今日 ' + formatTokens(usage.used) + ' / ' + formatTokens(usage.limit) +
                '（' + usage.pct.toFixed(usage.pct < 1 ? 3 : 1) + '%）';
        }
        const selected = selectedId === npc.id ? ' selected' : '';
        return (
            '<button type="button" class="emp-card' + selected + '" data-id="' + escapeHtml(npc.id) + '">' +
                '<span class="dot" style="background:' + st.color + '"></span>' +
                '<span>' +
                    '<span class="name">' + escapeHtml(npc.displayName) +
                        '<span class="status-pill status-' + escapeHtml(npc.status) + '">' + st.label + '</span>' +
                    '</span>' +
                    '<div class="sub">' + escapeHtml(npc.model) + (npc.provider ? ' · ' + escapeHtml(npc.provider) : '') + '</div>' +
                    '<div class="sub">' + escapeHtml(usageLine) + '</div>' +
                    (usage && usage.limit ? '<div class="' + barClass + '"><span style="width:' + barWidth + '%"></span></div>' : '') +
                '</span>' +
            '</button>'
        );
    }).join('');

    listEl.querySelectorAll('.emp-card').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const npc = npcs.find(function (n) { return n.id === btn.getAttribute('data-id'); });
            if (npc) openInspector(npc);
        });
    });

    const events = ((officeData.events) || []).slice().reverse();
    if (!events.length) {
        feedEl.innerHTML = '<div class="event-row">暫時未有事件。</div>';
        return;
    }
    feedEl.innerHTML = events.map(function (ev) {
        const who = displayNameById(ev.employee_id);
        const cls = ev.ok ? 'ok' : 'fail';
        const preview = ev.text ? String(ev.text) : (ev.ok ? '成功' : '失敗');
        const tokens = (ev.input_tokens || ev.output_tokens)
            ? ' · in ' + (ev.input_tokens || 0) + ' / out ' + (ev.output_tokens || 0)
            : '';
        return (
            '<div class="event-row ' + cls + '">' +
                '<div class="when">' + escapeHtml(formatTime(ev.ts)) + ' · ' + escapeHtml(who) + '</div>' +
                '<div><span class="kind">' + escapeHtml(kindLabel(ev.kind)) +
                    (ev.ok ? ' ✓' : ' ✗') + '</span> ' + escapeHtml(preview) +
                    escapeHtml(tokens) + '</div>' +
            '</div>'
        );
    }).join('');
}

function displayNameById(id) {
    const npc = npcs.find(function (n) { return n.id === id; });
    if (npc) return npc.displayName;
    return id || '—';
}

function findNpcById(id) {
    return npcs.find(function (n) { return n.id === id; });
}

function openInspector(npc) {
    selectedId = npc.id;
    gameState = 'dialogue';
    const box = document.getElementById('dialogue-box');
    const speaker = document.getElementById('speaker-name');
    const meta = document.getElementById('inspector-meta');
    const text = document.getElementById('dialogue-text');
    const evBox = document.getElementById('inspector-events');
    const st = statusInfo(npc.status);
    const last = lastEvent(npc.id);
    const usage = npc.isManager ? null : todayUsage(npc.id);

    speaker.textContent = npc.displayName + (npc.isManager ? ' · 總管' : '');
    box.classList.add('active');

    const notes = [];
    if (npc.roleTitle) notes.push(npc.roleTitle);
    if (npc.specialty && npc.specialty.length) notes.push('專長：' + npc.specialty.join('、'));
    if (npc.status === 'paused') notes.push('呢位員工而家暫停接工。');
    if (npc.status === 'error') notes.push('最近狀態異常，請睇事件紀錄。');
    if (last && last.ok === false) notes.push('最近一次事件失敗：' + (last.text || kindLabel(last.kind)));

    meta.innerHTML =
        '<div><dt>狀態</dt><dd>' + escapeHtml(st.label) + '</dd></div>' +
        '<div><dt>模型</dt><dd>' + escapeHtml(npc.model) + '</dd></div>' +
        '<div><dt>供應商</dt><dd>' + escapeHtml(npc.provider || (npc.isManager ? '內部派工' : '—')) + '</dd></div>' +
        '<div><dt>今日 Token</dt><dd>' +
            (usage && usage.limit
                ? escapeHtml(formatTokens(usage.used) + ' / ' + formatTokens(usage.limit) + '（' + usage.pct.toFixed(usage.pct < 1 ? 3 : 1) + '%）')
                : (npc.isManager ? '—' : '無資料')) +
        '</dd></div>';

    let body = '';
    if (last && last.text) {
        body = '最後回覆預覽：\n「' + last.text + '」\n';
        if (last.model) body += '當時模型：' + last.model + '\n';
        body += 'Token：in ' + (last.input_tokens || 0) + ' / out ' + (last.output_tokens || 0);
    } else if (npc.isManager) {
        body = '我係 AI總管，負責分派工作俾閃一、閃二、智一。呢度顯示嘅係公開快照，唔會即場呼叫模型。';
    } else {
        body = '尚未有回覆預覽。狀態備註：' + (notes.join(' ') || '無。');
    }
    if (notes.length) body += '\n\n' + notes.join('\n');
    text.textContent = body;

    const recent = eventsFor(npc.id).slice().reverse().slice(0, 6);
    if (!recent.length) {
        evBox.textContent = '呢位員工暫時未有事件紀錄。';
    } else {
        evBox.innerHTML = recent.map(function (ev) {
            return escapeHtml(formatTime(ev.ts) + ' · ' + kindLabel(ev.kind) + (ev.ok ? ' ✓ ' : ' ✗ ') + (ev.text || ''));
        }).join('<br>');
    }

    renderHud();
    document.getElementById('interaction-hint').style.display = 'none';
}

function closeInspector() {
    gameState = 'playing';
    selectedId = nearbyNpc ? nearbyNpc.id : null;
    document.getElementById('dialogue-box').classList.remove('active');
    renderHud();
}

function toggleDialogue() {
    if (gameState === 'dialogue') {
        closeInspector();
        return;
    }
    if (nearbyNpc) openInspector(nearbyNpc);
}

function typeWriter(element, text, speed) {
    speed = speed || 24;
    element.textContent = '';
    element.classList.add('typing-cursor');
    let i = 0;
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i += 1;
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
    text.textContent = '…';
    const who = selectedId || (nearbyNpc && nearbyNpc.id);
    try {
        const apiUrl = API_URL ? API_URL + '/api/chat' : '/api/chat';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message, employee_id: who })
        });
        if (response.ok) {
            const data = await response.json();
            typeWriter(text, data.response);
            return;
        }
    } catch (err) {
        /* fall through to mock */
    }
    typeWriter(text, getMockResponse(message, who));
}

function getMockResponse(text, empId) {
    const npc = findNpcById(empId) || nearbyNpc;
    const name = npc ? npc.displayName : '員工';
    const last = npc ? lastEvent(npc.id) : null;
    const lower = text.toLowerCase();
    if (npc && npc.status === 'paused') {
        return name + '而家暫停咗，唔會接新工。呢句係離線模擬。';
    }
    if (lower.indexOf('你好') >= 0 || lower.indexOf('hi') >= 0) {
        return '你好，我係' + name + '。資料來自靜態快照。';
    }
    if (lower.indexOf('用量') >= 0 || lower.indexOf('token') >= 0) {
        if (!npc || npc.isManager) return '總管唔計個人 token；請睇各員工今日用量。';
        const u = todayUsage(npc.id);
        return name + '今日用咗 ' + u.used + ' token（預算 ' + u.limit + '）。';
    }
    if (last && last.text) return '（模擬）上次公開回覆係：「' + last.text + '」';
    return '（模擬）' + name + '收到：「' + text + '」。正式派工唔喺呢個靜態頁面執行。';
}

function update(deltaTime) {
    let dx = 0;
    let dy = 0;
    if (keys.w || keys.ArrowUp || holdDir.up) dy = -PLAYER_SPEED;
    if (keys.s || keys.ArrowDown || holdDir.down) dy = PLAYER_SPEED;
    if (keys.a || keys.ArrowLeft || holdDir.left) dx = -PLAYER_SPEED;
    if (keys.d || keys.ArrowRight || holdDir.right) dx = PLAYER_SPEED;

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

    nearbyNpc = null;
    let best = INTERACT_DIST;
    npcs.forEach(function (npc) {
        const dist = Math.hypot(player.x - npc.x, player.y - npc.y);
        if (dist < best) {
            best = dist;
            nearbyNpc = npc;
        }
    });

    const hint = document.getElementById('interaction-hint');
    const container = document.getElementById('game-container');
    if (nearbyNpc && gameState === 'playing') {
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / CANVAS_WIDTH;
        const scaleY = rect.height / CANVAS_HEIGHT;
        const crect = container.getBoundingClientRect();
        hint.style.display = 'block';
        hint.style.left = (rect.left - crect.left + nearbyNpc.x * scaleX) + 'px';
        hint.style.top = (rect.top - crect.top + (nearbyNpc.y - 36) * scaleY) + 'px';
        hint.textContent = '▼ 查看' + nearbyNpc.displayName;
    } else if (gameState === 'playing') {
        hint.style.display = 'none';
    }

    npcs.forEach(function (npc) {
        npc.animTimer += deltaTime;
        const paused = npc.status === 'paused' || npc.status === 'offline';
        const interval = npc.status === 'busy' ? 180 : 400;
        if (paused) {
            npc.bobOffset = 0;
            return;
        }
        if (npc.animTimer > interval) {
            npc.animFrame = (npc.animFrame + 1) % 2;
            npc.bobOffset = npc.animFrame === 0 ? 0 : (npc.status === 'busy' ? 3 : 2);
            npc.animTimer = 0;
        }
    });
}

function drawObject(x, y, w, h, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 4, y + 6, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y, w, 3);
    ctx.fillRect(x, y, 3, h);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, y + h - 3, w, 3);
    ctx.fillRect(x + w - 3, y, 3, h);
}

function drawShadow(x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y, w, h);
}

function drawLabel(text, x, y, bg) {
    ctx.font = 'bold 11px "Noto Sans HK", sans-serif';
    const w = Math.max(48, ctx.measureText(text).width + 10);
    const px = Math.floor(x - w / 2);
    ctx.fillStyle = bg || '#ffd43b';
    ctx.fillRect(px, y, w, 14);
    ctx.strokeStyle = '#212529';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, y, w, 14);
    ctx.fillStyle = '#212529';
    ctx.fillText(text, px + 5, y + 11);
}

function drawFloor() {
    ctx.fillStyle = '#2d3a4a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (let y = 36; y < CANVAS_HEIGHT - 36; y += TILE_SIZE) {
        for (let x = 36; x < CANVAS_WIDTH - 36; x += TILE_SIZE) {
            const inWar = x < 232 && y < 340;
            const isEven = ((x / TILE_SIZE) + (y / TILE_SIZE)) % 2 === 0;
            if (inWar) ctx.fillStyle = isEven ? '#5c3d4a' : '#4a303b';
            else ctx.fillStyle = isEven ? '#4a5568' : '#3d4852';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = inWar ? '#7a5560' : '#5a6578';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        }
    }

    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 3;
    ctx.strokeRect(44, 48, 188, 280);

    ctx.font = 'bold 12px "Noto Sans HK", sans-serif';
    ctx.fillStyle = '#ffd43b';
    ctx.fillText('派工室', 58, 68);
    ctx.fillText('開放式辦公區', 300, 68);
    ctx.fillText('茶水間', 72, 422);
    ctx.fillText('會議室', 620, 382);
}

function drawDesk(npc) {
    const d = npc.desk;
    const wood = npc.isManager ? '#5c3d1e' : '#8b5a2b';
    drawObject(d.x, d.y, d.w, d.h, wood);

    const st = statusInfo(npc.status);
    const mx = d.x + 12;
    const my = d.y + 10;
    const mw = npc.isManager ? 56 : 40;
    const mh = 28;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = st.screen;
    ctx.fillRect(mx + 3, my + 3, mw - 6, mh - 8);
    if (npc.status === 'busy') {
        ctx.fillStyle = '#212529';
        const t = npc.animFrame;
        ctx.fillRect(mx + 6, my + 7 + t, mw - 12, 2);
        ctx.fillRect(mx + 8, my + 12, mw - 16 - t * 4, 2);
    } else if (npc.status === 'paused') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(mx + 3, my + 3, mw - 6, mh - 8);
    } else if (npc.status === 'error') {
        ctx.fillStyle = npc.animFrame ? '#fff' : '#ff6b6b';
        ctx.fillRect(mx + Math.floor(mw / 2) - 2, my + 6, 4, 10);
        ctx.fillRect(mx + Math.floor(mw / 2) - 2, my + 18, 4, 4);
    }

    ctx.fillStyle = '#ced4da';
    ctx.fillRect(d.x + d.w - 36, d.y + 14, 22, 16);
    ctx.fillStyle = st.color;
    ctx.fillRect(d.x + 8, d.y + d.h - 10, 10, 6);

    if (npc.isManager) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(d.x + 78, d.y + 16, 34, 26);
        ctx.fillStyle = '#212529';
        ctx.fillRect(d.x + 82, d.y + 20, 26, 3);
        ctx.fillRect(d.x + 82, d.y + 26, 18, 3);
    }
}

function drawStaticProps() {
    drawObject(56, 430, 140, 92, '#4a5568');
    ctx.fillStyle = '#e8590c';
    ctx.fillRect(76, 446, 28, 22);
    ctx.fillStyle = '#fff';
    ctx.fillRect(84, 452, 12, 8);
    ctx.fillStyle = '#7950f2';
    ctx.fillRect(120, 450, 18, 28);
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(150, 458, 22, 16);

    drawObject(560, 390, 186, 112, '#5c4033');
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(580, 410, 146, 52);

    drawObject(248, 448, 44, 40, '#718096');
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(254, 454, 32, 10);

    drawObject(48, 48, 28, 28, '#2f9e44');
    drawObject(724, 48, 28, 28, '#2f9e44');
    drawObject(724, 500, 28, 28, '#2f9e44');
    drawObject(48, 500, 28, 28, '#2f9e44');
}

function drawCharacter(ch, facing) {
    const pal = ch.palette || PALETTES.player;
    const dim = ch.status === 'paused' || ch.status === 'offline';
    const x = ch.x;
    const y = ch.y + (ch.bobOffset || 0);
    const w = ch.width;
    const h = ch.height;
    const shirt = dim ? '#868e96' : pal.shirt;
    const pants = dim ? '#495057' : pal.pants;

    ctx.fillStyle = shirt;
    ctx.fillRect(x + 4, y + 12, w - 8, h - 12);
    ctx.fillStyle = pal.skin;
    ctx.fillRect(x + 6, y + 2, w - 12, 12);
    ctx.fillStyle = pal.hair;
    ctx.fillRect(x + 4, y, w - 8, 6);
    ctx.fillRect(x + 4, y, 4, 10);
    ctx.fillRect(x + w - 8, y, 4, 10);

    if (ch.isManager) {
        ctx.fillStyle = pal.accent || '#fbbf24';
        ctx.fillRect(x + 8, y - 4, 8, 4);
        ctx.fillStyle = '#1a202c';
        ctx.fillRect(x + 6, y + 5, w - 12, 2);
    }

    ctx.fillStyle = '#1a202c';
    const dir = facing || 'down';
    if (dir === 'right') ctx.fillRect(x + 14, y + 6, 3, 3);
    else if (dir === 'left') ctx.fillRect(x + 7, y + 6, 3, 3);
    else {
        ctx.fillRect(x + 8, y + 6, 3, 3);
        ctx.fillRect(x + 13, y + 6, 3, 3);
    }

    ctx.fillStyle = pants;
    if (ch.isMoving && ch.animFrame % 2 === 0) {
        ctx.fillRect(x + 5, y + h - 8, 6, 8);
        ctx.fillRect(x + 13, y + h - 6, 6, 6);
    } else if (ch.isMoving) {
        ctx.fillRect(x + 5, y + h - 6, 6, 6);
        ctx.fillRect(x + 13, y + h - 8, 6, 8);
    } else if (ch.animFrame === 1 && ch.status === 'busy') {
        ctx.fillRect(x + 4, y + h - 8, 6, 8);
        ctx.fillRect(x + 14, y + h - 8, 6, 8);
    } else {
        ctx.fillRect(x + 5, y + h - 8, 6, 8);
        ctx.fillRect(x + 13, y + h - 8, 6, 8);
    }

    if (ch.status === 'busy') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + w + 2, y + 4, 16, 10);
        ctx.strokeStyle = '#212529';
        ctx.strokeRect(x + w + 2, y + 4, 16, 10);
        ctx.fillStyle = '#212529';
        ctx.font = '9px monospace';
        ctx.fillText('…', x + w + 5, y + 12);
    }
    if (ch.status === 'paused') {
        ctx.fillStyle = '#ced4da';
        ctx.font = 'bold 10px "Noto Sans HK", sans-serif';
        ctx.fillText('Zz', x + w - 2, y);
    }
    if (ch.status === 'error' && ch.animFrame) {
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(x + 8, y - 12, 8, 8);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 11, y - 10, 2, 4);
    }
}

function drawPlayer() {
    drawShadow(player.x + 4, player.y + player.height - 4, player.width - 8, 6);
    drawCharacter({
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height,
        palette: PALETTES.player,
        isMoving: player.isMoving,
        animFrame: player.animFrame,
        status: 'idle'
    }, player.direction);
}

function render() {
    drawFloor();
    drawStaticProps();
    npcs.forEach(function (npc) { drawDesk(npc); });

    const drawables = npcs.map(function (n) { return { y: n.y, draw: function () { drawNpc(n); } }; });
    drawables.push({ y: player.y, draw: drawPlayer });
    drawables.sort(function (a, b) { return a.y - b.y; });
    drawables.forEach(function (d) { d.draw(); });
}

function drawNpc(npc) {
    drawShadow(npc.x + 4, npc.y + npc.height - 4, npc.width - 8, 6);
    drawCharacter(npc, 'down');
    const st = statusInfo(npc.status);
    drawLabel(npc.displayName, npc.x + npc.width / 2, npc.y - 20, st.color);
    if (selectedId === npc.id) {
        ctx.strokeStyle = '#ffd43b';
        ctx.lineWidth = 2;
        ctx.strokeRect(npc.x - 4, npc.y - 6, npc.width + 8, npc.height + 10);
    }
}

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    if (gameState === 'playing') update(deltaTime);
    else {
        npcs.forEach(function (npc) {
            if (npc.status === 'busy' || npc.status === 'error') {
                npc.animTimer += deltaTime;
                if (npc.animTimer > 200) {
                    npc.animFrame = (npc.animFrame + 1) % 2;
                    npc.animTimer = 0;
                }
            }
        });
    }
    render();
    requestAnimationFrame(gameLoop);
}

function canvasPoint(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (evt.clientX - rect.left) * (CANVAS_WIDTH / rect.width),
        y: (evt.clientY - rect.top) * (CANVAS_HEIGHT / rect.height)
    };
}

function npcAt(x, y) {
    for (let i = 0; i < npcs.length; i++) {
        const n = npcs[i];
        if (x >= n.x - 8 && x <= n.x + n.width + 8 && y >= n.y - 24 && y <= n.y + n.height + 8) return n;
        const d = n.desk;
        if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return n;
    }
    return null;
}

function bindInput() {
    window.addEventListener('keydown', function (e) {
        const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
        if (keys.hasOwnProperty(e.key) && !typing) keys[e.key] = true;
        if (e.key === 'Escape') {
            if (gameState === 'dialogue') closeInspector();
            return;
        }
        if (typing) return;
        if ((e.key === ' ' || e.key === 'Enter') && gameState === 'playing' && nearbyNpc) {
            e.preventDefault();
            openInspector(nearbyNpc);
        } else if (e.key >= '1' && e.key <= '9') {
            const idx = Number(e.key) - 1;
            if (npcs[idx]) openInspector(npcs[idx]);
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) {
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', function (e) {
        if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
    });

    canvas.addEventListener('click', function (e) {
        const p = canvasPoint(e);
        const npc = npcAt(p.x, p.y);
        if (npc) openInspector(npc);
    });

    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('dialogue-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') sendMessage();
    });
    document.getElementById('close-inspector').addEventListener('click', closeInspector);

    document.querySelectorAll('.dpad button').forEach(function (btn) {
        const dir = btn.getAttribute('data-dir');
        const act = btn.getAttribute('data-act');
        const set = function (v) {
            if (dir) holdDir[dir] = v;
        };
        btn.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            if (act === 'interact') toggleDialogue();
            else set(true);
        });
        btn.addEventListener('pointerup', function () { set(false); });
        btn.addEventListener('pointerleave', function () { set(false); });
    });
}

document.addEventListener('DOMContentLoaded', function () {
    bindInput();
    loadOfficeData();
    requestAnimationFrame(gameLoop);
});
