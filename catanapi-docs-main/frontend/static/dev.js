/**
 * Hexbandit Frontend Application – CAT-141
 *
 * Single-page app that interfaces with the Hexbandit REST API to:
 * - Create games with chosen agents
 * - Display game state (players, resources, board, actions)
 * - Submit moves (manual or AI-driven)
 * - Play a full game
 */

const API_BASE = '/api/v1';

/** Get the full API base URL, respecting the host switcher in dev.html. */
function getApiBase() {
    const origin = (typeof getApiOrigin === 'function') ? getApiOrigin() : '';
    return origin + API_BASE;
}

// ── State ────────────────────────────────────────────────────────────────

let currentGameId = null;
let currentState = null;
let availableAgents = [];
let autoPlayInterval = null;

let appVersion = '';
let workerVersion = ''; // CAT-587
let _loadAgentsGen = 0; // Stale-request guard for loadAgents()

// ── DOM Refs ─────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/** Escape a string for safe insertion into HTML to prevent XSS */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ── API Helpers ──────────────────────────────────────────────────────────

async function api(method, path, body = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    // CAT-164: Inject API key when available (staging/prod require it).
    const apiKey = (typeof window !== 'undefined' && window.HEXBANDIT_API_KEY)
        || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('hexbandit_api_key'));
        // Note: sessionStorage (not localStorage) is used here — it is tab-scoped and
        // not readable across origins, reducing XSS exposure for operator/admin keys.
    if (apiKey) opts.headers['X-API-Key'] = apiKey;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${getApiBase()}${path}`, opts);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        const detail = err.detail;
        const msg = typeof detail === 'string' ? detail
            : typeof detail === 'object' && detail !== null ? (detail.message || JSON.stringify(detail))
            : JSON.stringify(err);
        throw new Error(msg);
    }
    return res.json();
}

function setApiKeyStatus(message, color = '') {
    const statusEl = document.getElementById('api-key-status');
    if (!statusEl) return;
    if (statusEl._tid) {
        clearTimeout(statusEl._tid);
        statusEl._tid = null;
    }
    statusEl.textContent = message;
    statusEl.style.color = color || '#4caf50';
}

async function testApiKey() {
    const inputEl = document.getElementById('api-key-input');
    const btnEl = document.getElementById('api-key-test');
    const key = inputEl?.value?.trim() || '';

    if (!key) {
        setApiKeyStatus('Enter key', '#ff6b6b');
        inputEl?.focus();
        return;
    }

    // Keep storage in sync even when user clicks Test immediately after paste.
    sessionStorage.setItem('hexbandit_api_key', key);

    if (btnEl) {
        btnEl.disabled = true;
        btnEl.textContent = 'Testing...';
    }
    setApiKeyStatus('…', '#888');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch(`${getApiBase()}/agents/available`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': key,
            },
            signal: controller.signal,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            const detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail || err);
            throw new Error(detail);
        }

        setApiKeyStatus('✅ Valid', '#4caf50');
        if (typeof loadAgents === 'function') loadAgents();
    } catch (e) {
        const msg = e?.message || 'unknown error';
        if (_isAuthError(msg)) {
            setApiKeyStatus('❌ Invalid', '#ff6b6b');
        } else if (_isNetworkError(msg)) {
            setApiKeyStatus('❌ Network', '#ff6b6b');
        } else {
            setApiKeyStatus('❌ Error', '#ff6b6b');
        }
        console.warn('API key validation failed:', msg);
    } finally {
        clearTimeout(timeoutId);
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.textContent = 'Test Key';
        }
    }
}

// ── Agent Loading ────────────────────────────────────────────────────────

/** Return true if an error message looks like an API auth/authorization failure. */
function _isWandbCredentialError(msg) {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return (lower.includes('wandb') && lower.includes('api key'))
        || lower.includes('wandb login')
        || lower.includes('failed to resolve wandb artifact');
}

function _isAuthError(msg) {
    if (!msg) return false;
    if (_isWandbCredentialError(msg)) return false;
    const lower = msg.toLowerCase();
    return lower.includes('api key') || lower.includes('unauthorized')
        || lower.includes('401') || lower.includes('forbidden')
        || lower.includes('insufficient permissions');
}

function _isForbiddenError(msg) {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return lower.includes('forbidden') || lower.includes('403')
        || lower.includes('insufficient permissions');
}

function _isNetworkError(msg) {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return lower.includes('failed to fetch') || lower.includes('networkerror')
        || lower.includes('network error') || lower.includes('abort')
        || lower.includes('timeout') || lower.includes('err_connection');
}

async function loadAgents() {
    const gen = ++_loadAgentsGen;
    const loading = $('#loading-agents');
    const maxRetries = 3;
    let lastError = null;
    loading.classList.remove('hidden');
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const data = await api('GET', '/agents/available');
            if (gen !== _loadAgentsGen) return; // stale: a newer call supersedes this one
            availableAgents = data.agents || data;
            if (availableAgents.length > 0) {
                loading.classList.add('hidden');
                renderPlayerConfig();
                return;
            }
        } catch (e) {
            lastError = e;
            console.warn(`loadAgents attempt ${attempt}/${maxRetries} failed:`, e.message);
            if (_isAuthError(e.message)) break; // auth errors won't clear with retry
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
                if (gen !== _loadAgentsGen) return; // stale during backoff delay
            }
        }
    }
    if (gen !== _loadAgentsGen) return; // stale before writing fallback state
    // All retries exhausted — fall back to well-known agent IDs
    console.error('Failed to load agents after retries; using fallback list');
    availableAgents = [
        { agent_id: 'random', name: 'Random' },
        { agent_id: 'simple', name: 'Simple' },
        { agent_id: 'weighted-random', name: 'Weighted Random' },
        { agent_id: 'alphabeta', name: 'AlphaBeta' },
        { agent_id: 'value-function', name: 'Value Function' },
    ];
    const detail = lastError ? lastError.message : 'unknown error';
    loading.textContent = _isForbiddenError(detail)
        ? `⚠️ Insufficient permissions — your API key does not have the required access level. (${detail})`
        : _isAuthError(detail)
        ? `⚠️ Authentication required — staging needs a valid staging API key (local runs may bypass auth). Enter your key in the bar above. (${detail})`
        : `⚠️ Could not load agents from API — showing defaults. (${detail})`;
    loading.classList.remove('hidden');
    renderPlayerConfig();
}

// ── Player Config ────────────────────────────────────────────────────────

const PLAYER_COLORS = [
    { name: 'Red', css: 'var(--color-red)' },
    { name: 'Blue', css: 'var(--color-blue)' },
    { name: 'White', css: 'var(--color-white)' },
    { name: 'Orange', css: 'var(--color-orange)' },
];

function renderPlayerConfig() {
    const n = parseInt($('#num-players').value);
    const container = $('#player-config');
    container.innerHTML = '';

    for (let i = 0; i < n; i++) {
        const color = PLAYER_COLORS[i];
        const row = document.createElement('div');
        row.className = 'player-row';

        const dot = document.createElement('div');
        dot.className = 'player-color-dot';
        dot.style.background = color.css;

        const label = document.createElement('label');
        label.textContent = `Player ${i + 1}`;

        const select = document.createElement('select');
        select.id = `player-${i}-agent`;

        // Add bot options
        for (const agent of availableAgents) {
            const id = agent.agent_id || agent;
            const name = agent.name || id;
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = name;
            // Default first player to random, rest to simple or random
            if (i === 0 && id === 'random') opt.selected = true;
            if (i > 0 && id === 'simple') opt.selected = true;
            select.appendChild(opt);
        }

        row.appendChild(dot);
        row.appendChild(label);
        row.appendChild(select);
        container.appendChild(row);
    }
}

// ── Game Creation ────────────────────────────────────────────────────────

async function createGame() {
    const numPlayers = parseInt($('#num-players').value);
    const playerIds = [];
    for (let i = 0; i < numPlayers; i++) {
        playerIds.push($(`#player-${i}-agent`).value);
    }

    const seedInput = $('#game-seed').value;
    const body = {
        num_players: numPlayers,
        player_ids: playerIds,
    };
    if (seedInput) body.seed = parseInt(seedInput);

    const errEl = $('#setup-error');
    errEl.classList.add('hidden');
    const btn = $('#btn-create-game');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
        const data = await api('POST', '/games/', body);
        currentGameId = data.game_id;
        currentState = data.state;
        showGameScreen();
        renderGameState();
    } catch (err) {
        const detail = err.message;
        errEl.textContent = _isWandbCredentialError(detail)
            ? `Backend W&B credential missing. Set WANDB_API_KEY for the API process (or pick a non-RL agent like Simple/Random). (${detail})`
            : _isForbiddenError(detail)
            ? `Insufficient permissions — your API key does not have the required access level (operator group required). (${detail})`
            : _isAuthError(detail)
            ? `Staging needs a valid staging API key (local runs may bypass auth). Enter your key in the bar above. (${detail})`
            : detail;
        errEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Start Game';
    }
}

