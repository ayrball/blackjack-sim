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

  placeBet() {
    if (this.stagedBet === 0 || this.stagedBet > this.bankroll) return false;
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
