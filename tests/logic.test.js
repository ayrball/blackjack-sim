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
  g.state = { dealerCards: cards('A', '6'), playerHands: [] };
  g.shoe = cards('10'); // next draw
  assert.equal(g.dealerPlay().length, 1);
  g.state = { dealerCards: cards('10', '7'), playerHands: [] };
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
