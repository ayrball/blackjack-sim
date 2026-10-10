class CardCounter {
  constructor(numDecks = 6) {
    this.numDecks = numDecks;
    this.reset();
  }

  reset() {
    this.runningCount = 0;
    this.cardsDealt = 0;
    this.cardsSeen = { 'A': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0, 'J': 0, 'Q': 0, 'K': 0 };
  }

  getHiLoValue(rank) {
    if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
    if (['7', '8', '9'].includes(rank)) return 0;
    if (['10', 'J', 'Q', 'K', 'A'].includes(rank)) return -1;
    return 0;
  }

  countCard(rank) {
    this.runningCount += this.getHiLoValue(rank);
    this.cardsDealt++;
    if (this.cardsSeen[rank] !== undefined) {
      this.cardsSeen[rank]++;
    }
  }

  getRunningCount() {
    return this.runningCount;
  }

  getCardsRemaining() {
    return (this.numDecks * 52) - this.cardsDealt;
  }

  getDecksRemaining() {
    const decks = this.getCardsRemaining() / 52;
    return Math.round(decks * 10) / 10;
  }

  getTrueCount() {
    const decksRemaining = this.getDecksRemaining();
    if (decksRemaining === 0) return 0;
    const trueCount = this.runningCount / decksRemaining;
    return Math.round(trueCount * 10) / 10;
  }

  getPenetration() {
    const total = this.numDecks * 52;
    return Math.round((this.cardsDealt / total) * 100);
  }

  // Bet ramps in units of the table minimum, by whole true count:
  // TC ≤ 1, 2, 3, 4, ≥ 5. Wider spreads earn more but swing harder.
  static get SPREADS() {
    return {
      '1-4':  { label: '1–4 (conservative)', units: [1, 2, 3, 4, 4] },
      '1-8':  { label: '1–8 (moderate)',     units: [1, 2, 4, 6, 8] },
      '1-12': { label: '1–12 (standard)',    units: [1, 2, 4, 8, 12] },
      '1-16': { label: '1–16 (aggressive)',  units: [1, 4, 8, 12, 16] }
    };
  }

  _spreadTier() {
    // Bet by whole true count (floored), matching the spread shown in settings
    const tc = Math.floor(this.getTrueCount());
    return Math.min(Math.max(tc - 1, 0), 4);
  }

  getSuggestedBet(minBet = 5, maxBet = 500, spread = '1-12') {
    const units = (CardCounter.SPREADS[spread] || CardCounter.SPREADS['1-12']).units;
    return Math.min(minBet * units[this._spreadTier()], maxBet);
  }

  // Returns the full bet spread for display in settings
  getBetSpread(minBet = 5, maxBet = 500, spread = '1-12') {
    const units = (CardCounter.SPREADS[spread] || CardCounter.SPREADS['1-12']).units;
    const labels = ['≤ 1', '2', '3', '4', '≥ 5'];
    return units.map((u, i) => ({ tc: labels[i], units: u, bet: Math.min(minBet * u, maxBet) }));
  }

  getPlayerEdge() {
    // Rule of thumb: about -0.5% off the top, +0.5% per true count (break-even near TC +1)
    return this.getTrueCount() * 0.5 - 0.5;
  }

  getCardsSeen() {
    return this.cardsSeen;
  }

  getTotalPerRank() {
    return this.numDecks * 4;
  }
}
window.CardCounter = CardCounter;
