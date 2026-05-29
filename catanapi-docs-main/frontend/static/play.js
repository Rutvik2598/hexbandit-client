/* ═══════════════════════════════════════════════════════════════════════
   Hexbandit – Playable Frontend (play.js)
   Hex board rendering, game interactions, API integration.
   ═══════════════════════════════════════════════════════════════════════ */

// ── API helpers ──────────────────────────────────────────────────────────

const API_PATH = '/api/v1';

function getApiBase() {
    const origin = (typeof getApiOrigin === 'function') ? getApiOrigin() : '';
    return origin + API_PATH;
}

async function api(method, path, body = null, signal = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (signal) opts.signal = signal;
    // Inject API key when available (staging/prod require it).
    const apiKey = (typeof window !== 'undefined' && window.HEXBANDIT_API_KEY)
        || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('hexbandit_api_key'));
        // Note: sessionStorage (not localStorage) is used here — it is tab-scoped and
        // not readable across origins, reducing XSS exposure for operator/admin keys.
    if (apiKey) opts.headers['X-API-Key'] = apiKey;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${getApiBase()}${path}`, opts);
    if (!res.ok) {
        // ALB/proxy 502/503/504 responses are often HTML or plain
        // text, not JSON.  Gracefully extract a useful message regardless.
        let msg;
        let detailObj = null;
        let rawPayload = null;
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const err = await res.json().catch(() => null);
            if (err) {
                rawPayload = err;
                const detail = err.detail;
                if (detail && typeof detail === 'object') detailObj = detail;
                msg = typeof detail === 'string' ? detail
                    : typeof detail === 'object' && detail !== null ? (detail.message || JSON.stringify(detail))
                    : JSON.stringify(err);
            }
        }
        if (!msg) {
            // Non-JSON body (HTML error page, plain text, empty body).
            const status = res.status;
            if (status === 502) msg = 'Server unavailable (502 Bad Gateway). Retrying…';
            else if (status === 503) msg = 'Server is starting up (503). Please wait…';
            else if (status === 504) msg = 'Server timed out (504 Gateway Timeout). Retrying…';
            else msg = res.statusText || `HTTP ${status}`;
        }
        const error = new Error(msg);
        error.status = res.status;
        error.path = path;
        if (detailObj) error.detail = detailObj;
        if (!detailObj && rawPayload) error.payload = rawPayload;
        throw error;
    }
    return res.json();
}

/** Build an auth-only headers object for raw fetch() calls (e.g. DELETE 204). */
function _authHeaders() {
    const apiKey = (typeof window !== 'undefined' && window.HEXBANDIT_API_KEY)
        || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('hexbandit_api_key'));
    const h = {};
    if (apiKey) h['X-API-Key'] = apiKey;
    return h;
}

// ── Frontend error reporting ────────────────────────────────────

/**
 * Report a frontend error to the API error-reporting endpoint. Fire-and-forget;
 * failures are swallowed so gameplay never depends on telemetry.
 */
function reportFrontendError(message, context, extra) {
    try {
        const payload = {
            message: String(message || 'Unknown error').slice(0, 2000),
            context: context || undefined,
            game_id: currentGameId || undefined,
            num_turns: gameState?.num_turns ?? undefined,
            url: window.location.pathname,
        };
        if (extra?.stack) payload.stack = String(extra.stack).slice(0, 4000);
        api('POST', '/errors/frontend', payload).catch(() => {});
    } catch (_) {
        // Never throw from the error reporter itself
    }
}

function setApiKeyStatus(message, color = '') {
    const statusEl = document.getElementById('api-key-status');
    if (!statusEl) return;
    if (statusEl._tid) {
        clearTimeout(statusEl._tid);
        statusEl._tid = null;
    }
    statusEl.textContent = message;
    statusEl.style.color = color || '';
}

async function testApiKey() {
    const inputEl = document.getElementById('api-key-input');
    const btnEl = document.getElementById('api-key-test');
    const key = inputEl?.value?.trim() || '';

    if (!key) {
        setApiKeyStatus('Enter key', '#dc3545');
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
        const res = await fetch(`${getApiBase()}/agents`, {
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

        setApiKeyStatus('✅ Valid', '#198754');
        if (typeof loadAgents === 'function') loadAgents();
    } catch (e) {
        const msg = e?.message || 'unknown error';
        if (_isAuthError(msg)) {
            setApiKeyStatus('❌ Invalid', '#dc3545');
        } else if (_isNetworkError(msg)) {
            setApiKeyStatus('❌ Network', '#dc3545');
        } else {
            setApiKeyStatus('❌ Error', '#dc3545');
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

// ── Global state ─────────────────────────────────────────────────────────

let currentGameId = null;
let externalGameId = null; // Dedicated backend game_id for external-state AI/eval/analyze/recording
let gameState = null;
let agents = [];
let autoPlaying = false;
let logEntries = [];
let humanPlayerIndices = [];  // Track which seats are human
let externalStateMode = false; // External state = frontend-authoritative game_state
let _aiMoveInFlight = false; // True while an async move request is outstanding
let _humanMoveInFlight = false; // True while a human POST /games/{id}/moves is outstanding
let _autoAdvanceRunId = 0; // Run-ID token for autoAdvanceAI single-flight guard
let _autoPlayRunId = 0; // Run-ID token for autoPlayLoop single-flight guard
let aiMoveFailedTerminal = false; // Terminal client state after AI move failure
let appVersion = ''; // Fetched from /api/v1/version
let workerVersion = ''; // Fetched from /api/v1/version
let appEnvironment = ''; // Fetched from /api/v1/version — "local"|"dev"|"staging"|"prod"
let featureReviewPrevAction = false; // Fetched from /api/v1/version features.enable_review_prev_turn

// Returns true when the server is running in a dev or local environment.
// Used to gate environment-specific UI behaviour unrelated to feature flags.
function isDevEnvironment() {
    return appEnvironment === 'local' || appEnvironment === 'dev';
}
let lastPwin = null; // Per-player win probabilities (smoothed) for display
let _evaluating = false; // Guard against concurrent evaluate calls
let _clearThinkingTimeout = null; // Pending clearThinkingStatus timeout id
const PWIN_SMOOTH_ALPHA = 0.4; // EMA smoothing factor (0 = no change, 1 = no smoothing)
const EVAL_BAR_PENDING = '\u23f3'; // Sentinel passed to renderEvalBar() to show the pending/evaluating state
let _pwinActionStep = 0; // action_step of game state that lastPwin corresponds to
let _tradeSelection = null; // Two-click trade state: { giving: resourceIdx, rate: number, actions: [] }
// free-form OFFER_TRADE composer state.
//   null  -> button collapsed.
//   {give:[5], ask:[5]} -> composer open; values are non-negative ints.
let _playerTradeComposer = null;
let lastActionPwin = null;  // Map<action_label, {pwin_by_color, confidence}> from last evaluate (smoothed); ordered by visits desc
let _hoverActionLabel = null; // Label of the action currently being hovered
let _perspectiveColor = null; // Color of the active human player (e.g. 'RED'), updated each turn
let _loadAgentsGen = 0; // Stale-request guard for loadAgents()
let _monopolyPending = false; // two-step Monopoly resource picker
let _yopStep1 = null; // null | 'PICK1' | '<resource>' for Year of Plenty
let searchMetricsByColor = {}; // Map<color, {last_decide, average}> from async move responses

function getExternalRequestGameId() {
    return (externalStateMode && externalGameId) ? externalGameId : currentGameId;
}

function getRecordingGameId() {
    // External-mode mirror recordings can be partial; use the server game id.
    return currentGameId;
}

/**
 * Compute the backend-style action label for a frontend action object.
 * Matches the format produced by _root_action_label / _action_id_to_label on
 * the Python side so labels can be used as Map keys against lastActionPwin.
 */
/**
 * Recursively format an action value to match Python's str(tuple) output.
 * Nested arrays become "(v1, v2)" with parens, matching _root_action_label.
 */
function formatActionLabelValue(value) {
    if (Array.isArray(value)) {
        return `(${value.map(formatActionLabelValue).join(', ')})`;
    }
    return String(value);
}

function actionKey(action) {
    const val = action.value;
    if (val === null || val === undefined) return action.action_type;
    // Match Python _root_action_label format: "ACTION_TYPE (v1, v2)" for tuples,
    // "ACTION_TYPE v" for scalars — always a space separator, parens only for tuples.
    if (Array.isArray(val)) return `${action.action_type} ${formatActionLabelValue(val)}`;
    return `${action.action_type} ${val}`;
}

/**
 * Return the first entry in lastActionPwin whose label matches the given
 * actionType.  The map is ordered by visits descending (server-sorted), so
 * the first match is the highest-visits action of that type.
 */
function getBestActionPwin(actionType) {
    if (!lastActionPwin) return null;
    for (const [label, data] of lastActionPwin) {
        if (label === actionType || label.startsWith(actionType + ' ')) {
            return { label, ...data };
        }
    }
    return null;
}

/**
 * Return the first entry whose label matches actionType and contains coordStr.
 * Used for MOVE_ROBBER tiles where multiple actions share the same tile.
 */
function getBestActionPwinForCoord(actionType, coordStr) {
    if (!lastActionPwin) return null;
    for (const [label, data] of lastActionPwin) {
        if (label.startsWith(actionType) && label.includes(coordStr)) {
            return { label, ...data };
        }
    }
    return null;
}

/** Show the eval bar in action-hover mode with the given label + pwin data. */
function showActionPwin(label, pwinByColor) {
    _hoverActionLabel = label;
    renderEvalBar(label, pwinByColor);
}

/** Show the eval bar in pending mode (evaluation not yet complete). */
function showActionPwinPending() {
    _hoverActionLabel = EVAL_BAR_PENDING;
    renderEvalBar(EVAL_BAR_PENDING, null);
}

/** Revert the eval bar to state PWin after a hover ends. */
function clearActionPwin() {
    _hoverActionLabel = null;
    renderEvalBar(null, null);
}

/**
 * Apply EMA smoothing to a new pwin_by_color object.
 * On the first call (no previous data), smooths from a uniform prior
 * (1/num_players per color) so the very first evaluate is also smoothed.
 */
function smoothPwin(newPwin) {
    if (!lastPwin) {
        // Initialize uniform prior: 1/num_players per color.
        const numColors = Object.keys(newPwin).length || 1;
        const uniform = {};
        for (const color of Object.keys(newPwin)) {
            uniform[color] = 1.0 / numColors;
        }
        lastPwin = uniform;
    }
    const smoothed = {};
    let total = 0;
    for (const color of Object.keys(newPwin)) {
        const prev = lastPwin[color] ?? newPwin[color];
        smoothed[color] = PWIN_SMOOTH_ALPHA * newPwin[color] + (1 - PWIN_SMOOTH_ALPHA) * prev;
        total += smoothed[color];
    }
    // Re-normalize to sum to 1.0
    if (total > 0) {
        for (const color of Object.keys(smoothed)) {
            smoothed[color] /= total;
        }
    }
    return smoothed;
}

/**
 * Scale action pwins so they stay consistent with the smoothed state pwin.
 *
 * Instead of independently smoothing each action, we derive a per-color
 * scaling factor from the ratio of the smoothed state pwin to the raw state
 * pwin.  This keeps every action's displayed values proportionally anchored
 * to the eval bar's "Win probability" number.
 *
 * @param {Array}  newActionsList   - actions_pwin list from the API
 * @param {Object} rawStatePwin     - raw pwin_by_color from this evaluate response
 * @param {Object} smoothedStatePwin - pwin_by_color after EMA smoothing
 * @returns {Map<string, Object>}   Map<action_label, entry> for lastActionPwin
 */
function scaleActionPwinsToState(newActionsList, rawStatePwin, smoothedStatePwin) {
    const result = new Map();
    // Compute per-color scaling factor: smoothed / raw.
    const factors = {};
    if (rawStatePwin && smoothedStatePwin) {
        for (const color of Object.keys(rawStatePwin)) {
            const raw = rawStatePwin[color] || 0;
            factors[color] = raw > 0 ? (smoothedStatePwin[color] || 0) / raw : 1;
        }
    }
    for (const entry of newActionsList) {
        if (!rawStatePwin || !smoothedStatePwin) {
            result.set(entry.action_label, entry);
            continue;
        }
        const scaledPwin = {};
        let total = 0;
        for (const color of Object.keys(entry.pwin_by_color)) {
            const factor = factors[color] ?? 1;
            scaledPwin[color] = entry.pwin_by_color[color] * factor;
            total += scaledPwin[color];
        }
        if (total > 0) {
            for (const color of Object.keys(scaledPwin)) scaledPwin[color] /= total;
        }
        result.set(entry.action_label, { ...entry, pwin_by_color: scaledPwin });
    }
    return result;
}

// Color palette
const PLAYER_COLORS = {
    RED: '#e74c3c',
    BLUE: '#3498db',
    ORANGE: '#e67e22',
    WHITE: '#ecf0f1',
};

// Resource → SVG tile asset
const RESOURCE_TILES = {
    WOOD: '/assets/tile_wood.svg',
    Wood: '/assets/tile_wood.svg',
    BRICK: '/assets/tile_brick.svg',
    Brick: '/assets/tile_brick.svg',
    SHEEP: '/assets/tile_sheep.svg',
    Sheep: '/assets/tile_sheep.svg',
    WHEAT: '/assets/tile_wheat.svg',
    Wheat: '/assets/tile_wheat.svg',
    ORE: '/assets/tile_ore.svg',
    Ore: '/assets/tile_ore.svg',
};
const DESERT_TILE = '/assets/tile_desert.svg';

// Resource emoji for display
const RESOURCE_EMOJI = {
    wood: '🪵', brick: '🧱', sheep: '🐑', wheat: '🌾', ore: '⛏️',
};

// ── Hex math (cube coordinates → pixel) ──────────────────────────────────

const SQRT3 = Math.sqrt(3);
const HEX_SIZE = 56; // radius of hex in pixels (was 50)

function cubeToPixel(q, r, cx, cy) {
    const x = HEX_SIZE * (SQRT3 * q + (SQRT3 / 2) * r) + cx;
    const y = HEX_SIZE * (1.5 * r) + cy;
    return { x, y };
}

function hexCorners(cx, cy, size) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30);
        corners.push({
            x: cx + size * Math.cos(angle),
            y: cy + size * Math.sin(angle),
        });
    }
    return corners;
}

function hexPolygonPoints(cx, cy, size) {
    return hexCorners(cx, cy, size)
        .map(c => `${c.x},${c.y}`)
        .join(' ');
}

// ── Parse coordinate strings from API ────────────────────────────────────

function parseCoord(key) {
    // API returns keys like "(0, 1, -1)" or "[0, 1, -1]"
    const nums = key.replace(/[()[\]]/g, '').split(',').map(Number);
    return nums;
}

// ── Setup screen ─────────────────────────────────────────────────────────

async function loadAgents() {
    const gen = ++_loadAgentsGen;
    const numPlayers = parseInt(document.getElementById('num-players')?.value || '4', 10);
    const maxRetries = 3;
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Use /agents to get selection_priority for smart defaults.
            // Wrap in a timeout to avoid long hangs from protocol/network issues.
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const data = await api(
                'GET',
                `/agents?num_players=${numPlayers}`,
                null,
                controller.signal,
            ).finally(() => clearTimeout(timeoutId));
            if (gen !== _loadAgentsGen) return; // stale: a newer call supersedes this one
            agents = data.agents || data || [];
            if (agents.length > 0) {
                _clearAgentWarning();
                _showPlayerSelection();
                renderAgentSelectors();
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
    // All retries exhausted — hide player selection and show error.
    console.error('Failed to load agents after retries; hiding player selection');
    agents = [];
    const detail = lastError ? lastError.message : 'unknown error';
    const isNetwork = _isNetworkError(detail);
    const msg = _isForbiddenError(detail)
        ? `Insufficient permissions — your API key does not have the required access level. (${detail})`
        : _isAuthError(detail)
        ? `Authentication required — enter your API key in the bar above. (${detail})`
        : isNetwork
        ? `Cannot reach the API server. Check that the API URL is correct and uses the right protocol (http vs https). (${detail})`
        : `Could not load agents from API. (${detail})`;
    _showAgentWarning(msg);
    _hidePlayerSelection();
}

function _showAgentWarning(msg) {
    let banner = document.getElementById('agent-load-warning');
    const isAuth = _isAuthError(msg);
    const isForbidden = _isForbiddenError(msg);
    // Treat 403 (forbidden/insufficient permissions) differently from 401 (missing/invalid key)
    const is401Missing = isAuth && !isForbidden;
    const setupForm = document.querySelector('#setup-screen .setup-form');
    const slotsField = document.getElementById('player-slots-field');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'agent-load-warning';
    }
    if (setupForm) {
        if (slotsField) setupForm.insertBefore(banner, slotsField);
        else setupForm.prepend(banner);
    }
    // Use red for missing-key errors (401), yellow for insufficient-permissions (403) and other issues
    banner.style.cssText = is401Missing
        ? 'background:#f8d7da;color:#721c24;padding:10px 14px;border:1px solid #f5c6cb;border-radius:6px;margin-bottom:10px;font-size:13px;display:flex;flex-direction:column;gap:6px;'
        : 'background:#fff3cd;color:#856404;padding:8px 12px;border-radius:6px;margin-bottom:10px;font-size:13px;display:flex;align-items:center;gap:8px;';
    banner.textContent = '';
    if (is401Missing) {
        const title = document.createElement('strong');
        title.textContent = '🔑 API Key Required';
        banner.appendChild(title);
        const desc = document.createElement('span');
        desc.textContent = 'Enter your API key in the "Key" field above to load the full list of AI agents. Without a key, only basic agents are available.';
        banner.appendChild(desc);
        // Highlight the API key input field
        const keyInput = document.getElementById('api-key-input');
        if (keyInput) {
            keyInput.style.outline = '2px solid #dc3545';
            keyInput.setAttribute('placeholder', '← Enter API key here');
            keyInput.focus();
        }
    } else {
        banner.appendChild(document.createTextNode(`⚠️ ${msg} `));
    }
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;align-items:center;' + (isAuth ? 'margin-top:4px;' : 'margin-left:auto;');
    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Retry';
    retryBtn.setAttribute('style', 'cursor:pointer;border:1px solid currentColor;background:transparent;border-radius:4px;padding:2px 8px;');
    retryBtn.onclick = loadAgents;
    btnRow.appendChild(retryBtn);
    banner.appendChild(btnRow);
}

function _clearAgentWarning() {
    document.getElementById('agent-load-warning')?.remove();
    // Remove API key input highlight if it was set
    const keyInput = document.getElementById('api-key-input');
    if (keyInput) {
        keyInput.style.outline = '';
        keyInput.setAttribute('placeholder', 'API Key (staging)');
    }
}

/** Show the player-selection field and re-enable the Start button. */
function _showPlayerSelection() {
    const field = document.getElementById('player-slots-field');
    if (field) field.style.display = '';
    const btn = document.getElementById('start-btn');
    if (btn) btn.disabled = false;
}

/** Hide the player-selection field and disable the Start button. */
function _hidePlayerSelection() {
    const field = document.getElementById('player-slots-field');
    if (field) field.style.display = 'none';
    const btn = document.getElementById('start-btn');
    if (btn) btn.disabled = true;
}

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

/** Return true if the error is specifically a 403 / insufficient-permissions failure. */
function _isForbiddenError(msg) {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return lower.includes('forbidden') || lower.includes('403')
        || lower.includes('insufficient permissions');
}

/** Return true if an error looks like a network/connection failure (timeout, DNS, etc.). */
function _isNetworkError(msg) {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return lower.includes('failed to fetch') || lower.includes('networkerror')
        || lower.includes('network error') || lower.includes('abort')
        || lower.includes('timeout') || lower.includes('err_connection');
}

// Ensure "Human" is always available as an option in the selector
function getAgentOptions() {
    const humanOption = { agent_id: 'human', name: '🎮 Human Player', selection_priority: -1 };
    const hasHuman = agents.some(a => (a.agent_id || a) === 'human');
    return hasHuman ? agents : [humanOption, ...agents];
}

/** Return the agent_id with the highest selection_priority (for AI defaults) */
function getDefaultAiAgent() {
    let best = null;
    let bestPri = -Infinity;
    for (const a of agents) {
        const aid = a.agent_id || a;
        if (aid === 'human') continue;
        const pri = a.selection_priority || 0;
        if (pri > bestPri) { bestPri = pri; best = aid; }
    }
    return best || 'random';
}


// Preserve player selections across player-count changes.
// Keys are seat indices (0-based), values are agent_id strings.
const _playerSelections = {};

function renderAgentSelectors() {
    const numPlayers = parseInt(document.getElementById('num-players').value, 10);
    const container = document.getElementById('player-slots');

    // Snapshot current selections before rebuilding
    for (let i = 0; i < 4; i++) {
        const sel = document.getElementById(`agent-${i}`);
        if (sel) _playerSelections[i] = sel.value;
    }

    container.innerHTML = '';

    const colors = ['RED', 'BLUE', 'ORANGE', 'WHITE'];
    const defaultAi = getDefaultAiAgent();

    for (let i = 0; i < numPlayers; i++) {
        const row = document.createElement('div');
        row.className = 'player-row';

        const dot = document.createElement('div');
        dot.className = 'color-dot';
        dot.style.background = PLAYER_COLORS[colors[i]];
        row.appendChild(dot);

        const label = document.createElement('span');
        label.textContent = `Player ${i + 1}`;
        label.style.cssText = 'font-size:13px;width:70px;';
        row.appendChild(label);

        const sel = document.createElement('select');
        sel.id = `agent-${i}`;
        sel.style.flex = '1';

        for (const agent of getAgentOptions()) {
            const opt = document.createElement('option');
            const aid = agent.agent_id || agent;
            opt.value = aid;
            opt.textContent = agent.name || aid;
            sel.appendChild(opt);
        }

        const optionValues = new Set(Array.from(sel.options).map(o => o.value));
        const previous = _playerSelections[i];

        // Restore previous selection only if it still exists after filtering.
        // Otherwise, fall back to the highest-priority available AI agent.
        if (previous !== undefined && optionValues.has(previous)) {
            sel.value = previous;
        } else if (previous !== undefined) {
            sel.value = defaultAi;
            _playerSelections[i] = defaultAi;
        } else if (i === 0 && optionValues.has('human')) {
            sel.value = 'human';
        } else {
            sel.value = defaultAi;
        }

        row.appendChild(sel);
        container.appendChild(row);
    }
}

async function createGame() {
    const numPlayers = parseInt(document.getElementById('num-players').value, 10);
    const mapSeedVal = document.getElementById('map-seed').value.trim();
    const playerIds = [];
    aiMoveFailedTerminal = false;
    humanPlayerIndices = [];
    // Capture external-state mode toggle
    externalStateMode = !!document.getElementById('external-state-toggle')?.checked;
    // Reset any in-flight AI loops from a previous game so the new game
    // starts from a clean loop state.
    _autoAdvanceRunId++;
    _autoPlayRunId++;
    setAutoPlay(false);
    for (let i = 0; i < numPlayers; i++) {
        const sel = document.getElementById(`agent-${i}`);
        const aid = sel ? sel.value : 'random';
        playerIds.push(aid);
        if (aid === 'human') humanPlayerIndices.push(i);
    }

    try {
        document.getElementById('start-btn').disabled = true;
        document.getElementById('start-btn').innerHTML = '<span class="spinner"></span> Creating…';

        const friendlyRobber = !!document.getElementById('friendly-robber-toggle')?.checked;
        const balancedDice = !!document.getElementById('balanced-dice-toggle')?.checked;
        const body = { num_players: numPlayers, player_ids: playerIds };
        if (mapSeedVal) body.map_seed = parseInt(mapSeedVal, 10);
        if (friendlyRobber || balancedDice) {
            body.config = { friendly_robber: friendlyRobber, balanced_dice: balancedDice };
        }

        const data = await api('POST', '/games/', body);
        currentGameId = data.id || data.game_id;
        externalGameId = null;
        if (externalStateMode) {
            const seatedPlayerIds = Array.isArray(data.player_ids) && data.player_ids.length === numPlayers
                ? data.player_ids
                : playerIds;
            const externalBody = {
                ...body,
                player_ids: seatedPlayerIds,
                externally_managed: true,
                recording: true,
                config: body.config || undefined,
            };
            const externalData = await api('POST', '/games/', externalBody);
            externalGameId = externalData.id || externalData.game_id;
        }

        // Clear the game log so stale errors from a previous
        // game's in-flight AI move don't appear in the new game.
        logEntries = [];
        _lastActionLogTotal = 0;

        log(
            `Game created (ID: ${currentGameId})`
            + (externalStateMode ? ` [🌐 External State ID: ${externalGameId}]` : '')
        );

        // Switch to game screen
        document.getElementById('setup-screen').classList.remove('active');
        document.getElementById('game-screen').classList.add('active');
        chatReset();

        const stateOk = await refreshState();
        if (!stateOk) {
            log('Failed to load initial game state; cannot start game loop.', 'error');
            return;
        }

        // Fallback: if refreshState() didn't set _perspectiveColor (e.g. the
        // first active player is AI), seed it from any human so evaluate works.
        if (!_perspectiveColor) {
            const humanPlayer = getHumanPlayerData();
            _perspectiveColor = humanPlayer ? humanPlayer.color : null;
        }

        // Evaluate immediately if it's already the human's turn on load.
        if (isCurrentPlayerHuman()) {
            evaluatePosition();
        }

        // Auto-start for all-AI games (check from state, not selector)
        const hasHuman = gameState.players && gameState.players.some(p => p.agent_id === 'human');
        if (!hasHuman && currentGameId) {
            setAutoPlay(true);
            autoPlayLoop();
        }
        // Auto-advance if first player is AI in a mixed game
        else if (!isCurrentPlayerHuman()) {
            autoAdvanceAI();
        }
    } catch (e) {
        // Hard fail: reset all game state so the user is cleanly back on the
        // new-game screen with no orphaned references.
        currentGameId = null;
        externalGameId = null;
        externalStateMode = false;

        const detail = e.message;
        const msg = _isWandbCredentialError(detail)
            ? `Failed to create game: backend W&B credential missing. Set WANDB_API_KEY for the API process (or pick a non-RL agent like Simple/Random). (${detail})`
            : _isForbiddenError(detail)
            ? `Failed to create game: your API key does not have sufficient permissions (operator group required). (${detail})`
            : _isAuthError(detail)
            ? `Failed to create game: API key required. Enter your key in the bar above. (${detail})`
            : `Failed to create game: ${detail}`;
        alert(msg);
    } finally {
        document.getElementById('start-btn').disabled = false;
        document.getElementById('start-btn').textContent = '▶ Start Game';
    }
}

// ── Game state management ────────────────────────────────────────────────

async function refreshState() {
    if (!currentGameId) return false;
    try {
        let url = `/games/${currentGameId}/state`;
        // Request only new action_log entries since last sync
        url += `?action_log_start_index=${_lastActionLogTotal}`;
        // Pass perspective so the backend reveals hidden info for the local player
        if (humanPlayerIndices.length > 0) {
            url += '&perspective=human';
        }
        const response = await api('GET', url);
        // The GameStateResponse has a nested 'state' dict with full game data
        gameState = response.state || response;
        // Update perspective to the active human player (supports multiple humans).
        if (gameState.current_player_agent_id === 'human' && gameState.current_player_color) {
            _perspectiveColor = gameState.current_player_color;
        }
        // Clear node position cache so it rebuilds from fresh state data
        Object.keys(_nodePositionCache).forEach(k => delete _nodePositionCache[k]);
        // Clear trade selection on state refresh (new actions available)
        _tradeSelection = null;
        _playerTradeComposer = null;
        renderGame();
        return true;
    } catch (e) {
        log(`Error refreshing state: ${e.message}`, 'error');
        return false;
    }
}

function isCurrentPlayerHuman() {
    if (!gameState) return false;
    // Use the backend-assigned agent_id — this accounts for the
    // randomised seating order the engine applies.
    return gameState.current_player_agent_id === 'human';
}

/**
 * Call the /evaluate endpoint to get fresh PWin for the current position.
 * Runs in the background — does not block the UI. Skips if an evaluation
 * is already in flight or the game is over. The backend decides which
 * search agent to use.
 */
async function evaluatePosition() {
    if (!currentGameId || _evaluating) return;
    if (gameState && gameState.winner) return;

    // Snapshot action_step and game ID so we can discard stale results if
    // the state advances or the user starts a new game while we wait.
    const requestStep = gameState?.action_step ?? 0;
    const requestGameId = currentGameId;
    const evalGameId = getExternalRequestGameId();
    _evaluating = true;
    try {
        // 1. Submit async evaluate request — backend picks the best search agent.
        // perspective_color is required by the backend. Skip evaluation
        // entirely if it hasn't been set (e.g. all-AI game or human player not found).
        if (!_perspectiveColor) return;
        const evalBody = {
            game_id: evalGameId,
            perspective_color: _perspectiveColor,
            requested_step: requestStep,
        };
        if (externalStateMode) {
            evalBody.game_state = gameState;
        }
        const submitResult = await api('POST', '/moves/evaluate', evalBody);
        const requestId = submitResult.request_id;

        // 3. Poll for completion with timeout (same pattern as _doAiMoveInner).
        // Use dynamic deadline extension + transient 502 retry.
        let evalDeadline = Date.now() + POLL_TIMEOUT_MS;
        let _evalDeadlineExtended = false;
        let _evalTransientErrors = 0;
        while (Date.now() < evalDeadline) {
            // Discard if game changed or state moved on while we were waiting.
            if (currentGameId !== requestGameId || (gameState?.action_step ?? 0) !== requestStep) {
                console.debug('Evaluate result discarded (stale): game %s→%s, step%d→step%d',
                    requestGameId, currentGameId, requestStep, gameState?.action_step ?? 0);
                return;
            }

            let pollResult;
            try {
                pollResult = await api('GET', `/moves/${requestId}`);
                _evalTransientErrors = 0;
            } catch (pollErr) {
                const isTransient = /50[234]/.test(pollErr.message);
                if (isTransient && _evalTransientErrors < POLL_TRANSIENT_MAX) {
                    _evalTransientErrors++;
                    await new Promise(r => setTimeout(r, POLL_TRANSIENT_BACKOFF_MS));
                    continue;
                }
                throw pollErr;
            }

            // Extend deadline when budget is first known.
            const evalBudgetS = pollResult.think_time_budget_s;
            if (!_evalDeadlineExtended && evalBudgetS != null && evalBudgetS > 0) {
                const budgetMs = Math.max(POLL_BUDGET_FLOOR_MS, evalBudgetS * POLL_BUDGET_FACTOR * 1000);
                evalDeadline = Math.max(evalDeadline, Date.now() + budgetMs);
                _evalDeadlineExtended = true;
            }

            if (pollResult.status === 'complete') {
                const pwinResult = pollResult.pwin_result;
                const pwinByColor = pwinResult && pwinResult.pwin_by_color;
                if (pwinByColor) {
                    const prevPwinSnapshot = lastPwin ? { ...lastPwin } : null;
                    lastPwin = smoothPwin(pwinByColor);
                    _pwinActionStep = requestStep;
                    renderPlayers();
                    if (pollResult.commentary) {
                        chatOnServerCommentary(pollResult.commentary);
                    } else {
                        chatOnEvalUpdate(prevPwinSnapshot, lastPwin);
                    }
                }
                // Parse per-action pwin for hover display
                const actionsPwin = pwinResult && pwinResult.actions_pwin;
                if (actionsPwin) {
                    lastActionPwin = scaleActionPwinsToState(actionsPwin, pwinByColor, lastPwin);
                    // Re-render board and actions so hover handlers pick up new data
                    renderBoard();
                    renderActions();
                }
                return;
            }

            if (pollResult.status === 'error') {
                console.debug('Evaluate request errored:', pollResult.error);
                return;
            }

            const interval = (pollResult.thinking_progress > 80) ? POLL_FAST_INTERVAL_MS : POLL_INTERVAL_MS;
            await new Promise(r => setTimeout(r, interval));
        }

        // Timed out — cancel the stale evaluate request (best-effort).
        console.debug('Evaluate position timed out.');
        fetch(`${getApiBase()}/moves/${requestId}`, { method: 'DELETE', headers: _authHeaders() }).catch(() => {});
    } catch (e) {
        // Silently ignore — evaluation is best-effort.
        // Common expected errors: game finished, no search agent, etc.
        console.debug('Evaluate position skipped:', e.message);
    } finally {
        _evaluating = false;
    }
}

let _aiRetryCount = 0; // Track consecutive AI failures for retry logic
const AI_MAX_RETRIES = 3;

// ── Async move: request → poll → apply ───────────────────────────────────

const POLL_INTERVAL_MS = 500; // default poll cadence
const POLL_FAST_INTERVAL_MS = 200; // when thinking_progress > 80%
const POLL_TIMEOUT_MS = 60000; // 60 s base poll timeout (raised from 30 s)
// When the server reports a think_time_budget, extend the poll
// deadline to budget × this factor so large RL models have time to finish.
const POLL_BUDGET_FACTOR = 3.0;
const POLL_BUDGET_FLOOR_MS = POLL_TIMEOUT_MS; // never below the base timeout
// Max consecutive 502/503/504 poll errors before giving up.
// Transient gateway errors during polling are retried transparently.
const POLL_TRANSIENT_MAX = 5;
const POLL_TRANSIENT_BACKOFF_MS = 1000;

/**
 * Request an AI move via the async /moves/request endpoint, poll until
 * complete, then apply the result via /games/{id}/moves.
 *
 * In normal mode, sends game_id (server-authoritative).
 * In external-state mode, sends external game_id + game_state.
 *
 * Always uses the async protocol — there is no synchronous path.
 */
async function doAiMove() {
    if (!currentGameId) return false;
    if (aiMoveFailedTerminal) return false;
    if (isCurrentPlayerHuman()) {
        log('It is your turn \u2014 pick an action below or click the board.', 'info');
        return false;
    }
    if (!gameState) return false;
    if (_aiMoveInFlight) return false; // Prevent duplicate requests

    const agentId = gameState.current_player_agent_id;
    if (!agentId || agentId === 'human') return false;

    _aiMoveInFlight = true;
    try {
        return await _doAiMoveInner(agentId);
    } finally {
        _aiMoveInFlight = false;
    }
}

async function _doAiMoveInner(agentId) {
    const actingColor = gameState && gameState.current_player_color ? gameState.current_player_color : null;
    // Snapshot the game ID so we can detect if the user started a new game
    // while this move was in-flight.
    const moveGameId = currentGameId;
    const moveRequestGameId = getExternalRequestGameId();
    const moveRequestStep = gameState?.action_step ?? 0;

    // 1. Submit async move request
    let requestId;
    try {
        updateThinkingStatus('submitting', 'Submitting move request…', 0);
        if (externalStateMode) {
            const requestBody = {
                game_id: moveRequestGameId,
                game_state: gameState,
            };
            const submitResult = await api('POST', '/moves/request', requestBody);
            requestId = submitResult.request_id;
            console.debug(`🤖 Move requested (${requestId.slice(0, 8)}…) [ext-state]`);
        } else {
            // Server-authoritative: send game_id only
            const submitResult = await api('POST', '/moves/request', { game_id: currentGameId });
            requestId = submitResult.request_id;
            console.debug(`🤖 Move requested (${requestId.slice(0, 8)}…)`);
        }
    } catch (e) {
        const msg = e.message || '';
        log(`Move request failed: ${msg}`, 'error');
        updateThinkingStatus('error', 'Request failed', 0);
        clearThinkingStatus();
        // Retry logic for transient failures
        const refreshed = await refreshState();
        if (!refreshed) { resetAutoPlayState(true); return false; }
        if (isCurrentPlayerHuman()) return false;
        if (gameState && gameState.winner) return false;
        _aiRetryCount++;
        if (_aiRetryCount < AI_MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 500));
            return await doAiMove();
        }
        log('AI move failed after retries. Click "🤖 AI Move" to retry or start a new game.', 'error');
        resetAutoPlayState(false);
        _aiRetryCount = 0;
        return false;
    }

    // 2. Poll for completion with timeout
    // Extend the deadline when the server reports a think_time_budget
    // so large RL models (e.g. V5 with time_limit_s=5) have enough headroom.
    let deadline = Date.now() + POLL_TIMEOUT_MS;
    let _deadlineExtended = false;
    let _transientErrors = 0;
    try {
        while (Date.now() < deadline) {
            // Bail out if the user started a new game mid-poll.
            if (currentGameId !== moveGameId) {
                clearThinkingStatus();
                console.debug('AI move poll abandoned (game changed).');
                return false;
            }
            let pollResult;
            try {
                pollResult = await api('GET', `/moves/${requestId}`);
                _transientErrors = 0; // reset on success
            } catch (pollErr) {
                // Retry transient 502/503/504 errors during polling.
                // The backend may still be processing; the ALB just couldn't
                // reach it momentarily (GIL contention, brief overload).
                const isTransient = /50[234]/.test(pollErr.message);
                if (isTransient && _transientErrors < POLL_TRANSIENT_MAX) {
                    _transientErrors++;
                    console.warn(
                        `Poll transient error ${_transientErrors}/${POLL_TRANSIENT_MAX}: ${pollErr.message}`
                    );
                    updateThinkingStatus('thinking', `Server busy, retrying… (${_transientErrors})`, -1);
                    await new Promise(r => setTimeout(r, POLL_TRANSIENT_BACKOFF_MS));
                    continue;
                }
                throw pollErr; // non-transient or max retries exceeded
            }
            const pollStatus = pollResult.status;
            const progress = pollResult.thinking_progress || 0;
            const message = pollResult.thinking_message || 'Thinking…';
            const budgetS = pollResult.think_time_budget_s;
            const elapsedS = pollResult.think_time_elapsed_s;

            updateThinkingStatus('thinking', message, progress);

            // Dynamically extend the deadline when budget is first known.
            if (!_deadlineExtended && budgetS != null && budgetS > 0) {
                const budgetMs = Math.max(POLL_BUDGET_FLOOR_MS, budgetS * POLL_BUDGET_FACTOR * 1000);
                deadline = Math.max(deadline, Date.now() + budgetMs);
                _deadlineExtended = true;
            }

            // Start/refresh client-side interpolation when budget is known
            if (budgetS != null && elapsedS != null && budgetS > 0) {
                _startThinkInterpolation(budgetS, elapsedS);
            }

            if (pollStatus === 'complete') {
                _stopThinkInterpolation();
                const moveResult = pollResult.result;
                if (!moveResult) {
                    log('Move completed but no result returned.', 'error');
                    updateThinkingStatus('error', 'No result', 0);
                    clearThinkingStatus();
                    return false;
                }
                if (moveGameId && !externalStateMode) {
                    api('POST', '/chat/move', {
                        game_id: moveGameId,
                        action_taken: moveResult.action_type,
                        agent_id: agentId,
                    }).then(r => { if (r && r.commentary) chatOnAgentMove(r.commentary, actingColor); })
                      .catch(() => {});
                }
                if (actingColor && moveResult.search_metrics) {
                    searchMetricsByColor[actingColor] = moveResult.search_metrics;
                    console.info('🧠 Search metrics', {
                        color: actingColor,
                        agent_id: agentId,
                        last_decide: moveResult.search_metrics.last_decide || null,
                        average: moveResult.search_metrics.average || null,
                    });
                }

                // If the user started a new game while this move
                // was in-flight, discard the result silently.
                if (currentGameId !== moveGameId) {
                    console.debug('AI move result discarded (game changed).');
                    clearThinkingStatus();
                    return false;
                }

                // 3. Apply or refresh depending on mode
                //    game_id mode (server-authoritative): move is already
                //    applied server-side by _process_move_game_id — only refresh.
                //    game_state mode (client-authoritative / external state):
                //    apply the computed move to the frontend-authoritative game.
                //    The backend already persists/mirrors externally managed
                //    /moves/request results, so do not replay onto externalGameId.
                if (externalStateMode) {
                    updateThinkingStatus('applying', 'Applying move…', 100);
                    const body = {
                        player_id: agentId,
                        action_type: moveResult.action_type,
                        action_data: moveResult.action_data || {},
                        requested_step: moveRequestStep,
                    };
                    await api('POST', `/games/${moveGameId}/moves`, body);
                } else {
                    updateThinkingStatus('applying', 'Refreshing state…', 100);
                }

                console.debug(`🤖 Move applied: ${moveResult.action_type}`);

                updateThinkingStatus('done', 'Move applied', 100);
                clearThinkingStatus();

                const refreshOk = await refreshState();
                if (!refreshOk) {
                    log('State refresh failed after AI move.', 'error');
                    resetAutoPlayState(true);
                    return false;
                }
                _aiRetryCount = 0;
                // Evaluate when human turn starts after AI move
                if (isCurrentPlayerHuman() && (gameState?.action_step ?? 0) > _pwinActionStep) {
                    evaluatePosition();
                }
                return true;
            }

            if (pollStatus === 'error') {
                _stopThinkInterpolation();
                const errMsg = pollResult.error || 'Unknown error';
                log(`Move error: ${errMsg}`, 'error');
                updateThinkingStatus('error', errMsg, 0);
                clearThinkingStatus();
                return false;
            }

            // Adaptive poll interval: faster when near completion
            const interval = (progress > 80) ? POLL_FAST_INTERVAL_MS : POLL_INTERVAL_MS;
            await new Promise(r => setTimeout(r, interval));
        }

        // Timed out
        _stopThinkInterpolation();
        log('AI move timed out after polling.', 'error');
        updateThinkingStatus('error', 'Timed out', 0);
        clearThinkingStatus();
        // Cancel the stale request (best-effort). DELETE returns 204 No Content,
        // so use fetch directly instead of api() (which expects JSON).
        fetch(`${getApiBase()}/moves/${requestId}`, { method: 'DELETE', headers: _authHeaders() }).catch(() => {});
        return false;

    } catch (e) {
        _stopThinkInterpolation();
        const detail = (e?.detail && typeof e.detail === 'object')
            ? e.detail
            : (e?.payload && typeof e.payload === 'object' ? e.payload : { message: e?.message || 'Unknown error' });
        const diagnostics = {
            status: e?.status ?? null,
            path: e?.path ?? null,
            detail,
        };
        log(`Move polling error: ${e.message}`, 'error', { diagnostics });
        updateThinkingStatus('error', 'Polling failed', 0);
        clearThinkingStatus();
        return false;
    }
}

// ── Thinking progress interpolation state ────────────
let _thinkRafId = null;          // requestAnimationFrame handle
let _thinkBudgetS = null;        // server-reported think_time_budget_s
let _thinkElapsedAtPoll = 0;     // server-reported think_time_elapsed_s at last poll
let _thinkPollReceivedMs = 0;    // local timestamp when last poll arrived
let _thinkDisplayedPct = 0;      // last progress pct set on the fill bar

/** Start or update the client-side interpolation loop.
 *  Between server polls the bar advances locally using the known budget. */
function _startThinkInterpolation(budgetS, elapsedS) {
    _thinkBudgetS = budgetS;
    _thinkElapsedAtPoll = elapsedS;
    _thinkPollReceivedMs = performance.now();
    if (_thinkRafId !== null) return;  // loop already running
    function tick() {
        const fill = document.getElementById('thinking-bar-fill');
        if (!fill || !_thinkBudgetS) { _thinkRafId = null; return; }
        const localElapsed = (performance.now() - _thinkPollReceivedMs) / 1000;
        const totalElapsed = _thinkElapsedAtPoll + localElapsed;
        const pct = Math.min(95, (totalElapsed / _thinkBudgetS) * 100);
        fill.style.width = pct + '%';
        _thinkDisplayedPct = pct; // keep displayed state in sync with interpolated width
        if (pct >= 95 || totalElapsed >= _thinkBudgetS) {
            _thinkRafId = null;
            return;
        }
        _thinkRafId = requestAnimationFrame(tick);
    }
    _thinkRafId = requestAnimationFrame(tick);
}

function _stopThinkInterpolation() {
    if (_thinkRafId !== null) {
        cancelAnimationFrame(_thinkRafId);
        _thinkRafId = null;
    }
    _thinkBudgetS = null;
}

/** Update the thinking-status indicator in the game header.
 *  @param {string} phase - submitting|thinking|applying|done|error
 *  @param {string} message - human-readable label
 *  @param {number} progress - 0-100 percentage for the bar fill */
function updateThinkingStatus(phase, message, progress) {
    const badge = document.getElementById('thinking-status-badge');
    if (!badge) return;
    if (_clearThinkingTimeout !== null) {
        clearTimeout(_clearThinkingTimeout);
        _clearThinkingTimeout = null;
    }
    const icons = {
        submitting: '📡',
        thinking: '🧠',
        applying: '✅',
        done: '🤖',
        error: '❌',
    };
    const icon = icons[phase] || '🌐';
    // normalize label to "AI thinking" during the thinking phase
    const displayLabel = (phase === 'thinking') ? 'AI thinking' : message;
    const text = badge.querySelector('#thinking-bar-text');
    const fill = badge.querySelector('#thinking-bar-fill');
    if (text) text.textContent = `${icon} ${displayLabel}`;
    // backward-progress guard — snap immediately, don't animate
    const pct = progress != null ? Math.min(progress, 100) : 0;
    if (fill) {
        const currentVisualPct = parseFloat(fill.style.width) || _thinkDisplayedPct;
        if (pct < currentVisualPct) {
            fill.style.transition = 'none';
            fill.style.width = pct + '%';
            requestAnimationFrame(() => { fill.style.transition = ''; });
        } else {
            fill.style.width = pct + '%';
        }
    }
    _thinkDisplayedPct = pct;
    badge.classList.remove('hidden');
    badge.classList.toggle('thinking-active', phase === 'thinking' || phase === 'submitting');
    badge.classList.toggle('thinking-error', phase === 'error');
}

/** Clear the thinking-status indicator after a short delay */
function clearThinkingStatus() {
    _stopThinkInterpolation();
    if (_clearThinkingTimeout !== null) {
        clearTimeout(_clearThinkingTimeout);
    }
    _clearThinkingTimeout = setTimeout(() => {
        _clearThinkingTimeout = null;
        const badge = document.getElementById('thinking-status-badge');
        if (!badge) return;
        const fill = badge.querySelector('#thinking-bar-fill');
        if (fill) fill.style.width = '0%';
        _thinkDisplayedPct = 0; // reset so next turn starts clean
        const text = badge.querySelector('#thinking-bar-text');
        if (text) text.textContent = '';
        badge.classList.add('hidden');
        badge.classList.remove('thinking-active', 'thinking-error');
    }, 1500);
}

async function submitAction(action) {
    if (!currentGameId) return;
    // Prevent duplicate submissions while a human move POST is already in flight.
    // Mirrors the _aiMoveInFlight guard in doAiMove().
    if (_humanMoveInFlight) return;
    _humanMoveInFlight = true;

    // Snapshot game context so the catch block can tell whether an incoming
    // error is stale (from a duplicate request that raced the first one).
    const requestGameId = currentGameId;
    const requestStep = gameState?.action_step ?? 0;

    try {
        const body = {
            player_id: gameState.current_player_agent_id || 'human',
            action_type: action.action_type,
            action_data: { value: action.value },
            requested_step: requestStep,
        };
        // External-state mode keeps the local/frontend game authoritative for
        // direct human moves. Replaying here onto externalGameId can diverge
        // legality due to independent server-side randomness/state timing.
        await api('POST', `/games/${requestGameId}/moves`, body);
        const refreshOk = await refreshState();
        if (!refreshOk) {
            log('State refresh failed after move.', 'error');
            return;
        }

        // Evaluate after human move — state has changed since last PWin.
        // No agent_id passed; backend picks the best search agent.
        if ((gameState?.action_step ?? 0) > _pwinActionStep) {
            evaluatePosition(); // fire-and-forget
        }

        // After a move, auto-advance AI turns if current player is AI
        if (!isCurrentPlayerHuman() && !autoPlaying) {
            autoAdvanceAI();
        }
    } catch (e) {
        // If the game has already advanced past the state we targeted, this
        // error came from a duplicate request that the server correctly rejected
        // (e.g. second BUILD_SETTLEMENT after the first was already applied).
        // Suppress the user-visible error; the game has already continued.
        const isStale = currentGameId !== requestGameId
            || (gameState?.action_step ?? 0) > requestStep;
        if (isStale) {
            console.debug(
                `submitAction: stale duplicate error suppressed `
                + `(game ${requestGameId}→${currentGameId}, `
                + `step ${requestStep}→${gameState?.action_step ?? 0}): ${e.message}`
            );
        } else {
            const friendly = _friendlyOfferTradeError(action, e?.message);
            log(`Move error: ${friendly}`, 'error');
        }
        // Re-fetch state so the UI stays in sync and the human can retry.
        await refreshState();
    } finally {
        _humanMoveInFlight = false;
        // Re-render board highlights and action buttons now that the lock is
        // released. refreshState() renders while the lock is still held, so
        // the new playable-action highlights carry is-pending and are blocked
        // at the DOM layer. This second render clears that class.
        if (gameState) { renderBoard(); renderActions(); }
    }
}

async function autoAdvanceAI() {
    // Auto-play AI turns after a human move until it's a human's turn again.
    // Each call claims a new run ID; any older loop (e.g. from a previous game
    // whose await resumed after a new game started) sees a stale ID and exits,
    // preventing it from issuing moves against the new game.
    // Exits early if autoPlayLoop takes over (autoPlaying becomes true).
    const runId = ++_autoAdvanceRunId;
    if (aiMoveFailedTerminal) return;
    try {
        while (
            currentGameId
            && gameState
            && !gameState.winner
            && !aiMoveFailedTerminal
            && !autoPlaying
            && !isCurrentPlayerHuman()
            && _autoAdvanceRunId === runId
        ) {
            const ok = await doAiMove();
            if (!ok) break;
            await new Promise(r => setTimeout(r, 300));
        }
    } finally {
        // No flag to clear — run-ID token handles single-flight isolation.
    }
}

function setAutoPlay(value) {
    autoPlaying = value;
    updateAutoPlayBtn();
}

function resetAutoPlayState(aiMoveFailed) {
    aiMoveFailedTerminal = aiMoveFailed;
    setAutoPlay(false);
}

function toggleAutoPlay() {
    setAutoPlay(!autoPlaying);
    if (autoPlaying) autoPlayLoop();
    // If toggled off, the running loop will exit on next iteration check
}

function updateAutoPlayBtn() {
    const btn = document.getElementById('auto-play-btn');
    if (btn) {
        btn.textContent = autoPlaying ? '⏸ Stop' : '⏵ Auto-Play';
        btn.className = autoPlaying ? 'btn btn-danger' : 'btn btn-secondary';
    }
}

async function autoPlayLoop() {
    // Each call claims a new run ID; any older loop sees a stale ID and exits.
    // This prevents the boolean-guard timing race where a rapid stop→start can
    // leave autoPlaying===true with no active loop.
    const runId = ++_autoPlayRunId;
    try {
        while (autoPlaying && currentGameId && !aiMoveFailedTerminal && _autoPlayRunId === runId) {
            if (gameState && gameState.winner) {
                setAutoPlay(false);
                break;
            }
            if (isCurrentPlayerHuman()) {
                // Pause auto-play; human must act
                log('Auto-play paused — your turn.', 'info');
                setAutoPlay(false);
                break;
            }
            const ok = await doAiMove();
            if (!ok) {
                setAutoPlay(false);
                break;
            }
            await new Promise(r => setTimeout(r, 200));
        }
    } finally {
        // No flag to clear — run-ID token handles single-flight isolation.
    }
}

// ── Logging ──────────────────────────────────────────────────────────────

let _lastActionLogTotal = 0; // Track total action count synced from backend

// Resource index → name mapping (matches backend RESOURCE_NAMES)
const RESOURCE_IDX_NAMES = ['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'];
const RESOURCE_IDX_EMOJI = ['🪵', '🧱', '🐑', '🌾', '⛏️'];
// Dev card index → name mapping (matches backend DEV_CARD_NAMES)
const DEV_CARD_NAMES = ['KNIGHT', 'YEAR_OF_PLENTY', 'MONOPOLY', 'ROAD_BUILDING', 'VICTORY_POINT'];
const DEV_CARD_ICONS = ['⚔️ Knight', '🎁 Year of Plenty', '💰 Monopoly', '🛤️ Road Building', '🏆 Victory Point'];

function log(msg, level = 'info', options = {}) {
    const turn = gameState ? gameState.num_turns : 0;
    const { html = false, diagnostics = null } = options;
    logEntries.push({ turn, msg, level, html, diagnostics });
    renderLog();
}

function _formatDiagnosticsForTooltip(diagnostics) {
    if (diagnostics == null) return '';
    try {
        return JSON.stringify(diagnostics, null, 2);
    } catch (_) {
        return String(diagnostics);
    }
}

function _openDiagnosticsJson(diagnostics) {
    const payload = _formatDiagnosticsForTooltip(diagnostics);
    const escaped = payload
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    const html = `<!doctype html><html><head><title>Move Diagnostics</title></head><body><pre style="white-space:pre-wrap;word-break:break-word;font:13px/1.45 monospace;margin:16px;">${escaped}</pre></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Get a legible CSS color for a player color on dark backgrounds.
 * The WHITE player color (#ecf0f1) needs no adjustment; others are fine.
 */
function getPlayerTextColor(color) {
    const map = {
        RED: '#ff6b6b',
        BLUE: '#5dade2',
        ORANGE: '#f0b27a',
        WHITE: '#ecf0f1',
    };
    return map[color] || '#ccc';
}

/** Find display name for a player color from game state */
function getAgentNameByColor(color) {
    if (!gameState || !gameState.players) return color;
    const p = gameState.players.find(pl => pl.color === color || pl.color === color.toUpperCase());
    if (!p) return color;
    return p.name || `Player ${p.index + 1}`;
}

/** Is a given color a human player? */
function isColorHumanPlayer(color) {
    if (!gameState || !gameState.players) return false;
    const p = gameState.players.find(pl => pl.color === color || pl.color === color.toUpperCase());
    if (!p) return false;
    return p.agent_id === 'human';
}

/** Escape a string for safe insertion into HTML to prevent XSS */

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Build an HTML span for a player label colored by their player color */
function playerLabel(color) {
    const textColor = getPlayerTextColor(color.toUpperCase ? color.toUpperCase() : color);
    const agentName = escapeHtml(getAgentNameByColor(color));
    return `<span class="log-player" style="color:${textColor};font-weight:700;">${agentName}</span>`;
}

/**
 * Format a resource identifier as either an emoji-only or emoji+name string.
 *
 * The compact form is useful where many resources are listed together, such as
 * roll payouts. The verbose form keeps the previous emoji+name rendering for
 * trading and other action text. Unknown values still fall back to their
 * original identifier, but are HTML-escaped because the result is rendered
 * through innerHTML in several UI surfaces.
 */
function resStr(resIdx, verbose = true) {
    if (resIdx === null || resIdx === undefined) return '';
    if (typeof resIdx === 'string') {
        const emoji = RESOURCE_EMOJI[resIdx.toLowerCase()];
        if (!emoji) return escapeHtml(resIdx);
        return verbose ? `${emoji}${escapeHtml(resIdx)}` : emoji;
    }
    const emoji = RESOURCE_IDX_EMOJI[resIdx];
    if (!emoji) return escapeHtml(String(resIdx));
    if (!verbose) return emoji;
    return RESOURCE_IDX_NAMES[resIdx] ? `${emoji}${RESOURCE_IDX_NAMES[resIdx]}` : emoji;
}

/**
 * Format a resource plus an optional count suffix in compact or verbose form.
 *
 * Single-card counts are suppressed to reduce noise, while grouped displays can
 * still surface quantities greater than one. The verbosity flag is forwarded to
 * resStr() so callers can choose icon-only or emoji+name output.
 */
function resCountStr(resIdx, count, verbose = true) {
    const resource = resStr(resIdx, verbose);
    if (!resource) return '';
    return count >= 2 ? `${resource}×${count}` : resource;
}

function formatRollPayout(result) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
        return '';
    }

    const playerParts = [];
    for (const [playerColor, freqdeck] of Object.entries(result)) {
        if (!Array.isArray(freqdeck)) continue;
        const gains = freqdeck
            .map((count, idx) => count > 0 ? resCountStr(idx, count, false) : '')
            .filter(Boolean);
        if (gains.length === 0) continue;
        playerParts.push(`${playerLabel(playerColor)} ${gains.join(' ')}`);
    }

    return playerParts.length > 0 ? ` — ${playerParts.join('; ')}` : '';
}

