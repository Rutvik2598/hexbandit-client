/* ═══════════════════════════════════════════════════════════════════════
   Hexbandit – Game Replay (replay.js)
   ═══════════════════════════════════════════════════════════════════════ */

// ── Replay state ─────────────────────────────────────────────────────────

let _replayMode = false;
let _replayFrames = [];    // Array of {turn, action, state, evaluate}
let _replayStep = 0;       // Current frame index
const _analyzeCache = {};  // Cache for /moves/analyze responses: gameId_step -> AnalysisDTO
let _savedPerspectiveColor = null; // Stash live _perspectiveColor during replay

function isReplayMode() { return _replayMode; }

function _replayGameId() {
    if (typeof getRecordingGameId === 'function') {
        return getRecordingGameId();
    }
    return currentGameId;
}

// ── Entry / exit ─────────────────────────────────────────────────────────

// opts.startAtStep — optional step index to open the replay at (default: 0).
// opts.frames      — optional preloaded frames array; if provided the network
//                    fetch is skipped so callers that already have the recording
//                    (e.g. reviewPreviousAction) avoid a redundant round-trip.
async function enterReplayMode(opts = {}) {
    if (!currentGameId) return;
    const replayGameId = _replayGameId();
    // Clear stale analysis results from previous replay sessions.
    for (const k in _analyzeCache) delete _analyzeCache[k];
    try {
        let frames;
        if (opts.frames && opts.frames.length > 0) {
            frames = opts.frames;
        } else {
            const data = await api('GET', `/games/${replayGameId}/recording`);
            if (!data.frames || data.frames.length === 0) {
                log('No recording data available for this game.', 'info');
                return;
            }
            frames = data.frames;
        }
        _replayFrames = frames;
        // Clamp the requested start step within valid bounds (default 0).
        const requestedStep = (opts.startAtStep !== undefined) ? opts.startAtStep : 0;
        _replayStep = Math.max(0, Math.min(requestedStep, _replayFrames.length - 1));
        _replayMode = true;

        // Save the live perspective color so we can restore it on exit.
        _savedPerspectiveColor = _perspectiveColor;

        // Dismiss winner overlay so the board is visible
        document.getElementById('winner-overlay')?.classList.remove('active');

        _replayUpdateUI();
    } catch (e) {
        log(`Failed to load replay: ${e.message}`, 'error');
    }
}

function exitReplayMode() {
    _replayMode = false;
    _replayFrames = [];
    _replayStep = 0;

    // Restore the live perspective color saved on entry.
    _perspectiveColor = _savedPerspectiveColor;
    _savedPerspectiveColor = null;

    // Hide replay controls and move back to document body
    const controls = document.getElementById('replay-controls');
    if (controls) {
        controls.classList.add('hidden');
        document.body.appendChild(controls);
    }
    const gameControls = document.querySelector('.game-controls');
    if (gameControls) gameControls.style.display = '';

    // Restore action section visibility
    const actionSection = document.querySelector('.action-section');
    if (actionSection) actionSection.style.display = '';

    // Hide analysis panel
    const analysisPanel = document.getElementById('replay-analysis-panel');
    if (analysisPanel) analysisPanel.style.display = 'none';

    // Restore chat panel
    const chatPanel = document.getElementById('chat-panel');
    if (chatPanel) chatPanel.style.display = '';

    // Re-render live state
    if (currentGameId && gameState) {
        renderGame();
    }
}

// ── Navigation ───────────────────────────────────────────────────────────

function replayPrev() {
    if (!_replayMode || _replayStep <= 0) return;
    _replayStep--;
    _replayUpdateUI();
}

function replayNext() {
    if (!_replayMode || _replayStep >= _replayFrames.length - 1) return;
    _replayStep++;
    _replayUpdateUI();
}

function replayGoToStart() {
    if (!_replayMode || _replayFrames.length === 0) return;
    _replayStep = 0;
    _replayUpdateUI();
}

