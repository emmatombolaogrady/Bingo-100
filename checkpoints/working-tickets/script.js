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

  const startBtn = document.getElementById('startBtn');
  const callBtn = document.getElementById('callBtn');
  const autoBtn = document.getElementById('autoBtn');
  const resetBtn = document.getElementById('resetBtn');
  const ticketCountInput = document.getElementById('ticketCount');
   const cpuCountInput = document.getElementById('cpuCount');
  const ticketsEl = document.getElementById('tickets');
  const calledListEl = document.getElementById('calledList');
  const lastCallEl = document.getElementById('lastCall');
  const statusEl = document.getElementById('status');
  const prizeModal = document.getElementById('prizeModal');
  const fullHouseWinnerEl = document.getElementById('fullHouseWinner');
  const totalScoreWinnerEl = document.getElementById('totalScoreWinner');
  const closePrizeBtn = document.getElementById('closePrize');
  const resetFromPrizeBtn = document.getElementById('resetFromPrize');
  const rptAmountsEl = document.getElementById('rptAmounts');
  const fullHouseAmountEl = document.getElementById('fullHouseAmount');
  const totalScoreAmountEl = document.getElementById('totalScoreAmount');

  let state = initialState();
  let autoTimer = null; // interval id for auto calling

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
    lastCallEl.textContent = '—';
    statusEl.innerHTML = '';
    callBtn.disabled = true;
    autoBtn.disabled = true;
    stopAuto();
    hidePrizeModal();
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
     sectionHeader.innerHTML = `<div class="player-header">${label} — ${count} ticket(s)</div>`;
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
    // Pick 10 unique numbers from 1..100
    const pool = range(1, MAX_NUMBER + 1);
    const picked = new Set();
    while (picked.size < NUMBERS_PER_TICKET) {
      picked.add(pool[Math.floor(Math.random() * pool.length)]);
    }
    const numbers = Array.from(picked).sort((a, b) => a - b);
    // Build a 2x9 grid ensuring exactly 5 numbers per row (total 10).
    // To keep a pleasant spread, pick 5 distinct columns for row 0 and 5 distinct columns for row 1.
    const grid = Array.from({ length: TICKET_ROWS }, () => Array(TICKET_COLS).fill(null));
    const cols = shuffle(range(0, TICKET_COLS)); // 0..8 shuffled
    const row0Cols = cols.slice(0, 5).sort((a, b) => a - b);
    const row1Cols = cols.slice(5, 10).sort((a, b) => a - b);

    // Place first 5 numbers on row 0, next 5 on row 1.
    for (let i = 0; i < 5; i++) {
      grid[0][row0Cols[i]] = numbers[i];
    }
    for (let i = 0; i < 5; i++) {
      grid[1][row1Cols[i]] = numbers[i + 5];
    }

    return {
      id,
      numbers: new Set(numbers),
      marks: new Set(),
      grid,
      score: 0, // total score progress (0..100 with wrap)
    };
  }

  function renderTicket(ticket) {
    const wrap = document.createElement('div');
    wrap.className = 'ticket';
    wrap.dataset.id = String(ticket.id);

    const header = document.createElement('div');
    header.className = 'ticket-header';
    header.innerHTML = `<span>Ticket #${ticket.id}</span><span>Marked: <strong class="marked-count">0</strong> / ${NUMBERS_PER_TICKET}</span>`;

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
        cell.dataset.number = n ?? '';
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
    lastCallEl.textContent = String(n);

    // Mark tickets and update scores
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
          statusEl.innerHTML = `<div class="winner">Full House! Ticket #${ticket.id} wins the Full House prize (30% RTP).</div>`;
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
    statusEl.innerHTML += `<div class=\"winner\">Total Score Prize! Ticket #${winnerId} wins (55% RTP) — Score: ${totalScoreVal}.` +
      `</div><div class=\"note\">Game over. Reset to play again.</div>`;

    // Show Prize UI
    const fhTicket = state.tickets.find(t => String(t.id) === String(state.fullHouseWinner));
    const fhScoreVal = fhTicket ? fhTicket.score : 0;
    const fhText = state.fullHouseWinner ? `Ticket #${state.fullHouseWinner} (Score: ${fhScoreVal})` : '—';
    const tsText = state.totalScoreWinner ? `Ticket #${state.totalScoreWinner} (Score: ${totalScoreVal})` : '—';
    fullHouseWinnerEl.textContent = fhText;
    totalScoreWinnerEl.textContent = tsText;
    // Fill prize amounts
    if (fullHouseAmountEl) fullHouseAmountEl.textContent = currency(state.rtp.fullHouse);
    if (totalScoreAmountEl) totalScoreAmountEl.textContent = currency(state.rtp.totalScore);
    showPrizeModal();
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
    const cell = ticketEl.querySelector(`.cell[data-number="${n}"]`);
    if (cell) cell.classList.add('marked');
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