/** Convert an action_log event to a rich HTML log entry */
function formatActionLogEvent(event) {
    const color = event.color;
    const type = event.action_type;
    const val = event.value;
    const result = event.result;
    const label = playerLabel(color);
    const isLocalPlayer = isColorHumanPlayer(color);

    switch (type) {
        case 'ROLL': {
            const dice = Array.isArray(val)
                ? val
                : (Array.isArray(result) && result.length === 2 ? result : null);
            const d1 = Array.isArray(dice) ? dice[0] : '?';
            const d2 = Array.isArray(dice) ? dice[1] : '?';
            const total = d1 + d2;
            return `${label}: 🎲 ROLL <b>${total}</b> (${d1}+${d2})${formatRollPayout(result)}`;
        }
        case 'BUILD_SETTLEMENT':
            return `${label}: 🏠 BUILD SETTLEMENT at node ${val}`;
        case 'BUILD_CITY':
            return `${label}: 🏰 BUILD CITY at node ${val}`;
        case 'BUILD_ROAD': {
            const edge = Array.isArray(val) ? val.join('–') : val;
            return `${label}: 🛤️ BUILD ROAD ${edge}`;
        }
        case 'BUY_DEVELOPMENT_CARD': {
            // Backend reveals result only for the perspective player
            if (result !== null && result !== undefined) {
                const cardName = DEV_CARD_ICONS[result] || DEV_CARD_NAMES[result] || `card #${result}`;
                return `${label}: 📜 BUY DEV CARD [${cardName}]`;
            }
            return `${label}: 📜 BUY DEV CARD [🂠 unknown]`;
        }
        case 'PLAY_KNIGHT_CARD':
            return `${label}: ⚔️ PLAY KNIGHT`;
        case 'MOVE_ROBBER': {
            let robMsg = `${label}: 🥷 MOVE ROBBER`;
            // value is [tile_coord, victim_color|null]
            if (Array.isArray(val) && val.length >= 2 && val[1]) {
                robMsg += ` → rob ${playerLabel(val[1])}`;
            }
            if (event.card_stolen) {
                if (result !== null && result !== undefined) {
                    robMsg += ` — stole ${resStr(result, false)}`;
                } else {
                    robMsg += ` — stole a card`;
                }
            }
            return robMsg;
        }
        case 'MARITIME_TRADE': {
            if (Array.isArray(val)) {
                const asking = val[val.length - 1];
                const giving = val.slice(0, -1).filter(v => v !== null);
                const rate = giving.length;
                const giveRes = resStr(giving[0], false);
                const askRes = resStr(asking, false);
                return `${label}: ⚓ TRADE ${rate}:1 ${giveRes} → ${askRes}`;
            }
            return `${label}: ⚓ MARITIME TRADE`;
        }
        case 'DISCARD': {
            if (Array.isArray(val)) {
                const discarded = val.map(r => resStr(r, false)).join(' ');
                return `${label}: 🗑️ DISCARD ${discarded}`;
            }
            if (val && typeof val === 'object' && Number.isInteger(val.count)) {
                const noun = val.count === 1 ? 'card' : 'cards';
                return `${label}: 🗑️ DISCARD ${val.count} ${noun}`;
            }
            return `${label}: 🗑️ DISCARD`;
        }
        case 'PLAY_YEAR_OF_PLENTY': {
            if (Array.isArray(val)) {
                const gained = val.map(r => resStr(r, false)).join(' ');
                return `${label}: 🎁 YEAR OF PLENTY — gained ${gained}`;
            }
            return `${label}: 🎁 YEAR OF PLENTY`;
        }
        case 'PLAY_MONOPOLY': {
            const res = resStr(val, false);
            return `${label}: 💰 MONOPOLY on ${res}`;
        }
        case 'PLAY_ROAD_BUILDING':
            return `${label}: 🛤️ ROAD BUILDING`;
        case 'OFFER_TRADE': {
            if (Array.isArray(val) && val.length >= 10) {
                const offering = val.slice(0, 5);
                const asking = val.slice(5, 10);
                const offerParts = offering.map((n, i) => n > 0 ? resCountStr(i, n, false) : '').filter(Boolean);
                const askParts = asking.map((n, i) => n > 0 ? resCountStr(i, n, false) : '').filter(Boolean);
                return `${label}: 🤝 OFFER TRADE ${offerParts.join(' ')} → ${askParts.join(' ')}`;
            }
            return `${label}: 🤝 OFFER TRADE`;
        }
        case 'ACCEPT_TRADE':
            return `${label}: ✅ ACCEPT TRADE`;
        case 'REJECT_TRADE':
            return `${label}: ❌ REJECT TRADE`;
        case 'CONFIRM_TRADE': {
            if (Array.isArray(val) && val.length >= 11) {
                const partner = val[10];
                return `${label}: 🤝 CONFIRM TRADE with ${playerLabel(partner)}`;
            }
            return `${label}: 🤝 CONFIRM TRADE`;
        }
        case 'CANCEL_TRADE':
            return `${label}: 🚫 CANCEL TRADE`;
        case 'END_TURN':
            return null;  // Filtered out — too much clutter
        default: {
            let extra = '';
            if (val !== null && val !== undefined) {
                extra = ` (${JSON.stringify(val)})`;
            }
            return `${label}: ${type}${extra}`;
        }
    }
}

