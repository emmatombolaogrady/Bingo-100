// Bingo 100 Prototype
// Game model:
// - Numbers 1..100 are called without repetition.
// - Each ticket: 2 rows x 9 columns, 10 unique numbers on the ticket (1..100).
// - Full House: first ticket to mark all 10 numbers wins (30% RTP noted).
// - Total Score: per-ticket progress bar accumulates marked numbers' values, wraps >100 to 0.
//   After full house, find ticket with score 100 or closest to 100 for the 55% RTP prize.

(function () {
  const MAX_NUMBER = 100;
  const NUMBERS_PER_TICKET = 10;
  const TICKET_ROWS = 2;
  const TICKET_COLS = 9;
  // Column ranges mapping (index 0..8)
  const COLUMN_RANGES = [
    [1, 11],   // col 0: 1-11
    [12, 22],  // col 1: 12-22
    [23, 33],  // col 2: 23-33
    [34, 44],  // col 3: 34-44
    [45, 55],  // col 4: 45-55
    [56, 66],  // col 5: 56-66
    [67, 77],  // col 6: 67-77
    [78, 88],  // col 7: 78-88
    [89, 100], // col 8: 89-100
  ];

  const startBtn = document.getElementById('startBtn');
  const callBtn = document.getElementById('callBtn');
  const autoBtn = document.getElementById('autoBtn');
  const resetBtn = document.getElementById('resetBtn');
  const ticketCountInput = document.getElementById('ticketCount');
   const cpuCountInput = document.getElementById('cpuCount');
  const voiceToggle = document.getElementById('voiceToggle');
  const ticketsEl = document.getElementById('tickets');
  const calledListEl = document.getElementById('calledList');
  const callCountEl = document.getElementById('callCount');
  const statusEl = document.getElementById('status');
  const prizeModal = document.getElementById('prizeModal');
  const fullHouseWinnerEl = document.getElementById('fullHouseWinner');
  const totalScoreWinnerEl = document.getElementById('totalScoreWinner');
  const closePrizeBtn = document.getElementById('closePrize');
  const resetFromPrizeBtn = document.getElementById('resetFromPrize');
  const rptAmountsEl = document.getElementById('rptAmounts');
  const fullHouseAmountEl = document.getElementById('fullHouseAmount');
  const totalScoreAmountEl = document.getElementById('totalScoreAmount');
  const closestScoreEl = document.getElementById('closestScore');
  const closestTicketEl = document.getElementById('closestTicket');
  // Heartbeat feature removed per request

  let state = initialState();
  let autoTimer = null; // interval id for auto calling
  let voices = [];
  let selectedVoice = null;
  // Heartbeat manager removed

  function initialState() {
    return {
      tickets: [], // { id, numbers:Set, marks:Set, grid:number[][], score:number }
      callsPool: [], // remaining numbers to call
      called: [], // called numbers in order
      running: false,
      fullHouseWinner: null, // ticket id
      totalScoreWinner: null, // ticket id
  rtp: { total: 0, fullHouse: 0, totalScore: 0 },
  config: { ticketPrice: 0.10, ticketCountPerPlayer: 0, players: 0 },
    };
  }

  function resetGame() {
    state = initialState();
    ticketsEl.innerHTML = '';
    calledListEl.innerHTML = '';
  if (callCountEl) callCountEl.textContent = `0 of ${MAX_NUMBER}`;
    statusEl.innerHTML = '';
  if (closestScoreEl) closestScoreEl.textContent = '—';
  if (closestTicketEl) closestTicketEl.textContent = 'Ticket —';
    callBtn.disabled = true;
    autoBtn.disabled = true;
    stopAuto();
    hidePrizeModal();
    // Stop any ongoing speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    // Stop heartbeat if running
    // (heartbeat removed)
  }

  function startGame() {
    resetGame();
  const ticketCount = clamp(parseInt(ticketCountInput.value, 10) || 4, 1, 20);
     const cpuCount = clamp(parseInt(cpuCountInput.value, 10) || 1, 1, 100);
    state.callsPool = shuffle(range(1, MAX_NUMBER + 1));
    // Compute RTP based on players and tickets
    const players = 1 + cpuCount;
    state.config.ticketCountPerPlayer = ticketCount;
    state.config.players = players;
    computeRTP();
    renderRTPAmounts();
     // Generate tickets for Human (playerId 0)
     addPlayerTickets('You', 0, ticketCount);
     // Generate tickets for CPU players (playerId 1..cpuCount)
     for (let p = 1; p <= cpuCount; p++) {
       addPlayerTickets(`CPU ${p}`, p, ticketCount);
     }
    state.running = true;
    callBtn.disabled = false;
    autoBtn.disabled = false;
  statusEl.innerHTML = `<div class="note">Game started. Click "Call Next Number" to play.</div>`;
  if (callCountEl) callCountEl.textContent = `0 of ${MAX_NUMBER}`;
    // Initialize closest score view
    updateClosestPlayerScore();
    // Start heartbeat
    // (heartbeat removed)
  }

  function computeRTP() {
    const price = state.config.ticketPrice;
    const totalTickets = state.config.ticketCountPerPlayer * state.config.players;
    const totalRTPBase = totalTickets * price; // 100% RTP base
    const fullHouse = roundToPence(totalRTPBase * 0.30);
    const totalScore = roundToPence(totalRTPBase * 0.55);
    state.rtp = { total: totalRTPBase, fullHouse, totalScore };
  }

  function renderRTPAmounts() {
    if (rptAmountsEl) {
      rptAmountsEl.textContent = `— Base: ${currency(state.rtp.total)} | Full House: ${currency(state.rtp.fullHouse)} | Total Score: ${currency(state.rtp.totalScore)}`;
    }
  }

   function addPlayerTickets(label, playerId, count) {
     const sectionHeader = document.createElement('div');
     sectionHeader.className = 'player-section';
    // Keep a section anchor but hide text for human player (playerId 0)
    sectionHeader.dataset.playerId = String(playerId);
    if (playerId === 0) {
      sectionHeader.innerHTML = `<div class="player-header" style="display:none"></div>`;
    } else {
      sectionHeader.innerHTML = `<div class="player-header">${label} — ${count} ticket(s)</div>`;
    }
     ticketsEl.appendChild(sectionHeader);
     for (let i = 0; i < count; i++) {
       const ticket = generateTicket(`${playerId}-${i + 1}`);
       ticket.playerId = playerId;
       ticket.owner = label;
       state.tickets.push(ticket);
       ticketsEl.appendChild(renderTicket(ticket));
     }
   }

  function generateTicket(id) {
    // Build per-column pools according to COLUMN_RANGES
    const columnPools = COLUMN_RANGES.map(([min, max]) => range(min, max + 1));
    const columnCounts = Array(TICKET_COLS).fill(0); // max 2 per column
    const byColumn = Array.from({ length: TICKET_COLS }, () => []);

    const picked = new Set();
    // Pick 10 numbers respecting column ranges and capacity (<=2 per column)
    while (picked.size < NUMBERS_PER_TICKET) {
      // choose a column that still has capacity
      const availableCols = columnCounts
        .map((cnt, idx) => ({ cnt, idx }))
        .filter(c => c.cnt < 2 && columnPools[c.idx].length > 0);
      if (availableCols.length === 0) break; // safety
      const chosen = availableCols[Math.floor(Math.random() * availableCols.length)].idx;

      // pick a number from the chosen column not already picked
      const pool = columnPools[chosen];
      const candidate = pool[Math.floor(Math.random() * pool.length)];
      if (picked.has(candidate)) continue; // re-pick if duplicate
      picked.add(candidate);
      byColumn[chosen].push(candidate);
      columnCounts[chosen]++;
    }

    // If for any reason we didn't reach 10 (e.g., duplicates), fill deterministically
    for (let col = 0; picked.size < NUMBERS_PER_TICKET && col < TICKET_COLS; col++) {
      const pool = columnPools[col];
      for (const n of pool) {
        if (picked.size >= NUMBERS_PER_TICKET) break;
        if (columnCounts[col] >= 2) break;
        if (!picked.has(n)) {
          picked.add(n);
          byColumn[col].push(n);
          columnCounts[col]++;
        }
      }
    }

    // Sort numbers within each column for consistent display
    byColumn.forEach(arr => arr.sort((a, b) => a - b));

    // Build a 2x9 grid; assign numbers to rows keeping row counts balanced (5 each)
    const grid = Array.from({ length: TICKET_ROWS }, () => Array(TICKET_COLS).fill(null));
    let rowCounts = [0, 0];
    for (let col = 0; col < TICKET_COLS; col++) {
      const nums = byColumn[col];
      for (let i = 0; i < nums.length; i++) {
        // Place in the row that currently has fewer items; second goes to the other row
        let row;
        if (i === 0) {
          row = rowCounts[0] <= rowCounts[1] ? 0 : 1;
        } else {
          row = rowCounts[0] > rowCounts[1] ? 1 : 0;
        }
        // Ensure we don't exceed 5 per row; if exceeded, use the other row
        if (rowCounts[row] >= 5) row = 1 - row;
        if (rowCounts[row] < 5) {
          grid[row][col] = nums[i];
          rowCounts[row]++;
        }
      }
    }

    // Collect the numbers set from grid
    const numbers = [];
    for (let r = 0; r < TICKET_ROWS; r++) {
      for (let c = 0; c < TICKET_COLS; c++) {
        const v = grid[r][c];
        if (v != null) numbers.push(v);
      }
    }

    return {
      id,
      numbers: new Set(numbers),
      marks: new Set(),
      grid,
      score: 0,
    };
  }

  function renderTicket(ticket) {
    const wrap = document.createElement('div');
    wrap.className = 'ticket';
    wrap.dataset.id = String(ticket.id);

    const header = document.createElement('div');
    header.className = 'ticket-header';
    // Human player (playerId 0) ticket label: "Ticket X" instead of "Ticket #0-X"
    let ticketLabel;
    if (ticket.playerId === 0 && /^0-/.test(ticket.id)) {
      const seq = ticket.id.split('-')[1];
      ticketLabel = `Ticket ${seq}`;
    } else {
      ticketLabel = `Ticket #${ticket.id}`;
    }
    header.innerHTML = `<span>${ticketLabel}</span><span>Marked: <strong class="marked-count">0</strong> / ${NUMBERS_PER_TICKET}</span>`;

    const progress = document.createElement('div');
    progress.className = 'progress';
  progress.innerHTML = `<div class="bar"></div><div class="label">0</div><div class="overflow-msg">100+ time to reset!</div>`;

    const gridEl = document.createElement('div');
    gridEl.className = 'grid';

    for (let r = 0; r < TICKET_ROWS; r++) {
      for (let c = 0; c < TICKET_COLS; c++) {
        const n = ticket.grid[r][c];
  const cell = document.createElement('div');
  cell.className = 'cell' + (n ? '' : ' empty');
  cell.textContent = n ?? '';
  // Store numbers as strings for reliable DOM query matching
  cell.dataset.number = n != null ? String(n) : '';
        gridEl.appendChild(cell);
      }
    }

    wrap.appendChild(header);
    wrap.appendChild(progress);
    wrap.appendChild(gridEl);
    // Remaining numbers focused view (hidden initially)
    const remainEl = document.createElement('div');
    remainEl.className = 'remaining';
    wrap.appendChild(remainEl);
    return wrap;
  }

  function callNext() {
    if (!state.running) return;
    if (state.callsPool.length === 0) {
      statusEl.innerHTML = `<div class="note">All numbers have been called.</div>`;
      callBtn.disabled = true;
      return;
    }

    const n = state.callsPool.pop(); // take last for efficiency
    state.called.push(n);

    addCalledBall(n);
  if (callCountEl) callCountEl.textContent = `${state.called.length} of ${MAX_NUMBER}`;
    // Speak the called number (female voice) if enabled
    speakCalledNumber(n);

    // Defer marking and scoring by 1 second to add a brief suspense before updates
    setTimeout(() => {
      // Mark tickets and update scores after delay
      for (const ticket of state.tickets) {
        if (ticket.numbers.has(n)) {
          ticket.marks.add(n);
          updateTicketCell(ticket.id, n);
          updateMarkedCount(ticket.id, ticket.marks.size);
          const prev = ticket.score;
          const sum = prev + n;
          if (sum > 100) {
            // Animate to 100 slowly and pulse, then reset to 0
            animateOverflowToReset(ticket.id, prev);
            ticket.score = 0;
          } else {
            ticket.score = sum;
            updateProgress(ticket.id, ticket.score);
          }

          // Check full house
          if (!state.fullHouseWinner && ticket.marks.size >= NUMBERS_PER_TICKET) {
            state.fullHouseWinner = ticket.id;
            statusEl.innerHTML = `<div class=\"winner\">Full House! Ticket #${ticket.id} wins the Full House prize (30% RTP).</div>`;
            // Stop further calls and evaluate total score prize
            callBtn.disabled = true;
            autoBtn.disabled = true;
            state.running = false;
            stopAuto();
            evaluateTotalScorePrize();
            return; // stop processing further tickets after win
          }
        }
      }

      // Update closest score for player's tickets after delayed marking
      updateClosestPlayerScore();
      // Reorder only the player's tickets (playerId 0) by proximity to full house
      reorderPlayerTickets();
    }, 1000);

    // (auto-reorder removed by request)
  }

  function startAuto() {
    if (autoTimer || !state.running) return;
    autoBtn.textContent = 'Stop Auto';
    autoBtn.classList.add('active');
    autoTimer = setInterval(() => {
      if (!state.running) { stopAuto(); return; }
      callNext();
    }, 3000);
  }

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    autoBtn.textContent = 'Auto Call (3s)';
    autoBtn.classList.remove('active');
  }

  function animateOverflowToReset(ticketId, prevScore) {
    const ticketEl = ticketsEl.querySelector(`.ticket[data-id="${ticketId}"]`);
    if (!ticketEl) return;
    const progressEl = ticketEl.querySelector('.progress');
    const bar = ticketEl.querySelector('.progress .bar');
    const label = ticketEl.querySelector('.progress .label');
    const msg = ticketEl.querySelector('.progress .overflow-msg');

    // Prepare slow animation to 100
    progressEl.classList.add('slow');
    bar.style.background = 'var(--success)'; // near max feel
    bar.style.width = '100%';
    label.textContent = '100';

    // After slow fill, show message and pulse then reset to 0
    setTimeout(() => {
      progressEl.classList.add('pulse');
      progressEl.classList.add('show-msg');
      // Wait for pulse to finish, then reset
      setTimeout(() => {
        progressEl.classList.remove('pulse');
        // keep message for remaining duration to total 2s
        setTimeout(() => {
          progressEl.classList.remove('show-msg');
          progressEl.classList.remove('slow');
          bar.style.width = '0%';
          label.textContent = '0';
          bar.style.background = 'var(--warn)';
        }, 1200); // message visible to total 2s from start of show
      }, 800); // matches CSS pulse duration
    }, 800); // matches slow fill duration
  }

  function evaluateTotalScorePrize() {
    // Find ticket at 100 or closest to 100 (highest score <= 100 by proximity)
    const scores = state.tickets.map(t => ({ id: t.id, score: t.score }));
    // Prefer exact 100
    const exact = scores.find(s => s.score === 100);
    let winnerId;
    if (exact) {
      winnerId = exact.id;
    } else {
      // Closest to 100: choose the one with minimal (100 - score), i.e., max score
      const best = scores.reduce((a, b) => (b.score > a.score ? b : a));
      winnerId = best.id;
    }
    state.totalScoreWinner = winnerId;
    const totalWinner = state.tickets.find(t => String(t.id) === String(winnerId));
    const totalScoreVal = totalWinner ? totalWinner.score : 0;
    const totalWinnerLabel = totalWinner ? formatTicketLabel(totalWinner) : `Ticket #${winnerId}`;
    statusEl.innerHTML += `<div class=\"winner\">Total Score Prize! ${totalWinnerLabel} wins (55% RTP).` +
      `</div><div class=\"note\">Game over. Reset to play again.</div>`;

    // Show Prize UI
  const fhTicket = state.tickets.find(t => String(t.id) === String(state.fullHouseWinner));
  const fhText = fhTicket ? formatTicketLabel(fhTicket) : '—';
  const tsTicket = totalWinner;
  const tsText = tsTicket ? formatTicketLabel(tsTicket) : '—';
    fullHouseWinnerEl.textContent = fhText;
    totalScoreWinnerEl.textContent = tsText;
    // Fill prize amounts
    if (fullHouseAmountEl) fullHouseAmountEl.textContent = currency(state.rtp.fullHouse);
    if (totalScoreAmountEl) totalScoreAmountEl.textContent = currency(state.rtp.totalScore);
    showPrizeModal();
  }

  // Compute and render the player's (playerId 0) ticket score closest to 100
  function updateClosestPlayerScore() {
    if (!closestScoreEl || !closestTicketEl) return;
    const playerTickets = state.tickets.filter(t => t.playerId === 0);
    if (playerTickets.length === 0) {
      closestScoreEl.textContent = '—';
      closestTicketEl.textContent = 'Ticket —';
      return;
    }
    // Prefer exact 100; otherwise closest by difference (min (100 - score)) i.e. max score
    let best = null;
    for (const t of playerTickets) {
      if (!best) { best = t; continue; }
      const tIsExact = t.score === 100;
      const bIsExact = best.score === 100;
      if (tIsExact && !bIsExact) { best = t; continue; }
      if (!tIsExact && !bIsExact && t.score > best.score) { best = t; }
    }
    const scoreText = best ? String(best.score) : '—';
    let ticketText = 'Ticket —';
    if (best) {
      // For human player tickets (id pattern 0-X) show simplified label without '#0-'
      if (best.playerId === 0 && /^0-/.test(String(best.id))) {
        ticketText = `Ticket ${String(best.id).split('-')[1]}`;
      } else {
        ticketText = `Ticket #${best.id}`;
      }
    }
    closestScoreEl.textContent = scoreText;
    closestTicketEl.textContent = ticketText;
  }

  // Format a ticket label for display: for human player show 'Ticket N', for others 'Ticket #id'
  function formatTicketLabel(ticket) {
    const idStr = String(ticket.id);
    if (ticket.playerId === 0 && /^0-/.test(idStr)) {
      return `Ticket ${idStr.split('-')[1]}`;
    }
    return `Ticket #${idStr}`;
  }

  function addCalledBall(n) {
    const ball = document.createElement('div');
    ball.className = 'ball';
    ball.textContent = String(n);
    calledListEl.prepend(ball); // newest first
    // Mark the newest as current and clear previous current
    const children = Array.from(calledListEl.children);
    children.forEach((el, idx) => {
      if (idx === 0) {
        el.classList.add('current');
      } else {
        el.classList.remove('current');
      }
    });
    // Keep only the latest 4 (current + 3 previous)
    while (calledListEl.children.length > 4) {
      calledListEl.removeChild(calledListEl.lastElementChild);
    }
  }

  function updateTicketCell(ticketId, n) {
    const ticketEl = ticketsEl.querySelector(`.ticket[data-id="${ticketId}"]`);
    if (!ticketEl) return;
    const key = String(n);
    // Mark grid cell
    const cell = ticketEl.querySelector(`.cell[data-number="${key}"]`);
    if (cell) cell.classList.add('marked');
    // Remove from big-number remaining view if present
    const big = ticketEl.querySelector(`.remaining .big-number[data-number="${key}"]`);
    if (big) big.remove();
    updateRemainingView(ticketId);
  }

  function updateMarkedCount(ticketId, count) {
    const ticketEl = ticketsEl.querySelector(`.ticket[data-id="${ticketId}"]`);
    if (!ticketEl) return;
    const el = ticketEl.querySelector('.marked-count');
    if (el) el.textContent = String(count);
    updateRemainingView(ticketId);
  }

  function updateRemainingView(ticketId) {
    const ticket = state.tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    const remaining = Array.from(ticket.numbers).filter(n => !ticket.marks.has(n)).sort((a,b)=>a-b);
    const ticketEl = ticketsEl.querySelector(`.ticket[data-id="${ticketId}"]`);
    if (!ticketEl) return;
    const remainEl = ticketEl.querySelector('.remaining');
    const gridEl = ticketEl.querySelector('.grid');

    if (remaining.length <= 3 && remaining.length > 0) {
      // Switch to compact focused mode
      ticketEl.classList.add('compact');
      // Render big numbers
      remainEl.innerHTML = '';
      remaining.forEach(num => {
        const bn = document.createElement('div');
        bn.className = 'big-number';
        bn.textContent = String(num);
        bn.dataset.number = String(num);
        remainEl.appendChild(bn);
      });
    } else {
      // Show normal grid
      ticketEl.classList.remove('compact');
      remainEl.innerHTML = '';
    }

    // When a number gets marked and it's in big-number view, reflect it by removing it
    if (ticketEl.classList.contains('compact')) {
      // Remove big-number elements for those already marked
      remainEl.querySelectorAll('.big-number').forEach(el => {
        const num = parseInt(el.dataset.number, 10);
        if (ticket.marks.has(num)) {
          el.remove();
        }
      });
    }
  }

  // Compute remaining numbers for a ticket
  function remainingCount(ticket) {
    return NUMBERS_PER_TICKET - ticket.marks.size;
  }

  // Reorder only player's tickets (playerId 0) into groups: 1 left, 2 left, 3 left, others (4+)
  function reorderPlayerTickets() {
    // Find the human player's section by data attribute
    const playerSection = Array.from(ticketsEl.querySelectorAll('.player-section'))
      .find(sec => sec.dataset.playerId === '0');
    if (!playerSection) return;

    // Collect ticket nodes belonging to playerId 0
    const playerTicketNodes = Array.from(ticketsEl.querySelectorAll('.ticket')).filter(node => {
      const id = node.dataset.id;
      const t = state.tickets.find(tt => String(tt.id) === String(id));
      return t && t.playerId === 0;
    });
    if (playerTicketNodes.length === 0) return;

    // Group by remaining count
    const groups = { one: [], two: [], three: [], other: [] };
    for (const node of playerTicketNodes) {
      const id = node.dataset.id;
      const t = state.tickets.find(tt => String(tt.id) === String(id));
      if (!t) continue;
      const rem = remainingCount(t);
      if (rem === 1) groups.one.push(node);
      else if (rem === 2) groups.two.push(node);
      else if (rem === 3) groups.three.push(node);
      else groups.other.push(node);
    }

    const appendOrder = [...groups.one, ...groups.two, ...groups.three, ...groups.other];

    // Insert reordered player tickets immediately after their section header
    let anchor = playerSection.nextSibling;
    // Remove existing player tickets from DOM (to avoid duplicates)
    for (const node of playerTicketNodes) {
      ticketsEl.removeChild(node);
    }
    // Re-insert in desired order after the player section, before any other elements
    let insertAfter = playerSection;
    for (const node of appendOrder) {
      ticketsEl.insertBefore(node, insertAfter.nextSibling);
      insertAfter = node;
    }
  }

  // (ticket order remains static; removed auto-reorder functionality by request)

  function updateProgress(ticketId, score) {
    const ticketEl = ticketsEl.querySelector(`.ticket[data-id="${ticketId}"]`);
    if (!ticketEl) return;
    const bar = ticketEl.querySelector('.progress .bar');
    const label = ticketEl.querySelector('.progress .label');
    const percent = Math.min(score, 100);
    bar.style.width = percent + '%';
    label.textContent = String(score);
    // Turn green at >= 75
    if (score >= 75) {
      bar.style.background = 'var(--success)';
    } else {
      bar.style.background = 'var(--warn)';
    }
    // Reset to 0 visually if exceeded
    if (score === 0) {
      bar.style.width = '0%';
      label.textContent = '0';
    }
  }

  // Utils
  function range(a, b) { // [a, b)
    const out = [];
    for (let i = a; i < b; i++) out.push(i);
    return out;
  }
  function shuffle(arr) {
    // Fisher–Yates
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function currency(n) { return `£${n.toFixed(2)}`; }
  function roundToPence(n) { return Math.round(n * 100) / 100; }

  // Wire events
  startBtn.addEventListener('click', startGame);
  resetBtn.addEventListener('click', resetGame);
  callBtn.addEventListener('click', callNext);
  autoBtn.addEventListener('click', () => {
    if (autoTimer) stopAuto(); else startAuto();
  });
  closePrizeBtn.addEventListener('click', hidePrizeModal);
  resetFromPrizeBtn.addEventListener('click', () => { hidePrizeModal(); resetGame(); });
  if (voiceToggle) {
    voiceToggle.addEventListener('change', () => {
      // Cancel any ongoing speech when toggling off
      if (!voiceToggle.checked && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    });
  }
  if (heartbeatToggle) {
    // (heartbeat toggle removed)
  }

  // Voice setup
  if (window.speechSynthesis) {
    const loadVoices = () => {
      voices = window.speechSynthesis.getVoices();
      // Try to select a female voice heuristically; fallback to default
      selectedVoice = selectFemaleVoice(voices);
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }

  function selectFemaleVoice(list) {
    if (!list || list.length === 0) return null;
    // Strongly prefer known female voices on macOS/iOS and common engines
    const preferredFemales = [
      'Samantha','Victoria','Karen','Serena','Moira','Kate','Tessa','Zoe','Natasha','Susan','Ava','Allison','Amy','Anna','Kathy','Jessica','Nora','Fiona'
    ];
    const maleHints = /(male|man|boy|daniel|alex|fred|arthur|james|tom|george|liam|ryan)/i;
    const femaleHints = /(female|woman|girl)/i;
    const langHints = /(en-GB|en-US|en-AU|en)/i;
    // Rank voices by: preferredFemales > femaleHints > English language > others
    const scored = list.map(v => {
      const name = v.name || '';
      const uri = String(v.voiceURI || '');
      let score = 0;
      if (preferredFemales.some(n => name.toLowerCase().includes(n.toLowerCase()))) score += 100;
      if (femaleHints.test(name) || femaleHints.test(uri)) score += 20;
      if (langHints.test(v.lang)) score += 10;
      if (maleHints.test(name) || maleHints.test(uri)) score -= 50;
      if (!v.localService) score += 5; // prefer non-local for consistency
      return { v, score };
    });
    scored.sort((a,b)=>b.score-a.score);
    const best = scored[0]?.v || null;
    return best;
  }

  function speakCalledNumber(n) {
    if (!voiceToggle || !voiceToggle.checked) return;
    if (!window.speechSynthesis) return;
    // If current voice appears male, try re-selecting a female voice
    if (selectedVoice) {
      const malePattern = /(male|man|boy|daniel|alex|fred|arthur|james|tom|george|liam|ryan)/i;
      if (malePattern.test(String(selectedVoice.name)) || malePattern.test(String(selectedVoice.voiceURI))) {
        const voicesList = window.speechSynthesis.getVoices();
        const newSel = selectFemaleVoice(voicesList);
        if (newSel) selectedVoice = newSel;
      }
    } else {
      const voicesList = window.speechSynthesis.getVoices();
      const newSel = selectFemaleVoice(voicesList);
      if (newSel) selectedVoice = newSel;
    }
  // Speak only the number itself; adjust to a friendlier but less raised pitch.
  const utter = new SpeechSynthesisUtterance(String(n));
  if (selectedVoice) utter.voice = selectedVoice;
  // Keep mild energy but lower pitch significantly (near natural female range).
  utter.rate = 1.12; // slightly above normal for snappiness
  utter.pitch = 1.05 + Math.random() * 0.05; // subtle variance 1.05–1.10
  utter.volume = 1.0;
    window.speechSynthesis.cancel(); // prevent overlap stacking
    window.speechSynthesis.speak(utter);
  }

  // Modal helpers
  function showPrizeModal() {
    prizeModal.classList.add('show');
    prizeModal.setAttribute('aria-hidden', 'false');
  }
  function hidePrizeModal() {
    prizeModal.classList.remove('show');
    prizeModal.setAttribute('aria-hidden', 'true');
  }
})();
