/**
 * AI總管 :: WORKFORCE NODE
 * Style D · Matrix terminal command-center
 * 純靜態：讀取 data/office-data.json（冇密鑰、唔需要後端）
 */

(function () {
    'use strict';

    var DATA_FILE = 'data/office-data.json';

    var STATUS_UI = {
        idle: { label: '閒置', code: 'IDLE' },
        busy: { label: '忙碌', code: 'BUSY' },
        paused: { label: '暫停', code: 'PAUSED' },
        offline: { label: '離線', code: 'OFFLINE' },
        error: { label: '錯誤', code: 'ERROR' }
    };

    var KIND_LABELS = {
        smoke_test: '煙霧測試',
        connectivity_test: '連線測試',
        dispatch: '派工',
        chat: '對話',
        failover: '備援切換'
    };

    var GLYPH = {
        idle: '>',
        busy: '*',
        paused: 'z',
        offline: '.',
        error: '!'
    };

    var officeData = null;
    var nodes = [];
    var selectedId = null;
    var loadError = null;
    var rainTimer = null;

    function dataUrl() {
        var q = new URLSearchParams(window.location.search).get('data');
        if (q && q.startsWith('data/') && q.indexOf('..') === -1) {
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
                timeZone: 'Asia/Hong_Kong',
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

    function formatClock(date) {
        try {
            return date.toLocaleTimeString('zh-HK', {
                timeZone: 'Asia/Hong_Kong',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }) + ' HKT';
        } catch (err) {
            return date.toISOString();
        }
    }

    function formatTokens(n) {
        var v = Number(n) || 0;
        if (v >= 1000000) return (v / 1000000).toFixed(2) + 'M';
        if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
        return String(v);
    }

    function asciiBar(pct, width) {
        width = width || 18;
        var p = Math.max(0, Math.min(100, Number(pct) || 0));
        var filled = Math.round((p / 100) * width);
        var out = '';
        var i;
        for (i = 0; i < width; i += 1) {
            out += i < filled ? '#' : '-';
        }
        return '[' + out + ']';
    }

    function todayUsage(empId) {
        var u = (officeData && officeData.usage && officeData.usage[empId]) || {};
        var b = (officeData && officeData.budgets && officeData.budgets.per_employee && officeData.budgets.per_employee[empId]) || {};
        var used = (Number(u.day_input) || 0) + (Number(u.day_output) || 0);
        var limit = Number(b.daily_limit) || 0;
        var pct = limit > 0 ? (used / limit) * 100 : 0;
        return {
            used: used,
            limit: limit,
            pct: pct,
            input: Number(u.day_input) || 0,
            output: Number(u.day_output) || 0,
            calls: Number(u.call_count) || 0,
            monthUsed: (Number(u.month_input) || 0) + (Number(u.month_output) || 0),
            monthLimit: Number(b.monthly_limit) || 0
        };
    }

    function eventsFor(empId) {
        var list = (officeData && officeData.events) || [];
        return list.filter(function (ev) { return ev.employee_id === empId; });
    }

    function lastEvent(empId) {
        var list = eventsFor(empId);
        if (!list.length) return null;
        return list[list.length - 1];
    }

    function deriveManagerStatus() {
        var employees = (officeData && officeData.employees) || [];
        if (employees.some(function (e) { return e.status === 'error'; })) return 'error';
        if (employees.some(function (e) { return e.status === 'busy'; })) return 'busy';
        if (employees.length && employees.every(function (e) {
            return e.status === 'paused' || e.status === 'offline';
        })) return 'paused';
        return 'idle';
    }

    function buildNodes() {
        nodes = [];
        if (!officeData) return;

        var manager = Object.assign({
            id: 'ai-manager',
            display_name: 'AI總管',
            role: 'dispatcher',
            role_title: '派工總管',
            model: 'dispatcher',
            status: deriveManagerStatus()
        }, officeData.manager || {});

        if (!manager.status) manager.status = deriveManagerStatus();

        var roster = [manager].concat(officeData.employees || []);
        roster.forEach(function (raw) {
            nodes.push({
                id: raw.id,
                raw: raw,
                displayName: raw.display_name || raw.id,
                roleTitle: raw.role_title || (raw.role === 'dispatcher' ? '派工總管' : '員工'),
                model: raw.model || (raw.role === 'dispatcher' ? 'dispatcher' : '—'),
                provider: raw.provider || '',
                status: raw.status || 'idle',
                specialty: raw.specialty || [],
                isManager: raw.id === 'ai-manager' || raw.role === 'dispatcher'
            });
        });
    }

    function findNode(id) {
        return nodes.find(function (n) { return n.id === id; });
    }

    function displayNameById(id) {
        var n = findNode(id);
        return n ? n.displayName : (id || '—');
    }

    function barClass(pct) {
        var warnAt = (officeData && officeData.budgets && officeData.budgets.warn_at_pct) || 80;
        var stopAt = (officeData && officeData.budgets && officeData.budgets.hard_stop_at_pct) || 100;
        if (pct >= stopAt) return 'ascii-bar danger';
        if (pct >= warnAt) return 'ascii-bar warn';
        return 'ascii-bar';
    }

    function usageLine(node) {
        if (node.isManager) return 'DISPATCHER · 唔計個人 token';
        var usage = todayUsage(node.id);
        if (!usage.limit) return '無預算資料';
        return '今日 ' + formatTokens(usage.used) + ' / ' + formatTokens(usage.limit) +
            '  (' + usage.pct.toFixed(usage.pct < 1 ? 3 : 1) + '%)';
    }

    function nodeSummary() {
        var counts = { idle: 0, busy: 0, paused: 0, offline: 0, error: 0 };
        nodes.forEach(function (n) {
            if (counts[n.status] == null) counts[n.status] = 0;
            counts[n.status] += 1;
        });
        return 'NODES/' + nodes.length +
            '  IDLE/' + counts.idle +
            '  BUSY/' + counts.busy +
            '  PAUSED/' + counts.paused +
            '  OFF/' + counts.offline +
            '  ERR/' + counts.error;
    }

    function appendBoot(html) {
        var log = document.getElementById('boot-log');
        var line = document.createElement('div');
        line.innerHTML = html;
        log.appendChild(line);
    }

    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    /* ---------- matrix rain ---------- */

    function startRain() {
        var canvas = document.getElementById('matrix-rain');
        if (!canvas || !canvas.getContext) return;
        var ctx = canvas.getContext('2d');
        var fontSize = 14;
        var drops = [];
        var cols = 0;
        var glyphs = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF<>[]{}/=+#$';

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            cols = Math.max(8, Math.floor(canvas.width / fontSize));
            drops = [];
            var i;
            for (i = 0; i < cols; i += 1) {
                drops[i] = Math.random() * canvas.height / fontSize;
            }
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        function tick() {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = fontSize + 'px monospace';
            var i, x, y, ch;
            for (i = 0; i < drops.length; i += 1) {
                ch = glyphs.charAt(Math.floor(Math.random() * glyphs.length));
                x = i * fontSize;
                y = drops[i] * fontSize;
                ctx.fillStyle = (i % 9 === 0) ? 'rgba(176, 255, 176, 0.85)' : 'rgba(0, 255, 65, 0.62)';
                ctx.fillText(ch, x, y);
                if (y > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                } else {
                    drops[i] += 0.85 + (i % 5) * 0.08;
                }
            }
        }

        resize();
        window.addEventListener('resize', resize);
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            tick();
            return;
        }
        rainTimer = window.setInterval(tick, 48);
    }

    function tickClock() {
        var el = document.getElementById('clock');
        if (el) el.textContent = formatClock(new Date());
    }

    /* ---------- render ---------- */

    function renderRoster() {
        var listEl = document.getElementById('employee-list');
        if (loadError) {
            listEl.innerHTML = '<div class="data-error">請確認 GitHub Pages／本機伺服器可以讀到 data/office-data.json</div>';
            return;
        }
        listEl.innerHTML = nodes.map(function (node, index) {
            var st = statusInfo(node.status);
            var usage = node.isManager ? null : todayUsage(node.id);
            var extra = '';
            var cls = 'emp-card status-' + node.status;
            if (selectedId === node.id) cls += ' selected';
            if (node.status === 'paused') cls += ' is-paused';
            if (node.status === 'offline') cls += ' is-offline';
            if (node.status === 'error') cls += ' is-error';
            if (usage && usage.limit) {
                extra = '<div class="' + barClass(usage.pct) + '">' +
                    asciiBar(usage.pct) + ' ' + usage.pct.toFixed(usage.pct < 1 ? 3 : 1) + '%</div>';
            }
            return (
                '<button type="button" class="' + cls + '" role="option" aria-selected="' +
                    (selectedId === node.id ? 'true' : 'false') +
                    '" data-id="' + escapeHtml(node.id) + '">' +
                    '<span class="glyph" aria-hidden="true">' + (GLYPH[node.status] || '>') + '</span>' +
                    '<span>' +
                        '<span class="name">' + escapeHtml((index + 1) + '  ' + node.displayName) +
                            '<span class="status-pill status-' + escapeHtml(node.status) + '">[' +
                            st.code + ']</span>' +
                        '</span>' +
                        '<div class="sub">' + escapeHtml(node.model) +
                            (node.provider ? ' · ' + escapeHtml(node.provider) : '') +
                            (node.status === 'paused' ? '  // HALT · 暫停接工' : '') +
                        '</div>' +
                        '<div class="sub">' + escapeHtml(usageLine(node)) + '</div>' +
                        extra +
                    '</span>' +
                '</button>'
            );
        }).join('');

        listEl.querySelectorAll('.emp-card').forEach(function (btn) {
            btn.addEventListener('click', function () {
                selectNode(btn.getAttribute('data-id'));
            });
        });
    }

    function renderBudgets() {
        var el = document.getElementById('budget-list');
        if (!officeData) {
            el.innerHTML = '';
            return;
        }
        var staff = nodes.filter(function (n) { return !n.isManager; });
        if (!staff.length) {
            el.innerHTML = '<div class="empty">無員工預算。</div>';
            return;
        }
        el.innerHTML = staff.map(function (node) {
            var u = todayUsage(node.id);
            var monthPct = u.monthLimit > 0 ? (u.monthUsed / u.monthLimit) * 100 : 0;
            return (
                '<div class="budget-row">' +
                    '<div class="who">' + escapeHtml(node.displayName) +
                        '  <span class="meta">' + escapeHtml(node.id) + '</span></div>' +
                    '<div class="' + barClass(u.pct) + '">DAY   ' + asciiBar(u.pct, 22) +
                        '  ' + formatTokens(u.used) + ' / ' + formatTokens(u.limit) + '</div>' +
                    '<div class="' + barClass(monthPct) + '">MONTH ' + asciiBar(monthPct, 22) +
                        '  ' + formatTokens(u.monthUsed) + ' / ' + formatTokens(u.monthLimit) +
                        '  · calls ' + u.calls + '</div>' +
                '</div>'
            );
        }).join('');
    }

    function renderLog() {
        var feedEl = document.getElementById('event-feed');
        if (!officeData) {
            feedEl.innerHTML = '';
            return;
        }
        var events = (officeData.events || []).slice().reverse();
        if (!events.length) {
            feedEl.innerHTML = '<div class="empty">&gt; 暫時未有事件。</div>';
            return;
        }
        feedEl.innerHTML = events.map(function (ev, idx) {
            var who = displayNameById(ev.employee_id);
            var cls = (ev.ok ? 'ok' : 'fail') + (ev.employee_id === selectedId ? ' active' : '');
            var preview = ev.text ? String(ev.text) : (ev.ok ? '成功' : '失敗');
            var tokens = (ev.input_tokens || ev.output_tokens)
                ? ' in:' + (ev.input_tokens || 0) + ' out:' + (ev.output_tokens || 0)
                : '';
            return (
                '<div class="event-row ' + cls + '" tabindex="0" data-id="' +
                    escapeHtml(ev.employee_id || '') + '" data-idx="' + idx + '">' +
                    '<span class="when">' + escapeHtml(formatTime(ev.ts)) + '</span>' +
                    '<span class="who">' + escapeHtml(who) + '</span>' +
                    '<span><span class="flag">[' + (ev.ok ? 'OK' : 'FAIL') + ']</span> ' +
                        escapeHtml(kindLabel(ev.kind)) + '  ' + escapeHtml(preview) +
                        escapeHtml(tokens) + '</span>' +
                '</div>'
            );
        }).join('');

        feedEl.querySelectorAll('.event-row').forEach(function (row) {
            row.addEventListener('click', function () {
                var id = row.getAttribute('data-id');
                if (id) selectNode(id);
            });
            row.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    var id = row.getAttribute('data-id');
                    if (id) selectNode(id);
                }
            });
        });
    }

    function renderInspector() {
        var body = document.getElementById('inspector-body');
        var node = selectedId ? findNode(selectedId) : null;
        if (!node) {
            body.innerHTML =
                '<pre class="idle-prompt">SELECT A NODE\n' +
                '&gt; 喺名單撳一位員工，或者撳 1–4\n' +
                '&gt; 顯示狀態、模型、今日 token、最後回覆</pre>';
            return;
        }

        var st = statusInfo(node.status);
        var last = lastEvent(node.id);
        var usage = node.isManager ? null : todayUsage(node.id);
        var halt = node.status === 'paused'
            ? '<div class="block"><h3>NODE STATE</h3><div class="last-reply">// HALT · 呢位員工而家暫停接工（PAUSED）</div></div>'
            : '';
        var replyBlock;
        if (last && last.text) {
            replyBlock =
                '<div class="block"><h3>LAST REPLY / 最後回覆</h3>' +
                '<div class="last-reply">「' + escapeHtml(last.text) + '」</div>' +
                '<div class="insp-events">當時模型：' + escapeHtml(last.model || node.model) +
                ' · token in ' + (last.input_tokens || 0) + ' / out ' + (last.output_tokens || 0) +
                '</div></div>';
        } else if (node.isManager) {
            replyBlock =
                '<div class="block"><h3>DISPATCHER</h3>' +
                '<div class="last-reply">我係 AI總管，負責分派工作俾閃一、閃二、智一。\n呢度顯示嘅係公開快照，唔會即場呼叫模型。</div></div>';
        } else {
            replyBlock =
                '<div class="block"><h3>LAST REPLY / 最後回覆</h3>' +
                '<div class="insp-events">尚未有回覆預覽。</div></div>';
        }

        var recent = eventsFor(node.id).slice().reverse().slice(0, 6);
        var evHtml;
        if (!recent.length) {
            evHtml = '<div class="insp-events">呢位員工暫時未有事件紀錄。</div>';
        } else {
            evHtml = recent.map(function (ev) {
                return '<div class="insp-events">' +
                    escapeHtml(formatTime(ev.ts) + '  [' + (ev.ok ? 'OK' : 'FAIL') + ']  ' +
                        kindLabel(ev.kind) + '  ' + (ev.text || '')) +
                    '</div>';
            }).join('');
        }

        var tokenDd = node.isManager
            ? '—'
            : (usage && usage.limit
                ? formatTokens(usage.used) + ' / ' + formatTokens(usage.limit) +
                    '（' + usage.pct.toFixed(usage.pct < 1 ? 3 : 1) + '%）'
                : '無資料');

        body.innerHTML =
            '<div class="insp-head"><span class="host">root@workforce</span>:<span>' +
                escapeHtml(node.id) + '</span>$ inspect</div>' +
            '<div class="kv">' +
                '<dt>顯示名 / NAME</dt><dd>' + escapeHtml(node.displayName) +
                    (node.isManager ? ' · 總管' : '') + '</dd>' +
                '<dt>狀態 / STATUS</dt><dd>[' + st.code + '] ' + escapeHtml(st.label) + '</dd>' +
                '<dt>模型 / MODEL</dt><dd>' + escapeHtml(node.model) + '</dd>' +
                '<dt>供應商 / PROVIDER</dt><dd>' +
                    escapeHtml(node.provider || (node.isManager ? '內部派工' : '—')) + '</dd>' +
                '<dt>職稱 / ROLE</dt><dd>' + escapeHtml(node.roleTitle || '—') + '</dd>' +
                '<dt>專長 / SPEC</dt><dd>' +
                    escapeHtml((node.specialty && node.specialty.length) ? node.specialty.join('、') : '—') + '</dd>' +
                '<dt>今日 Token</dt><dd>' + escapeHtml(tokenDd) + '</dd>' +
            '</div>' +
            halt +
            replyBlock +
            '<div class="block"><h3>EVENTS / 呢位員工</h3>' + evHtml + '</div>' +
            '<details class="mock-chat"><summary>可選模擬對話（靜態站唔會呼叫真實 LLM）</summary>' +
                '<div class="prompt-row">' +
                    '<span class="ps1">&gt;</span>' +
                    '<input id="command-input" type="text" autocomplete="off" placeholder="echo 指令…">' +
                    '<button type="button" id="send-btn">EXEC</button>' +
                '</div>' +
            '</details>';

        var input = document.getElementById('command-input');
        var send = document.getElementById('send-btn');
        if (send) send.addEventListener('click', sendMessage);
        if (input) {
            input.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter') sendMessage();
            });
        }
    }

    function renderHud() {
        var nameEl = document.getElementById('office-name');
        var titleEl = document.getElementById('sys-title');
        var updatedEl = document.getElementById('updated-at');
        var summaryEl = document.getElementById('node-summary');
        var linkEl = document.getElementById('link-state');

        if (loadError) {
            titleEl.textContent = 'AI總管 :: WORKFORCE NODE';
            nameEl.textContent = '資料載入失敗';
            updatedEl.textContent = 'SNAPSHOT/FAIL';
            summaryEl.textContent = 'NODES/--';
            linkEl.textContent = 'LINK/DOWN';
            renderRoster();
            document.getElementById('budget-list').innerHTML = '';
            document.getElementById('event-feed').innerHTML = '';
            document.getElementById('inspector-body').innerHTML =
                '<div class="data-error">載入唔到公開快照。</div>';
            return;
        }
        if (!officeData) return;

        titleEl.textContent = 'AI總管 :: WORKFORCE NODE';
        nameEl.textContent = officeData.office_name || 'AI總管 · 員工辦公室';
        updatedEl.textContent = officeData.updated_at
            ? ('SNAPSHOT ' + formatTime(officeData.updated_at))
            : 'SNAPSHOT/--';
        summaryEl.textContent = nodeSummary();
        linkEl.textContent = 'LINK/UP';

        renderRoster();
        renderBudgets();
        renderLog();
        renderInspector();
    }

    function selectNode(id) {
        selectedId = id;
        renderHud();
        var panel = document.getElementById('inspector-panel');
        if (panel && window.matchMedia('(max-width: 980px)').matches) {
            panel.scrollIntoView({ block: 'nearest' });
        }
    }

    function selectByIndex(index) {
        if (!nodes.length) return;
        var i = (index + nodes.length) % nodes.length;
        selectNode(nodes[i].id);
    }

    function currentIndex() {
        if (!selectedId) return -1;
        return nodes.findIndex(function (n) { return n.id === selectedId; });
    }

    /* ---------- optional mock chat ---------- */

    function typeWriter(element, text, speed) {
        speed = speed || 18;
        element.textContent = '';
        element.classList.add('typing-cursor');
        var i = 0;
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
        var input = document.getElementById('command-input');
        if (!input) return;
        var message = input.value.trim();
        if (!message) return;
        input.value = '';
        var host = document.querySelector('.last-reply') || document.getElementById('inspector-body');
        host.textContent = '…';
        typeWriter(host, getMockResponse(message, selectedId));
    }

    function getMockResponse(text, empId) {
        var npc = findNode(empId);
        var name = npc ? npc.displayName : '員工';
        var last = npc ? lastEvent(npc.id) : null;
        var lower = text.toLowerCase();
        if (npc && npc.status === 'paused') {
            return name + '而家暫停咗，唔會接新工。呢句係離線模擬。';
        }
        if (lower.indexOf('你好') >= 0 || lower.indexOf('hi') >= 0) {
            return '你好，我係' + name + '。資料來自靜態快照。';
        }
        if (lower.indexOf('用量') >= 0 || lower.indexOf('token') >= 0) {
            if (!npc || npc.isManager) return '總管唔計個人 token；請睇各員工今日用量。';
            var u = todayUsage(npc.id);
            return name + '今日用咗 ' + u.used + ' token（預算 ' + u.limit + '）。';
        }
        if (last && last.text) return '（模擬）上次公開回覆係：「' + last.text + '」';
        return '（模擬）' + name + '收到：「' + text + '」。正式派工唔喺呢個靜態頁面執行。';
    }

    /* ---------- keys ---------- */

    function onKey(ev) {
        if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) {
            if (ev.key === 'Escape') ev.target.blur();
            return;
        }
        if (ev.key >= '1' && ev.key <= '9') {
            var n = Number(ev.key) - 1;
            if (nodes[n]) {
                ev.preventDefault();
                selectNode(nodes[n].id);
            }
            return;
        }
        if (ev.key === 'ArrowDown' || ev.key === 'j') {
            ev.preventDefault();
            selectByIndex(currentIndex() < 0 ? 0 : currentIndex() + 1);
            return;
        }
        if (ev.key === 'ArrowUp' || ev.key === 'k') {
            ev.preventDefault();
            selectByIndex(currentIndex() < 0 ? 0 : currentIndex() - 1);
            return;
        }
        if (ev.key === 'Enter' && currentIndex() < 0 && nodes[0]) {
            ev.preventDefault();
            selectNode(nodes[0].id);
            return;
        }
        if (ev.key === 'Escape') {
            selectedId = null;
            renderHud();
        }
    }

    /* ---------- boot / load ---------- */

    async function loadOfficeData() {
        var boot = document.getElementById('boot-screen');
        var msg = document.getElementById('boot-msg');
        appendBoot('<span class="dim">$</span> mount /workforce');
        appendBoot('<span class="dim">$</span> auth --node AI總管');
        try {
            appendBoot('<span class="dim">$</span> cat ' + DATA_FILE);
            var res = await fetch(dataUrl(), { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            officeData = await res.json();
            buildNodes();
            appendBoot('<span class="ok">ok</span>  snapshot ' + escapeHtml(officeData.updated_at || 'unspecified'));
            appendBoot('<span class="ok">ok</span>  nodes ' + nodes.length + '  (AI總管 + employees)');
            msg.textContent = 'READY.';
            await sleep(720);
            boot.classList.add('hidden');
            document.getElementById('app').hidden = false;
            if (!selectedId && nodes[0]) selectedId = nodes[0].id;
            renderHud();
        } catch (err) {
            loadError = err;
            boot.classList.add('error');
            msg.textContent = '載入唔到 data/office-data.json。請用本機 HTTP 伺服器開啟（唔好直接雙擊 HTML）。';
            appendBoot('<span class="fail">fail</span>  ' + escapeHtml(err && err.message ? err.message : 'load error'));
            document.getElementById('app').hidden = false;
            renderHud();
        }
    }

    function init() {
        startRain();
        tickClock();
        window.setInterval(tickClock, 1000);
        document.addEventListener('keydown', onKey);
        loadOfficeData();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