function replayGoToEnd() {
    if (!_replayMode || _replayFrames.length === 0) return;
    _replayStep = _replayFrames.length - 1;
    _replayUpdateUI();
}

function replaySeek(step) {
    if (!_replayMode) return;
    _replayStep = Math.max(0, Math.min(step, _replayFrames.length - 1));
    _replayUpdateUI();
}

// ── Keyboard navigation ──────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
    if (!_replayMode) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); replayPrev(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); replayNext(); }
    else if (e.key === 'Home') { e.preventDefault(); replayGoToStart(); }
    else if (e.key === 'End') { e.preventDefault(); replayGoToEnd(); }
    else if (e.key === 'Escape') { e.preventDefault(); exitReplayMode(); }
});

// ── Render ────────────────────────────────────────────────────────────────

function _replayUpdateUI() {
    if (!_replayMode || _replayFrames.length === 0) return;

    const frame = _replayFrames[_replayStep];
    if (!frame) return;
    const frameAction = frame.action || null;

    // Temporarily replace gameState with the frame's snapshot for rendering
    const savedState = gameState;
    gameState = frame.state;
    // Replay perspective follows the frame so player-scoped panels reflect the
    // actor at the currently viewed step.
    _perspectiveColor = frameAction?.color || frame.state?.current_player_color || _perspectiveColor;

    // Clear node position cache so board rebuilds from frame state
    if (typeof _nodePositionCache !== 'undefined') {
        Object.keys(_nodePositionCache).forEach(k => delete _nodePositionCache[k]);
    }

    // Render board, players, bank using the frame state
    renderGameHeader();
    renderPlayers();
    renderBoard();
    renderResourceCards();
    renderBankInfo();

    // Pre-populate node position cache from board data so highlights can look
    // up positions for nodes that have no building on them yet.
    const _boardNP = frame.state?.board?.node_positions;
    if (_boardNP && typeof cubeToPixel === 'function') {
        const _SVG_CX = 300, _SVG_CY = 260;
        for (const [nid, coords] of Object.entries(_boardNP)) {
            const id = parseInt(nid, 10);
            if (!_nodePositionCache[id] && Array.isArray(coords) && coords.length >= 3) {
                _nodePositionCache[id] = cubeToPixel(coords[0], coords[2], _SVG_CX, _SVG_CY);
            }
        }
    }

    // Restore saved state reference (replay doesn't mutate live state)
    gameState = savedState;

    // Update replay-specific UI
    _replayRenderControls();
    _replayRenderAnalysisPanel(frame);
    _replayRenderEvalBar(frame);
    _replayRenderImmediateMoveHighlights(frame);
    _replayHideLiveControls();
}

/**
 * Render move indicators immediately from the replay frame itself.
 *
 * Why this exists:
 * Step changes should show at least the "action taken" marker instantly,
 * without waiting for /moves/analyze to complete.
 *
 * The async analyze path still runs and will refresh overlays with
 * best-vs-taken indicators when available.
 */
function _replayRenderImmediateMoveHighlights(frame) {
    // Clear stale overlays from the previous step first.
    document.querySelectorAll('.replay-taken-highlight, .replay-best-highlight').forEach(el => el.remove());
    if (!frame || !frame.action) return;
    // Reuse the same renderer used by analyze results.
    _replayAddBoardHighlights(
        { action_taken: frame.action, best_action: null },
        _replayStep
    );
}