// ── Screen Navigation ────────────────────────────────────────────────────

function showGameScreen() {
    $('#setup-screen').classList.remove('active');
    $('#game-screen').classList.add('active');
}

function showSetupScreen() {
    if (autoPlayInterval) { clearInterval(autoPlayInterval); autoPlayInterval = null; }
    $('#game-screen').classList.remove('active');
    $('#setup-screen').classList.add('active');
    $('#winner-overlay').classList.add('hidden');
    currentGameId = null;
    currentState = null;
}

// ── Render Game State ────────────────────────────────────────────────────

function renderGameState() {
    if (!currentState) return;
    const s = currentState;

    // Header info
    $('#game-id-display').textContent = `Game: ${currentGameId?.slice(0, 8)}…`;
    $('#turn-display').textContent = `Turn: ${s.num_turns || 0}`;
    $('#phase-display').textContent = s.is_initial_build_phase ? 'Setup' : 'Playing';

    // Status bar
    const currentColor = s.current_player_color || '?';
    const currentPlayer = (s.players || []).find(p => p.color === s.current_player_color);
    const currentAgent = currentPlayer?.name || currentColor;
    const prompt = s.current_prompt || '';
    $('#game-status-bar').innerHTML =
        `<strong style="color:var(--color-${escapeHtml(String(currentColor).toLowerCase())})">${escapeHtml(currentAgent)}</strong> (${escapeHtml(currentColor)}) – ${escapeHtml(formatPrompt(prompt))}`;

    // Players
    renderPlayers(s);

    // Board
    renderBoard(s);

    // Actions
    renderActions(s);

    // Bank
    renderBank(s);

    // Winner check
    if (s.winner) {
        $('#winner-message').innerHTML =
            `<span style="color:var(--color-${escapeHtml(String(s.winner.color || '').toLowerCase())})">${escapeHtml(s.winner.name || 'Unknown')}</span> (${escapeHtml(s.winner.color)}) wins!`;
        $('#winner-overlay').classList.remove('hidden');
    }
}