/**
 * Sync the game log from the backend action_log.
 * Called from renderGame() after each state refresh.
 */
function syncGameLog() {
    if (!gameState || !gameState.action_log) return;
    const actionLog = gameState.action_log;
    const serverTotal = gameState.action_log_total || actionLog.length;

    // How many new events since our last sync?
    const newCount = serverTotal - _lastActionLogTotal;
    if (newCount <= 0) return;

    // The backend returns a sliding window (last N events).
    // New events are at the tail of this window.
    const startIdx = Math.max(0, actionLog.length - newCount);
    for (let i = startIdx; i < actionLog.length; i++) {
        const formatted = formatActionLogEvent(actionLog[i]);
        if (formatted === null) continue;  // Filtered event (e.g. END_TURN)
        logEntries.push({
            turn: gameState.num_turns,
            msg: formatted,
            level: 'info',
            html: true,
        });
    }
    _lastActionLogTotal = serverTotal;
    renderLog();
}

function renderLog() {
    const el = document.getElementById('game-log');
    if (!el) return;
    // Clear existing content
    el.textContent = '';
    // Render newest first, up to last 100 entries
    const entries = logEntries.slice(-100).reverse();
    for (const e of entries) {
        const cls = e.level === 'error' ? 'log-error' : e.level === 'warning' ? 'log-warning' : '';
        const entryEl = document.createElement('div');
        entryEl.className = `log-entry ${cls}`.trim();
        const turnEl = document.createElement('span');
        turnEl.className = 'turn-num';
        turnEl.textContent = `T${e.turn}`;
        entryEl.appendChild(turnEl);
        entryEl.appendChild(document.createTextNode(' '));
        const msgEl = document.createElement('span');
        // Only use innerHTML for entries explicitly marked as pre-formatted HTML
        // (e.g. formatActionLogEvent output); otherwise render as plain text.
        if (e.html) {
            msgEl.innerHTML = e.msg;
        } else {
            msgEl.textContent = e.msg;
        }
        entryEl.appendChild(msgEl);
        if (e.diagnostics) {
            entryEl.appendChild(document.createTextNode(' '));
            const diagBtn = document.createElement('button');
            diagBtn.className = 'log-diagnostics-btn';
            diagBtn.type = 'button';
            diagBtn.textContent = 'Details';
            diagBtn.addEventListener('click', () => _openDiagnosticsJson(e.diagnostics));
            entryEl.appendChild(diagBtn);
        }
        el.appendChild(entryEl);
    }
    // Auto-scroll to top (newest first)
    el.scrollTop = 0;
}

