class BasicStrategy {
  constructor() {
    // 6-deck, dealer hits soft 17 (H17), double after split allowed (DAS)
    // Actions: H=Hit, S=Stand, D=Double(hit if can't), Ds=Double(stand if can't), P=Split
    // Dealer upcard index: 2=0, 3=1, 4=2, 5=3, 6=4, 7=5, 8=6, 9=7, 10=8, A=9

    // Hard totals: rows = player total 5-21, columns = dealer 2-A
    this.hard = {
      5:  ['H','H','H','H','H','H','H','H','H','H'],
      6:  ['H','H','H','H','H','H','H','H','H','H'],
      7:  ['H','H','H','H','H','H','H','H','H','H'],
      8:  ['H','H','H','H','H','H','H','H','H','H'],
      9:  ['H','D','D','D','D','H','H','H','H','H'],
      10: ['D','D','D','D','D','D','D','D','H','H'],
      11: ['D','D','D','D','D','D','D','D','D','D'],
      12: ['H','H','S','S','S','H','H','H','H','H'],
      13: ['S','S','S','S','S','H','H','H','H','H'],
      14: ['S','S','S','S','S','H','H','H','H','H'],
      15: ['S','S','S','S','S','H','H','H','H','H'],
      16: ['S','S','S','S','S','H','H','H','H','H'],
      17: ['S','S','S','S','S','S','S','S','S','S'],
      18: ['S','S','S','S','S','S','S','S','S','S'],
      19: ['S','S','S','S','S','S','S','S','S','S'],
      20: ['S','S','S','S','S','S','S','S','S','S'],
      21: ['S','S','S','S','S','S','S','S','S','S']
    };

    // Soft totals: rows = soft total 12-21, columns = dealer 2-A
    // (soft 12 is A,A when a split isn't possible)
    this.soft = {
      12: ['H','H','H','H','H','H','H','H','H','H'],
      13: ['H','H','H','D','D','H','H','H','H','H'],
      14: ['H','H','H','D','D','H','H','H','H','H'],
      15: ['H','H','D','D','D','H','H','H','H','H'],
      16: ['H','H','D','D','D','H','H','H','H','H'],
      17: ['H','D','D','D','D','H','H','H','H','H'],
      18: ['Ds','Ds','Ds','Ds','Ds','S','S','H','H','H'],
      19: ['S','S','S','S','Ds','S','S','S','S','S'],
      20: ['S','S','S','S','S','S','S','S','S','S'],
      21: ['S','S','S','S','S','S','S','S','S','S']
    };

    // Pairs: rows = pair card value, columns = dealer 2-A
    // Pair card: A, 10, 9, 8, 7, 6, 5, 4, 3, 2
    this.pairs = {
      'A': ['P','P','P','P','P','P','P','P','P','P'],
      '10':['S','S','S','S','S','S','S','S','S','S'],
      '9': ['P','P','P','P','P','S','P','P','S','S'],
      '8': ['P','P','P','P','P','P','P','P','P','P'],
      '7': ['P','P','P','P','P','P','H','H','H','H'],
      '6': ['P','P','P','P','P','H','H','H','H','H'],
      '5': ['D','D','D','D','D','D','D','D','H','H'],
      '4': ['H','H','H','P','P','H','H','H','H','H'],
      '3': ['P','P','P','P','P','P','H','H','H','H'],
      '2': ['P','P','P','P','P','P','H','H','H','H']
    };
  }

  getDealerIndex(dealerUpcard) {
    if (dealerUpcard === 'A') return 9;
    const val = ['10','J','Q','K'].includes(dealerUpcard) ? 10 : parseInt(dealerUpcard);
    return val - 2; // 2->0, 3->1, ..., 10->8
  }

  getPairKey(rank) {
    if (['10','J','Q','K'].includes(rank)) return '10';
    return rank;
  }

  getRecommendation(playerCards, dealerUpcard, canDouble, canSplit) {
    const di = this.getDealerIndex(dealerUpcard);
    const handVal = this._handValue(playerCards);

    // Check for pair first
    if (playerCards.length === 2) {
      const r1 = this.getPairKey(playerCards[0].rank);
      const r2 = this.getPairKey(playerCards[1].rank);
      if (r1 === r2 && this.pairs[r1]) {
        const pairAction = this.pairs[r1][di];
        if (pairAction === 'P' && canSplit) {
          return { action: 'SPLIT', code: 'P' };
        }
        // If can't split (5,5 never splits anyway, or 10,10 stands), fall through
        if (pairAction === 'P' && !canSplit) {
          // Fall through to hard/soft
        } else if (pairAction !== 'P') {
          // Pair table says don't split, fall through
        }
      }
    }

    // Soft hand
    if (handVal.soft && handVal.total >= 12 && handVal.total <= 21) {
      const row = this.soft[handVal.total];
      if (row) {
        let action = row[di];
        // Handle D and Ds when can't double
        if ((action === 'D' || action === 'Ds') && !canDouble) {
          action = action === 'Ds' ? 'S' : 'H';
        }
        if (action === 'D' || action === 'Ds') action = 'D';
        return { action: this._actionName(action), code: action };
      }
    }

    // Hard hand
    const total = handVal.total;
    const hardTotal = Math.min(Math.max(total, 5), 21);
    const row = this.hard[hardTotal];
    if (row) {
      let action = row[di];
      if (action === 'D' && !canDouble) {
        action = 'H';
      }
      return { action: this._actionName(action), code: action };
    }

    return { action: 'STAND', code: 'S' };
  }

  _actionName(code) {
    const names = { 'H': 'HIT', 'S': 'STAND', 'D': 'DOUBLE', 'P': 'SPLIT' };
    return names[code] || 'STAND';
  }

  _handValue(cards) {
    let total = 0;
    let aces = 0;
    for (const card of cards) {
      if (card.rank === 'A') { aces++; total += 11; }
      else if (['10','J','Q','K'].includes(card.rank)) { total += 10; }
      else { total += parseInt(card.rank); }
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return { total, soft: aces > 0 && total <= 21 };
  }

  // Returns the full basic strategy chart data for rendering
  getChartData() {
    return { hard: this.hard, soft: this.soft, pairs: this.pairs };
  }
}
window.BasicStrategy = BasicStrategy;