function formatPrompt(prompt) {
    const map = {
        'BUILD_INITIAL_SETTLEMENT': '🏠 Place Settlement',
        'BUILD_INITIAL_ROAD': '🛤️ Place Road',
        'PLAY_TURN': '🎲 Play Turn',
        'DISCARD': '🗑️ Discard Cards',
        'MOVE_ROBBER': '🏴‍☠️ Move Robber',
        'DECIDE_TRADE': '🤝 Decide Trade',
        'DECIDE_ACCEPTEES': '✅ Choose Acceptees',
    };
    return map[prompt] || prompt;
}

function renderPlayers(s) {
    const container = $('#players-list');
    container.innerHTML = '';

    for (const p of (s.players || [])) {
        const isActive = p.color === s.current_player_color;
        const card = document.createElement('div');
        card.className = 'player-card' + (isActive ? ' active' : '');

        const colorStyle = `background: var(--color-${p.color.toLowerCase()})`;
        const textColorStyle = `color: var(--color-${p.color.toLowerCase()}); font-weight: 700;`;
        card.innerHTML = `
            <div class="player-name">
                <span class="dot" style="${colorStyle}"></span>
                <span style="${textColorStyle}">${escapeHtml(p.name || `Player ${p.index + 1}`)}</span> (${escapeHtml(p.color)})
            </div>
            <div class="player-vp">${escapeHtml(String(p.victory_points))} VP</div>
            <div class="player-resources">
                ${renderResourceBadges(p.resources)}
            </div>
            <div class="player-stats">
                🏠 ${escapeHtml(String(p.settlements))} · 🏙️ ${escapeHtml(String(p.cities))} · 🛤️ ${escapeHtml(String(p.roads_built))}
                ${p.has_longest_road ? ' · 🏆 LR' : ''}
                ${p.has_largest_army ? ' · ⚔️ LA' : ''}
            </div>
        `;
        container.appendChild(card);
    }
}