// ── Watermark (Version + Map Seed) ───────────────────────────────────────

function renderWatermark() {
    renderVersionStamp();  // ensure element exists
    const el = document.getElementById('app-version-stamp');
    if (!el) return;
    const mapSeed = gameState.map_seed || '?';
    const version = appVersion || '?';
    const wVersion = (workerVersion && workerVersion !== 'no_workers_registered' && workerVersion !== 'unavailable')
        ? workerVersion : 'offline';
    el.textContent = `API v${version} | Worker ${wVersion === 'offline' ? wVersion : 'v' + wVersion} | Map Seed: ${mapSeed}`;
}

async function fetchVersion() {
    try {
        const data = await api('GET', '/version');
        appVersion = data.version || '';
        workerVersion = data.worker_version?.version || '';
        appEnvironment = data.environment || '';
        featureReviewPrevAction = data?.features?.enable_review_prev_turn === true;
        if (typeof setChatEnabled === 'function') {
            const chatEnabledByFeature = data?.features?.enable_chat_endpoints === true;
            setChatEnabled(chatEnabledByFeature);
        }
    } catch {
        appVersion = '';
        workerVersion = '';
        appEnvironment = '';
        featureReviewPrevAction = false;
        if (typeof setChatEnabled === 'function') setChatEnabled(false);
    }
    if (typeof updateReviewPrevActionBtnVisibility === 'function') {
        updateReviewPrevActionBtnVisibility();
    }
    // If a game is already running, show version + map seed; otherwise just version
    if (gameState) {
        renderWatermark();
    } else {
        renderVersionStamp();
    }
}