function _replayRenderControls() {
    const controls = document.getElementById('replay-controls');
    if (!controls) return;
    controls.classList.remove('hidden');

    // Move replay controls into the game-header top bar
    const gameHeader = document.querySelector('.game-header');
    if (gameHeader && controls.parentElement !== gameHeader) {
        gameHeader.appendChild(controls);
    }

    const scrubber = document.getElementById('replay-scrubber');
    if (scrubber) {
        scrubber.max = String(_replayFrames.length - 1);
        scrubber.value = String(_replayStep);
    }

    const label = document.getElementById('replay-step-label');
    if (label) {
        label.textContent = `${_replayStep + 1} / ${_replayFrames.length}`;
    }

    // Disable buttons at boundaries
    const prevBtn = document.getElementById('replay-prev');
    const startBtn = document.getElementById('replay-start');
    const nextBtn = document.getElementById('replay-next');
    const endBtn = document.getElementById('replay-end');
    if (prevBtn) prevBtn.disabled = _replayStep <= 0;
    if (startBtn) startBtn.disabled = _replayStep <= 0;
    if (nextBtn) nextBtn.disabled = _replayStep >= _replayFrames.length - 1;
    if (endBtn) endBtn.disabled = _replayStep >= _replayFrames.length - 1;

    // Hide normal game controls
    const gameControls = document.querySelector('.game-controls');
    if (gameControls) gameControls.style.display = 'none';
}

function _replayHideLiveControls() {
    // Hide action buttons section
    const actionSection = document.querySelector('.action-section');
    if (actionSection) actionSection.style.display = 'none';

    // Hide chat panel to make room for analysis
    const chatPanel = document.getElementById('chat-panel');
    if (chatPanel) chatPanel.style.display = 'none';
}

function _replayRenderAnalysisPanel(frame) {
    let panel = document.getElementById('replay-analysis-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'replay-analysis-panel';
        panel.className = 'replay-analysis-panel';
        const rightPanel = document.getElementById('right-panel');
        if (rightPanel) {
            rightPanel.prepend(panel);
        }
    }
    panel.style.display = 'block';

    const action = frame.action || {};
    const actingColor = action.color || null;
    const displayColor = actingColor || '?';
    const actionType = action.action_type || '?';
    const value = action.value;

    const players = frame.state?.players || [];
    const actingPlayer = players.find(p => p.color === actingColor);
    const playerName = actingPlayer
        ? (actingPlayer.name || `Player ${actingPlayer.index}`)
        : displayColor;

    const colorHex = (typeof PLAYER_COLORS !== 'undefined' && actingColor && PLAYER_COLORS[actingColor]) || '#fff';

    let valueStr = '';
    if (value !== null && value !== undefined) {
        valueStr = ` ${typeof value === 'object' ? JSON.stringify(value) : value}`;
    }

    const turnNum = frame.turn ?? frame.state?.num_turns ?? '?';

    // Win % from the acting player's POV — only use evaluation tied to this replay frame.
    // Most replay frames will not have evaluate data yet, so show unavailable until
    // analyze/backfill provides frame-specific probabilities.
    const pwinByColor = frame.evaluate?.pwin_by_color || null;
    const actingPwin = (actingColor && pwinByColor) ? pwinByColor[actingColor] : null;
    const actingPwinStr = actingPwin != null ? `${(actingPwin * 100).toFixed(1)}%` : '–';
    const actingLabel = actingColor ? `Win % (${actingColor})` : 'Win %';

    panel.innerHTML = `
        <div class="replay-analysis-header">📊 Analysis</div>
        <div class="replay-analysis-row">
            <span class="replay-analysis-label">Turn</span>
            <span>${turnNum}</span>
        </div>
        <div class="replay-analysis-row">
            <span class="replay-analysis-label">Player</span>
            <span style="color:${colorHex};font-weight:600;">${_escapeHtml(playerName)}</span>
        </div>
        <div class="replay-analysis-row">
            <span class="replay-analysis-label">${actingLabel}</span>
            <span id="replay-pwin-value" class="replay-analysis-pwin-value">${actingPwinStr}</span>
        </div>
        <div class="replay-analysis-separator"></div>
        <div class="replay-analysis-row">
            <span class="replay-analysis-label">Action Taken</span>
            <span id="replay-action-taken-desc">${_escapeHtml(actionType)}${_escapeHtml(valueStr)}</span>
        </div>
        <div id="replay-explanation-block">
            <div class="replay-analysis-separator"></div>
            <div class="replay-analysis-row">
                <span class="replay-analysis-label">Best Available</span>
                <span class="replay-analysis-loading">…</span>
            </div>
        </div>
    `;

    const replayGameId = _replayGameId();
    if (replayGameId && actingColor && actingPlayer?.agent_id === 'human') {
        const capturedStep = _replayStep;
        const capturedGameId = replayGameId;
        const capturedFrame = frame;
        _fetchReplayAnalysis(capturedGameId, capturedStep, capturedFrame).then(analysis => {
            // Discard stale results: replay may have exited, the user may have
            // navigated to a different step, or a different game may be active.
            if (!_replayMode || _replayGameId() !== capturedGameId || _replayStep !== capturedStep) return;

            // Update action-taken description with the formatted version
            if (analysis?.action_taken?.description) {
                const descEl = document.getElementById('replay-action-taken-desc');
                if (descEl) descEl.textContent = analysis.action_taken.description;
            }

            // Update explanation / best-action block
            const el = document.getElementById('replay-explanation-block');
            if (el) el.innerHTML = _renderExplanationBlock(analysis);

            // If analyze backfilled or refreshed evaluate data, write it onto
            // the frame so every subsequent read (eval bar, pwin display) uses
            // the most up-to-date values (e.g. from a restricted re-evaluate).
            if (analysis?.evaluate) {
                capturedFrame.evaluate = analysis.evaluate;
            }

            // Update the Win % to reflect the action-taken pwin (the position
            // assessment after the player's actual choice) when available from
            // the analysis, falling back to the frame evaluate otherwise.
            const _actingColor = capturedFrame.action?.color;
            const actingTakenPwin = _actingColor
                ? analysis?.action_taken?.pwin_by_color?.[_actingColor]
                : null;
            const actingFramePwin = _actingColor
                ? capturedFrame.evaluate?.pwin_by_color?.[_actingColor]
                : null;
            const actingPwinVal = actingTakenPwin ?? actingFramePwin;
            if (actingPwinVal != null) {
                const pwinEl = document.getElementById('replay-pwin-value');
                if (pwinEl) pwinEl.textContent = `${(actingPwinVal * 100).toFixed(1)}%`;
            }
            if (capturedFrame.evaluate?.pwin_by_color) {
                _replayRenderEvalBar(capturedFrame);
            }

            // Overlay board highlights for action taken and best action.
            _replayAddBoardHighlights(analysis, capturedStep);
        });
    }
}

