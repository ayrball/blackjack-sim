document.addEventListener('DOMContentLoaded', () => {
  let counter = new window.CardCounter();
  let analytics = new window.Analytics();
  let betting = new window.BettingSystem();
  const game = new window.BlackjackGame();
  const strategy = new window.BasicStrategy();

  const DEAL_DELAY = 220;  // ms between cards on the initial deal
  const BOT_DELAY = 550;   // ms between simulated players' actions
  const MAX_BOTS = 5;

  const state = {
    phase: 'betting',
    seats: [],          // per spot this round: { owner: 'you' | 'bot', label }
    turn: null,         // { spot, hand } whose turn it is, or null
    insuranceBet: 0,
    awaitingInsurance: false,
    actionLock: false,
    strategyEnabled: false,
    minBet: 5,
    maxBet: 500,
    startingBankroll: 1000,
    numHands: 1,        // your hands per round (1 or 2)
    numBots: 0,         // simulated players sharing the table
    deviationsEnabled: false
  };

  // Cards currently visible on the table, and those that already played their deal animation
  let shownCards = new WeakSet();
  let animatedCards = new WeakSet();

  // UI Elements
  const elBankrollAmount = document.getElementById('bankroll-amount');
  const elBetAmount = document.getElementById('bet-amount');
  const elBetChipsVisual = document.getElementById('bet-chips-visual');
  const elBettingSection = document.getElementById('betting-section');
  const elActionButtons = document.getElementById('action-buttons');
  const elDealerCards = document.getElementById('dealer-cards');
  const elDealerScore = document.getElementById('dealer-score');
  const elPlayerHandsContainer = document.getElementById('player-hands-container');
  const elGameMessage = document.getElementById('game-message');

  // Counting UI
  const elRunningCount = document.getElementById('running-count');
  const elTrueCount = document.getElementById('true-count');
  const elCardsRemaining = document.getElementById('cards-remaining');
  const elDecksRemaining = document.getElementById('decks-remaining');
  const elDeckPenetration = document.getElementById('deck-penetration');
  const elSuggestedBet = document.getElementById('suggested-bet');
  const elPlayerEdge = document.getElementById('player-edge');
  const elCardGrid = document.getElementById('card-grid');

  // Analytics UI
  const elStatHands = document.getElementById('stat-hands');
  const elStatWins = document.getElementById('stat-wins');
  const elStatLosses = document.getElementById('stat-losses');
  const elStatPushes = document.getElementById('stat-pushes');
  const elStatBlackjacks = document.getElementById('stat-blackjacks');
  const elStatWinrate = document.getElementById('stat-winrate');
  const elStatWagered = document.getElementById('stat-wagered');
  const elStatPnl = document.getElementById('stat-pnl');
  const canvasChart = document.getElementById('bankroll-chart');

  const elShoeProgress = document.getElementById('shoe-progress');
  const elShoeLabel = document.getElementById('shoe-label');

  const suitSymbols = { 'hearts': '♥', 'diamonds': '♦', 'clubs': '♣', 'spades': '♠' };
  const isTenRank = r => ['10', 'J', 'Q', 'K'].includes(r);

  function init() {
    setupEventListeners();
    updateBankroll();
    updateBetDisplay();
    updateCountingPanel();
    updateAnalyticsPanel();
    updateShoeIndicator();
    updateHandsToggle();
    setPhase('betting');
  }

  function setupEventListeners() {
    document.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.phase !== 'betting') return;
        const val = parseInt(btn.dataset.value);
        if (betting.addChip(val)) {
          updateBetDisplay();
          updateBankroll();
          btn.style.transform = 'scale(1.1)';
          setTimeout(() => btn.style.transform = 'scale(1)', 100);
        }
      });
    });

    document.getElementById('clear-bet-btn').addEventListener('click', () => {
      if (state.phase === 'betting') {
        betting.clearBet();
        updateBetDisplay();
      }
    });

    document.getElementById('repeat-bet-btn').addEventListener('click', () => {
      if (state.phase === 'betting') {
        if (betting.repeatBet()) {
          updateBetDisplay();
        }
      }
    });

    document.querySelectorAll('#hands-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.phase !== 'betting') return;
        state.numHands = parseInt(btn.dataset.hands);
        betting.setHands(state.numHands);
        updateHandsToggle();
        updateBetDisplay();
      });
    });

    document.getElementById('deal-btn').addEventListener('click', () => {
      if (state.phase === 'betting' && betting.isBetValid()) {
        startRound();
      }
    });

    document.getElementById('btn-hit').addEventListener('click', () => {
      if (canPlayHand()) playerHit();
    });

    document.getElementById('btn-stand').addEventListener('click', () => {
      if (canPlayHand()) playerStand();
    });

    document.getElementById('btn-double').addEventListener('click', () => {
      if (canPlayHand()) playerDouble();
    });

    document.getElementById('btn-split').addEventListener('click', () => {
      if (canPlayHand()) playerSplit();
    });

    document.getElementById('btn-insurance').addEventListener('click', () => {
      if (state.phase === 'playing' && state.awaitingInsurance) playerInsurance();
    });

    document.getElementById('btn-no-insurance').addEventListener('click', () => {
      if (state.phase === 'playing' && state.awaitingInsurance) peekAndContinue();
    });

    document.getElementById('toggle-counting').addEventListener('click', (e) => {
      document.getElementById('counting-panel').classList.toggle('hidden');
      e.currentTarget.classList.toggle('active');
    });

    document.getElementById('toggle-strategy').addEventListener('click', (e) => {
      state.strategyEnabled = !state.strategyEnabled;
      e.currentTarget.classList.toggle('active');
      updateStrategyAdvisor();
    });

    document.getElementById('toggle-analytics').addEventListener('click', (e) => {
      document.getElementById('analytics-panel').classList.toggle('hidden');
      e.currentTarget.classList.toggle('active');
      if (!document.getElementById('analytics-panel').classList.contains('hidden')) {
        analytics.drawChart(canvasChart);
      }
    });

    document.getElementById('new-shoe-btn').addEventListener('click', () => {
      if (!requireBettingPhase()) return;
      game.initShoe();
      counter.reset();
      updateCountingPanel();
      updateShoeIndicator();
      flashMessage('New Shoe Shuffled');
    });

    // Settings modal
    document.getElementById('open-settings-btn').addEventListener('click', () => {
      if (!requireBettingPhase()) return;
      document.getElementById('setting-min-bet').value = state.minBet;
      document.getElementById('setting-max-bet').value = state.maxBet;
      document.getElementById('setting-bankroll').value = state.startingBankroll;
      document.getElementById('setting-bots').value = state.numBots;
      document.getElementById('setting-deviations').checked = state.deviationsEnabled;
      updateBetSpreadPreview();
      document.getElementById('settings-overlay').classList.remove('hidden');
    });

    document.getElementById('close-settings-btn').addEventListener('click', () => {
      document.getElementById('settings-overlay').classList.add('hidden');
    });

    document.getElementById('settings-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('settings-overlay').classList.add('hidden');
      }
    });

    // Live preview of bet spread when min/max inputs change
    document.getElementById('setting-min-bet').addEventListener('input', updateBetSpreadPreview);
    document.getElementById('setting-max-bet').addEventListener('input', updateBetSpreadPreview);

    document.getElementById('settings-save-btn').addEventListener('click', () => {
      if (!requireBettingPhase()) {
        document.getElementById('settings-overlay').classList.add('hidden');
        return;
      }
      const newMin = Math.max(1, parseInt(document.getElementById('setting-min-bet').value) || 5);
      const newMax = Math.max(newMin, parseInt(document.getElementById('setting-max-bet').value) || 500);
      const newBankroll = Math.max(newMin, parseInt(document.getElementById('setting-bankroll').value) || 1000);
      const newBots = Math.min(MAX_BOTS, Math.max(0, parseInt(document.getElementById('setting-bots').value) || 0));

      // Table options apply straight away; only bankroll/limit changes reset the session
      state.numBots = newBots;
      state.deviationsEnabled = document.getElementById('setting-deviations').checked;

      const moneyChanged = newMin !== state.minBet || newMax !== state.maxBet || newBankroll !== state.startingBankroll;
      if (moneyChanged) {
        state.minBet = newMin;
        state.maxBet = newMax;
        state.startingBankroll = newBankroll;

        betting = new window.BettingSystem(newBankroll, newMin, newMax);
        betting.setHands(state.numHands);
        analytics = new window.Analytics(newBankroll);
        counter.reset();
        game.initShoe();

        updateBankroll();
        updateBetDisplay();
        updateCountingPanel();
        updateAnalyticsPanel();
        updateShoeIndicator();
      }

      document.getElementById('settings-overlay').classList.add('hidden');
      flashMessage(moneyChanged ? 'Settings Applied: New Session' : 'Settings Applied');
    });
  }

  // Shoe and bankroll changes are only allowed between hands
  function requireBettingPhase() {
    if (state.phase === 'betting') return true;
    // Don't cover the result banner; the betting phase is a moment away
    if (state.phase !== 'result') {
      flashMessage('Finish the current hand first');
    }
    return false;
  }

  function setPhase(newPhase) {
    state.phase = newPhase;
    if (newPhase === 'betting') {
      elBettingSection.classList.remove('hidden');
      elActionButtons.classList.add('hidden');
      updateDealButton();
    } else if (newPhase === 'playing') {
      elBettingSection.classList.add('hidden');
      elActionButtons.classList.remove('hidden');
      updateActionButtons();
    } else {
      elBettingSection.classList.add('hidden');
      elActionButtons.classList.add('hidden');
    }
    updateStrategyAdvisor();
  }

  // ==================== SEATS & TURNS ====================

  // Simulated players sit on both sides of you; your hands are adjacent seats.
  function buildSeats() {
    const before = Math.ceil(state.numBots / 2);
    const after = state.numBots - before;
    const seats = [];
    let botNo = 1;
    for (let i = 0; i < before; i++) seats.push({ owner: 'bot', label: `P${botNo++}` });
    for (let i = 0; i < state.numHands; i++) {
      seats.push({ owner: 'you', label: state.numHands > 1 ? `YOU ${i + 1}` : 'YOU' });
    }
    for (let i = 0; i < after; i++) seats.push({ owner: 'bot', label: `P${botNo++}` });
    return seats;
  }

  function isMine(spotIndex) {
    return state.seats[spotIndex] && state.seats[spotIndex].owner === 'you';
  }

  function myHands() {
    const gs = game.getState();
    if (!gs) return [];
    return gs.spots.filter((_, s) => isMine(s)).flatMap(spot => spot.hands);
  }

  function currentHand() {
    return state.turn ? game.getHand(state.turn.spot, state.turn.hand) : null;
  }

  function isMyTurn() {
    return state.phase === 'playing' && !!state.turn && isMine(state.turn.spot);
  }

  // True when the player may act on the current hand (not mid-transition)
  function canPlayHand() {
    return isMyTurn() && !state.awaitingInsurance && !state.actionLock;
  }

  // First unfinished hand in seat order. Earlier hands are always finished,
  // so scanning from the start also picks up hands created by splits.
  function findNextTurn() {
    const spots = game.getState().spots;
    for (let s = 0; s < spots.length; s++) {
      for (let h = 0; h < spots[s].hands.length; h++) {
        if (!spots[s].hands[h].isStood) return { spot: s, hand: h };
      }
    }
    return null;
  }

  function advance() {
    if (state.phase !== 'playing') return;
    state.actionLock = false;
    state.turn = findNextTurn();
    renderTable();

    if (!state.turn) {
      startDealerPhase();
      return;
    }
    if (!isMine(state.turn.spot)) {
      lockActions();
      setTimeout(botAct, BOT_DELAY);
      return;
    }
    updateActionButtons();
    updateStrategyAdvisor();
  }

  // Ignore input until the next turn starts, so a quick click can't act twice
  function lockActions() {
    state.actionLock = true;
    ['btn-hit', 'btn-stand', 'btn-double', 'btn-split'].forEach(id => {
      document.getElementById(id).disabled = true;
    });
    updateStrategyAdvisor();
  }

  function advanceAfterDelay(ms) {
    lockActions();
    setTimeout(advance, ms);
  }

  // Simulated players play perfect basic strategy (no count, no insurance)
  function botAct() {
    if (state.phase !== 'playing' || !state.turn) return;
    const { spot, hand } = state.turn;
    const h = game.getHand(spot, hand);
    const upcard = game.getState().dealerCards[0].rank;
    const rec = strategy.getRecommendation(h.cards, upcard, game.canDouble(spot, hand), game.canSplit(spot, hand));

    if (rec.code === 'P') {
      showCards(...game.split(spot, hand));
    } else if (rec.code === 'D') {
      showCards(game.double(spot, hand));
    } else if (rec.code === 'H') {
      showCards(game.hit(spot, hand));
    } else {
      game.stand(spot, hand);
    }
    renderTable();
    setTimeout(advance, BOT_DELAY);
  }

  // ==================== ROUND FLOW ====================

  function startRound() {
    const shuffled = game.needsShuffle();
    if (shuffled) {
      game.initShoe();
      counter.reset();
    }

    const betPerHand = betting.placeBet();
    if (!betPerHand) return;

    state.seats = buildSeats();
    state.turn = null;
    state.insuranceBet = 0;
    state.awaitingInsurance = false;
    state.actionLock = false;
    shownCards = new WeakSet();
    animatedCards = new WeakSet();

    updateBankroll();
    updateBetDisplay();
    hideMessage();
    if (shuffled) flashMessage('Shoe Shuffled');

    const dealOrder = game.startRound(state.seats.length);
    game.getState().spots.forEach((spot, s) => {
      if (isMine(s)) spot.hands[0].bet = betPerHand;
    });

    setPhase('dealing');
    renderTable();

    let delay = 150;
    dealOrder.forEach(step => {
      setTimeout(() => {
        shownCards.add(step.card);
        if (!step.hole) counter.countCard(step.card.rank);
        renderTable();
        updateCountingPanel();
        updateShoeIndicator();
      }, delay);
      delay += DEAL_DELAY;
    });
    setTimeout(afterDeal, delay);
  }

  // Insurance is offered when the dealer shows an Ace; then the dealer peeks.
  function afterDeal() {
    setPhase('playing');
    const upcard = game.getState().dealerCards[0].rank;
    const needsDecision = upcard === 'A' && myHands().some(h => !h.hasBlackjack);
    if (needsDecision) {
      state.awaitingInsurance = true;
      updateActionButtons();
      updateStrategyAdvisor();
      return;
    }
    peekAndContinue();
  }

  function insuranceCost() {
    return myHands().filter(h => !h.hasBlackjack).reduce((sum, h) => sum + h.bet / 2, 0);
  }

  function playerInsurance() {
    const cost = insuranceCost();
    if (betting.withdraw(cost)) {
      state.insuranceBet = cost;
      updateBankroll();
    }
    peekAndContinue();
  }

  // Dealer checks for blackjack under an Ace or ten before anyone plays
  function peekAndContinue() {
    state.awaitingInsurance = false;
    const upcard = game.getState().dealerCards[0].rank;
    if ((upcard === 'A' || isTenRank(upcard)) && game.dealerHasBlackjack()) {
      revealHoleCard();
      resolveGame();
      return;
    }
    advance();
  }

  function revealHoleCard() {
    const hole = game.revealHole();
    counter.countCard(hole.rank);
    renderTable();
    updateCountingPanel();
  }

  // Put newly drawn cards on the table and into the count
  function showCards(...cards) {
    cards.forEach(card => {
      if (!card) return;
      shownCards.add(card);
      counter.countCard(card.rank);
    });
    updateCountingPanel();
    updateShoeIndicator();
  }

  function playerHit() {
    const { spot, hand } = state.turn;
    const card = game.hit(spot, hand);
    if (!card) return;
    showCards(card);
    afterPlayerAction();
  }

  function playerStand() {
    game.stand(state.turn.spot, state.turn.hand);
    afterPlayerAction();
  }

  function playerDouble() {
    const { spot, hand } = state.turn;
    const h = currentHand();
    if (!game.canDouble(spot, hand) || !betting.withdraw(h.bet)) return;
    h.bet *= 2;
    updateBankroll();
    showCards(game.double(spot, hand));
    afterPlayerAction();
  }

  function playerSplit() {
    const { spot, hand } = state.turn;
    const h = currentHand();
    if (!game.canSplit(spot, hand) || !betting.withdraw(h.bet)) return;
    updateBankroll();
    showCards(...game.split(spot, hand));
    afterPlayerAction();
  }

  function afterPlayerAction() {
    renderTable();
    if (currentHand().isStood) {
      advanceAfterDelay(450);
    } else {
      updateActionButtons();
      updateStrategyAdvisor();
    }
  }

  function startDealerPhase() {
    if (state.phase !== 'playing') return;
    setPhase('dealer');
    state.turn = null;
    revealHoleCard();

    // The dealer only draws if some hand at the table is still live
    const anyLive = game.getState().spots.some(spot =>
      spot.hands.some(h => !h.isBusted && !h.hasBlackjack));
    if (!anyLive) {
      setTimeout(resolveGame, 500);
      return;
    }

    let delay = 500;
    game.dealerPlay().forEach(card => {
      setTimeout(() => {
        showCards(card);
        renderTable();
      }, delay);
      delay += 500;
    });
    setTimeout(resolveGame, delay + 200);
  }

  function resolveGame() {
    if (state.phase === 'result') return;
    setPhase('result');
    state.turn = null;
    const gs = game.getState();
    const dealerBJ = game.dealerHasBlackjack();

    let totalPayout = 0;
    let totalBet = 0;
    const resultMsg = [];
    let hasWin = false;
    let hasLoss = false;
    let hasBJ = false;

    if (state.insuranceBet > 0) {
      if (dealerBJ) {
        totalPayout += state.insuranceBet * 3;
        resultMsg.push(`Insurance pays ${formatMoney(state.insuranceBet * 2)}`);
      } else {
        resultMsg.push('Insurance lost');
      }
    }

    const handMsgs = [];
    gs.spots.forEach((spot, s) => {
      spot.hands.forEach(hand => {
        const res = game.getHandResult(hand.cards, gs.dealerCards, hand.hasBlackjack, dealerBJ);
        hand.result = res;
        if (!isMine(s)) return;

        const payout = hand.bet * game.getPayoutMultiplier(res);
        totalPayout += payout;
        totalBet += hand.bet;

        if (res === 'blackjack') { hasBJ = true; hasWin = true; }
        else if (res === 'win') { hasWin = true; }
        else if (res === 'loss') { hasLoss = true; }

        if (res === 'blackjack') handMsgs.push(`Blackjack! +${formatMoney(payout - hand.bet)}`);
        else if (res === 'win') handMsgs.push(`Win +${formatMoney(payout - hand.bet)}`);
        else if (res === 'push') handMsgs.push('Push');
        else handMsgs.push(hand.isBusted ? 'Bust' : 'Loss');
      });
    });

    // With several hands, show the net; each hand's result is on its badge
    if (handMsgs.length === 1) {
      resultMsg.push(handMsgs[0]);
    } else {
      const net = totalPayout - totalBet - state.insuranceBet;
      resultMsg.push(net === 0 ? 'Net: Even' : `Net ${net > 0 ? '+' : '-'}${formatMoney(Math.abs(net))}`);
    }

    if (totalPayout > 0) {
      betting.payout(totalPayout);
    }

    // Record as single analytics entry for the overall round
    const overallOutcome = hasBJ ? 'blackjack' : hasWin ? 'win' : (totalPayout > 0 && !hasLoss) ? 'push' : 'loss';
    analytics.recordHand({
      bet: totalBet + state.insuranceBet,
      outcome: overallOutcome,
      payout: totalPayout,
      bankrollAfter: betting.getBankroll()
    });

    renderTable();
    updateBankroll();
    updateAnalyticsPanel();

    const msgType = hasBJ ? 'blackjack' : hasWin ? 'win' : (totalPayout >= totalBet && !hasLoss) ? 'push' : 'loss';
    showMessage(resultMsg.join(' | '), msgType);

    setTimeout(() => {
      setPhase('betting');
      betting.clearBet();
      updateBetDisplay();
      hideMessage();
      if (betting.getBankroll() < state.minBet) {
        showMessage('Out of chips: open Settings to reset your bankroll', 'loss');
      }
    }, 2500);
  }

  // ==================== RENDERING ====================

  function createCardElement(card, faceDown = false) {
    const div = document.createElement('div');
    const colorClass = (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black';
    const animate = !animatedCards.has(card);
    animatedCards.add(card);
    div.className = `card ${faceDown ? 'face-down' : ''} ${animate ? 'dealing' : ''} ${colorClass}`;
    if (!faceDown) {
      div.dataset.suit = card.suit;
      div.dataset.rank = card.rank;
    }

    const suitSym = faceDown ? '' : suitSymbols[card.suit];
    const rank = faceDown ? '' : card.rank;

    div.innerHTML = `
      <div class="card-inner">
        <div class="card-front">
          <span class="card-corner top-left">
            <span class="card-rank">${rank}</span>
            <span class="card-suit-symbol">${suitSym}</span>
          </span>
          <span class="card-center-pip">${suitSym}</span>
          <span class="card-corner bottom-right">
            <span class="card-rank">${rank}</span>
            <span class="card-suit-symbol">${suitSym}</span>
          </span>
        </div>
        <div class="card-back"></div>
      </div>
    `;

    if (animate) {
      setTimeout(() => div.classList.remove('dealing'), 400);
    }
    return div;
  }

  function renderTable() {
    const gs = game.getState();
    if (!gs) return;

    elDealerCards.innerHTML = '';
    gs.dealerCards.forEach((card, i) => {
      if (!shownCards.has(card)) return;
      elDealerCards.appendChild(createCardElement(card, i === 1 && gs.dealerHoleHidden));
    });
    updateDealerScore();

    const spotCount = gs.spots.length;
    elPlayerHandsContainer.className =
      (spotCount >= 6 ? 'packed ' : spotCount >= 3 ? 'crowded ' : '') +
      (state.phase === 'playing' && state.turn ? 'in-play' : '');
    elPlayerHandsContainer.innerHTML = '';

    gs.spots.forEach((spot, s) => {
      const seat = state.seats[s];
      const seatDiv = document.createElement('div');
      seatDiv.className = `seat ${seat.owner}`;

      const label = document.createElement('span');
      label.className = 'seat-label';
      label.textContent = seat.label;
      seatDiv.appendChild(label);

      const handsRow = document.createElement('div');
      handsRow.className = 'seat-hands';
      spot.hands.forEach((hand, h) => {
        const active = state.turn && state.turn.spot === s && state.turn.hand === h;
        handsRow.appendChild(renderHand(hand, seat.owner === 'you', active));
      });
      seatDiv.appendChild(handsRow);
      elPlayerHandsContainer.appendChild(seatDiv);
    });
  }

  function renderHand(hand, mine, active) {
    const container = document.createElement('div');
    container.className = `hand-container ${active ? 'active' : ''}`;

    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'player-cards';
    const visible = hand.cards.filter(c => shownCards.has(c));
    visible.forEach(c => cardsDiv.appendChild(createCardElement(c)));
    container.appendChild(cardsDiv);

    if (visible.length > 0) {
      const badge = document.createElement('div');
      const res = hand.result;
      if (res) {
        const text = { blackjack: 'BJ', win: 'Win', push: 'Push', loss: hand.isBusted ? 'Bust' : 'Lose' }[res];
        badge.textContent = text;
        badge.className = `score-badge ${res === 'loss' ? 'loss' : res === 'push' ? 'push' : 'win'}`;
      } else if (hand.isBusted) {
        badge.textContent = 'Bust';
        badge.className = 'score-badge loss';
      } else if (hand.hasBlackjack && visible.length === 2) {
        badge.textContent = 'BJ';
        badge.className = 'score-badge win';
      } else {
        const val = game.handValue(visible);
        badge.textContent = val.soft ? `Soft ${val.total}` : val.total;
        badge.className = 'score-badge';
      }
      container.appendChild(badge);
    }

    if (mine && hand.bet > 0) {
      const bet = document.createElement('span');
      bet.className = 'hand-bet';
      bet.textContent = formatMoney(hand.bet) + (hand.isDoubled ? ' (2×)' : '');
      container.appendChild(bet);
    }
    return container;
  }

  function updateActionButtons() {
    const waiting = state.awaitingInsurance;
    const myTurn = isMyTurn() && !waiting && !state.actionLock;
    const hand = currentHand();
    const bankroll = betting.getBankroll();

    const set = (id, enabled) => { document.getElementById(id).disabled = !enabled; };
    set('btn-hit', myTurn && !hand.isStood);
    set('btn-stand', myTurn && !hand.isStood);
    set('btn-double', myTurn && game.canDouble(state.turn.spot, state.turn.hand) && bankroll >= hand.bet);
    set('btn-split', myTurn && game.canSplit(state.turn.spot, state.turn.hand) && bankroll >= hand.bet);
    set('btn-insurance', waiting && bankroll >= insuranceCost());

    document.getElementById('btn-insurance').classList.toggle('hidden', !waiting);
    document.getElementById('btn-no-insurance').classList.toggle('hidden', !waiting);
  }

  function updateStrategyAdvisor() {
    const advisorEl = document.getElementById('strategy-advisor');
    const labelEl = document.getElementById('strategy-advisor-label');
    const actionEl = document.getElementById('strategy-advisor-action');
    const detailEl = document.getElementById('strategy-advisor-detail');

    if (!state.strategyEnabled || state.phase !== 'playing' || state.actionLock || !game.getState()) {
      advisorEl.classList.add('hidden');
      return;
    }

    const tc = counter.getTrueCount();
    const countForPlay = state.deviationsEnabled ? tc : null;

    // Insurance decision comes before any play on the hand
    if (state.awaitingInsurance) {
      const take = strategy.shouldTakeInsurance(countForPlay);
      advisorEl.className = (take ? 'recommend-insurance' : 'recommend-stand') + (take ? ' deviation' : '');
      labelEl.textContent = take ? 'COUNT DEVIATION' : 'BASIC STRATEGY';
      actionEl.textContent = take ? 'TAKE INSURANCE' : 'NO INSURANCE';
      detailEl.textContent = state.deviationsEnabled
        ? `Insure at TC ≥ +3 (now ${tc.toFixed(1)})`
        : 'Basic strategy: never take insurance';
      return;
    }

    if (!isMyTurn()) {
      advisorEl.classList.add('hidden');
      return;
    }

    const { spot, hand: handIdx } = state.turn;
    const hand = currentHand();
    if (hand.isStood) { advisorEl.classList.add('hidden'); return; }

    const dealerUpcard = game.getState().dealerCards[0].rank;
    const canDbl = game.canDouble(spot, handIdx) && betting.getBankroll() >= hand.bet;
    const canSpl = game.canSplit(spot, handIdx) && betting.getBankroll() >= hand.bet;
    const rec = strategy.getRecommendation(hand.cards, dealerUpcard, canDbl, canSpl, countForPlay);

    const handVal = game.handValue(hand.cards);
    const handDesc = handVal.soft ? `Soft ${handVal.total}` : `Hard ${handVal.total}`;
    const [c1, c2] = hand.cards;
    const isPair = hand.cards.length === 2 &&
      (c1.rank === c2.rank || (isTenRank(c1.rank) && isTenRank(c2.rank)));
    const pairDesc = isPair ? `Pair of ${isTenRank(c1.rank) ? '10' : c1.rank}s` : null;

    const applied = rec.deviation && rec.deviation.applied;
    advisorEl.className = `recommend-${rec.action.toLowerCase()}` + (applied ? ' deviation' : '');
    labelEl.textContent = applied ? 'COUNT DEVIATION' : 'BASIC STRATEGY';
    actionEl.textContent = rec.action;
    let detail = `${pairDesc || handDesc} vs Dealer ${dealerUpcard}`;
    if (rec.deviation) detail += ` · ${rec.deviation.rule} (TC ${tc.toFixed(1)})`;
    detailEl.textContent = detail;
  }

  function updateDealerScore() {
    const gs = game.getState();
    if (!gs) return;
    const visible = gs.dealerCards.filter(c => shownCards.has(c));
    if (visible.length === 0) {
      elDealerScore.classList.add('hidden');
      return;
    }
    if (gs.dealerHoleHidden) {
      elDealerScore.textContent = game.handValue([gs.dealerCards[0]]).total;
      elDealerScore.className = 'score-badge';
    } else {
      const val = game.handValue(visible);
      if (val.total > 21) {
        elDealerScore.textContent = 'Bust';
        elDealerScore.className = 'score-badge loss';
      } else {
        elDealerScore.textContent = val.soft ? `Soft ${val.total}` : val.total;
        elDealerScore.className = 'score-badge';
      }
    }
  }

  function updateBankroll() {
    elBankrollAmount.textContent = formatMoney(betting.getBankroll());
    updateDealButton();
  }

  function updateDealButton() {
    document.getElementById('deal-btn').disabled = !betting.isBetValid();
  }

  function updateHandsToggle() {
    document.querySelectorAll('#hands-toggle button').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.hands) === state.numHands);
    });
  }

  function updateBetDisplay() {
    const bet = betting.getCurrentBet();
    elBetAmount.textContent = state.numHands > 1 && bet > 0
      ? `${formatMoney(bet)} × ${state.numHands}`
      : formatMoney(bet);
    // Point out the table minimum while the staged bet is below it
    document.getElementById('bet-label').textContent =
      bet > 0 && bet < state.minBet ? `MIN ${formatMoney(state.minBet)}` : (state.numHands > 1 ? 'BET PER HAND' : 'BET');
    updateDealButton();

    elBetChipsVisual.innerHTML = '';
    if (bet > 0) {
      elBetChipsVisual.innerHTML = `<div class="chip chip-100" style="transform:scale(0.8)"><span class="chip-inner"><span class="chip-value">${bet}</span></span></div>`;
    }
  }

  function updateCountingPanel() {
    elRunningCount.textContent = counter.getRunningCount();
    elTrueCount.textContent = counter.getTrueCount().toFixed(1);
    elCardsRemaining.textContent = counter.getCardsRemaining();
    elDecksRemaining.textContent = counter.getDecksRemaining().toFixed(1);
    elDeckPenetration.textContent = counter.getPenetration() + '%';

    const suggested = counter.getSuggestedBet(state.minBet, state.maxBet);
    elSuggestedBet.textContent = formatMoney(suggested);

    const edge = counter.getPlayerEdge();
    elPlayerEdge.textContent = (edge > 0 ? '+' : '') + edge.toFixed(2) + '%';
    elPlayerEdge.className = 'stat-value ' + (edge > 0 ? 'positive' : 'negative');

    populateCardGrid();
  }

  function updateBetSpreadPreview() {
    const min = Math.max(1, parseInt(document.getElementById('setting-min-bet').value) || 5);
    const max = Math.max(min, parseInt(document.getElementById('setting-max-bet').value) || 500);
    const spread = counter.getBetSpread(min, max);
    const ids = ['spread-1', 'spread-2', 'spread-3', 'spread-4', 'spread-5'];
    spread.forEach((s, i) => {
      const el = document.getElementById(ids[i]);
      if (el) el.textContent = formatMoney(s.bet);
    });
  }

  function updateShoeIndicator() {
    const total = game.getTotalCards();
    const remaining = game.getShoeSize();
    const pct = (remaining / total) * 100;
    elShoeProgress.style.width = pct + '%';
    elShoeLabel.textContent = `Shoe: ${remaining} cards`;
  }

  function populateCardGrid() {
    elCardGrid.innerHTML = '';
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const seen = counter.getCardsSeen();
    const totalPerRank = counter.getTotalPerRank();

    ranks.forEach(rank => {
      const val = counter.getHiLoValue(rank);
      const hiLoClass = val === 1 ? 'plus' : val === -1 ? 'minus' : 'zero';
      const count = seen[rank] || 0;

      const div = document.createElement('div');
      div.className = 'card-count-cell';
      div.dataset.hiLo = hiLoClass;
      div.innerHTML = `
        <span class="cell-rank">${rank}</span>
        <span class="cell-count">${count}/${totalPerRank}</span>
      `;
      elCardGrid.appendChild(div);
    });
  }

  function updateAnalyticsPanel() {
    const stats = analytics.getStats();
    elStatHands.textContent = stats.hands;
    elStatWins.textContent = stats.wins;
    elStatLosses.textContent = stats.losses;
    elStatPushes.textContent = stats.pushes;
    elStatBlackjacks.textContent = stats.blackjacks;
    elStatWinrate.textContent = stats.winRate + '%';
    elStatWagered.textContent = formatMoney(stats.totalWagered);
    elStatPnl.textContent = `${stats.netPnl >= 0 ? '+' : '-'}${formatMoney(Math.abs(stats.netPnl))}`;

    if (!document.getElementById('analytics-panel').classList.contains('hidden')) {
      analytics.drawChart(canvasChart);
    }
  }

  function showMessage(text, type = 'info') {
    elGameMessage.textContent = text;
    elGameMessage.className = `message-${type}`;
    elGameMessage.classList.remove('hidden');
  }

  // Show a short notice, then hide it unless another message has replaced it
  function flashMessage(text, ms = 1500) {
    showMessage(text, 'info');
    setTimeout(() => {
      if (elGameMessage.textContent === text) hideMessage();
    }, ms);
  }

  function hideMessage() {
    elGameMessage.classList.add('hidden');
  }

  init();
});