function renderResourceBadges(resources) {
    if (!resources) return '';
    return Object.entries(resources)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `<span class="resource-badge ${k}">${k.slice(0, 1).toUpperCase()} ${v}</span>`)
        .join('');
}

function renderBoard(s) {
    const buildingsEl = $('#board-buildings');
    const robberEl = $('#board-robber');

    // Buildings summary
    const buildings = s.board?.buildings || {};
    const buildingEntries = Object.entries(buildings);
    if (buildingEntries.length === 0) {
        buildingsEl.innerHTML = '<em>No buildings yet</em>';
    } else {
        buildingsEl.innerHTML = buildingEntries
            .slice(-20)  // Show last 20
            .map(([nodeId, b]) =>
                `<div class="building-entry">
                    <span style="color: var(--color-${escapeHtml(b.color.toLowerCase())})">${escapeHtml(b.color)}</span>
                    ${escapeHtml(b.type)} @ node ${escapeHtml(String(nodeId))}
                </div>`
            ).join('');
    }

    // Robber
    const robber = s.board.robber_coordinate;
    robberEl.innerHTML = `<strong>Robber:</strong> ${robber ? JSON.stringify(robber) : 'N/A'}`;
}

function renderActions(s) {
    const container = $('#action-buttons');
    container.innerHTML = '';

    const actions = s.playable_actions || [];
    // Group by action type
    const grouped = {};
    for (const a of actions) {
        const key = a.action_type;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(a);
    }

    for (const [type, acts] of Object.entries(grouped)) {
        if (acts.length === 1) {
            const btn = document.createElement('button');
            btn.className = 'action-btn';
            btn.textContent = formatActionType(type);
            btn.addEventListener('click', () => submitAction(acts[0]));
            container.appendChild(btn);
        } else if (acts.length <= 10) {
            for (const a of acts) {
                const btn = document.createElement('button');
                btn.className = 'action-btn';
                const valStr = a.value ? ` (${JSON.stringify(a.value).slice(0, 30)})` : '';
                btn.textContent = `${formatActionType(type)}${valStr}`;
                btn.addEventListener('click', () => submitAction(a));
                container.appendChild(btn);
            }
        } else {
            // Too many (e.g. discard combos) – just show count
            const btn = document.createElement('button');
            btn.className = 'action-btn';
            btn.textContent = `${formatActionType(type)} (${acts.length} options)`;
            btn.addEventListener('click', () => submitAction(acts[0]));
            container.appendChild(btn);
        }
    }
}

function formatActionType(type) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderBank(s) {
    const bankEl = $('#bank-resources');
    const bank = s.bank_resources || {};
    bankEl.innerHTML = Object.entries(bank)
        .map(([k, v]) => `<div class="resource-row"><span>${k}</span><span>${v}</span></div>`)
        .join('');

    const devEl = $('#dev-cards-remaining');
    devEl.textContent = `${s.dev_cards_remaining ?? '?'} cards remaining`;
}

// ── Actions ──────────────────────────────────────────────────────────────

let _devMoveInFlight = false; // True while a dev-panel move POST is outstanding