/**
 * Render the explanation block for the replay analysis panel.
 * Accepts the full AnalysisDTO object from /moves/analyze.
 *  - best_action present        -> "Best" row with win-prob delta.
 *  - explanation present        -> render the explanation text.
 *  - explanation_error present  -> render in RED (developer signal: uncovered step).
 *  - all null                   -> return empty string (no block shown).
 * @param {object|null} analysis - Full response from /moves/analyze, or null.
 */
function _renderExplanationBlock(analysis) {
    if (!analysis) return '';

    // Use the acting player's color for all Win % values.
    const actingColor = analysis.acting_player || null;

    const _pwinStr = (pwinByColor) => {
        if (!actingColor || !pwinByColor) return null;
        const v = pwinByColor[actingColor];
        return v != null ? `${(v * 100).toFixed(1)}%` : null;
    };

    let rows = '';

    // PWin of action taken — sub-row under "Action Taken"
    const takenPwin = _pwinStr(analysis.action_taken?.pwin_by_color);
    if (takenPwin) {
        rows += `
        <div class="replay-analysis-row replay-analysis-sub">
            <span class="replay-analysis-label">↳ Win %</span>
            <span class="replay-analysis-pwin-value">${takenPwin}</span>
        </div>`;
    }

    // Best Available — always show this row
    rows += `<div class="replay-analysis-separator"></div>`;
    const bestDesc = analysis.best_action?.description;
    const takenDesc = analysis.action_taken?.description;
    if (!bestDesc) {
        rows += `
        <div class="replay-analysis-row">
            <span class="replay-analysis-label">Best Available</span>
            <span class="replay-analysis-sub">–</span>
        </div>`;
    } else if (bestDesc === takenDesc) {
        rows += `
        <div class="replay-analysis-row">
            <span class="replay-analysis-label">Best Available</span>
            <span>Optimal!</span>
        </div>`;
        const bestPwin = _pwinStr(analysis.best_action?.pwin_by_color);
        if (bestPwin) {
            rows += `
            <div class="replay-analysis-row replay-analysis-sub">
                <span class="replay-analysis-label">↳ Win %</span>
                <span class="replay-analysis-pwin-value">${bestPwin}</span>
            </div>`;
        }
    } else {
        const bestPwin = _pwinStr(analysis.best_action?.pwin_by_color);
        // Compute delta from pwin values for consistent formatting (1 decimal, +/- sign)
        let deltaHtml = '';
        if (actingColor && analysis.best_action?.pwin_by_color && analysis.action_taken?.pwin_by_color) {
            const bestVal = analysis.best_action.pwin_by_color[actingColor];
            const takenVal = analysis.action_taken.pwin_by_color[actingColor];
            if (bestVal != null && takenVal != null) {
                const delta = (bestVal - takenVal) * 100;
                const sign = delta >= 0 ? '+' : '';
                deltaHtml = ` <span class="replay-analysis-delta">${sign}${delta.toFixed(1)}%</span>`;
            }
        }
        rows += `
        <div class="replay-analysis-row">
            <span class="replay-analysis-label">Best Available</span>
            <span>${_escapeHtml(bestDesc)}</span>
        </div>`;
        if (bestPwin) {
            rows += `
            <div class="replay-analysis-row replay-analysis-sub">
                <span class="replay-analysis-label">↳ Win %</span>
                <span>${deltaHtml}${deltaHtml ? '&nbsp;&nbsp;' : ''}<span class="replay-analysis-pwin-value">${bestPwin}</span></span>
            </div>`;
        } else if (deltaHtml) {
            rows += `
            <div class="replay-analysis-row replay-analysis-sub">
                <span class="replay-analysis-label">↳ Delta</span>
                <span>${deltaHtml}</span>
            </div>`;
        }
    }

    // Explanation
    if (analysis.explanation) {
        rows += `
        <div class="replay-analysis-separator"></div>
        <div class="replay-analysis-explanation">
            <div class="replay-analysis-explanation-text">${_escapeHtml(analysis.explanation)}</div>
        </div>`;
    } else if (analysis.explanation_error) {
        rows += `
        <div class="replay-analysis-separator"></div>
        <div class="replay-analysis-row replay-analysis-explanation-error">
            <span class="replay-analysis-label" style="color:#e05555;">⚠</span>
            <span style="color:#e05555;font-size:0.85em;font-style:italic;">${_escapeHtml(analysis.explanation_error)}</span>
        </div>`;
    }

    return rows;
}

