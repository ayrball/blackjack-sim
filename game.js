// Table state is a row of seats ("spots"), dealt left to right. Each spot holds
// one hand, or up to four after splits. The app decides who owns each spot.
class BlackjackGame {
  constructor(numDecks = 6) {
    this.numDecks = numDecks;
    this.ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    this.suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    this.maxHandsPerSpot = 4;
    this.state = null;
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

  newHand(cards, extra = {}) {
    return {
      cards,
      bet: 0,
      isStood: false,
      isDoubled: false,
      isBusted: false,
      hasBlackjack: false,
      isSplitAce: false,
      surrendered: false,
      result: null,
      ...extra
    };
  }

  // Deals one card to each spot, the dealer's upcard, a second card to each
  // spot, then the hole card. `dealOrder` lists every card in that order.
  startRound(spotCount) {
    const spots = [];
    for (let i = 0; i < spotCount; i++) {
      spots.push({ hands: [this.newHand([])] });
    }
    const dealerCards = [];
    const dealOrder = [];

    for (let pass = 0; pass < 2; pass++) {
      spots.forEach((spot, s) => {
        const card = this.drawCard();
        spot.hands[0].cards.push(card);
        dealOrder.push({ target: 'spot', spot: s, card });
      });
      const card = this.drawCard();
      dealerCards.push(card);
      dealOrder.push({ target: 'dealer', card, hole: pass === 1 });
    }

    for (const spot of spots) {
      const hand = spot.hands[0];
      if (this.isBlackjack(hand.cards)) {
        hand.hasBlackjack = true;
        hand.isStood = true;
      }
    }

    this.state = { spots, dealerCards, dealerHoleHidden: true };
    return dealOrder;
  }

  getHand(spotIndex, handIndex) {
    return this.state.spots[spotIndex].hands[handIndex];
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

    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return { total, soft: aces > 0 && total <= 21 };
  }

  isBlackjack(cards) {
    return cards.length === 2 && this.handValue(cards).total === 21;
  }

  isBust(cards) {
    return this.handValue(cards).total > 21;
  }

  hit(spotIndex, handIndex) {
    const hand = this.getHand(spotIndex, handIndex);
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

  stand(spotIndex, handIndex) {
    const hand = this.getHand(spotIndex, handIndex);
    if (hand) hand.isStood = true;
  }

  canDouble(spotIndex, handIndex) {
    const hand = this.getHand(spotIndex, handIndex);
    return hand.cards.length === 2 && !hand.isStood && !hand.isBusted;
  }

  double(spotIndex, handIndex) {
    if (!this.canDouble(spotIndex, handIndex)) return null;
    const hand = this.getHand(spotIndex, handIndex);
    const card = this.drawCard();
    hand.cards.push(card);
    hand.isDoubled = true;
    hand.isStood = true;
    if (this.isBust(hand.cards)) {
      hand.isBusted = true;
    }
    return card;
  }

  // Late surrender: first two cards of an unsplit hand, after the dealer peeks
  canSurrender(spotIndex, handIndex) {
    const spot = this.state.spots[spotIndex];
    const hand = spot.hands[handIndex];
    return spot.hands.length === 1 && hand.cards.length === 2 && !hand.isStood;
  }

  surrender(spotIndex, handIndex) {
    if (!this.canSurrender(spotIndex, handIndex)) return false;
    const hand = this.getHand(spotIndex, handIndex);
    hand.surrendered = true;
    hand.isStood = true;
    return true;
  }

  canSplit(spotIndex, handIndex) {
    const spot = this.state.spots[spotIndex];
    const hand = spot.hands[handIndex];
    if (hand.cards.length !== 2 || hand.isStood || spot.hands.length >= this.maxHandsPerSpot) return false;

    const isTen = r => ['10', 'J', 'Q', 'K'].includes(r);
    const [r1, r2] = [hand.cards[0].rank, hand.cards[1].rank];
    return (isTen(r1) && isTen(r2)) || r1 === r2;
  }

  // Splits a pair into two hands that each carry the original bet. Split aces
  // get one card each and stand.
  split(spotIndex, handIndex) {
    if (!this.canSplit(spotIndex, handIndex)) return null;

    const spot = this.state.spots[spotIndex];
    const hand = spot.hands[handIndex];
    const [c1, c2] = hand.cards;
    const splitAces = c1.rank === 'A';

    const hand1 = this.newHand([c1, this.drawCard()], { bet: hand.bet, isSplitAce: splitAces });
    const hand2 = this.newHand([c2, this.drawCard()], { bet: hand.bet, isSplitAce: splitAces });
    for (const h of [hand1, hand2]) {
      if (splitAces || this.handValue(h.cards).total === 21) h.isStood = true;
    }

    spot.hands.splice(handIndex, 1, hand1, hand2);
    return [hand1.cards[1], hand2.cards[1]];
  }

  dealerHasBlackjack() {
    return this.isBlackjack(this.state.dealerCards);
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

  getHandResult(playerCards, dealerCards, playerBlackjack, dealerBlackjack, surrendered = false) {
    if (surrendered) return 'surrender';
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
    if (result === 'surrender') return 0.5;
    return 0;
  }

  getState() {
    return this.state;
  }
}
window.BlackjackGame = BlackjackGame;
