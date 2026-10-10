class BasicStrategy {
  constructor() {
    // 6-deck, dealer hits soft 17 (H17), double after split allowed (DAS).
    // Matches the Blackjack Apprenticeship H17 Deviation Chart (2018).
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

  // ==================== DEVIATIONS ====================
  // Every red index on the Blackjack Apprenticeship H17 Deviation Chart, in
  // the chart's order. Notation follows the chart:
  //   dir '+'  -> make `play` at that true count and above   (e.g. 4+)
  //   dir '-'  -> make `play` at that true count and below   (e.g. -1-)
  //   rc: true -> the chart's 0+ / 0-: any positive / negative RUNNING count
  // Upcards: 2-10, 11 = Ace.
  static get DEVIATIONS() {
    return [
      // Pair splitting
      { type: 'pair', pair: '10', up: 4,  index: 6,  dir: '+', play: 'P' },
      { type: 'pair', pair: '10', up: 5,  index: 5,  dir: '+', play: 'P' },
      { type: 'pair', pair: '10', up: 6,  index: 4,  dir: '+', play: 'P' },
      // Soft totals
      { type: 'soft', total: 19, up: 4,  index: 3,  dir: '+', play: 'Ds' }, // A,8
      { type: 'soft', total: 19, up: 5,  index: 1,  dir: '+', play: 'Ds' }, // A,8
      { type: 'soft', total: 19, up: 6,  index: 0,  dir: '-', rc: true, play: 'S' }, // A,8
      { type: 'soft', total: 17, up: 2,  index: 1,  dir: '+', play: 'D' },  // A,6
      // Hard totals
      { type: 'hard', total: 16, up: 9,  index: 4,  dir: '+', play: 'S' },
      { type: 'hard', total: 16, up: 10, index: 0,  dir: '+', rc: true, play: 'S' },
      { type: 'hard', total: 16, up: 11, index: 3,  dir: '+', play: 'S' },
      { type: 'hard', total: 15, up: 10, index: 4,  dir: '+', play: 'S' },
      { type: 'hard', total: 15, up: 11, index: 5,  dir: '+', play: 'S' },
      { type: 'hard', total: 13, up: 2,  index: -1, dir: '-', play: 'H' },
      { type: 'hard', total: 12, up: 2,  index: 3,  dir: '+', play: 'S' },
      { type: 'hard', total: 12, up: 3,  index: 2,  dir: '+', play: 'S' },
      { type: 'hard', total: 12, up: 4,  index: 0,  dir: '-', rc: true, play: 'H' },
      { type: 'hard', total: 10, up: 10, index: 4,  dir: '+', play: 'D' },
      { type: 'hard', total: 10, up: 11, index: 3,  dir: '+', play: 'D' },
      { type: 'hard', total: 9,  up: 2,  index: 1,  dir: '+', play: 'D' },
      { type: 'hard', total: 9,  up: 7,  index: 3,  dir: '+', play: 'D' },
      { type: 'hard', total: 8,  up: 6,  index: 2,  dir: '+', play: 'D' }
    ];
  }

  // Insurance or even money: take at 3+
  static get INSURANCE_INDEX() { return 3; }

  // Late surrender from the chart. Basic: 17 vs A, 16 vs 9/10/A, 15 vs 10
  // (hard, two-card hands; pairs follow the pair-splitting table).
  static get SURRENDER_BASIC() {
    return new Set(['17 v 11', '16 v 9', '16 v 10', '16 v 11', '15 v 10']);
  }

  // Surrender indices from the chart. play 'R' = surrender, 'N' = don't.
  static get SURRENDER_DEVIATIONS() {
    return [
      { total: 16, up: 8,  index: 4,  dir: '+', play: 'R' },
      { total: 16, up: 9,  index: -1, dir: '-', play: 'N' },
      { total: 15, up: 9,  index: 2,  dir: '+', play: 'R' },
      { total: 15, up: 10, index: 0,  dir: '-', rc: true, play: 'N' },
      { total: 15, up: 11, index: -1, dir: '+', play: 'R' }
    ];
  }

  // Accepts null (basic strategy only), { tc, rc }, or a bare true count
  _normCount(count) {
    if (count === null || count === undefined) return null;
    if (typeof count === 'number') return { tc: count, rc: count };
    return count;
  }

  // Whether a deviation's index condition holds at this count
  isActive(d, count) {
    const c = this._normCount(count);
    if (!c) return false;
    if (d.rc) return d.dir === '+' ? c.rc > 0 : c.rc < 0;
    return d.dir === '+' ? c.tc >= d.index : c.tc <= d.index;
  }

  // Basic strategy never insures; with deviations on, insure at TC >= +3
  shouldTakeInsurance(trueCount = null) {
    return trueCount !== null && trueCount >= BasicStrategy.INSURANCE_INDEX;
  }

  _upValue(dealerUpcard) {
    if (dealerUpcard === 'A') return 11;
    return ['10','J','Q','K'].includes(dealerUpcard) ? 10 : parseInt(dealerUpcard);
  }

  _upLabel(up) {
    return up === 11 ? 'A' : String(up);
  }

  _findDeviation(type, key, up) {
    return BasicStrategy.DEVIATIONS.find(d => d.type === type && d.up === up &&
      (type === 'pair' ? d.pair === key : d.total === key));
  }

  // The basic-strategy code for a deviation's cell
  basicPlayFor(d) {
    const di = d.up === 11 ? 9 : d.up - 2;
    if (d.type === 'pair') return this.pairs[d.pair][di];
    if (d.type === 'soft') return this.soft[d.total][di];
    return this.hard[d.total][di];
  }

  // Chart notation for an index: "4+", "-1-", "0+", "0-"
  indexLabel(d) {
    return `${d.index}${d.dir}`;
  }

  _condition(d) {
    if (d.rc) return d.dir === '+' ? 'any positive running count' : 'any negative running count';
    const sign = d.index > 0 ? '+' : '';
    return d.dir === '+' ? `TC ≥ ${sign}${d.index}` : `TC ≤ ${sign}${d.index}`;
  }

  _handLabel(d) {
    if (d.type === 'pair') return `${d.pair},${d.pair}`;
    if (d.type === 'soft') return `A,${d.total - 11}`;
    return String(d.total);
  }

  // e.g. "16 vs 9: stand at TC ≥ +4", "A,8 vs 6: stand at any negative running count"
  describeDeviation(d) {
    return `${this._handLabel(d)} vs ${this._upLabel(d.up)}: ${this._actionName(d.play).toLowerCase()} at ${this._condition(d)}`;
  }

  describeSurrender(d) {
    const verb = d.play === 'R' ? 'surrender' : "don't surrender";
    return `${d.total} vs ${this._upLabel(d.up)}: ${verb} at ${this._condition(d)}`;
  }

  // Rows for the strategy panel: insurance, every chart deviation, and the
  // surrender indices when late surrender is offered.
  getDeviationTable(count, { surrender = false } = {}) {
    const c = this._normCount(count) || { tc: 0, rc: 0 };
    const rows = [{
      section: 'Insurance', hand: 'Insurance', up: 'A', indexText: '3+',
      basic: 'NO', deviation: 'YES', inEffect: c.tc >= BasicStrategy.INSURANCE_INDEX, rule: null
    }];
    BasicStrategy.DEVIATIONS.forEach(d => {
      rows.push({
        section: d.type === 'pair' ? 'Pairs' : d.type === 'soft' ? 'Soft' : 'Hard',
        hand: this._handLabel(d),
        up: this._upLabel(d.up),
        indexText: this.indexLabel(d),
        basic: this._actionName(this.basicPlayFor(d)),
        deviation: this._actionName(d.play),
        inEffect: this.isActive(d, c),
        rule: this.describeDeviation(d)
      });
    });
    if (surrender) {
      BasicStrategy.SURRENDER_DEVIATIONS.forEach(d => {
        const basicSurr = BasicStrategy.SURRENDER_BASIC.has(`${d.total} v ${d.up}`);
        rows.push({
          section: 'Surrender',
          hand: String(d.total),
          up: this._upLabel(d.up),
          indexText: this.indexLabel(d),
          basic: basicSurr ? 'SURRENDER' : 'NO SURR.',
          deviation: d.play === 'R' ? 'SURRENDER' : 'NO SURR.',
          inEffect: this.isActive(d, c),
          rule: this.describeSurrender(d)
        });
      });
    }
    return rows;
  }

  // Decides late surrender for a two-card, non-pair hard hand.
  _surrenderDecision(playerCards, up, count) {
    const [c1, c2] = playerCards;
    const val = this._handValue(playerCards);
    if (val.soft || this.getPairKey(c1.rank) === this.getPairKey(c2.rank)) {
      return { surrender: false, info: null };
    }
    const basic = BasicStrategy.SURRENDER_BASIC.has(`${val.total} v ${up}`);
    const dev = count
      ? BasicStrategy.SURRENDER_DEVIATIONS.find(d => d.total === val.total && d.up === up)
      : null;
    let surrender = basic;
    if (dev && this.isActive(dev, count)) surrender = dev.play === 'R';
    return {
      surrender,
      info: dev ? { rule: this.describeSurrender(dev), applied: surrender !== basic } : null
    };
  }

  // Returns { action, code, deviation }. `count` is null for plain basic
  // strategy, or { tc, rc } (true and running count) to apply the chart's
  // deviations. `deviation` is set whenever the hand has an index on the
  // chart, with `applied` true when the count changes the basic play.
  getRecommendation(playerCards, dealerUpcard, canDouble, canSplit, count = null, canSurrender = false) {
    count = this._normCount(count);
    const di = this.getDealerIndex(dealerUpcard);
    const up = this._upValue(dealerUpcard);
    const handVal = this._handValue(playerCards);

    // Late surrender comes before any other decision on the first two cards
    let surrenderInfo = null;
    if (canSurrender && playerCards.length === 2) {
      const sur = this._surrenderDecision(playerCards, up, count);
      if (sur.surrender) return { action: 'SURRENDER', code: 'R', deviation: sur.info };
      surrenderInfo = sur.info;
    }

    // Pairs
    let pairInfo = null;
    if (playerCards.length === 2) {
      const r1 = this.getPairKey(playerCards[0].rank);
      const r2 = this.getPairKey(playerCards[1].rank);
      if (r1 === r2 && this.pairs[r1]) {
        const basic = this.pairs[r1][di];
        const dev = count && canSplit ? this._findDeviation('pair', r1, up) : null;
        const chosen = dev && this.isActive(dev, count) ? dev.play : basic;
        const info = dev ? this._deviationInfo(dev, basic, chosen) : null;
        if (chosen === 'P' && canSplit) {
          return { action: 'SPLIT', code: 'P', deviation: info };
        }
        // Not splitting: play it as a hard/soft total
        pairInfo = info;
      }
    }

    // Soft or hard total
    const soft = handVal.soft && handVal.total >= 12 && handVal.total <= 21;
    const total = soft ? handVal.total : Math.min(Math.max(handVal.total, 5), 21);
    const basic = (soft ? this.soft : this.hard)[total][di];
    const dev = count ? this._findDeviation(soft ? 'soft' : 'hard', total, up) : null;
    const chosen = dev && this.isActive(dev, count) ? dev.play : basic;

    let code = chosen;
    if (code === 'D' && !canDouble) code = 'H';
    if (code === 'Ds') code = canDouble ? 'D' : 'S';

    const info = dev ? this._deviationInfo(dev, basic, chosen) : (pairInfo || surrenderInfo);
    return { action: this._actionName(code), code, deviation: info };
  }

  _deviationInfo(dev, basicCode, chosenCode) {
    return { rule: this.describeDeviation(dev), applied: basicCode !== chosenCode };
  }

  _actionName(code) {
    const names = { 'H': 'HIT', 'S': 'STAND', 'D': 'DOUBLE', 'Ds': 'DOUBLE', 'P': 'SPLIT', 'R': 'SURRENDER' };
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
