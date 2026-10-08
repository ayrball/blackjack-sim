class BettingSystem {
  constructor(startingBankroll = 1000, minBet = 5, maxBet = 500) {
    this.startingBankroll = startingBankroll;
    this.minBet = minBet;
    this.maxBet = maxBet;
    this.reset(startingBankroll);
  }

  reset(startingBankroll) {
    this.bankroll = startingBankroll;
    this.stagedBet = 0;
    this.lastBet = 0;
    this.hands = 1;
  }

  // Number of hands played per round; the staged bet goes on each one
  setHands(n) {
    this.hands = n;
  }

  getTotalStake() {
    return this.stagedBet * this.hands;
  }

  getBankroll() {
    return this.bankroll;
  }

  getCurrentBet() {
    return this.stagedBet;
  }

  addChip(value) {
    if (this.stagedBet + value > this.maxBet) return false;
    if ((this.stagedBet + value) * this.hands > this.bankroll) return false;
    this.stagedBet += value;
    return true;
  }

  clearBet() {
    this.stagedBet = 0;
  }

  repeatBet() {
    if (this.lastBet * this.hands > this.bankroll) return false;
    this.stagedBet = this.lastBet;
    return true;
  }

  // Staged bet meets the table minimum and the bankroll covers it on every hand
  isBetValid() {
    return this.stagedBet >= this.minBet && this.stagedBet > 0 && this.getTotalStake() <= this.bankroll;
  }

  placeBet() {
    if (!this.isBetValid()) return false;
    this.bankroll -= this.getTotalStake();
    this.lastBet = this.stagedBet;
    return this.stagedBet; // per hand
  }

  // Extra money put out mid-round: doubles, splits, insurance
  withdraw(amount) {
    if (amount > this.bankroll) return false;
    this.bankroll -= amount;
    return true;
  }

  payout(amount) {
    this.bankroll += amount;
  }

  getLastBet() {
    return this.lastBet;
  }

  canBet(amount) {
    return this.bankroll >= amount;
  }
}
window.BettingSystem = BettingSystem;

// "$1,002" for whole amounts, "$1,002.50" when a 3:2 payout leaves cents
function formatMoney(amount) {
  const cents = !Number.isInteger(amount);
  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2
  });
}
window.formatMoney = formatMoney;
