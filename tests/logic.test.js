// Unit tests for the DOM-free game modules. Run with: node --test tests/*.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// The modules attach their classes to `window`, so load them into a sandbox that has one
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['counting.js', 'betting.js', 'strategy.js', 'game.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox);
}
const { CardCounter, BettingSystem, BasicStrategy, BlackjackGame, formatMoney } = sandbox.window;

const cards = (...ranks) => ranks.map(rank => ({ rank, suit: 'spades' }));

test('handValue handles soft and hard aces', () => {
  const g = new BlackjackGame(1);
  assert.deepEqual({ ...g.handValue(cards('A', '6')) }, { total: 17, soft: true });
  assert.deepEqual({ ...g.handValue(cards('A', '6', '10')) }, { total: 17, soft: false });
  assert.deepEqual({ ...g.handValue(cards('A', 'A')) }, { total: 12, soft: true });
  assert.deepEqual({ ...g.handValue(cards('K', 'Q', '5')) }, { total: 25, soft: false });
});

test('dealer hits soft 17 and stands on hard 17', () => {
  const g = new BlackjackGame(1);
  g.state = { dealerCards: cards('A', '6'), spots: [] };
  g.shoe = cards('10'); // next draw
  assert.equal(g.dealerPlay().length, 1);
  g.state = { dealerCards: cards('10', '7'), spots: [] };
  assert.equal(g.dealerPlay().length, 0);
});

test('hand results and payouts', () => {
  const g = new BlackjackGame(1);
  assert.equal(g.getHandResult(cards('A', 'K'), cards('10', '9'), true, false), 'blackjack');
  assert.equal(g.getHandResult(cards('A', 'K'), cards('A', 'K'), true, true), 'push');
  assert.equal(g.getHandResult(cards('10', '9'), cards('A', 'K'), false, true), 'loss');
  assert.equal(g.getHandResult(cards('10', '8'), cards('10', '6', '9'), false, false), 'win');
  assert.equal(g.getPayoutMultiplier('blackjack'), 2.5);
  assert.equal(g.getPayoutMultiplier('win'), 2);
});

test('basic strategy: key 6-deck H17 DAS plays', () => {
  const s = new BasicStrategy();
  const rec = (ranks, up, dbl = true, spl = true) => s.getRecommendation(cards(...ranks), up, dbl, spl).action;
  assert.equal(rec(['A', 'A'], '5'), 'SPLIT');
  assert.equal(rec(['A', 'A'], '5', true, false), 'HIT'); // soft 12 when a split isn't possible
  assert.equal(rec(['8', '8'], 'A'), 'SPLIT');
  assert.equal(rec(['10', 'K'], '6'), 'STAND');
  assert.equal(rec(['5', '6'], 'A'), 'DOUBLE'); // 11 vs A doubles under H17
  assert.equal(rec(['A', '7'], '3'), 'DOUBLE');
  assert.equal(rec(['A', '7'], '3', false), 'STAND'); // Ds falls back to stand
  assert.equal(rec(['A', '7'], '9'), 'HIT');
  assert.equal(rec(['10', '2'], '3'), 'HIT');
  assert.equal(rec(['10', '2'], '4'), 'STAND');
  assert.equal(rec(['10', '6'], 'K'), 'HIT');
  assert.equal(rec(['9', '9'], '7'), 'STAND');
});

test('true count, suggested bet and edge line up', () => {
  const c = new CardCounter(6);
  assert.equal(c.getPlayerEdge(), -0.5);
  // Running count +6 with 3 decks left -> TC +2
  for (let i = 0; i < 6; i++) c.countCard('5');
  for (let i = 0; i < 150; i++) c.countCard('8');
  assert.equal(c.getDecksRemaining(), 3);
  assert.equal(c.getTrueCount(), 2);
  assert.equal(c.getSuggestedBet(5, 500), 10);
  assert.equal(c.getPlayerEdge(), 0.5);
});

test('suggested bet uses whole true counts, matching the settings spread', () => {
  const c = new CardCounter(6);
  c.getTrueCount = () => 1.5;
  assert.equal(c.getSuggestedBet(5, 500), 5);
  c.getTrueCount = () => 2.0;
  assert.equal(c.getSuggestedBet(5, 500), 10);
  c.getTrueCount = () => 7;
  assert.equal(c.getSuggestedBet(5, 50), 50); // capped at table max
});