function renderVersionStamp() {
    let el = document.getElementById('app-version-stamp');
    if (!el) {
        el = document.createElement('div');
        el.id = 'app-version-stamp';
        el.className = 'game-watermark';
        document.body.appendChild(el);
    }
    // Keep stamp visible on setup screen (floating on body), and move
    // it in-flow to .action-bar only while #game-screen is active.
    const gameScreen = document.getElementById('game-screen');
    const gameScreenActive = !!(gameScreen && gameScreen.classList.contains('active'));
    const actionBar = document.querySelector('.action-bar');
    if (gameScreenActive && actionBar && el.parentElement !== actionBar) {
        actionBar.appendChild(el);
    } else if (!gameScreenActive && el.parentElement !== document.body) {
        document.body.appendChild(el);
    }

    if (gameScreenActive) {
        el.classList.remove('game-watermark-floating');
    } else {
        el.classList.add('game-watermark-floating');
    }

    el.textContent = appVersion ? `API v${appVersion} | Worker v${workerVersion || '?'}` : '';
}

// ── Render game ──────────────────────────────────────────────────────────

function renderGame() {
    if (!gameState) return;
    // In replay mode, replay.js handles rendering — skip live render.
    if (typeof isReplayMode === 'function' && isReplayMode()) return;
    renderGameHeader();
    renderPlayers();
    renderBoard();
    renderActions();
    renderResourceCards();
    renderBankInfo();
    renderWinner();
    renderWatermark();
    syncGameLog();
    chatOnRender();
    if (typeof updateReviewPrevActionBtnVisibility === 'function') {
        updateReviewPrevActionBtnVisibility();
    }
}

function renderGameHeader() {
    const header = document.getElementById('game-header-info');
    if (!header) return;
    const color = gameState.current_player_color || '?';
    const turn = gameState.num_turns || 0;
    const agentName = getAgentNameByColor(color);
    const isHuman = isCurrentPlayerHuman();
    header.innerHTML = `
        <span class="turn-info">Turn <strong>${turn}</strong></span>
        <span class="turn-info">Current: <strong style="color:${PLAYER_COLORS[color] || '#fff'}">${color}</strong> (<span style="color:${getPlayerTextColor(color)};font-weight:700;">${escapeHtml(agentName)}</span>)</span>
        ${isHuman ? '<span class="turn-info human-badge">🎮 YOUR TURN</span>' : ''}
        <span class="turn-info">${gameState.current_prompt || ''}</span>
    `;
    // Show/hide external-state badge during game (separate from thinking badge)
    const extBadge = document.getElementById('external-state-badge');
    if (extBadge) {
        if (externalStateMode) {
            extBadge.classList.remove('hidden');
        } else {
            extBadge.classList.add('hidden');
        }
    }
}

function renderPlayers() {
    const container = document.getElementById('players-panel');
    if (!container || !gameState.players) return;

    container.innerHTML = gameState.players.map((p, i) => {
        const color = p.color || 'WHITE';
        const isActive = i === gameState.current_player_index;
        const isHumanSeat = p.agent_id === 'human';
        const isAI = !isHumanSeat;
        const isAiThinking = isActive && isAI && !gameState.winner;
        const playerNameColor = getPlayerTextColor(color);
        const res = p.resources || {};
        return `
            <div class="player-card ${isActive ? 'active-player' : ''}">
                <div class="player-name">
                    <span class="dot bg-${color}"></span>
                    ${isHumanSeat ? '🎮 ' : '🤖 '}<span style="color:${playerNameColor};font-weight:700;">${escapeHtml(p.name || `Player ${i + 1}`)}</span>
                    ${isActive ? ' ◀' : ''}
                    ${isAiThinking ? '<span class="ai-thinking-indicator"><span class="spinner-small"></span> thinking…</span>' : ''}
                </div>
                <div class="vp">${p.victory_points || 0} VP</div>
                <div class="resources">
                    ${Object.entries(res).map(([r, n]) =>
                        `<span>${RESOURCE_EMOJI[r] || r} ${r} <b>${n}</b></span>`
                    ).join('')}
                </div>
                <div class="stats">
                    <span title="Development Cards" style="white-space:nowrap">📜 Dev <b>${p.num_dev_cards || 0}</b></span> ·
                    <span title="Settlements" style="white-space:nowrap">🏠 Settle <b>${p.settlements || 0}</b></span> ·
                    <span style="white-space:nowrap">🏰 Cities <b>${p.cities || 0}</b></span>
                </div>
                <div class="stats">
                    <span title="Longest Road Length" style="white-space:nowrap">🛤️ Road <b>${p.longest_road_length || 0}</b></span> ·
                    <span title="Knights Played" style="white-space:nowrap">⚔️ Knights <b>${p.knights_played || 0}</b></span>
                    ${p.has_longest_road ? ' · <span style="white-space:nowrap">🏆 Longest Road!</span>' : ''}
                    ${p.has_largest_army ? ' · <span style="white-space:nowrap">⚔️ Largest Army!</span>' : ''}
                </div>
                ${renderPortBadges(p.port_resources)}
                ${renderPwinBadge(color)}
                ${renderSearchMetricsBadge(color, isHumanSeat)}
            </div>
        `;
    }).join('');

    // Render the evaluation bar
    renderEvalBar();
}

function renderPortBadges(portResources) {
    if (!portResources || portResources.length === 0) return '';
    const badges = [];
    for (const res of portResources) {
        if (res === null) {
            badges.push(`<span class="port-badge" title="3:1 generic port">❓</span>`);
        } else {
            const emoji = RESOURCE_EMOJI[res] || res;
            badges.push(`<span class="port-badge" title="2:1 ${res} port">${emoji}</span>`);
        }
    }
    return `<div class="ports">⚓ Ports: ${badges.join(' ')}</div>`;
}

function renderPwinBadge(color) {
    if (!lastPwin) return '';
    const pwin = lastPwin[color];
    if (pwin == null) return '';
    const pct = (pwin * 100).toFixed(1);
    return `<div class="pwin-badge">
        📊 Win: <b style="color:${PLAYER_COLORS[color] || '#ccc'}">${pct}%</b>
    </div>`;
}

function formatMetricValue(value, decimals = 0) {
    if (value == null || Number.isNaN(Number(value))) return 'n/a';
    return Number(value).toFixed(decimals);
}

function renderSearchMetricsBadge(color, isHumanSeat) {
    if (isHumanSeat) return '';
    const metrics = searchMetricsByColor[color];
    if (!metrics || !metrics.average) return '';

    const last = metrics.last_decide;
    const avg = metrics.average;
    const lastLines = last ? [
        `Sims: ${formatMetricValue(last.sims)}`,
        `Max Ply: ${formatMetricValue(last.max_ply)}`,
        `Max Rounds: ${formatMetricValue(last.max_rounds)}`,
        `Expansions: ${formatMetricValue(last.expansions)}`,
        `Max Branching: ${formatMetricValue(last.max_branching_factor)}`,
    ] : ['No completed search snapshot yet'];
    if (last && (last.compute_env || last.num_search_threads)) {
        const envLabel = last.compute_env || 'unknown';
        const threadsLabel = last.num_search_threads ? `${last.num_search_threads} threads` : '';
        const computeLine = threadsLabel
            ? `Compute: ${envLabel} (${threadsLabel})`
            : `Compute: ${envLabel}`;
        lastLines.push(computeLine);
    }
    const avgLines = [
        `Sims: ${formatMetricValue(avg.sims, 2)}`,
        `Max Ply: ${formatMetricValue(avg.max_ply, 2)}`,
        `Max Rounds: ${formatMetricValue(avg.max_rounds, 2)}`,
        `Expansions: ${formatMetricValue(avg.expansions, 2)}`,
        `Max Branching: ${formatMetricValue(avg.max_branching_factor, 2)}`,
    ];
    const tooltip = escapeHtml(
        `Last Decide\n${lastLines.join('\n')}\n\nAverage\n${avgLines.join('\n')}`
    );
    return `
        <div class="search-metrics-badge" title="${tooltip}">
            🧠
        </div>
    `;
}

/**
 * Render the evaluation bar.
 *
 * When called with no arguments (or null/null) it shows the smoothed state
 * PWin stored in lastPwin.  When called from showActionPwin() it receives an
 * action label and a pwin_by_color object to display instead, letting the bar
 * reflect the hovered action's per-player win probability.
 *
 * A footer row below the bar shows the action name (left) and the perspective
 * player's numeric win% (right).  The win% is green when the hovered action
 * improves on the current state pwin, red when it's worse, and neutral grey
 * when showing the state pwin baseline (no hover).
 *
 * @param {string|null}  hoverLabel   - action label to display, or null for state PWin
 * @param {Object|null}  hoverPwin    - pwin_by_color override, or null for state PWin
 */
function renderEvalBar(hoverLabel = null, hoverPwin = null) {
    if (!gameState || !gameState.players) return;

    // ── Derive perspective color from the local/human player ────────────────
    // getHumanPlayerData() is the canonical source for the local player
    // (same one used to render RESOURCE CARDS and DEVELOPMENT CARDS).
    const humanPlayer = getHumanPlayerData();
    const perspectiveColor = humanPlayer ? (humanPlayer.color || null) : null;

    // ── Ensure bar wrapper exists ────────────────────────────────────────────
    let wrapper = document.getElementById('eval-bar-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'eval-bar-wrapper';
        wrapper.style.cssText = 'margin:6px 0 2px;background:rgba(255,255,255,0.06);border-radius:6px;padding:6px 8px;';
        const panel = document.getElementById('players-panel');
        if (panel) panel.insertBefore(wrapper, panel.firstChild);
    }

    // ── Bar clip container (provides border-radius + overflow:hidden) ────────
    let barClip = document.getElementById('eval-bar-clip');
    if (!barClip) {
        barClip = document.createElement('div');
        barClip.id = 'eval-bar-clip';
        barClip.style.cssText = 'height:8px;border-radius:4px;overflow:hidden;';
        wrapper.appendChild(barClip);
    }

    // ── Bar element (flex row of segments, no border-radius here) ───────────
    let bar = document.getElementById('eval-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'eval-bar';
        bar.style.cssText = 'height:8px;display:flex;';
        barClip.appendChild(bar);
    }

    // ── Footer row: action name (left) + numeric pwin (right) ───────────────
    let footer = document.getElementById('eval-bar-footer');
    if (!footer) {
        footer = document.createElement('div');
        footer.id = 'eval-bar-footer';
        footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:3px;min-height:14px;';
        const actionSpan = document.createElement('span');
        actionSpan.id = 'eval-bar-action';
        actionSpan.style.cssText = 'font-size:10px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color 0.15s;';
        const pctSpan = document.createElement('span');
        pctSpan.id = 'eval-bar-pct';
        pctSpan.style.cssText = 'font-size:10px;font-weight:600;margin-left:6px;flex-shrink:0;transition:color 0.15s;';
        footer.appendChild(actionSpan);
        footer.appendChild(pctSpan);
        wrapper.appendChild(footer);
    }
    const actionSpan = document.getElementById('eval-bar-action');
    const pctSpan    = document.getElementById('eval-bar-pct');

    // ── Pending state: no data yet ───────────────────────────────────────────
    const isPending = hoverLabel === EVAL_BAR_PENDING;
    if (isPending) {
        actionSpan.textContent = '\u23f3 Evaluating\u2026';
        actionSpan.style.color = 'var(--text-dim)';
        pctSpan.textContent = '';
        bar.style.display = lastPwin ? 'flex' : 'none';
        // Keep bar at current state PWin during pending — normalize so bar fills 100%
        // (raw Q values may not sum to 1, which would leave a square-ended gap).
        if (lastPwin) {
            const rawVals = gameState.players.map(p => lastPwin[p.color || 'WHITE'] || 0);
            const pIdx = perspectiveColor
                ? gameState.players.findIndex(p => (p.color || 'WHITE') === perspectiveColor)
                : -1;
            let dimVals;
            if (pIdx >= 0) {
                const pp = rawVals[pIdx];
                const ot = rawVals.reduce((s, v, i) => i !== pIdx ? s + v : s, 0) || 1;
                dimVals = rawVals.map((v, i) => i === pIdx ? pp : (v / ot) * (1 - pp));
            } else {
                const tot = rawVals.reduce((s, v) => s + v, 0) || 1;
                dimVals = rawVals.map(v => v / tot);
            }
            bar.innerHTML = gameState.players.map((p, i) => {
                const color = p.color || 'WHITE';
                const pct = dimVals[i] * 100;
                const bg = PLAYER_COLORS[color] || '#666';
                return `<div style="width:${pct}%;background:${bg};opacity:0.4;"></div>`;
            }).join('');
        }
        return;
    }

    // ── Choose data source ───────────────────────────────────────────────────
    const pwinData = hoverPwin || lastPwin;
    if (!pwinData) {
        wrapper.style.display = 'none';
        return;
    }
    wrapper.style.display = 'block';

    // ── Render bar segments ──────────────────────────────────────────────────
    // MCTS tracks each player's Q value independently — they don't sum to 1.
    // Anchor on the perspective player's exact value and distribute the
    // complement (1 - perspPwin) among other players proportionally using
    // their raw Q values as weights. This keeps the footer number exact and
    // ensures ALL segments update visually together (fixes Denis's UI glitch).
    bar.style.display = 'flex';
    const rawValues = gameState.players.map(p => pwinData[p.color || 'WHITE'] || 0);
    const perspIdx = perspectiveColor
        ? gameState.players.findIndex(p => (p.color || 'WHITE') === perspectiveColor)
        : -1;
    let displayValues;
    if (perspIdx >= 0) {
        const perspPwin = rawValues[perspIdx];
        const otherTotal = rawValues.reduce((s, v, i) => i !== perspIdx ? s + v : s, 0) || 1;
        displayValues = rawValues.map((v, i) =>
            i === perspIdx ? perspPwin : (v / otherTotal) * (1 - perspPwin)
        );
    } else {
        const total = rawValues.reduce((s, v) => s + v, 0) || 1;
        displayValues = rawValues.map(v => v / total);
    }
    bar.innerHTML = gameState.players.map((p, i) => {
        const color = p.color || 'WHITE';
        const pct = displayValues[i] * 100;
        const bg = PLAYER_COLORS[color] || '#666';
        return `<div style="width:${pct}%;background:${bg};transition:width 0.2s ease;" title="${color}: ${pct.toFixed(1)}%"></div>`;
    }).join('');

    // ── Footer: action name ──────────────────────────────────────────────────
    if (hoverLabel) {
        actionSpan.textContent = hoverLabel;
        actionSpan.style.color = 'var(--text-bright, #e0e0e0)';
    } else {
        actionSpan.textContent = 'Win probability';
        actionSpan.style.color = 'var(--text-dim)';
    }

    // ── Footer: numeric pwin for perspective player ──────────────────────────
    // Use the raw (un-normalized) perspective player value so the number
    // matches exactly what MCTS computed, not a normalization artifact.
    if (perspectiveColor) {
        const pwin = perspIdx >= 0 ? rawValues[perspIdx] * 100 : 0;
        pctSpan.textContent = pwin.toFixed(1) + '%';
        if (hoverPwin && lastPwin) {
            // Color: green if this action is better than state pwin, red if worse.
            // Use a small epsilon to avoid false-red from floating point rounding.
            const statePwin = (lastPwin[perspectiveColor] || 0) * 100;
            const delta = pwin - statePwin;
            pctSpan.style.color = delta >= 0 ? '#2ecc71' : (delta > -0.15 ? 'var(--text-dim)' : '#e74c3c');
        } else {
            pctSpan.style.color = 'var(--text-dim)';
        }
    } else {
        pctSpan.textContent = '';
    }
}

// ── SVG Board Rendering ──────────────────────────────────────────────────