/**
 * Fetch /moves/analyze for the given step, using a cache to avoid
 * redundant requests when stepping through the replay.
 * @param {string} gameId
 * @param {number} step
 * @param {object|null} frame - Replay frame used for external-state analysis.
 * @returns {Promise<object|null>} AnalysisDTO or null on failure
 */
async function _fetchReplayAnalysis(gameId, step, frame = null) {
    const useExternalState = !!externalStateMode && frame?.state && frame?.action;
    const cacheKey = `${gameId}_${step}_${useExternalState ? 'external' : 'recording'}`;
    if (_analyzeCache[cacheKey] !== undefined) return _analyzeCache[cacheKey];
    try {
        const body = { game_id: gameId, step };
        if (useExternalState) {
            body.game_state = frame.state;
            body.action_taken = {
                action_type: frame.action.action_type,
                action_data: { value: frame.action.value },
                color: frame.action.color,
            };
        }
        const result = await api('POST', '/moves/analyze', body);
        _analyzeCache[cacheKey] = result || null;
        return _analyzeCache[cacheKey];
    } catch (e) {
        console.debug(`Replay analysis skipped for step ${step}:`, e.message);
        _analyzeCache[cacheKey] = null;
        return null;
    }
}

function _replayRenderEvalBar(frame, overridePwin = null) {
    // renderPlayers() wipes #players-panel on every step, destroying the eval
    // bar DOM. Always call renderEvalBar() to rebuild it. Use frame pwin first,
    // then any override (from async analysis). If no data is available, use the
    // EVAL_BAR_PENDING path to show "Evaluating…" rather than fabricating fake
    // equal-split percentages.
    const savedState = gameState;
    const savedPwin = lastPwin;
    try {
        gameState = frame.state;
        const pwinSource = frame.evaluate?.pwin_by_color || overridePwin;
        if (pwinSource) {
            lastPwin = pwinSource;
            renderEvalBar();
        } else {
            // No pwin data — show the pending/empty path from renderEvalBar().
            lastPwin = null;
            renderEvalBar(EVAL_BAR_PENDING);
        }
    } finally {
        gameState = savedState;
        lastPwin = savedPwin;
    }
}