test('betting enforces table minimum and bankroll', () => {
  const b = new BettingSystem(100, 5, 500);
  b.addChip(1);
  assert.equal(b.isBetValid(), false);
  assert.equal(b.placeBet(), false);
  b.addChip(5);
  assert.equal(b.placeBet(), 6);
  assert.equal(b.getBankroll(), 94);
  assert.equal(b.addChip(100), false); // more than the bankroll
});

test('formatMoney', () => {
  assert.equal(formatMoney(1000), '$1,000');
  assert.equal(formatMoney(1002.5), '$1,002.50');
  assert.equal(formatMoney(0), '$0');
});

// Stacks the shoe so the next draws come out in the given order
function stackShoe(game, ...ranks) {
  game.shoe = cards(...ranks).reverse();
}

test('startRound deals one card per seat, dealer up, second pass, then hole', () => {
  const g = new BlackjackGame(1);
  stackShoe(g, '2', '3', '4', 'A', '5', '6', '7', 'K');
  const order = g.startRound(3);
  assert.deepEqual(Array.from(order, o => o.card.rank), ['2', '3', '4', 'A', '5', '6', '7', 'K']);
  assert.deepEqual(Array.from(order, o => o.target === 'dealer' ? 'D' : o.spot), [0, 1, 2, 'D', 0, 1, 2, 'D']);
  assert.equal(order[7].hole, true);
  const spots = g.getState().spots;
  assert.deepEqual(Array.from(spots[0].hands[0].cards, c => c.rank), ['2', '5']);
  assert.deepEqual(Array.from(g.getState().dealerCards, c => c.rank), ['A', 'K']);
  assert.equal(g.dealerHasBlackjack(), true);
});

test('blackjack on the deal stands automatically', () => {
  const g = new BlackjackGame(1);
  stackShoe(g, 'A', '9', 'K', '7');
  g.startRound(1);
  const hand = g.getHand(0, 0);
  assert.equal(hand.hasBlackjack, true);
  assert.equal(hand.isStood, true);
});

test('split keeps the bet on both hands; split aces get one card and stand', () => {
  const g = new BlackjackGame(1);
  stackShoe(g, '8', '9', '8', '7', '3', 'K');
  g.startRound(1);
  g.getHand(0, 0).bet = 25;
  assert.equal(g.canSplit(0, 0), true);
  g.split(0, 0);
  const hands = g.getState().spots[0].hands;
  assert.equal(hands.length, 2);
  assert.deepEqual(Array.from(hands, h => h.bet), [25, 25]);
  assert.deepEqual(Array.from(hands, h => h.cards.map(c => c.rank).join()), ['8,3', '8,K']);

  const g2 = new BlackjackGame(1);
  stackShoe(g2, 'A', '9', 'A', '7', '5', '6');
  g2.startRound(1);
  g2.split(0, 0);
  assert.ok(g2.getState().spots[0].hands.every(h => h.isStood && h.isSplitAce));
});

test('two hands: stake doubles and the bankroll must cover both', () => {
  const b = new BettingSystem(60, 5, 500);
  b.setHands(2);
  b.addChip(25);
  assert.equal(b.getTotalStake(), 50);
  assert.equal(b.addChip(25), false); // 2 x 50 would exceed 60
  assert.equal(b.placeBet(), 25);
  assert.equal(b.getBankroll(), 10);
  assert.equal(b.withdraw(25), false);
  assert.equal(b.withdraw(10), true);
});