async function submitAction(action) {
    if (!currentGameId) return;
    // Prevent duplicate submissions while a move POST is already in flight.
    if (_devMoveInFlight) return;
    _devMoveInFlight = true;
    try {
        const body = {
            player_id: action.color,
            action_type: action.action_type,
            action_data: { value: action.value },
        };
        const data = await api('POST', `/games/${currentGameId}/moves`, body);
        currentState = data.state;
        addLog(data.action);
        renderGameState();
    } catch (err) {
        addLog({ error: err.message });
    } finally {
        _devMoveInFlight = false;
    }
}

async function aiMove() {
    if (!currentGameId) return;
    try {
        // Submit async move request in server-authoritative game_id mode
        const req = await api('POST', '/moves/request', { game_id: currentGameId });
        const requestId = req.request_id;

        // Poll until complete or timeout (30 s)
        const deadline = Date.now() + 30_000;
        let result = req;
        while (result.status !== 'complete' && result.status !== 'error') {
            if (Date.now() >= deadline) throw new Error('AI move timed out');
            const progress = result.thinking_progress || 0;
            const pollMs = (progress > 80) ? 200 : 500;
            await new Promise(r => setTimeout(r, pollMs));
            result = await api('GET', `/moves/${requestId}`);
        }

        if (result.status === 'error') throw new Error(result.error || 'AI move error');

        // game_id mode already applied the move server-side; just refresh
        const action = result.result;
        const gameData = await api('GET', `/games/${currentGameId}/state`);
        currentState = gameData.state;
        addLog(action);
        renderGameState();
    } catch (err) {
        addLog({ error: err.message });
    }
}

async function autoPlay(count = 10) {
    const btn = $('#btn-auto-play');
    btn.disabled = true;
    btn.textContent = 'Playing...';

    for (let i = 0; i < count; i++) {
        if (currentState?.winner) break;
        try {
            await aiMove();
            // Small delay for UI updates
            await new Promise(r => setTimeout(r, 50));
        } catch {
            break;
        }
    }

    btn.disabled = false;
    btn.textContent = 'Auto-Play (10 moves)';
}

function addLog(action) {
    const logEl = $('#game-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    if (action.error) {
        entry.innerHTML = `<span style="color:var(--color-red)">⚠ ${escapeHtml(action.error)}</span>`;
    } else {
        const actor = (currentState?.players || []).find(p => p.color === action.color);
        const who = actor?.name || action.color || '?';
        entry.innerHTML = `<span class="log-color" style="color:var(--color-${escapeHtml((action.color||'').toLowerCase())})">${escapeHtml(who)}</span>: ${escapeHtml(action.action_type)}`;
    }

    logEl.prepend(entry);

    // Limit log size
    while (logEl.children.length > 100) {
        logEl.removeChild(logEl.lastChild);
    }
}

// ── Version Stamp ────────────────────────────────────────────────────────

async function fetchVersion() {
    try {
        const data = await api('GET', '/version');
        appVersion = data.version || '';
        workerVersion = data.worker_version?.version || '';
    } catch {
        appVersion = '';
        workerVersion = '';
    }
    renderVersionStamp();
}

function renderVersionStamp() {
    let el = document.getElementById('dev-version-stamp');
    if (!el) {
        el = document.createElement('div');
        el.id = 'dev-version-stamp';
        el.className = 'game-watermark';
        document.body.appendChild(el);
    }
    const wVersion = (workerVersion && workerVersion !== 'no_workers_registered' && workerVersion !== 'unavailable')
        ? 'v' + workerVersion : 'offline';
    el.textContent = appVersion ? `API v${appVersion} | Worker ${wVersion}` : '';
}

// ── Event Listeners ──────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadAgents();
    fetchVersion();

    $('#num-players').addEventListener('change', renderPlayerConfig);
    $('#btn-create-game').addEventListener('click', createGame);
    $('#btn-back').addEventListener('click', showSetupScreen);
    $('#btn-new-game').addEventListener('click', showSetupScreen);
    $('#btn-ai-move').addEventListener('click', aiMove);
    $('#btn-auto-play').addEventListener('click', () => autoPlay(10));
});