function _escapeHtml(str) {
    if (typeof escapeHtml === 'function') return escapeHtml(str);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ── Integrate with winner overlay ────────────────────────────────────────

// Called after renderWinner() to show/hide the replay button
function _replayCheckAvailability() {
    const btn = document.getElementById('replay-btn');
    if (!btn) return;
    const replayGameId = _replayGameId();
    if (replayGameId && gameState?.winner) {
        // Check if recording exists (we check frame count with a quick API call)
        api('GET', `/games/${replayGameId}/recording/0`)
            .then(() => { btn.style.display = ''; })
            .catch(() => { btn.style.display = 'none'; });
    } else {
        btn.style.display = 'none';
    }
}

// ── "Review Previous Action" shortcut ──────────────────────────

// Open replay mode starting at the first frame of the previous action.
// Only callable from dev/local environments (button is hidden otherwise).
// Fetches the recording once; passes preloaded frames to enterReplayMode
// so no second round-trip is made and startAtStep is computed against the
// exact same frame list that replay will use.
async function reviewPreviousAction() {
    if (!currentGameId) return;
    const replayGameId = _replayGameId();
    let data;
    try {
        data = await api('GET', `/games/${replayGameId}/recording`);
    } catch (e) {
        log(`Could not load recording: ${e.message}`, 'error');
        return;
    }
    if (!data.frames || data.frames.length === 0) {
        log('No recording data available yet.', 'info');
        return;
    }
    // Previous step = max(action_step - 1, 0)
    const currentStep = gameState?.action_step ?? 0;
    const startAtStep = Math.max(currentStep - 1, 0);
    // Pass preloaded frames so enterReplayMode skips the redundant fetch.
    enterReplayMode({ startAtStep, frames: data.frames });
}

// Update the visibility and enabled state of the "Review Action" button.
// Visibility is controlled by the `enable_review_prev_turn` feature flag, surfaced
// as `featureReviewPrevAction` via /api/v1/version. Defaults on; LD can disable per-env.
// Called from fetchVersion() (flag resolved) and renderGame() (game state changes).
function updateReviewPrevActionBtnVisibility() {
    const btn = document.getElementById('review-prev-action-btn');
    if (!btn) return;

    // Never show when the feature flag is off — gate is final; do not set display:''.
    if (typeof featureReviewPrevAction === 'undefined' || !featureReviewPrevAction) {
        btn.style.display = 'none';
        return;
    }

    // Hide after the game ends (winner overlay takes over with the full replay btn).
    if (!currentGameId || gameState?.winner) {
        btn.style.display = 'none';
        return;
    }

    // Show the button in all live-game states.
    btn.style.display = '';
    const actionStep = gameState?.action_step ?? 0;
    if (actionStep < 1) {
        btn.disabled = true;
        btn.title = 'No previous action yet — still in initial build';
    } else {
        btn.disabled = false;
        btn.title = 'Open Game Replay at the previous action';
    }
}

// ── Board highlights (action taken / best action) ─────────────────────────

/**
 * Overlay SVG markers on the board for the action taken and best action.
 * Called after analysis resolves; skips gracefully when board SVG is absent.
 * @param {object|null} analysis - AnalysisDTO from /moves/analyze
 * @param {number} step - replay step this analysis belongs to (stale-guard)
 */
function _replayAddBoardHighlights(analysis, step) {
    if (!analysis || _replayStep !== step) return;

    // Remove any existing highlight elements from a previous step.
    document.querySelectorAll('.replay-taken-highlight, .replay-best-highlight').forEach(el => el.remove());

    const svg = document.getElementById('board-svg');
    if (!svg) return;

    const takenAction = analysis.action_taken;
    const bestAction = analysis.best_action;
    const isSameAction = takenAction?.description === bestAction?.description;

    // Draw best action first (underneath) so taken overlaps it when same position.
    if (bestAction && !isSameAction) _appendHighlightEl(svg, bestAction, true);
    if (takenAction) _appendHighlightEl(svg, takenAction, false);
}

/**
 * Append a single SVG highlight element (circle or line) for one action.
 * Uses createElementNS so the element renders correctly inside an SVG.
 * @param {SVGElement} svg
 * @param {object} action - ActionRecord with action_type and value
 * @param {boolean} isBest - true = best-action style, false = taken style
 */
function _appendHighlightEl(svg, action, isBest) {
    if (!action) return;
    const NS = 'http://www.w3.org/2000/svg';
    const at = (action.action_type || '').toUpperCase();
    const val = action.value;
    const label = action.description || at;
    const cls = isBest ? 'replay-best-highlight' : 'replay-taken-highlight';

    const isNode = at === 'BUILD_SETTLEMENT' || at === 'BUILD_CITY';
    const isEdge = at === 'BUILD_ROAD';

    if (isNode && val != null) {
        const nodeId = parseInt(val, 10);
        const pos = (typeof _nodePositionCache !== 'undefined') ? _nodePositionCache[nodeId] : null;
        if (!pos) return;
        const el = document.createElementNS(NS, 'circle');
        el.setAttribute('cx', pos.x);
        el.setAttribute('cy', pos.y);
        el.setAttribute('r', isBest ? 16 : 13);
        el.setAttribute('class', cls);
        el.addEventListener('mouseenter', e => showReplayBoardTooltip(e, label));
        el.addEventListener('mouseleave', hideReplayBoardTooltip);
        svg.appendChild(el);
    } else if (isEdge && Array.isArray(val) && val.length === 2) {
        const p1 = (typeof _nodePositionCache !== 'undefined') ? _nodePositionCache[parseInt(val[0], 10)] : null;
        const p2 = (typeof _nodePositionCache !== 'undefined') ? _nodePositionCache[parseInt(val[1], 10)] : null;
        if (!p1 || !p2) return;
        const el = document.createElementNS(NS, 'line');
        el.setAttribute('x1', p1.x);
        el.setAttribute('y1', p1.y);
        el.setAttribute('x2', p2.x);
        el.setAttribute('y2', p2.y);
        el.setAttribute('class', cls);
        el.addEventListener('mouseenter', e => showReplayBoardTooltip(e, label));
        el.addEventListener('mouseleave', hideReplayBoardTooltip);
        svg.appendChild(el);
    }
}

function showReplayBoardTooltip(event, text) {
    let tip = document.getElementById('replay-board-tooltip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'replay-board-tooltip';
        tip.className = 'replay-board-tooltip';
        document.body.appendChild(tip);
    }
    tip.textContent = text;
    tip.style.display = 'block';
    tip.style.left = (event.pageX + 12) + 'px';
    tip.style.top = (event.pageY - 8) + 'px';
}

function hideReplayBoardTooltip() {
    const tip = document.getElementById('replay-board-tooltip');
    if (tip) tip.style.display = 'none';
}