test('Illustrious 18 deviations switch at their index', () => {
  const s = new BasicStrategy();
  const rec = (ranks, up, tc, dbl = true, spl = true) => s.getRecommendation(cards(...ranks), up, dbl, spl, tc);

  assert.equal(rec(['10', '6'], 'K', -1).action, 'HIT');
  const stand16 = rec(['10', '6'], 'K', 0);
  assert.equal(stand16.action, 'STAND');
  assert.equal(stand16.deviation.applied, true);
  assert.equal(stand16.deviation.rule, '16 vs 10: stand at TC ≥ 0');

  assert.equal(rec(['K', 'Q'], '6', 3.9).action, 'STAND');
  assert.equal(rec(['K', 'Q'], '6', 4).action, 'SPLIT');
  assert.equal(rec(['K', 'Q'], '5', 5).action, 'SPLIT');
  assert.equal(rec(['10', '2'], '4', -0.5).action, 'HIT');
  assert.equal(rec(['10', '3'], '2', -1.5).action, 'HIT');
  assert.equal(rec(['5', '4'], '2', 1).action, 'DOUBLE');
  assert.equal(rec(['6', '4'], 'A', 3).action, 'DOUBLE');
  assert.equal(rec(['6', '4'], 'A', 2).action, 'HIT');
  // Can't double: the deviation falls back to a hit, and isn't reported as a change
  const noDouble = rec(['5', '6'], 'A', 0, false);
  assert.equal(noDouble.action, 'HIT');
  // Without a count, plain basic strategy and no deviation info
  const basic = rec(['10', '6'], 'K', null);
  assert.equal(basic.action, 'HIT');
  assert.equal(basic.deviation, null);

  assert.equal(s.shouldTakeInsurance(3), true);
  assert.equal(s.shouldTakeInsurance(2.9), false);
  assert.equal(s.shouldTakeInsurance(null), false);
});

test('H17 index values and how they are described', () => {
  const s = new BasicStrategy();
  const rec = (ranks, up, tc) => s.getRecommendation(cards(...ranks), up, true, true, tc);
  // 12 vs 6 is -3 under H17 (S17 charts list -1)
  assert.equal(rec(['10', '2'], '6', -2).action, 'STAND');
  assert.equal(rec(['10', '2'], '6', -3.5).action, 'HIT');
  assert.equal(rec(['10', '2'], '6', -2).deviation.rule, '12 vs 6: hit at TC < -3');
  assert.equal(rec(['10', '3'], '2', 0).deviation.rule, '13 vs 2: hit at TC < -1');
  assert.equal(rec(['10', '2'], '2', 0).deviation.rule, '12 vs 2: stand at TC ≥ +3');
});

test('deviation table for the strategy panel', () => {
  const s = new BasicStrategy();
  const rows = s.getDeviationTable(3.2);
  assert.equal(rows.length, 18);
  assert.equal(rows[0].hand, 'Insurance');
  assert.equal(rows[0].current, 'YES');
  const r16 = rows.find(r => r.hand === '16' && r.up === '10');
  assert.equal(r16.basic, 'HIT');
  assert.equal(r16.deviation, 'STAND');
  assert.equal(r16.current, 'STAND');
  const r12v6 = rows.find(r => r.hand === '12' && r.up === '6');
  assert.equal(r12v6.below, true);
  assert.equal(r12v6.deviation, 'HIT');
  assert.equal(r12v6.current, 'STAND'); // not in effect at +3.2
  const tens = rows.find(r => r.hand === '10,10' && r.up === '5');
  assert.equal(tens.current, 'STAND'); // needs +5
});

test('suggested bet follows the chosen spread', () => {
  const c = new CardCounter(6);
  const at = (tc, spread) => { c.getTrueCount = () => tc; return c.getSuggestedBet(5, 500, spread); };
  assert.equal(at(0, '1-12'), 5);
  assert.equal(at(3.4, '1-12'), 20);
  assert.equal(at(6, '1-12'), 60);
  assert.equal(at(3, '1-4'), 15);
  assert.equal(at(9, '1-4'), 20);
  assert.equal(at(4, '1-8'), 30);
  assert.equal(at(2, '1-16'), 20);
  assert.equal(at(5, '1-16'), 80);
  assert.equal(at(-4, '1-16'), 5);
  assert.deepEqual(Array.from(c.getBetSpread(10, 500, '1-8'), r => r.bet), [10, 20, 40, 60, 80]);
});

test('setBet trims to table max and bankroll', () => {
  const b = new BettingSystem(100, 5, 50);
  assert.equal(b.setBet(80), true);
  assert.equal(b.getCurrentBet(), 50); // table max
  b.setHands(2);
  assert.equal(b.setBet(80), true);
  assert.equal(b.getCurrentBet(), 50); // 2 x 50 = bankroll
  const poor = new BettingSystem(4, 5, 500);
  assert.equal(poor.setBet(20), false);
});
