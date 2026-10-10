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

  // Hi-Lo Illustrious 18 for 6 decks, dealer hits soft 17 (Schlesinger's list
  // in rank order). Each entry switches from `below` to `atOrAbove` once the
  // true count reaches `index`. The H17 values differ from S17 charts on
  // 11 vs A (-1, S17 +1), 10 vs A (+3, S17 +4) and 12 vs 6 (-3, S17 -1).
  // Upcards: 2-10, 11 = Ace. Insurance (take at +3) is in shouldTakeInsurance.
  static get DEVIATIONS() {
    return [
      { type: 'hard', total: 16, up: 10, index: 0,  atOrAbove: 'S', below: 'H' },
      { type: 'hard', total: 15, up: 10, index: 4,  atOrAbove: 'S', below: 'H' },
      { type: 'pair', pair: '10', up: 5, index: 5,  atOrAbove: 'P', below: 'S' },
      { type: 'pair', pair: '10', up: 6, index: 4,  atOrAbove: 'P', below: 'S' },
      { type: 'hard', total: 10, up: 10, index: 4,  atOrAbove: 'D', below: 'H' },
      { type: 'hard', total: 12, up: 3,  index: 2,  atOrAbove: 'S', below: 'H' },
      { type: 'hard', total: 12, up: 2,  index: 3,  atOrAbove: 'S', below: 'H' },
      { type: 'hard', total: 11, up: 11, index: -1, atOrAbove: 'D', below: 'H' },
      { type: 'hard', total: 9,  up: 2,  index: 1,  atOrAbove: 'D', below: 'H' },
      { type: 'hard', total: 10, up: 11, index: 3,  atOrAbove: 'D', below: 'H' },
      { type: 'hard', total: 9,  up: 7,  index: 3,  atOrAbove: 'D', below: 'H' },
      { type: 'hard', total: 16, up: 9,  index: 5,  atOrAbove: 'S', below: 'H' },
      { type: 'hard', total: 13, up: 2,  index: -1, atOrAbove: 'S', below: 'H' },
      { type: 'hard', total: 12, up: 4,  index: 0,  atOrAbove: 'S', below: 'H' },
      { type: 'hard', total: 12, up: 5,  index: -2, atOrAbove: 'S', below: 'H' },
      { type: 'hard', total: 12, up: 6,  index: -3, atOrAbove: 'S', below: 'H' },
      { type: 'hard', total: 13, up: 3,  index: -2, atOrAbove: 'S', below: 'H' }
    ];
  }

  static get INSURANCE_INDEX() { return 3; }

  // Late surrender, 6D H17 basic strategy (two-card, unsplit hands only):
  // hard 16 (not 8,8) vs 9/10/A, hard 15 vs 10/A, hard 17 vs A, 8,8 vs A.
  // Keys: 'hard <total> v <up>' or 'pair <rank> v <up>', with A = 11.
  static get SURRENDER_BASIC() {
    return new Set(['hard 16 v 9', 'hard 16 v 10', 'hard 16 v 11', 'hard 15 v 10',
      'hard 15 v 11', 'hard 17 v 11', 'pair 8 v 11']);
  }

  // Fab 4 surrender indices for 6D H17 Hi-Lo (plus 16 vs 8, which the same
  // chart lists): surrender at TC >= index, otherwise play the hand out.
  static get FAB4() {
    return [
      { total: 14, up: 10, index: 3 },
      { total: 15, up: 9,  index: 2 },
      { total: 15, up: 10, index: 0 },
      { total: 15, up: 11, index: -1 },
      { total: 16, up: 8,  index: 4 }
    ];
  }

  // Decides late surrender for a two-card hand. Returns { surrender, basic,
  // dev } where dev is the Fab 4 entry for this hand (count mode only).
  _surrenderDecision(playerCards, up, trueCount) {
    const [c1, c2] = playerCards;
    const p1 = this.getPairKey(c1.rank), p2 = this.getPairKey(c2.rank);
    const val = this._handValue(playerCards);
    const key = p1 === p2 && p1 === '8' ? `pair 8 v ${up}` : `hard ${val.total} v ${up}`;
    if (val.soft) return { surrender: false, basic: false, dev: null };
    // 8,8 is only surrendered against an Ace; otherwise it's split
    if (p1 === '8' && p2 === '8' && up !== 11) return { surrender: false, basic: false, dev: null };

    const basic = BasicStrategy.SURRENDER_BASIC.has(key);
    const dev = trueCount !== null && !(p1 === p2)
      ? BasicStrategy.FAB4.find(d => d.total === val.total && d.up === up) || null
      : null;
    return { surrender: dev ? trueCount >= dev.index : basic, basic, dev };
  }

  describeSurrender(d) {
    const up = d.up === 11 ? 'A' : String(d.up);
    return `${d.total} vs ${up}: surrender at TC ≥ ${d.index > 0 ? '+' : ''}${d.index}`;
  }

  // Basic strategy never insures; with deviations on, insure at TC >= +3
  shouldTakeInsurance(trueCount = null) {
    return trueCount !== null && trueCount >= BasicStrategy.INSURANCE_INDEX;
  }

  _upValue(dealerUpcard) {
    if (dealerUpcard === 'A') return 11;
    return ['10','J','Q','K'].includes(dealerUpcard) ? 10 : parseInt(dealerUpcard);
  }

  _findDeviation(match) {
    return BasicStrategy.DEVIATIONS.find(d =>
      d.type === match.type && d.up === match.up &&
      (d.type === 'pair' ? d.pair === match.pair : d.total === match.total));
  }

  // The basic-strategy play for a deviation's hand (H17 table)
  basicPlayFor(d) {
    const di = d.up === 11 ? 9 : d.up - 2;
    const code = d.type === 'pair' ? this.pairs[d.pair][di] : this.hard[d.total][di];
    return code === 'Ds' ? 'D' : code;
  }

  // Describes the departure from basic strategy, e.g. "16 vs 10: stand at
  // TC ≥ 0" or, where basic already stands, "12 vs 6: hit at TC < -3"
  describeDeviation(d) {
    const up = d.up === 11 ? 'A' : String(d.up);
    const hand = d.type === 'pair' ? `${d.pair},${d.pair}` : String(d.total);
    const sign = d.index > 0 ? '+' : '';
    if (this.basicPlayFor(d) === d.atOrAbove) {
      return `${hand} vs ${up}: ${this._actionName(d.below).toLowerCase()} at TC < ${sign}${d.index}`;
    }
    return `${hand} vs ${up}: ${this._actionName(d.atOrAbove).toLowerCase()} at TC ≥ ${sign}${d.index}`;
  }

  // Rows for the strategy panel: insurance plus the 17 playing deviations,
  // with the basic play, the count-based play and the play at `trueCount`
  getDeviationTable(trueCount, { surrender = false } = {}) {
    const rows = [{
      rank: 1, hand: 'Insurance', up: 'A', index: BasicStrategy.INSURANCE_INDEX,
      basic: 'NO', deviation: 'YES', current: trueCount >= BasicStrategy.INSURANCE_INDEX ? 'YES' : 'NO',
      below: false, rule: null
    }];
    BasicStrategy.DEVIATIONS.forEach((d, i) => {
      const basic = this.basicPlayFor(d);
      const deviation = basic === d.atOrAbove ? d.below : d.atOrAbove;
      const current = trueCount >= d.index ? d.atOrAbove : d.below;
      rows.push({
        rank: i + 2,
        hand: d.type === 'pair' ? `${d.pair},${d.pair}` : String(d.total),
        up: d.up === 11 ? 'A' : String(d.up),
        index: d.index,
        basic: this._actionName(basic),
        deviation: this._actionName(deviation),
        current: this._actionName(current),
        below: basic === d.atOrAbove, // count play applies below the index
        rule: this.describeDeviation(d)
      });
    });
    // Fab 4 surrender plays, when late surrender is offered
    if (surrender) {
      BasicStrategy.FAB4.forEach(d => {
        const basicSurr = BasicStrategy.SURRENDER_BASIC.has(`hard ${d.total} v ${d.up}`);
        const notSurr = 'HIT';
        const current = trueCount >= d.index ? 'SURRENDER' : notSurr;
        rows.push({
          rank: rows.length + 1,
          hand: String(d.total),
          up: d.up === 11 ? 'A' : String(d.up),
          index: d.index,
          basic: basicSurr ? 'SURRENDER' : notSurr,
          deviation: basicSurr ? notSurr : 'SURRENDER',
          current,
          below: basicSurr,
          rule: this.describeSurrender(d),
          fab4: true
        });
      });
    }
    return rows;
  }

  // Returns { action, code, deviation }. Pass a true count to apply the
  // Illustrious 18; leave it null for plain basic strategy. `deviation` is set
  // whenever the hand is an index play, with `applied` true when the count
  // changes the basic-strategy action.
  getRecommendation(playerCards, dealerUpcard, canDouble, canSplit, trueCount = null, canSurrender = false) {
    const di = this.getDealerIndex(dealerUpcard);
    const up = this._upValue(dealerUpcard);
    const handVal = this._handValue(playerCards);
    const useCount = trueCount !== null;

    // Late surrender comes before any other decision on the first two cards
    if (canSurrender && playerCards.length === 2) {
      const sur = this._surrenderDecision(playerCards, up, trueCount);
      const devInfo = sur.dev
        ? { rule: this.describeSurrender(sur.dev), applied: sur.surrender !== sur.basic }
        : null;
      if (sur.surrender) {
        return { action: 'SURRENDER', code: 'R', deviation: devInfo };
      }
      if (devInfo && devInfo.applied) {
        // Count says keep playing a hand basic strategy would surrender
        const rest = this.getRecommendation(playerCards, dealerUpcard, canDouble, canSplit, trueCount, false);
        return { ...rest, deviation: devInfo };
      }
    }

    // Check for pair first
    let pairDev = null;
    if (playerCards.length === 2) {
      const r1 = this.getPairKey(playerCards[0].rank);
      const r2 = this.getPairKey(playerCards[1].rank);
      if (r1 === r2 && this.pairs[r1]) {
        const basic = this.pairs[r1][di];
        const dev = useCount && canSplit ? this._findDeviation({ type: 'pair', pair: r1, up }) : null;
        const pairAction = dev ? (trueCount >= dev.index ? dev.atOrAbove : dev.below) : basic;
        if (pairAction === 'P' && canSplit) {
          return { action: 'SPLIT', code: 'P', deviation: dev ? this._deviationInfo(dev, basic, 'P') : null };
        }
        // Otherwise (no split allowed or advised) play it as a hard/soft total
        pairDev = dev;
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
        return { action: this._actionName(action), code: action, deviation: null };
      }
    }

    // Hard hand
    const total = handVal.total;
    const hardTotal = Math.min(Math.max(total, 5), 21);
    const row = this.hard[hardTotal];
    if (row) {
      const basic = row[di];
      const dev = useCount ? this._findDeviation({ type: 'hard', total: hardTotal, up }) : null;
      if (!dev && pairDev) {
        // e.g. 10,10 vs 6 below its index: stand, but still show the index
        return { action: this._actionName(basic), code: basic, deviation: { rule: this.describeDeviation(pairDev), applied: false } };
      }
      const chosen = dev ? (trueCount >= dev.index ? dev.atOrAbove : dev.below) : basic;
      const action = chosen === 'D' && !canDouble ? 'H' : chosen;
      return {
        action: this._actionName(action),
        code: action,
        deviation: dev ? this._deviationInfo(dev, basic, chosen) : null
      };
    }

    return { action: 'STAND', code: 'S', deviation: null };
  }

  _deviationInfo(dev, basicCode, chosenCode) {
    const normalize = c => (c === 'Ds' ? 'D' : c);
    return { rule: this.describeDeviation(dev), applied: normalize(basicCode) !== normalize(chosenCode) };
  }

  _actionName(code) {
    const names = { 'H': 'HIT', 'S': 'STAND', 'D': 'DOUBLE', 'P': 'SPLIT', 'R': 'SURRENDER' };
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
