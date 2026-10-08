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
  }

  getBankroll() {
    return this.bankroll;
  }

  getCurrentBet() {
    return this.stagedBet;
  }

  addChip(value) {
    if (this.stagedBet + value > this.maxBet) return false;
    if (this.stagedBet + value > this.bankroll) return false;
    this.stagedBet += value;
    return true;
  }

  clearBet() {
    this.stagedBet = 0;
  }

  repeatBet() {
    if (this.lastBet > this.bankroll) return false;
    this.stagedBet = this.lastBet;
    return true;
  }

  // Staged bet meets the table minimum and is covered by the bankroll
  isBetValid() {
    return this.stagedBet >= this.minBet && this.stagedBet > 0 && this.stagedBet <= this.bankroll;
  }

  placeBet() {
    if (!this.isBetValid()) return false;
    this.bankroll -= this.stagedBet;
    this.lastBet = this.stagedBet;
    return this.stagedBet;
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