function renderBoard() {
    const svg = document.getElementById('board-svg');
    if (!svg || !gameState || !gameState.board) return;

    const board = gameState.board;
    const tiles = board.tiles || {};
    const buildings = board.buildings || {};
    const roads = board.roads || {};

    // Compute center of SVG
    const svgWidth = 600;
    const svgHeight = 520;
    const cx = svgWidth / 2;
    const cy = svgHeight / 2;

    // Add padding around the board coordinate space so port labels
    // pushed outward by the offset formula are not clipped at any edge.
    const vbPad = 30;
    svg.setAttribute('viewBox', `${-vbPad} ${-vbPad} ${svgWidth + 2 * vbPad} ${svgHeight + 2 * vbPad}`);

    let html = '';

    // ── SVG defs (gradients, filters) ───────────────────────────────
    html += `<defs>
        <radialGradient id=\"ocean-grad\" cx=\"50%\" cy=\"50%\" r=\"50%\">
            <stop offset=\"0%\" stop-color=\"#1a3a5c\" stop-opacity=\"0.3\" />
            <stop offset=\"100%\" stop-color=\"#0a1628\" stop-opacity=\"0\" />
        </radialGradient>
    </defs>`;
    // Ocean background circle
    html += `<circle cx=\"${cx}\" cy=\"${cy}\" r=\"270\" fill=\"url(#ocean-grad)\" />`;

    // ── Draw tiles ──────────────────────────────────────────────────
    const tilePositions = {};

    for (const [key, tile] of Object.entries(tiles)) {
        const coord = tile.coordinate || parseCoord(key);
        const q = coord[0]; // x in cube
        const r = coord[2]; // z in cube
        const pos = cubeToPixel(q, r, cx, cy);
        tilePositions[key] = pos;

        const resource = tile.resource;
        const number = tile.number;
        const fillColor = getResourceColor(resource);

        // Hex polygon
        html += `<polygon
            class="hex-tile"
            points="${hexPolygonPoints(pos.x, pos.y, HEX_SIZE - 2)}"
            fill="${fillColor}"
            stroke="#0d1b2e"
            stroke-width="2.5"
        />`;

        // Number token
        if (number) {
            const isHot = number === 6 || number === 8;
            html += `<circle cx="${pos.x}" cy="${pos.y}" r="15"
                fill="#1a1a2e" stroke="#666" stroke-width="1.5" />`;
            html += `<text x="${pos.x}" y="${pos.y}"
                class="hex-number ${isHot ? 'hot' : ''}">${number}</text>`;
        }

        // Resource label below number
        if (resource) {
            html += `<text x="${pos.x}" y="${pos.y + 22}"
                class="hex-resource-label">${resource}</text>`;
        }
    }

    // ── Draw robber ─────────────────────────────────────────────────
    const robberCoord = gameState.board.robber_coordinate;
    if (robberCoord) {
        const rq = robberCoord[0];
        const rr = robberCoord[2] !== undefined ? robberCoord[2] : robberCoord[1];
        const rPos = cubeToPixel(rq, rr, cx, cy);
        html += `<circle cx="${rPos.x}" cy="${rPos.y}" r="12" class="robber" />`;
        html += `<text x="${rPos.x}" y="${rPos.y}" text-anchor="middle"
            dominant-baseline="central" font-size="14" fill="#fff">🥷</text>`;
    }

    // ── Draw roads ──────────────────────────────────────────────────
    for (const [edgeKey, color] of Object.entries(roads)) {
        const edgeNodes = parseEdge(edgeKey);
        if (edgeNodes.length === 2) {
            const p1 = getNodePixel(edgeNodes[0], tilePositions, cx, cy);
            const p2 = getNodePixel(edgeNodes[1], tilePositions, cx, cy);
            if (p1 && p2) {
                html += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"
                    class="road" stroke="${PLAYER_COLORS[color] || '#fff'}" />`;
            }
        }
    }

    // ── Draw buildings ──────────────────────────────────────────────
    for (const [nodeId, bld] of Object.entries(buildings)) {
        const pos = getNodePixel(parseInt(nodeId, 10), tilePositions, cx, cy);
        if (!pos) continue;

        const color = PLAYER_COLORS[bld.color] || '#fff';
        if (bld.type === 'CITY' || bld.type === 'City') {
            html += `<rect x="${pos.x - 7}" y="${pos.y - 7}" width="14" height="14"
                rx="2" class="city" fill="${color}" />`;
        } else {
            html += `<circle cx="${pos.x}" cy="${pos.y}" r="6"
                class="settlement" fill="${color}" />`;
        }
    }

    // ── Draw ports ────────────────────────────────────────────────
    const portsList = board.ports || [];
    for (const port of portsList) {
        const portNodes = port.nodes || [];
        if (portNodes.length < 2) continue;

        const p1 = getNodePixel(portNodes[0], tilePositions, cx, cy);
        const p2 = getNodePixel(portNodes[1], tilePositions, cx, cy);
        if (!p1 || !p2) continue;

        // Port marker position: midpoint of the two nodes, shifted outward
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        const portResource = port.resource;
        const portColor = portResource ? getResourceColor(portResource) : '#6a6a8a';
        const portEmoji = portResource ? (RESOURCE_EMOJI[portResource.toLowerCase()] || '') : '';
        const portDisplayLabel = portResource ? `2:1${portEmoji}` : '3:1 ?';

        // Shift the port label further away from center
        const offsetX = (midX - cx) * 0.22;
        const offsetY = (midY - cy) * 0.22;
        const portX = midX + offsetX;
        const portY = midY + offsetY;

        // Line from port label to each node
        html += `<line x1="${p1.x}" y1="${p1.y}" x2="${portX}" y2="${portY}"
            stroke="${portColor}" stroke-width="2" stroke-dasharray="3,3" opacity="0.6" />`;
        html += `<line x1="${p2.x}" y1="${p2.y}" x2="${portX}" y2="${portY}"
            stroke="${portColor}" stroke-width="2" stroke-dasharray="3,3" opacity="0.6" />`;

        // Port label background pill
        const labelW = portResource ? 44 : 40;
        html += `<rect x="${portX - labelW/2}" y="${portY - 12}" width="${labelW}" height="24"
            rx="12" fill="${portColor}" opacity="0.92" stroke="rgba(255,255,255,0.25)" stroke-width="0.75" />`;
        html += `<text x="${portX}" y="${portY}"
            text-anchor="middle" dominant-baseline="central"
            font-size="12" font-weight="700" fill="#fff"
            pointer-events="none">${portDisplayLabel}</text>`;

        // Port node highlight dots — use owner color when a building occupies the node
        const bld0 = buildings[String(portNodes[0])];
        const bld1 = buildings[String(portNodes[1])];
        const dot0Color = bld0 ? (PLAYER_COLORS[bld0.color] || portColor) : portColor;
        const dot1Color = bld1 ? (PLAYER_COLORS[bld1.color] || portColor) : portColor;
        const dot0Opacity = bld0 ? '1' : '0.7';
        const dot1Opacity = bld1 ? '1' : '0.7';
        html += `<circle cx="${p1.x}" cy="${p1.y}" r="5" fill="${dot0Color}" opacity="${dot0Opacity}" stroke="rgba(255,255,255,0.35)" stroke-width="0.75" />`;
        html += `<circle cx="${p2.x}" cy="${p2.y}" r="5" fill="${dot1Color}" opacity="${dot1Opacity}" stroke="rgba(255,255,255,0.35)" stroke-width="0.75" />`;
    }

    // ── Playable action highlights (only clickable on human turns) ──
    if (gameState.playable_actions && isCurrentPlayerHuman()) {
        // While a human move is in flight, append 'is-pending' so CSS blocks clicks.
        const pendingClass = _humanMoveInFlight ? ' is-pending' : '';
        // Group MOVE_ROBBER actions by tile coordinate for tile-click targets
        const robberByTile = {};

        for (const action of gameState.playable_actions) {
            const at = action.action_type;
            const val = action.value;

            if ((at === 'BUILD_SETTLEMENT' || at === 'BUILD_CITY') && typeof val === 'number') {
                const pos = getNodePixel(val, tilePositions, cx, cy);
                if (pos) {
                    const key = actionKey(action);
                    const entry = lastActionPwin && lastActionPwin.get(key);
                    const hoverIn = entry
                        ? `showActionPwin(${JSON.stringify(key)}, ${JSON.stringify(entry.pwin_by_color)})`
                        : null;
                    html += `<circle cx="${pos.x}" cy="${pos.y}" r="8"
                        class="node-highlight visible${pendingClass}"
                        ${hoverIn ? `onmouseenter='${hoverIn}' onmouseleave='clearActionPwin()'` : ''}
                        onclick="submitAction(${JSON.stringify(action).replace(/"/g, '&quot;')})" />`;
                }
            }

            if (at === 'BUILD_ROAD' && Array.isArray(val) && val.length === 2) {
                const p1 = getNodePixel(val[0], tilePositions, cx, cy);
                const p2 = getNodePixel(val[1], tilePositions, cx, cy);
                if (p1 && p2) {
                    const key = actionKey(action);
                    const entry = lastActionPwin && lastActionPwin.get(key);
                    const hoverIn = entry
                        ? `showActionPwin(${JSON.stringify(key)}, ${JSON.stringify(entry.pwin_by_color)})`
                        : null;
                    html += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"
                        class="edge-highlight visible${pendingClass}"
                        ${hoverIn ? `onmouseenter='${hoverIn}' onmouseleave='clearActionPwin()'` : ''}
                        onclick="submitAction(${JSON.stringify(action).replace(/"/g, '&quot;')})" />`;
                }
            }

            if (at === 'MOVE_ROBBER' && Array.isArray(val) && val.length === 2) {
                const coord = val[0];
                const tileKey = Array.isArray(coord) ? coord.join(',') : String(coord);
                if (!robberByTile[tileKey]) robberByTile[tileKey] = { coord, actions: [] };
                robberByTile[tileKey].actions.push(action);
            }
        }

        // Render MOVE_ROBBER tile highlights
        for (const { coord, actions } of Object.values(robberByTile)) {
            const q = Array.isArray(coord) ? coord[0] : coord;
            const r = Array.isArray(coord) ? (coord[2] !== undefined ? coord[2] : coord[1]) : 0;
            const pos = cubeToPixel(q, r, cx, cy);
            if (pos) {
                // For hover: find the best-visits MOVE_ROBBER action for this tile
                const coordStr = Array.isArray(coord) ? coord.join(', ') : String(coord);
                const robberEntry = getBestActionPwinForCoord('MOVE_ROBBER', coordStr);
                const robberHoverIn = robberEntry
                    ? `showActionPwin(${JSON.stringify(robberEntry.label)}, ${JSON.stringify(robberEntry.pwin_by_color)})`
                    : null;
                const robberHoverAttrs = robberHoverIn
                    ? `onmouseenter='${robberHoverIn}' onmouseleave='clearActionPwin()'`
                    : '';

                if (actions.length === 1) {
                    // Single victim (or no victim) — click submits directly
                    html += `<circle cx="${pos.x}" cy="${pos.y}" r="${HEX_SIZE - 6}"
                        class="robber-highlight visible${pendingClass}"
                        ${robberHoverAttrs}
                        onclick="submitAction(${JSON.stringify(actions[0]).replace(/"/g, '&quot;')})" />`;
                } else {
                    // Multiple victims — click shows victim picker
                    html += `<circle cx="${pos.x}" cy="${pos.y}" r="${HEX_SIZE - 6}"
                        class="robber-highlight visible${pendingClass}"
                        ${robberHoverAttrs}
                        onclick="showRobberVictimPicker(${JSON.stringify(actions).replace(/"/g, '&quot;')})" />`;
                }
            }
        }
    }

    svg.innerHTML = html;
}

/**
 * Show a victim picker when the user clicks a robber tile with multiple
 * steal targets.  Replaces the normal action panel with victim buttons.
 */
function showRobberVictimPicker(actions) {
    const container = document.getElementById('action-buttons');
    if (!container) return;
    const COLOR_EMOJI = { RED: '🔴', BLUE: '🔵', ORANGE: '🟠', WHITE: '⚪' };
    let html = '<div style="margin-bottom:6px;font-weight:600;">🥷 Steal from whom?</div>';
    for (const action of actions) {
        const victim = action.value[1];
        const label = victim
            ? `${COLOR_EMOJI[victim] || ''} ${victim}`
            : 'No one (empty tile)';
        html += `<button class="${humanBtnClass(true)}"
            onclick='submitAction(${JSON.stringify(action)})'>${label}</button>`;
    }
    container.innerHTML = html;
}

// ── Board helpers ────────────────────────────────────────────────────────

function getResourceColor(resource) {
    const colors = {
        WOOD: '#2d6a1e', Wood: '#2d6a1e',
        BRICK: '#b5451d', Brick: '#b5451d',
        SHEEP: '#8bc34a', Sheep: '#8bc34a',
        WHEAT: '#ffc107', Wheat: '#ffc107',
        ORE: '#78909c', Ore: '#78909c',
    };
    return colors[resource] || '#c2b280'; // desert fallback
}

