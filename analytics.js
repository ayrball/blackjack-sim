class Analytics {
  constructor(startingBankroll = 1000) {
    this.reset(startingBankroll);
  }

  reset(startingBankroll) {
    this.startingBankroll = startingBankroll;
    this.history = [startingBankroll];
    this.hands = 0;
    this.wins = 0;
    this.losses = 0;
    this.pushes = 0;
    this.blackjacks = 0;
    this.totalWagered = 0;
  }

  recordHand({ bet, outcome, payout, bankrollAfter }) {
    this.hands++;
    this.totalWagered += bet;
    
    if (outcome === 'win') this.wins++;
    else if (outcome === 'loss') this.losses++;
    else if (outcome === 'push') this.pushes++;
    else if (outcome === 'blackjack') {
      this.wins++;
      this.blackjacks++;
    } else if (outcome === 'surrender') {
      this.losses++;
    }

    this.history.push(bankrollAfter);
  }

  getStats() {
    const winRate = this.hands > 0 ? ((this.wins) / this.hands * 100).toFixed(1) : 0;
    const currentBankroll = this.history[this.history.length - 1];
    const netPnl = currentBankroll - this.startingBankroll;

    return {
      hands: this.hands,
      wins: this.wins,
      losses: this.losses,
      pushes: this.pushes,
      blackjacks: this.blackjacks,
      winRate: parseFloat(winRate),
      totalWagered: this.totalWagered,
      netPnl: netPnl
    };
  }

  getBankrollHistory() {
    return this.history;
  }

  drawChart(canvasElement) {
    if (!canvasElement) return;
    const ctx = canvasElement.getContext('2d');
    const width = canvasElement.parentElement ? canvasElement.parentElement.clientWidth : canvasElement.width;
    canvasElement.width = width;
    const height = canvasElement.height;

    ctx.clearRect(0, 0, width, height);

    if (this.history.length <= 1) {
      ctx.fillStyle = '#888';
      ctx.font = '16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Play hands to see chart', width / 2, height / 2);
      return;
    }

    const maxVal = Math.max(...this.history, this.startingBankroll + 100);
    const minVal = Math.min(...this.history, this.startingBankroll - 100);
    const range = maxVal - minVal;

    const padX = 50;
    const padY = 20;
    const chartW = width - padX - 10;
    const chartH = height - padY * 2;

    const baseY = padY + chartH - ((this.startingBankroll - minVal) / range) * chartH;
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.moveTo(padX, baseY);
    ctx.lineTo(width - 10, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#aaa';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${maxVal}`, padX - 10, padY);
    ctx.fillText(`$${minVal}`, padX - 10, padY + chartH);
    ctx.fillText(`$${this.startingBankroll}`, padX - 10, baseY);

    const grad = ctx.createLinearGradient(0, padY, 0, padY + chartH);
    grad.addColorStop(0, 'rgba(212, 168, 67, 0.5)');
    grad.addColorStop(1, 'rgba(212, 168, 67, 0)');

    ctx.beginPath();
    ctx.moveTo(padX, padY + chartH - ((this.history[0] - minVal) / range) * chartH);

    for (let i = 0; i < this.history.length; i++) {
      const x = padX + (i / (this.history.length - 1)) * chartW;
      const y = padY + chartH - ((this.history[i] - minVal) / range) * chartH;
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = '#d4a843';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(padX + chartW, padY + chartH);
    ctx.lineTo(padX, padY + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }
}
window.Analytics = Analytics;
