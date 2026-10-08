class BlackjackGame {
  constructor(numDecks = 6) {
    this.numDecks = numDecks;
    this.ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    this.suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    this.initShoe();
  }

  initShoe() {
    this.shoe = [];
    for (let i = 0; i < this.numDecks; i++) {
      for (const suit of this.suits) {
        for (const rank of this.ranks) {
          this.shoe.push({ rank, suit });
        }
      }
    }
    this.shuffleShoe();
  }

  shuffleShoe() {
    for (let i = this.shoe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shoe[i], this.shoe[j]] = [this.shoe[j], this.shoe[i]];
    }
  }

  needsShuffle() {
    const totalCards = this.getTotalCards();
    return this.shoe.length < totalCards * 0.25;
  }

  drawCard() {
    if (this.shoe.length === 0) this.initShoe();
    return this.shoe.pop();
  }

  getShoeSize() {
    return this.shoe.length;
  }

  getTotalCards() {
    return this.numDecks * 52;
  }

  startHand() {
    this.state = {
      playerHands: [
        {
          cards: [this.drawCard(), this.drawCard()],
          isStood: false,
          isDoubled: false,
          isBusted: false,
          hasBlackjack: false
        }
      ],
      dealerCards: [this.drawCard(), this.drawCard()],
      dealerHoleHidden: true,
      insuranceTaken: false
    };

    const ph = this.state.playerHands[0];
    const val = this.handValue(ph.cards);
    if (val.total === 21 && ph.cards.length === 2) {
      ph.hasBlackjack = true;
      ph.isStood = true;
    }

    return {
      playerCards: ph.cards,
      dealerCards: this.state.dealerCards,
      dealerHoleHidden: true
    };
  }

  handValue(cards) {
    let total = 0;
    let aces = 0;
    
    for (const card of cards) {
      if (card.rank === 'A') {
        aces++;
        total += 11;
      } else if (['10', 'J', 'Q', 'K'].includes(card.rank)) {
        total += 10;
      } else {
        total += parseInt(card.rank);
      }
    }
    
    let soft = false;
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    
    if (aces > 0 && total <= 21) {
      soft = true;
    }
    
    return { total, soft };
  }

  isBlackjack(cards) {
    return cards.length === 2 && this.handValue(cards).total === 21;
  }

  isBust(cards) {
    return this.handValue(cards).total > 21;
  }

  hit(handIndex = 0) {
    const hand = this.state.playerHands[handIndex];
    if (hand.isStood || hand.isBusted) return null;
    
    const card = this.drawCard();
    hand.cards.push(card);
    
    if (this.isBust(hand.cards)) {
      hand.isBusted = true;
      hand.isStood = true;
    } else if (this.handValue(hand.cards).total === 21) {
      hand.isStood = true;
    }
    
    return card;
  }

  stand(handIndex = 0) {
    if (this.state.playerHands[handIndex]) {
      this.state.playerHands[handIndex].isStood = true;
    }
  }

  canDouble(handIndex = 0) {
    const hand = this.state.playerHands[handIndex];
    return hand.cards.length === 2 && !hand.isStood && !hand.isBusted;
  }

  double(handIndex = 0) {
    if (!this.canDouble(handIndex)) return null;
    const hand = this.state.playerHands[handIndex];
    const card = this.drawCard();
    hand.cards.push(card);
    hand.isDoubled = true;
    hand.isStood = true;
    if (this.isBust(hand.cards)) {
      hand.isBusted = true;
    }
    return card;
  }

  canSplit(handIndex = 0) {
    const hand = this.state.playerHands[handIndex];
    if (hand.cards.length !== 2 || this.state.playerHands.length >= 4) return false;
    
    const rank1 = hand.cards[0].rank;
    const rank2 = hand.cards[1].rank;
    
    const isTen1 = ['10', 'J', 'Q', 'K'].includes(rank1);
    const isTen2 = ['10', 'J', 'Q', 'K'].includes(rank2);
    
    if (isTen1 && isTen2) return true;
    return rank1 === rank2;
  }

  split(handIndex) {
    if (!this.canSplit(handIndex)) return null;
    
    const hand = this.state.playerHands[handIndex];
    const card2 = hand.cards.pop();
    
    const newHand1 = {
      cards: [hand.cards[0], this.drawCard()],
      isStood: false,
      isDoubled: false,
      isBusted: false,
      hasBlackjack: false,
      isSplitAce: hand.cards[0].rank === 'A'
    };
    
    const newHand2 = {
      cards: [card2, this.drawCard()],
      isStood: false,
      isDoubled: false,
      isBusted: false,
      hasBlackjack: false,
      isSplitAce: card2.rank === 'A'
    };
    
    if (newHand1.isSplitAce) newHand1.isStood = true;
    if (newHand2.isSplitAce) newHand2.isStood = true;
    
    this.state.playerHands.splice(handIndex, 1, newHand1, newHand2);
    
    return { hand1: newHand1.cards, hand2: newHand2.cards };
  }

  canInsurance() {
    return this.state.dealerCards[0].rank === 'A' && !this.state.insuranceTaken && this.state.playerHands.length === 1 && this.state.playerHands[0].cards.length === 2;
  }

  takeInsurance() {
    this.state.insuranceTaken = true;
  }

  revealHole() {
    this.state.dealerHoleHidden = false;
    return this.state.dealerCards[1];
  }

  dealerPlay() {
    const newCards = [];
    let val = this.handValue(this.state.dealerCards);
    while (val.total < 17 || (val.total === 17 && val.soft)) {
      const card = this.drawCard();
      this.state.dealerCards.push(card);
      newCards.push(card);
      val = this.handValue(this.state.dealerCards);
    }
    return newCards;
  }

  getHandResult(playerCards, dealerCards, playerBlackjack, dealerBlackjack) {
    if (playerBlackjack && dealerBlackjack) return 'push';
    if (playerBlackjack) return 'blackjack';
    if (dealerBlackjack) return 'loss';
    
    const pVal = this.handValue(playerCards).total;
    if (pVal > 21) return 'loss';
    
    const dVal = this.handValue(dealerCards).total;
    if (dVal > 21) return 'win';
    
    if (pVal > dVal) return 'win';
    if (pVal < dVal) return 'loss';
    return 'push';
  }

  getPayoutMultiplier(result) {
    if (result === 'blackjack') return 2.5;
    if (result === 'win') return 2;
    if (result === 'push') return 1;
    return 0;
  }

  getState() {
    return this.state;
  }

  resetHand() {
    this.state = null;
  }
}
window.BlackjackGame = BlackjackGame;