function parseEdge(edgeKey) {
    // Edge keys come as "(42, 43)" or "[42, 43]" or just "42"
    const cleaned = edgeKey.replace(/[()[\]]/g, '');
    return cleaned.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

// Node positions: use the authoritative positions provided by the backend.
// The backend computes each node's fractional cube coordinate by averaging
// the cube coordinates of all tiles that share it.
const _nodePositionCache = {};

function getNodePixel(nodeId, tilePositions, cx, cy) {
    if (_nodePositionCache[nodeId]) return _nodePositionCache[nodeId];

    // Use backend-provided node_positions (fractional cube coords)
    const board = gameState && gameState.board;
    const nodePositions = board && board.node_positions;
    if (nodePositions && nodePositions[String(nodeId)]) {
        const coords = nodePositions[String(nodeId)];
        // coords = [q, r_unused, s] — use q (index 0) and s (index 2)
        // same convention as tile rendering: cubeToPixel(q, s, cx, cy)
        const pos = cubeToPixel(coords[0], coords[2], cx, cy);
        _nodePositionCache[nodeId] = pos;
        return pos;
    }

    return null;
}

// ── Actions panel ────────────────────────────────────────────────────────

/**
 * Returns the CSS class string for a human-action button.
 * Appends 'is-pending' while _humanMoveInFlight is true so that duplicate
 * clicks are blocked at the DOM layer (pointer-events: none via CSS).
 */
function humanBtnClass(isHuman) {
    if (!isHuman) return 'action-btn';
    return 'action-btn human-action' + (_humanMoveInFlight ? ' is-pending' : '');
}

function renderActions() {
    const container = document.getElementById('action-buttons');
    const promptEl = document.getElementById('prompt-text');
    const humanPrompt = document.getElementById('human-prompt');
    if (!container) return;

    const isHuman = isCurrentPlayerHuman();

    // Show/hide the human prompt banner
    if (humanPrompt) {
        if (isHuman) {
            humanPrompt.classList.remove('hidden');
            humanPrompt.innerHTML = `<span>🎮 Your turn — ${formatPrompt(gameState.current_prompt)}</span>`;
        } else {
            humanPrompt.classList.add('hidden');
        }
    }

    if (promptEl) {
        promptEl.innerHTML = `<strong>${formatPrompt(gameState.current_prompt) || 'Waiting...'}</strong>`;
    }

    if (!gameState.playable_actions || gameState.playable_actions.length === 0) {
        container.innerHTML = '<div style="color:var(--text-dim);font-size:13px;">No actions available</div>';
        return;
    }

    // Don't show AI's available actions during AI turn.
    // Showing them leaks potentially hidden information (e.g. trade options reveal resources).
    if (!isHuman) {
        container.innerHTML = `
            <div style="color:var(--text-dim);font-size:13px;">🤖 AI is playing…</div>
            <button class="action-btn" style="border-color:var(--accent);color:var(--accent);"
                onclick="doAiMove()">🤖 AI Move</button>
        `;
        return;
    }

    // Group actions by type for cleaner display
    const grouped = {};
    for (const action of gameState.playable_actions) {
        const at = action.action_type;
        if (!grouped[at]) grouped[at] = [];
        grouped[at].push(action);
    }

    let html = '';

    // Quick actions (non-positional)
    const quickTypes = ['ROLL', 'BUY_DEVELOPMENT_CARD', 'PASS_TURN', 'DISCARD',
                        'PLAY_KNIGHT_CARD', 'END_TURN', 'PLAY_ROAD_BUILDING',
                        'ACCEPT_TRADE', 'REJECT_TRADE', 'CANCEL_TRADE'];

    // Handle MARITIME_TRADE separately with two-click UI
    const tradeActions = grouped['MARITIME_TRADE'] || [];
    delete grouped['MARITIME_TRADE'];

    // Handle Monopoly and Year of Plenty with step-based UI
    const monopolyActions = grouped['PLAY_MONOPOLY'] || [];
    delete grouped['PLAY_MONOPOLY'];
    const yopActions = grouped['PLAY_YEAR_OF_PLENTY'] || [];
    delete grouped['PLAY_YEAR_OF_PLENTY'];
    // Reset step-pickers when their action types are no longer available
    if (monopolyActions.length === 0) _monopolyPending = false;
    if (yopActions.length === 0) _yopStep1 = null;

    for (const [type, actions] of Object.entries(grouped)) {
        if (quickTypes.some(q => type.includes(q)) || actions.length <= 3) {
            for (const action of actions) {
                const label = formatActionLabel(action);
                const btnClass = humanBtnClass(isHuman);
                // Hover: exact match for quick/single actions
                const key = actionKey(action);
                const entry = lastActionPwin && lastActionPwin.get(key);
                const hoverIn = entry
                    ? `onmouseenter='showActionPwin(${JSON.stringify(key)}, ${JSON.stringify(entry.pwin_by_color)})' onmouseleave='clearActionPwin()'`
                    : '';
                html += `<button class="${btnClass}" ${hoverIn}
                    onclick='submitAction(${JSON.stringify(action)})'>
                    ${label}
                </button>`;
            }
        } else {
            // Macro button for positional actions — hover shows best of that type
            const best = getBestActionPwin(type);
            const macroHoverIn = best
                ? `onmouseenter='showActionPwin(${JSON.stringify(type)}, ${JSON.stringify(best.pwin_by_color)})' onmouseleave='clearActionPwin()'`
                : '';
            html += `<div class="action-btn" style="cursor:default;opacity:0.8;" ${macroHoverIn}>
                ${formatActionType(type)} (${actions.length} options${isHuman ? ' — click board' : ''})
            </div>`;
        }
    }

    // Two-click maritime trade UI
    if (tradeActions.length > 0) {
        html += renderMaritimeTradeUI(tradeActions, isHuman);
    }

    // free-form player trade composer.
    // The engine never emits OFFER_TRADE in playable_actions; the button
    // appears whenever state.is_trade_allowed gates trading on for the
    // current player (see Candidate B engine predicate).
    if (isHuman && gameState && gameState.is_trade_allowed) {
        html += renderPlayerTradeUI();
    } else if (_playerTradeComposer !== null) {
        // CAT-680: when trading is no longer allowed (cap reached, mid-
        // resolution, opponent's turn, ...) discard any half-built
        // composer so it cannot resurrect with a stale give/ask vector
        // when trade re-opens on the next eligible turn.
        _playerTradeComposer = null;
    }

    // Step-based Monopoly and Year of Plenty UI
    if (monopolyActions.length > 0) {
        html += renderMonopolyUI(monopolyActions, isHuman);
    }
    if (yopActions.length > 0) {
        html += renderYopUI(yopActions, isHuman);
    }

    container.innerHTML = html;
}

// ── Two-click Maritime Trade UI ──────────────────────────────────────────

function renderMaritimeTradeUI(tradeActions, isHuman) {
    const btnClass = humanBtnClass(isHuman);

    // If user already selected a "giving" resource, show step 2 (choose what to receive)
    if (_tradeSelection) {
        let html = '';
        html += `<div class="trade-group">`;
        html += `<div class="trade-header" style="font-size:12px;color:var(--text-dim);margin-bottom:4px;">
            ⚓ Trade ${_tradeSelection.rate}:1 ${resStr(_tradeSelection.giving, true)} for…</div>`;
        for (const action of _tradeSelection.actions) {
            const asking = action.value[action.value.length - 1];
            const askStr = resStr(asking, true);
            const key = actionKey(action);
            const entry = lastActionPwin && lastActionPwin.get(key);
            const hoverIn = entry
                ? `onmouseenter='showActionPwin(${JSON.stringify(key)}, ${JSON.stringify(entry.pwin_by_color)})' onmouseleave='clearActionPwin()'`
                : '';
            html += `<button class="${btnClass}" style="border-color:var(--accent);" ${hoverIn}
                onclick='submitAction(${JSON.stringify(action)})'>
                …for ${askStr}
            </button>`;
        }
        html += `<button class="action-btn" style="opacity:0.7;font-size:12px;"
            onclick="cancelTradeSelection()">✕ Back</button>`;
        html += `</div>`;
        return html;
    }

    // Step 1: Group trades by giving resource+rate, show one button per group
    const groups = {};
    for (const action of tradeActions) {
        const giving = action.value.slice(0, -1).filter(v => v !== null);
        if (giving.length === 0) continue;
        const giveRes = giving[0];
        const rate = giving.length;
        const key = `${giveRes}_${rate}`;
        if (!groups[key]) groups[key] = { giving: giveRes, rate, actions: [] };
        groups[key].actions.push(action);
    }

    let html = '';
    for (const [key, group] of Object.entries(groups)) {
        const giveStr = resStr(group.giving, true);
        // Hover: best MARITIME_TRADE action pwin for this resource group
        const best = getBestActionPwin('MARITIME_TRADE');
        const tradeHoverIn = best
            ? `onmouseenter='showActionPwin("MARITIME_TRADE", ${JSON.stringify(best.pwin_by_color)})' onmouseleave='clearActionPwin()'`
            : '';
        html += `<button class="${btnClass}" ${tradeHoverIn}
            onclick='selectTradeGiving(${group.giving}, ${group.rate}, ${JSON.stringify(group.actions)})'>
            ⚓ Trade ${group.rate}:1 ${giveStr}…
        </button>`;
    }
    return html;
}

function selectTradeGiving(giving, rate, actions) {
    _tradeSelection = { giving, rate, actions };
    renderActions();
}

function cancelTradeSelection() {
    _tradeSelection = null;
    renderActions();
}

// ── free-form player-to-player OFFER_TRADE composer ──────────
//
// The engine never emits OFFER_TRADE in playable_actions (Candidate B);
// the human player builds a 10-tuple (give[5] + ask[5]) and submits it
// directly. ``state.is_trade_allowed`` gates the button. The submitted
// action goes through the standard ``POST /games/.../moves`` path; if
// ``is_valid_action`` rejects it (unaffordable, no-op, malformed),
// ``submitAction`` surfaces the standard error envelope.
const _RESOURCE_NAMES = ['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'];
const _RESOURCE_EMOJI = ['🪵', '🧱', '🐑', '🌾', '⛏️'];

// CAT-680: map the engine's OFFER_TRADE rejection reason to a friendly
// one-liner. The engine embeds ``Reason: <ENUM>.`` in the ValueError that
// the API wraps as ``Illegal move: ... Reason: <ENUM>.``; the regex
// matches both shapes (with or without the wrapper).
const _OFFER_TRADE_REASON_TEXT = {
    TRADE_NOT_ALLOWED_DISABLED:
        'Player trades are disabled in this game.',
    TRADE_NOT_ALLOWED_RESOLVING:
        'A previous trade is still being resolved — wait for it to finish.',
    TRADE_NOT_ALLOWED_CAP_REACHED:
        'You have already made the maximum number of offers this turn.',
    TRADE_NOT_ALLOWED_WRONG_PHASE:
        'Trades can only be offered during the main phase of your own turn.',
    TRADE_NOT_ALLOWED_PRE_ROLL:
        'Roll the dice before offering trades.',
    TRADE_NOT_ALLOWED_EMPTY_HAND:
        'You have no resource cards to trade.',
    WRONG_ACTOR:
        'It is not your turn to make a trade offer.',
    MALFORMED_SHAPE:
        'Trade offer is malformed.',
    NEGATIVE_ENTRY:
        'Trade offer has negative resource counts.',
    EMPTY_GIVE:
        'You have to give at least one resource.',
    EMPTY_ASK:
        'You have to ask for at least one resource.',
    OVERLAP_OR_NO_OP:
        'You cannot offer the same resource on both sides of a trade.',
    UNAFFORDABLE_GIVE:
        'You do not hold enough of the resource you are trying to give.',
};

function _friendlyOfferTradeError(action, rawMessage) {
    if (!rawMessage) return rawMessage;
    if (!action || action.action_type !== 'OFFER_TRADE') return rawMessage;
    const m = rawMessage.match(/Reason:\s*([A-Z_]+)\b/);
    if (!m) return rawMessage;
    const tag = m[1];
    const friendly = _OFFER_TRADE_REASON_TEXT[tag];
    return friendly ? `Trade rejected — ${friendly}` : rawMessage;
}

function _humanPlayerHoldings() {
    // Look up the current human player's per-resource hand from the
    // serialised game state so the composer can pre-flight affordability
    // before the user clicks Send. Returns null when the data is not
    // available yet (no game state, no current_player_index resolved).
    if (!gameState || !Array.isArray(gameState.players)) return null;
    const idx = gameState.current_player_index;
    if (idx === null || idx === undefined) return null;
    const player = gameState.players[idx];
    if (!player) return null;
    const resources = player.resources || {};
    return [
        Number(resources.wood || 0),
        Number(resources.brick || 0),
        Number(resources.sheep || 0),
        Number(resources.wheat || 0),
        Number(resources.ore || 0),
    ];
}

function _playerTradeUnaffordable(give, holdings) {
    // CAT-680: report which give-side resource (if any) the human cannot
    // currently afford. Pure UX hint -- the engine still authoritatively
    // validates affordability through ``_is_valid_offer_trade``.
    if (!holdings) return null;
    for (let r = 0; r < 5; r++) {
        const want = give[r] | 0;
        if (want > 0 && (holdings[r] | 0) < want) {
            return { resourceIdx: r, want, have: holdings[r] | 0 };
        }
    }
    return null;
}

function renderPlayerTradeUI() {
    const btnClass = humanBtnClass(true);
    if (!_playerTradeComposer) {
        return `<button class="${btnClass}"
            style="border-color:var(--accent);"
            onclick="openPlayerTradeComposer()">🤝 Trade with players…</button>`;
    }
    const { give, ask } = _playerTradeComposer;
    let html = '<div class="trade-group">';
    html += '<div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">'
         + '🤝 Player trade — give what / ask what?</div>';
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;">';
    html += renderPlayerTradeColumn('give', 'Give', give);
    html += renderPlayerTradeColumn('ask', 'Ask', ask);
    html += '</div>';
    const sumGive = give.reduce((a, b) => a + b, 0);
    const sumAsk = ask.reduce((a, b) => a + b, 0);
    const shapeValid = sumGive >= 1 && sumAsk >= 1 && !_playerTradeIsNoOp(give, ask);
    const holdings = _humanPlayerHoldings();
    const unaffordable = shapeValid ? _playerTradeUnaffordable(give, holdings) : null;
    const valid = shapeValid && unaffordable === null;
    const sendDisabled = valid ? '' : 'disabled style="opacity:0.5;"';
    html += `<div style="margin-top:8px;display:flex;gap:6px;">`;
    html += `<button class="action-btn" ${sendDisabled} style="border-color:var(--accent);"
        onclick="submitPlayerTradeOffer()">Send offer</button>`;
    html += `<button class="action-btn" style="opacity:0.7;"
        onclick="closePlayerTradeComposer()">✕ Cancel</button>`;
    html += '</div>';
    if (!shapeValid) {
        html += '<div style="font-size:11px;color:var(--text-dim);margin-top:4px;">'
             + 'Need at least 1 in give and 1 in ask, and they must differ.</div>';
    } else if (unaffordable) {
        const name = _RESOURCE_NAMES[unaffordable.resourceIdx];
        html += `<div style="font-size:11px;color:var(--text-dim);margin-top:4px;">`
             + `You only have ${unaffordable.have} ${name} — cannot give ${unaffordable.want}.`
             + `</div>`;
    }
    html += '</div>';
    return html;
}

/**
 * Render one side of the player-trade composer.
 *
 * The composer is intentionally compact because it sits in the action rail
 * beside other turn controls. Resource names are exposed through titles and
 * ARIA labels while the visible UI stays icon-only for faster repeated use.
 */
function renderPlayerTradeColumn(side, label, values) {
    let html = '<div class="player-trade-column">';
    html += `<div class="player-trade-column-label">${label}</div>`;
    for (let r = 0; r < 5; r++) {
        const count = values[r];
        const resourceName = _RESOURCE_NAMES[r];
        html += `<div class="player-trade-resource-row" title="${label} ${resourceName}">`;
        html += `<span class="player-trade-resource-icon" aria-label="${resourceName}">${_RESOURCE_EMOJI[r]}</span>`;
        html += '<span class="player-trade-stepper">';
        html += `<button class="action-btn player-trade-bump" aria-label="Decrease ${label} ${resourceName}"
            onclick="bumpPlayerTrade('${side}', ${r}, -1)">−</button>`;
        html += `<span class="player-trade-count">${count}</span>`;
        html += `<button class="action-btn player-trade-bump" aria-label="Increase ${label} ${resourceName}"
            onclick="bumpPlayerTrade('${side}', ${r}, 1)">+</button>`;
        html += '</span>';
        html += `</div>`;
    }
    html += `</div>`;
    return html;
}

function _playerTradeIsNoOp(give, ask) {
    // Reject identical-payload trades (no net change). We also reject any
    // trade that has the same resource on both sides simultaneously --
    // that net-cancels at apply time and is treated as a malformed offer
    // by the engine.
    for (let r = 0; r < 5; r++) {
        if ((give[r] | 0) > 0 && (ask[r] | 0) > 0) return true;
    }
    for (let r = 0; r < 5; r++) {
        if (give[r] !== ask[r]) return false;
    }
    return true;
}

function openPlayerTradeComposer() {
    _playerTradeComposer = { give: [0, 0, 0, 0, 0], ask: [0, 0, 0, 0, 0] };
    renderActions();
}

function closePlayerTradeComposer() {
    _playerTradeComposer = null;
    renderActions();
}

function bumpPlayerTrade(side, resourceIdx, delta) {
    if (!_playerTradeComposer) return;
    const arr = _playerTradeComposer[side];
    const next = Math.max(0, Math.min(20, (arr[resourceIdx] || 0) + delta));
    arr[resourceIdx] = next;
    renderActions();
}

function submitPlayerTradeOffer() {
    if (!_playerTradeComposer) return;
    const { give, ask } = _playerTradeComposer;
    const value = give.concat(ask);
    submitAction({ action_type: 'OFFER_TRADE', value });
    _playerTradeComposer = null;
}

// ── Step-based Monopoly UI ──────────────────────────────────────

function renderMonopolyUI(actions, isHuman) {
    const btnClass = humanBtnClass(isHuman);

    if (!_monopolyPending) {
        // Collapsed: single trigger button
        const best = getBestActionPwin('PLAY_MONOPOLY');
        const hoverIn = best
            ? `onmouseenter='showActionPwin("PLAY_MONOPOLY", ${JSON.stringify(best.pwin_by_color)})' onmouseleave='clearActionPwin()'`
            : '';
        return `<button class="${btnClass}" ${hoverIn}
            onclick="_monopolyPending=true;renderActions();">💰 Monopoly…</button>`;
    }

    // Expanded: one button per resource
    let html = '<div class="trade-group">';
    html += '<div style="font-size:12px;color:var(--text-dim);margin-bottom:4px;">💰 Monopolize which resource?</div>';
    for (const action of actions) {
        const label = resStr(action.value, true);
        const key = actionKey(action);
        const entry = lastActionPwin && lastActionPwin.get(key);
        const hoverIn = entry
            ? `onmouseenter='showActionPwin(${JSON.stringify(key)}, ${JSON.stringify(entry.pwin_by_color)})' onmouseleave='clearActionPwin()'`
            : '';
        html += `<button class="${btnClass}" style="border-color:var(--accent);" ${hoverIn}
            onclick='submitAction(${JSON.stringify(action)})'>${label}</button>`;
    }
    html += `<button class="action-btn" style="opacity:0.7;font-size:12px;"
        onclick="_monopolyPending=false;renderActions();">✕ Back</button>`;
    html += '</div>';
    return html;
}

// ── Step-based Year of Plenty UI ────────────────────────────────

function renderYopUI(actions, isHuman) {
    const btnClass = humanBtnClass(isHuman);

    if (_yopStep1 === null) {
        // Collapsed: single trigger button
        const best = getBestActionPwin('PLAY_YEAR_OF_PLENTY');
        const hoverIn = best
            ? `onmouseenter='showActionPwin("PLAY_YEAR_OF_PLENTY", ${JSON.stringify(best.pwin_by_color)})' onmouseleave='clearActionPwin()'`
            : '';
        return `<button class="${btnClass}" ${hoverIn}
            onclick="_yopStep1='PICK1';renderActions();">🎁 Year of Plenty…</button>`;
    }

    if (_yopStep1 === 'PICK1') {
        // Step 1: pick first resource
        // Collect resources from BOTH positions of each action pair so
        // that a resource appearing only at value[1] (e.g. Ore in [Wood, Ore])
        // is still offered as a first pick.
        const seen = new Set();
        const firstResources = [];
        for (const a of actions) {
            const vals = Array.isArray(a.value) ? a.value : [a.value];
            for (const r of vals) {
                if (r !== null && r !== undefined && !seen.has(r)) {
                    seen.add(r);
                    firstResources.push(r);
                }
            }
        }
        let html = '<div class="trade-group">';
        html += '<div style="font-size:12px;color:var(--text-dim);margin-bottom:4px;">🎁 Year of Plenty — pick first resource</div>';
        for (const r of firstResources) {
            html += `<button class="${btnClass}" style="border-color:var(--accent);"
                onclick="_yopStep1=${JSON.stringify(r)};renderActions();">${resStr(r, true)}</button>`;
        }
        html += `<button class="action-btn" style="opacity:0.7;font-size:12px;"
            onclick="_yopStep1=null;renderActions();">✕ Back</button>`;
        html += '</div>';
        return html;
    }

    // Step 2: pick second resource
    // Match actions containing the first-chosen resource in EITHER
    // position of the pair, not just slot 0.  This ensures e.g. picking Ore
    // first also surfaces [Wood, Ore] (where Ore is in slot 1).
    const matched = actions.filter(a => {
        const vals = Array.isArray(a.value) ? a.value : [a.value];
        return vals.includes(_yopStep1);
    });
    let html = '<div class="trade-group">';
    html += `<div style="font-size:12px;color:var(--text-dim);margin-bottom:4px;">🎁 First: ${resStr(_yopStep1, true)} — pick second resource</div>`;
    for (const action of matched) {
        // The "second" resource is whichever slot is NOT the first pick.
        // For same-resource pairs like [Ore, Ore], both slots match — show that resource.
        const vals = Array.isArray(action.value) ? action.value : [action.value];
        let second;
        if (vals.length === 1) {
            second = vals[0];
        } else if (vals[0] === _yopStep1) {
            second = vals[1];
        } else {
            second = vals[0];
        }
        const label = resStr(second, true);
        const key = actionKey(action);
        const entry = lastActionPwin && lastActionPwin.get(key);
        const hoverIn = entry
            ? `onmouseenter='showActionPwin(${JSON.stringify(key)}, ${JSON.stringify(entry.pwin_by_color)})' onmouseleave='clearActionPwin()'`
            : '';
        html += `<button class="${btnClass}" style="border-color:var(--accent);" ${hoverIn}
            onclick='submitAction(${JSON.stringify(action)})'>${label}</button>`;
    }
    html += `<button class="action-btn" style="opacity:0.7;font-size:12px;"
        onclick="_yopStep1='PICK1';renderActions();">✕ Back</button>`;
    html += '</div>';
    return html;
}

function formatActionType(type) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatActionLabel(action) {
    const type = formatActionType(action.action_type);

    // Player-trade buttons: render readable resource icons instead of raw
    // tuples. ACCEPT_TRADE / REJECT_TRADE carry no value of their own --
    // pull the in-flight offer from gameState.state.current_trade so the
    // human can see what they are saying yes/no to.
    if (action.action_type === 'OFFER_TRADE' && Array.isArray(action.value)) {
        return `🤝 Offer: ${formatTradeOffer(action.value)}`;
    }
    if (action.action_type === 'ACCEPT_TRADE') {
        const detail = formatActiveTradeDetail();
        return detail ? `✅ Accept: ${detail}` : '✅ Accept Trade';
    }
    if (action.action_type === 'REJECT_TRADE') {
        const detail = formatActiveTradeDetail();
        return detail ? `❌ Reject: ${detail}` : '❌ Reject Trade';
    }
    if (action.action_type === 'CONFIRM_TRADE' && Array.isArray(action.value)) {
        // value is (give[5], ask[5], partner_color).
        const partner = action.value[10];
        const partnerLabel = partner ? playerLabel(partner) : 'partner';
        const detail = formatTradeOffer(action.value.slice(0, 10));
        return `🤝 Confirm with ${partnerLabel}: ${detail}`;
    }
    if (action.action_type === 'CANCEL_TRADE') {
        return '🚫 Cancel Trade';
    }

    if (action.value === null || action.value === undefined) return type;

    // Special formatting for maritime trade actions
    if (action.action_type === 'MARITIME_TRADE' && Array.isArray(action.value)) {
        return formatTradeLabel(action.value);
    }

    // Special formatting for discard actions — show resource emojis
    if (action.action_type === 'DISCARD' && Array.isArray(action.value)) {
        const resources = action.value.map(r => resStr(r)).join(' ');
        return `🗑️ Discard: ${resources}`;
    }

    if (typeof action.value === 'number') return `${type} (${action.value})`;
    if (Array.isArray(action.value)) return `${type} [${action.value.join(', ')}]`;
    return `${type}: ${action.value}`;
}

/**
 * Format a 10-int trade payload (give[5] then ask[5]) as readable
 * resource icons -- e.g. "🪵 1 → 🌾 1". Returns "Ø" for an empty side
 * so we never silently render a blank arrow. Falls back to "(invalid
 * offer)" for malformed payloads so the button text always stays
 * meaningful.
 */
function formatTradeOffer(value10) {
    if (!Array.isArray(value10) || value10.length < 10) {
        return '(invalid offer)';
    }
    const give = value10.slice(0, 5);
    const ask = value10.slice(5, 10);
    const giveParts = give
        .map((n, i) => Number(n) > 0 ? resCountStr(i, Number(n), false) : '')
        .filter(Boolean);
    const askParts = ask
        .map((n, i) => Number(n) > 0 ? resCountStr(i, Number(n), false) : '')
        .filter(Boolean);
    const giveStr = giveParts.length ? giveParts.join(' ') : 'Ø';
    const askStr = askParts.length ? askParts.join(' ') : 'Ø';
    return `${giveStr} → ${askStr}`;
}

/**
 * Build the "<offerer> <give> → <ask>" detail string for the currently
 * in-flight trade so ACCEPT / REJECT buttons can show what they are
 * responding to. Reads from gameState.state.current_trade where the
 * 11th element is the offerer SEAT INDEX (per State.to_dict). Returns
 * an empty string when no trade is being resolved or the payload is
 * malformed so the caller can fall back to a generic label.
 */
function formatActiveTradeDetail() {
    if (!gameState || !gameState.state) return '';
    const trade = gameState.state.current_trade;
    if (!Array.isArray(trade) || trade.length < 11) return '';
    const offererIdx = trade[10];
    let offererColor = null;
    const colors = gameState.state.colors;
    if (Array.isArray(colors) && typeof offererIdx === 'number'
        && offererIdx >= 0 && offererIdx < colors.length) {
        offererColor = colors[offererIdx];
    }
    const offer = formatTradeOffer(trade.slice(0, 10));
    if (offererColor) {
        return `${playerLabel(offererColor)} ${offer}`;
    }
    return offer;
}

function formatTradeLabel(tradeValue) {
    // Trade value is a tuple like [WOOD, WOOD, WOOD, WOOD, null, BRICK] or integer indices
    // Last element is what we're asking for; preceding non-nulls are what we give
    const asking = tradeValue[tradeValue.length - 1];
    const giving = tradeValue.slice(0, -1).filter(v => v !== null);
    const rate = giving.length;
    const giveStr = giving[0] !== undefined ? resStr(giving[0], true) : '?';
    const askStr = asking !== null && asking !== undefined ? resStr(asking, true) : '?';
    return `⚓ ${rate}:1 ${giveStr} → ${askStr}`;
}

function formatPrompt(prompt) {
    const map = {
        'BUILD_INITIAL_SETTLEMENT': '🏠 Place Settlement',
        'BUILD_INITIAL_ROAD': '🛤️ Place Road',
        'PLAY_TURN': '🎲 Play Turn',
        'DISCARD': '🗑️ Discard Cards',
        'MOVE_ROBBER': '🥷 Move Robber',
        'DECIDE_TRADE': '🤝 Decide Trade',
        'DECIDE_ACCEPTEES': '✅ Choose Acceptees',
    };
    return map[prompt] || prompt || '';
}

// ── Resource & Dev Card Rendering ────────────────────────────────────────

function renderResourceCards() {
    const section = document.getElementById('resource-cards-section');
    const container = document.getElementById('resource-cards');
    const devSection = document.getElementById('dev-cards-section');
    const devContainer = document.getElementById('dev-cards');
    if (!section || !container) return;

    // In replay, render from the replay perspective player; otherwise render
    // the local human player's private hand.
    const perspectivePlayer = getPerspectivePlayerData();
    if (!perspectivePlayer) {
        section.classList.add('hidden');
        if (devSection) devSection.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    const res = perspectivePlayer.resources || {};
    const cards = [
        { key: 'wood', emoji: '🪵', label: 'Wood', cls: 'rc-wood' },
        { key: 'brick', emoji: '🧱', label: 'Brick', cls: 'rc-brick' },
        { key: 'sheep', emoji: '🐑', label: 'Sheep', cls: 'rc-sheep' },
        { key: 'wheat', emoji: '🌾', label: 'Wheat', cls: 'rc-wheat' },
        { key: 'ore', emoji: '⛏️', label: 'Ore', cls: 'rc-ore' },
    ];

    container.innerHTML = cards.map(c => {
        const count = res[c.key] || 0;
        return `<div class="resource-card ${c.cls} ${count === 0 ? 'empty' : ''}">
            <span class="rc-emoji">${c.emoji}</span>
            <span class="rc-count">${count}</span>
            <span class="rc-label">${c.label}</span>
        </div>`;
    }).join('');

    // Dev cards — show the actual cards for the active resource-card subject:
    // human player in live mode, replay perspective player in replay mode.
    if (devSection && devContainer) {
        const devHand = perspectivePlayer.dev_cards_private || {};
        const totalDev = perspectivePlayer.num_dev_cards || 0;
        if (totalDev === 0) {
            devSection.classList.remove('hidden');
            devContainer.innerHTML = '<div class="dev-stat" style="color:var(--text-dim)">No development cards</div>';
        } else {
            devSection.classList.remove('hidden');
            const DEV_CARD_DISPLAY = [
                { key: 'knight', emoji: '⚔️', label: 'Knight' },
                { key: 'victory_point', emoji: '🏆', label: 'Victory Point' },
                { key: 'year_of_plenty', emoji: '🎁', label: 'Year of Plenty' },
                { key: 'monopoly', emoji: '💰', label: 'Monopoly' },
                { key: 'road_building', emoji: '🛤️', label: 'Road Building' },
            ];
            devContainer.innerHTML = DEV_CARD_DISPLAY
                .filter(c => (devHand[c.key] || 0) > 0)
                .map(c => `<div class="dev-stat">${c.emoji} ${c.label}: <b>${devHand[c.key]}</b></div>`)
                .join('');
        }
    }
}

function getHumanPlayerData() {
    if (!gameState || !gameState.players) return null;
    const human = gameState.players.find(p => p.agent_id === 'human');
    if (human) return human;
    return null;
}

function getPerspectivePlayerData() {
    if (!gameState || !gameState.players) return null;
    if (_perspectiveColor) {
        return gameState.players.find(p => p.color === _perspectiveColor) || null;
    }
    return getHumanPlayerData();
}

function renderBankInfo() {
    const el = document.getElementById('bank-info');
    if (!el || !gameState) return;

    const bank = gameState.bank_resources;
    const devRemaining = gameState.dev_cards_remaining;
    if (!bank) { el.innerHTML = ''; return; }

    el.innerHTML = `
        <span class="bank-label">Bank:</span>
        <span class="bank-res">🪵${bank.wood || 0}</span>
        <span class="bank-res">🧱${bank.brick || 0}</span>
        <span class="bank-res">🐑${bank.sheep || 0}</span>
        <span class="bank-res">🌾${bank.wheat || 0}</span>
        <span class="bank-res">⛏️${bank.ore || 0}</span>
        ${devRemaining !== undefined ? `<span class="bank-res">📜${devRemaining} dev</span>` : ''}
    `;
}

// ── Winner ───────────────────────────────────────────────────────────────

function renderWinner() {
    const overlay = document.getElementById('winner-overlay');
    if (!overlay) return;

    if (gameState.winner) {
        const w = gameState.winner;
        document.getElementById('winner-color').textContent = w.color || '?';
        document.getElementById('winner-color').style.color = PLAYER_COLORS[w.color] || '#fff';
        const winnerAgentEl = document.getElementById('winner-agent');
        winnerAgentEl.textContent = w.name || `Player ${w.player_index}`;
        winnerAgentEl.style.color = getPlayerTextColor(w.color || '');
        // Build a final score summary
        const summaryEl = document.getElementById('winner-summary');
        if (summaryEl && gameState.players) {
            summaryEl.innerHTML = [...gameState.players]
                .sort((a, b) => (b.victory_points || 0) - (a.victory_points || 0))
                .map(p => {
                    const c = PLAYER_COLORS[p.color] || '#fff';
                    const label = escapeHtml(p.name || ('Player ' + (p.index + 1)));
                    return `<div class="winner-player-row">
                        <span class="dot bg-${p.color}"></span>
                        <span style="color:${c};font-weight:600;">${label}</span>
                        <span>${p.victory_points || 0} VP</span>
                    </div>`;
                }).join('');
        }
        overlay.classList.add('active');
        setAutoPlay(false);
        // Check if recording is available for replay
        if (typeof _replayCheckAvailability === 'function') _replayCheckAvailability();
    } else {
        overlay.classList.remove('active');
    }
}

function dismissWinnerOverlay() {
    document.getElementById('winner-overlay').classList.remove('active');
}

function newGame() {
    // Exit replay mode if active
    if (typeof exitReplayMode === 'function' && typeof isReplayMode === 'function' && isReplayMode()) {
        exitReplayMode();
    }
    currentGameId = null;
    externalGameId = null;
    gameState = null;
    setAutoPlay(false);
    logEntries = [];
    _lastActionLogTotal = 0;
    _aiRetryCount = 0;
    humanPlayerIndices = [];
    lastPwin = null;
    lastActionPwin = null;
    searchMetricsByColor = {};
    _hoverActionLabel = null;
    _perspectiveColor = null;
    _evaluating = false;
    _pwinActionStep = 0;
    _chatPrevPwin = null;
    _chatLastActionLogTotal = 0;
    externalStateMode = false;
    Object.keys(_nodePositionCache).forEach(k => delete _nodePositionCache[k]);

    // Hide badges; preserve toggle/localStorage state
    const thinkingBadge = document.getElementById('thinking-status-badge');
    if (thinkingBadge) thinkingBadge.classList.add('hidden');
    const extBadge = document.getElementById('external-state-badge');
    if (extBadge) extBadge.classList.add('hidden');

    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('winner-overlay').classList.remove('active');
    document.getElementById('setup-screen').classList.add('active');
    // Reposition build stamp from .action-bar back to body (floating)
    // now that #game-screen is no longer active.
    renderVersionStamp();
}

async function deleteGame() {
    if (!currentGameId) return;
    try {
        await api('DELETE', `/games/${currentGameId}`);
        if (externalGameId && externalGameId !== currentGameId) {
            await api('DELETE', `/games/${externalGameId}`);
        }
        log('Game deleted');
    } catch (e) {
        console.warn('Delete failed:', e);
    }
    newGame();
}

// ── Init ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Wire global error handlers for frontend error reporting
    window.onerror = (msg, source, line, col, err) => {
        reportFrontendError(msg || String(err), 'window.onerror', {
            stack: err?.stack,
        });
    };
    window.addEventListener('unhandledrejection', (e) => {
        reportFrontendError(String(e.reason), 'unhandledrejection', {
            stack: e.reason?.stack,
        });
    });

    document.getElementById('num-players')?.addEventListener('change', () => {
        loadAgents();
    });
    // Some browsers/input modes dispatch 'input' without 'change' until blur.
    // Register both so player-count changes always refresh agent options.
    document.getElementById('num-players')?.addEventListener('input', () => {
        loadAgents();
    });
    document.getElementById('start-btn')?.addEventListener('click', createGame);
    document.getElementById('auto-play-btn')?.addEventListener('click', toggleAutoPlay);
    document.getElementById('new-game-btn')?.addEventListener('click', newGame);
    document.getElementById('delete-game-btn')?.addEventListener('click', deleteGame);

    loadAgents();
    fetchVersion();

    // Restore external-state toggle from localStorage
    const externalStateToggle = document.getElementById('external-state-toggle');
    if (externalStateToggle) {
        const saved = localStorage.getItem('hexbandit_external_state');
        if (saved === 'true') externalStateToggle.checked = true;
        externalStateToggle.addEventListener('change', function () {
            localStorage.setItem('hexbandit_external_state', this.checked ? 'true' : 'false');
        });
    }
});
