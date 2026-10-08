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

  getSuggestedBet(minBet = 5, maxBet = 500) {
    // Bet by whole true count (floored), matching the spread shown in settings
    const tc = Math.floor(this.getTrueCount());
    let bet;
    if (tc <= 1) bet = minBet;
    else if (tc < 3) bet = minBet * 2;
    else if (tc < 4) bet = minBet * 4;
    else if (tc < 5) bet = minBet * 8;
    else bet = minBet * 12;
    return Math.min(bet, maxBet);
  }

  // Returns the full bet spread for display in settings
  getBetSpread(minBet = 5, maxBet = 500) {
    return [
      { tc: '≤ 1', units: 1, bet: Math.min(minBet, maxBet) },
      { tc: '2', units: 2, bet: Math.min(minBet * 2, maxBet) },
      { tc: '3', units: 4, bet: Math.min(minBet * 4, maxBet) },
      { tc: '4', units: 8, bet: Math.min(minBet * 8, maxBet) },
      { tc: '≥ 5', units: 12, bet: Math.min(minBet * 12, maxBet) },
    ];
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
