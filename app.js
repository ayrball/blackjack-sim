document.addEventListener('DOMContentLoaded', () => {
  let counter = new window.CardCounter();
  let analytics = new window.Analytics();
  let betting = new window.BettingSystem();
  const game = new window.BlackjackGame();
  const strategy = new window.BasicStrategy();
  
  const state = {
    phase: 'betting',
    currentHandIndex: 0,
    handBets: [],
    insuranceBet: 0,
    awaitingInsurance: false,
    actionLock: false,
    strategyEnabled: false,
    minBet: 5,
    maxBet: 500,
    startingBankroll: 1000
  };

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

  function init() {
    setupEventListeners();
    updateBankroll();
    updateBetDisplay();
    updateCountingPanel();
    updateAnalyticsPanel();
    updateShoeIndicator();
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

    document.getElementById('deal-btn').addEventListener('click', () => {
      if (state.phase === 'betting' && betting.isBetValid()) {
        startHand();
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
      if (state.phase === 'playing' && state.awaitingInsurance) finishInsuranceDecision();
    });
    
    document.getElementById('toggle-counting').addEventListener('click', (e) => {
      document.getElementById('counting-panel').classList.toggle('hidden');
      e.currentTarget.classList.toggle('active');
    });

    document.getElementById('toggle-strategy').addEventListener('click', (e) => {
      state.strategyEnabled = !state.strategyEnabled;
      e.currentTarget.classList.toggle('active');
      if (state.phase === 'playing') {
        updateStrategyAdvisor();
      } else {
        document.getElementById('strategy-advisor').classList.add('hidden');
      }
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

      state.minBet = newMin;
      state.maxBet = newMax;
      state.startingBankroll = newBankroll;

      // Reinitialize betting system with new settings
      betting = new window.BettingSystem(newBankroll, newMin, newMax);
      analytics = new window.Analytics(newBankroll);
      counter.reset();
      game.initShoe();

      updateBankroll();
      updateBetDisplay();
      updateCountingPanel();
      updateAnalyticsPanel();
      updateShoeIndicator();

      document.getElementById('settings-overlay').classList.add('hidden');
      flashMessage('Settings Applied');
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
      document.getElementById('strategy-advisor').classList.add('hidden');
      updateDealButton();
    } else if (newPhase === 'playing') {
      elBettingSection.classList.add('hidden');
      elActionButtons.classList.remove('hidden');
      updateActionButtons();
      updateStrategyAdvisor();
    } else {
      elBettingSection.classList.add('hidden');
      elActionButtons.classList.add('hidden');
      document.getElementById('strategy-advisor').classList.add('hidden');
    }
  }

  function createCardElement(card, faceDown = false) {
    const div = document.createElement('div');
    const colorClass = (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black';
    div.className = `card ${faceDown ? 'face-down' : ''} dealing ${colorClass}`;
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
    
    setTimeout(() => {
      div.classList.remove('dealing');
    }, 400);
    
    return div;
  }

  function startHand() {
    const shuffled = game.needsShuffle();
    if (shuffled) {
      game.initShoe();
      counter.reset();
    }

    const betAmount = betting.placeBet();
    if (!betAmount) return;
    
    state.handBets = [betAmount];
    state.insuranceBet = 0;
    state.currentHandIndex = 0;
    state.awaitingInsurance = false;
    state.actionLock = false;

    updateBankroll();
    updateBetDisplay();
    
    elDealerCards.innerHTML = '';
    elDealerScore.classList.add('hidden');
    elPlayerHandsContainer.innerHTML = '';
    hideMessage();
    if (shuffled) flashMessage('Shoe Shuffled');

    const dealData = game.startHand();
    
    const handDiv = document.createElement('div');
    handDiv.className = 'hand-container active';
    handDiv.dataset.handIndex = "0";
    handDiv.innerHTML = `
      <div class="player-cards" id="player-cards-0"></div>
      <div class="score-badge hidden" id="player-score-0"></div>
    `;
    elPlayerHandsContainer.appendChild(handDiv);
    
    setPhase('dealing');
    
    const pCards = dealData.playerCards;
    const dCards = dealData.dealerCards;
    
    setTimeout(() => {
      document.getElementById('player-cards-0').appendChild(createCardElement(pCards[0]));
      counter.countCard(pCards[0].rank);
      updateCountingPanel();
    }, 200);
    
    setTimeout(() => {
      elDealerCards.appendChild(createCardElement(dCards[0]));
      counter.countCard(dCards[0].rank);
      updateCountingPanel();
    }, 400);
    
    setTimeout(() => {
      document.getElementById('player-cards-0').appendChild(createCardElement(pCards[1]));
      counter.countCard(pCards[1].rank);
      updateCountingPanel();
      updatePlayerScores();
    }, 600);
    
    setTimeout(() => {
      elDealerCards.appendChild(createCardElement(dCards[1], true));
      updateShoeIndicator();
      checkInitialBlackjack();
    }, 800);
  }

  function checkInitialBlackjack() {
    const gameState = game.getState();
    const ph = gameState.playerHands[0];
    const dealerUpCard = gameState.dealerCards[0];
    const isPlayerBJ = ph.hasBlackjack;
    
    // Dealer shows an Ace: offer insurance first, then peek (see finishInsuranceDecision)
    if (dealerUpCard.rank === 'A' && !isPlayerBJ) {
      state.awaitingInsurance = true;
      setPhase('playing');
      updatePlayerHandsRender();
      return;
    }
    
    const dealerVal = game.handValue(gameState.dealerCards).total;
    const isDealerBJ = dealerVal === 21;
    
    if (isPlayerBJ || isDealerBJ) {
      const holeCard = game.revealHole();
      counter.countCard(holeCard.rank);
      updateDealerCardsRender();
      updateCountingPanel();
      resolveGame();
    } else {
      setPhase('playing');
      updateActionButtons();
      updatePlayerHandsRender();
    }
  }

  function playerHit() {
    const card = game.hit(state.currentHandIndex);
    if (card) {
      counter.countCard(card.rank);
      updateCountingPanel();
      updateShoeIndicator();
      updatePlayerHandsRender();
      updatePlayerScores();
      
      const gameState = game.getState();
      const hand = gameState.playerHands[state.currentHandIndex];
      if (hand.isStood || hand.isBusted) {
        moveToNextHandOrDealer();
      } else {
        updateActionButtons();
      }
    }
  }

  function playerStand() {
    game.stand(state.currentHandIndex);
    updatePlayerHandsRender();
    moveToNextHandOrDealer();
  }

  function playerDouble() {
    const bet = state.handBets[state.currentHandIndex];
    if (betting.getBankroll() >= bet && game.canDouble(state.currentHandIndex)) {
      betting.bankroll -= bet;
      state.handBets[state.currentHandIndex] *= 2;
      updateBankroll();
      
      const card = game.double(state.currentHandIndex);
      if (card) {
        counter.countCard(card.rank);
        updateCountingPanel();
        updateShoeIndicator();
        updatePlayerHandsRender();
        updatePlayerScores();
        advanceAfterDelay(500);
      }
    }
  }

  function playerSplit() {
    const bet = state.handBets[state.currentHandIndex];
    if (betting.getBankroll() >= bet && game.canSplit(state.currentHandIndex)) {
      betting.bankroll -= bet;
      state.handBets.splice(state.currentHandIndex + 1, 0, bet);
      updateBankroll();
      
      const res = game.split(state.currentHandIndex);
      if (res) {
        counter.countCard(res.hand1[1].rank);
        counter.countCard(res.hand2[1].rank);
        updateCountingPanel();
        updateShoeIndicator();
        
        elPlayerHandsContainer.innerHTML = '';
        const gameState = game.getState();
        for (let i = 0; i < gameState.playerHands.length; i++) {
          const div = document.createElement('div');
          div.className = `hand-container ${i === state.currentHandIndex ? 'active' : ''}`;
          div.dataset.handIndex = i;
          div.innerHTML = `
            <div class="player-cards" id="player-cards-${i}"></div>
            <div class="score-badge hidden" id="player-score-${i}"></div>
          `;
          elPlayerHandsContainer.appendChild(div);
        }
        
        updatePlayerHandsRender();
        updatePlayerScores();
        
        const hand = gameState.playerHands[state.currentHandIndex];
        if (hand.isStood) {
          moveToNextHandOrDealer();
        } else {
          updateActionButtons();
        }
      }
    }
  }

  function playerInsurance() {
    if (game.canInsurance()) {
      const insBet = state.handBets[0] / 2;
      if (betting.getBankroll() >= insBet) {
        betting.bankroll -= insBet;
        state.insuranceBet = insBet;
        game.takeInsurance();
        updateBankroll();
      }
    }
    finishInsuranceDecision();
  }

  // Called once the player has taken or declined insurance: the dealer peeks
  // for blackjack before the player may hit, double or split.
  function finishInsuranceDecision() {
    state.awaitingInsurance = false;
    const dealerVal = game.handValue(game.getState().dealerCards).total;
    if (dealerVal === 21) {
      const holeCard = game.revealHole();
      counter.countCard(holeCard.rank);
      updateDealerCardsRender();
      updateCountingPanel();
      resolveGame();
    } else {
      updateActionButtons();
    }
  }

  function moveToNextHandOrDealer() {
    const gameState = game.getState();
    if (state.currentHandIndex < gameState.playerHands.length - 1) {
      state.currentHandIndex++;
      updatePlayerHandsRender();
      updateActionButtons();
      
      const hand = gameState.playerHands[state.currentHandIndex];
      if (hand.isStood) {
        advanceAfterDelay(500);
      }
    } else {
      startDealerPhase();
    }
  }

  // True when the player may act on the current hand (not mid-transition)
  function canPlayHand() {
    return state.phase === 'playing' && !state.awaitingInsurance && !state.actionLock;
  }

  // Auto-advance after a short pause, ignoring player input in the meantime so
  // a quick click can't advance the hand twice.
  function advanceAfterDelay(ms) {
    state.actionLock = true;
    ['btn-hit', 'btn-stand', 'btn-double', 'btn-split'].forEach(id => {
      document.getElementById(id).disabled = true;
    });
    setTimeout(() => {
      state.actionLock = false;
      moveToNextHandOrDealer();
    }, ms);
  }

  function startDealerPhase() {
    if (state.phase !== 'playing') return;
    setPhase('dealer');
    updatePlayerHandsRender();
    
    const gameState = game.getState();
    const allBusted = gameState.playerHands.every(h => h.isBusted);
    const allBlackjack = gameState.playerHands.every(h => h.hasBlackjack);
    
    const holeCard = game.revealHole();
    counter.countCard(holeCard.rank);
    updateCountingPanel();
    updateDealerCardsRender();
    
    if (allBusted || allBlackjack) {
      setTimeout(resolveGame, 500);
      return;
    }
    
    let delay = 500;
    const newCards = game.dealerPlay();
    newCards.forEach(c => {
      setTimeout(() => {
        elDealerCards.appendChild(createCardElement(c));
        counter.countCard(c.rank);
        updateCountingPanel();
        updateShoeIndicator();
        updateDealerScore();
      }, delay);
      delay += 500;
    });
    
    setTimeout(resolveGame, delay + 200);
  }

  function resolveGame() {
    if (state.phase === 'result') return;
    setPhase('result');
    const gameState = game.getState();
    
    updateDealerScore();
    const dealerVal = game.handValue(gameState.dealerCards).total;
    const dealerBJ = dealerVal === 21 && gameState.dealerCards.length === 2;
    
    let totalPayout = 0;
    let resultMsg = [];
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
    
    for (let i = 0; i < gameState.playerHands.length; i++) {
      const hand = gameState.playerHands[i];
      const bet = state.handBets[i];
      const pBJ = hand.hasBlackjack;
      
      const res = game.getHandResult(hand.cards, gameState.dealerCards, pBJ, dealerBJ);
      const mult = game.getPayoutMultiplier(res);
      const payout = bet * mult;
      totalPayout += payout;
      
      if (res === 'blackjack') { hasBJ = true; hasWin = true; }
      else if (res === 'win') { hasWin = true; }
      else if (res === 'loss') { hasLoss = true; }
      
      if (res === 'blackjack') resultMsg.push(`Blackjack! +${formatMoney(payout - bet)}`);
      else if (res === 'win') resultMsg.push(`Win +${formatMoney(payout - bet)}`);
      else if (res === 'push') resultMsg.push('Push');
      else if (res === 'loss') resultMsg.push(hand.isBusted ? 'Bust' : 'Loss');
    }
    
    if (totalPayout > 0) {
      betting.payout(totalPayout);
    }
    
    // Record as single analytics entry for the overall hand result
    const totalBet = state.handBets.reduce((a, b) => a + b, 0);
    const overallOutcome = hasBJ ? 'blackjack' : hasWin ? 'win' : (totalPayout > 0 && !hasLoss) ? 'push' : 'loss';
    analytics.recordHand({
      bet: totalBet + state.insuranceBet,
      outcome: overallOutcome,
      payout: totalPayout,
      bankrollAfter: betting.getBankroll()
    });
    
    updateBankroll();
    updateAnalyticsPanel();
    
    if (resultMsg.length > 0) {
      const msgType = hasBJ ? 'blackjack' : hasWin ? 'win' : (totalPayout >= totalBet && !hasLoss) ? 'push' : 'loss';
      showMessage(resultMsg.join(' | '), msgType);
    }
    
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

  function updateActionButtons() {
    const gameState = game.getState();
    const hand = gameState.playerHands[state.currentHandIndex];
    const bet = state.handBets[state.currentHandIndex];
    const bankroll = betting.getBankroll();
    
    const waiting = state.awaitingInsurance;
    document.getElementById('btn-hit').disabled = waiting || hand.isStood || hand.isBusted;
    document.getElementById('btn-stand').disabled = waiting || hand.isStood || hand.isBusted;
    document.getElementById('btn-double').disabled = waiting || !game.canDouble(state.currentHandIndex) || bankroll < bet;
    document.getElementById('btn-split').disabled = waiting || !game.canSplit(state.currentHandIndex) || bankroll < bet;
    document.getElementById('btn-insurance').disabled = !waiting || !game.canInsurance() || bankroll < (state.handBets[0] / 2);
    document.getElementById('btn-insurance').classList.toggle('hidden', !waiting);
    document.getElementById('btn-no-insurance').classList.toggle('hidden', !waiting);

    updateStrategyAdvisor();
  }

  function updateStrategyAdvisor() {
    const advisorEl = document.getElementById('strategy-advisor');
    const actionEl = document.getElementById('strategy-advisor-action');
    const detailEl = document.getElementById('strategy-advisor-detail');
    
    if (!state.strategyEnabled || state.phase !== 'playing') {
      advisorEl.classList.add('hidden');
      return;
    }
    
    const gameState = game.getState();
    if (!gameState) { advisorEl.classList.add('hidden'); return; }
    
    const hand = gameState.playerHands[state.currentHandIndex];
    if (hand.isStood || hand.isBusted) { advisorEl.classList.add('hidden'); return; }
    
    const dealerUpcard = gameState.dealerCards[0].rank;
    const canDbl = game.canDouble(state.currentHandIndex) && betting.getBankroll() >= state.handBets[state.currentHandIndex];
    const canSpl = game.canSplit(state.currentHandIndex) && betting.getBankroll() >= state.handBets[state.currentHandIndex];
    
    // Insurance decision comes before any play on the hand. Hi-Lo index: take it at TC >= +3.
    if (state.awaitingInsurance) {
      const tc = counter.getTrueCount();
      const take = tc >= 3;
      advisorEl.className = take ? 'recommend-insurance' : 'recommend-stand';
      actionEl.textContent = take ? 'TAKE INSURANCE' : 'NO INSURANCE';
      detailEl.textContent = take
        ? `True count ${tc.toFixed(1)} ≥ +3: insurance is +EV`
        : `True count ${tc.toFixed(1)} < +3: decline insurance`;
      advisorEl.classList.remove('hidden');
      return;
    }

    const rec = strategy.getRecommendation(hand.cards, dealerUpcard, canDbl, canSpl);
    
    // Build detail text
    const handVal = game.handValue(hand.cards);
    const handDesc = handVal.soft ? `Soft ${handVal.total}` : `Hard ${handVal.total}`;
    const isPair = hand.cards.length === 2 && 
      (hand.cards[0].rank === hand.cards[1].rank || 
       (['10','J','Q','K'].includes(hand.cards[0].rank) && ['10','J','Q','K'].includes(hand.cards[1].rank)));
    const pairDesc = isPair ? `Pair of ${hand.cards[0].rank}s` : null;
    const dealerDesc = `Dealer shows ${dealerUpcard}`;
    
    advisorEl.className = `recommend-${rec.action.toLowerCase()}`;
    actionEl.textContent = rec.action;
    detailEl.textContent = `${pairDesc || handDesc} vs ${dealerDesc}`;
    advisorEl.classList.remove('hidden');
  }

  function updatePlayerHandsRender() {
    const gameState = game.getState();
    if (!gameState) return;
    
    document.querySelectorAll('.hand-container').forEach(hc => {
      const idx = parseInt(hc.dataset.handIndex);
      if (idx === state.currentHandIndex && state.phase === 'playing') {
        hc.classList.add('active');
      } else {
        hc.classList.remove('active');
      }
      
      const cardsCont = document.getElementById(`player-cards-${idx}`);
      if (cardsCont) {
        cardsCont.innerHTML = '';
        const hand = gameState.playerHands[idx];
        hand.cards.forEach(c => {
          cardsCont.appendChild(createCardElement(c));
        });
      }
    });
    updatePlayerScores();
  }

  function updateDealerCardsRender() {
    const gameState = game.getState();
    if (!gameState) return;
    elDealerCards.innerHTML = '';
    gameState.dealerCards.forEach((c, i) => {
      if (i === 1 && gameState.dealerHoleHidden) {
        elDealerCards.appendChild(createCardElement(c, true));
      } else {
        elDealerCards.appendChild(createCardElement(c));
      }
    });
    updateDealerScore();
  }

  function updatePlayerScores() {
    const gameState = game.getState();
    if (!gameState) return;
    
    gameState.playerHands.forEach((hand, idx) => {
      const scoreBadge = document.getElementById(`player-score-${idx}`);
      if (scoreBadge) {
        const val = game.handValue(hand.cards);
        if (hand.isBusted) {
          scoreBadge.textContent = 'Bust';
          scoreBadge.className = 'score-badge loss';
        } else if (hand.hasBlackjack) {
          scoreBadge.textContent = 'BJ';
          scoreBadge.className = 'score-badge win';
        } else {
          scoreBadge.textContent = val.soft ? `Soft ${val.total}` : val.total;
          scoreBadge.className = 'score-badge';
        }
        scoreBadge.classList.remove('hidden');
      }
    });
  }

  function updateDealerScore() {
    const gameState = game.getState();
    if (!gameState) return;
    if (gameState.dealerHoleHidden) {
      const upVal = game.handValue([gameState.dealerCards[0]]);
      elDealerScore.textContent = upVal.total;
    } else {
      const val = game.handValue(gameState.dealerCards);
      if (val.total > 21) {
        elDealerScore.textContent = 'Bust';
        elDealerScore.className = 'score-badge loss';
      } else {
        elDealerScore.textContent = val.soft ? `Soft ${val.total}` : val.total;
        elDealerScore.className = 'score-badge';
      }
    }
    elDealerScore.classList.remove('hidden');
  }

  function updateBankroll() {
    elBankrollAmount.textContent = formatMoney(betting.getBankroll());
    updateDealButton();
  }

  function updateDealButton() {
    document.getElementById('deal-btn').disabled = !betting.isBetValid();
  }

  function updateBetDisplay() {
    const bet = betting.getCurrentBet();
    elBetAmount.textContent = formatMoney(bet);
    // Point out the table minimum while the staged bet is below it
    document.getElementById('bet-label').textContent =
      bet > 0 && bet < state.minBet ? `MIN ${formatMoney(state.minBet)}` : 'BET';
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
