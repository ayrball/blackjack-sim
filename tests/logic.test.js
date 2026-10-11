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

test('surrender returns half the bet and only on an unsplit two-card hand', () => {
  const g = new BlackjackGame(1);
  stackShoe(g, '10', 'K', '6', '7', '5');
  g.startRound(1);
  assert.equal(g.canSurrender(0, 0), true);
  assert.equal(g.surrender(0, 0), true);
  const hand = g.getHand(0, 0);
  assert.equal(g.getHandResult(hand.cards, g.getState().dealerCards, false, false, hand.surrendered), 'surrender');
  assert.equal(g.getPayoutMultiplier('surrender'), 0.5);

  const g2 = new BlackjackGame(1);
  stackShoe(g2, '8', '9', '8', '7', '3', 'K');
  g2.startRound(1);
  g2.split(0, 0);
  assert.equal(g2.canSurrender(0, 0), false);
});

// Every index on the Blackjack Apprenticeship H17 Deviation Chart. Counts are
// { tc, rc } (true count, running count); `at` is just inside the index and
// `off` just outside it.
const count = (tc, rc = tc) => ({ tc, rc });

test('BJA H17 chart: pair splitting', () => {
  const s = new BasicStrategy();
  const rec = (ranks, up, c) => s.getRecommendation(cards(...ranks), up, true, true, c).action;
  assert.equal(rec(['K', 'Q'], '4', count(6)), 'SPLIT');
  assert.equal(rec(['K', 'Q'], '4', count(5.9)), 'STAND');
  assert.equal(rec(['K', 'Q'], '5', count(5)), 'SPLIT');
  assert.equal(rec(['K', 'Q'], '5', count(4.9)), 'STAND');
  assert.equal(rec(['K', 'Q'], '6', count(4)), 'SPLIT');
  assert.equal(rec(['K', 'Q'], '6', count(3.9)), 'STAND');
  assert.equal(rec(['K', 'Q'], '7', count(10)), 'STAND'); // no index vs 7
  assert.equal(rec(['8', '8'], 'A', count(-5)), 'SPLIT');
});

test('BJA H17 chart: soft totals', () => {
  const s = new BasicStrategy();
  const rec = (ranks, up, c, dbl = true) => s.getRecommendation(cards(...ranks), up, dbl, false, c).action;
  assert.equal(rec(['A', '8'], '4', count(3)), 'DOUBLE');
  assert.equal(rec(['A', '8'], '4', count(2.9)), 'STAND');
  assert.equal(rec(['A', '8'], '4', count(3), false), 'STAND'); // can't double: stand
  assert.equal(rec(['A', '8'], '5', count(1)), 'DOUBLE');
  assert.equal(rec(['A', '8'], '5', count(0.9)), 'STAND');
  assert.equal(rec(['A', '8'], '6', count(0, 0)), 'DOUBLE');    // basic Ds
  assert.equal(rec(['A', '8'], '6', count(-0.2, -1)), 'STAND'); // 0-: negative running count
  assert.equal(rec(['A', '6'], '2', count(1)), 'DOUBLE');
  assert.equal(rec(['A', '6'], '2', count(0.9)), 'HIT');
  assert.equal(rec(['A', '6'], '2', count(1), false), 'HIT');   // can't double: hit
});

test('BJA H17 chart: hard totals', () => {
  const s = new BasicStrategy();
  const rec = (ranks, up, c) => s.getRecommendation(cards(...ranks), up, true, false, c).action;
  assert.equal(rec(['10', '6'], '9', count(4)), 'STAND');
  assert.equal(rec(['10', '6'], '9', count(3.9)), 'HIT');
  assert.equal(rec(['10', '6'], 'K', count(0.2, 1)), 'STAND'); // 0+: positive running count
  assert.equal(rec(['10', '6'], 'K', count(0, 0)), 'HIT');
  assert.equal(rec(['10', '6'], 'A', count(3)), 'STAND');
  assert.equal(rec(['10', '6'], 'A', count(2.9)), 'HIT');
  assert.equal(rec(['10', '5'], 'K', count(4)), 'STAND');
  assert.equal(rec(['10', '5'], 'A', count(5)), 'STAND');
  assert.equal(rec(['10', '5'], 'A', count(4.9)), 'HIT');
  assert.equal(rec(['10', '3'], '2', count(-1)), 'HIT');        // -1-: at -1 and below
  assert.equal(rec(['10', '3'], '2', count(-0.9)), 'STAND');
  assert.equal(rec(['10', '2'], '2', count(3)), 'STAND');
  assert.equal(rec(['10', '2'], '3', count(2)), 'STAND');
  assert.equal(rec(['10', '2'], '4', count(-0.2, -1)), 'HIT');  // 0-
  assert.equal(rec(['10', '2'], '4', count(0, 0)), 'STAND');
  assert.equal(rec(['6', '4'], 'K', count(4)), 'DOUBLE');
  assert.equal(rec(['6', '4'], 'A', count(3)), 'DOUBLE');
  assert.equal(rec(['5', '4'], '2', count(1)), 'DOUBLE');
  assert.equal(rec(['5', '4'], '7', count(3)), 'DOUBLE');
  assert.equal(rec(['5', '3'], '6', count(2)), 'DOUBLE');
  assert.equal(rec(['5', '3'], '6', count(1.9)), 'HIT');
  // Not on the chart, so plain basic strategy at any count
  assert.equal(rec(['6', '5'], 'A', count(-5)), 'DOUBLE');
  assert.equal(rec(['10', '2'], '6', count(-5)), 'STAND');
  assert.equal(rec(['10', '2'], '5', count(-5)), 'STAND');
  assert.equal(rec(['10', '3'], '3', count(-5)), 'STAND');
  // Basic strategy mode ignores the count
  assert.equal(rec(['10', '6'], 'K', null), 'HIT');
});

test('BJA H17 chart: late surrender', () => {
  const s = new BasicStrategy();
  const rec = (ranks, up, c) => s.getRecommendation(cards(...ranks), up, true, true, c, true).action;
  assert.equal(rec(['10', '7'], 'A', null), 'SURRENDER');
  assert.equal(rec(['10', '6'], '10', null), 'SURRENDER');
  assert.equal(rec(['10', '6'], 'A', null), 'SURRENDER');
  assert.equal(rec(['10', '6'], '9', null), 'SURRENDER');
  assert.equal(rec(['10', '6'], '9', count(-1)), 'HIT');        // -1-: don't surrender
  assert.equal(rec(['10', '6'], '8', count(4)), 'SURRENDER');
  assert.equal(rec(['10', '6'], '8', count(3.9)), 'HIT');
  assert.equal(rec(['10', '5'], '10', null), 'SURRENDER');
  assert.equal(rec(['10', '5'], '10', count(-0.2, -1)), 'HIT'); // 0-: don't surrender
  assert.equal(rec(['10', '5'], '9', count(2)), 'SURRENDER');
  assert.equal(rec(['10', '5'], 'A', null), 'HIT');             // blank cell in basic
  assert.equal(rec(['10', '5'], 'A', count(-1)), 'SURRENDER');  // -1+
  assert.equal(rec(['10', '5'], 'A', count(-1.1)), 'HIT');
  assert.equal(rec(['10', '4'], '10', count(10)), 'HIT');       // 14 never surrenders
  assert.equal(rec(['8', '8'], 'A', null), 'SPLIT');            // pairs split
  assert.equal(rec(['A', '6'], 'A', null), 'HIT');              // soft hands don't surrender
  assert.equal(rec(['5', '5', '6'], 'A', count(3)), 'STAND');   // 3 cards: 16 vs A stand at 3+
});

test('strategy panel lists every chart deviation in chart notation', () => {
  const s = new BasicStrategy();
  const rows = s.getDeviationTable(count(3.2, 16));
  assert.equal(rows.length, 22); // insurance + 21 playing deviations
  assert.equal(rows[0].hand, 'Insurance');
  assert.equal(rows[0].inEffect, true);
  const row = (hand, up) => rows.find(r => r.hand === hand && r.up === up);
  assert.equal(row('16', '10').indexText, '0+');
  assert.equal(row('16', '10').inEffect, true);
  assert.equal(row('13', '2').indexText, '-1-');
  assert.equal(row('13', '2').inEffect, false);
  assert.equal(row('A,8', '4').indexText, '3+');
  assert.equal(row('A,8', '4').deviation, 'DOUBLE');
  assert.equal(row('10,10', '4').inEffect, false);
  assert.equal(s.getDeviationTable(count(0), { surrender: true }).length, 27);
  assert.equal(s.describeDeviation(BasicStrategy.DEVIATIONS.find(d => d.total === 19 && d.up === 6)),
    'A,8 vs 6: stand at any negative running count');
});

test('cut card sets when the shoe is reshuffled', () => {
  const g = new BlackjackGame(6);
  assert.equal(g.getCutCards(), 78);              // default 1.5 decks
  assert.equal(Math.round(g.getPenetration() * 100), 75);
  g.shoe.length = 78;
  assert.equal(g.needsShuffle(), false);
  g.shoe.length = 77;
  assert.equal(g.needsShuffle(), true);
  g.setCutDecks(1);
  assert.equal(g.getCutCards(), 52);
  assert.equal(g.needsShuffle(), false);          // 77 left > 52
  assert.equal(Math.round(g.getPenetration() * 100), 83);
  g.setCutDecks(10);                              // clamped to leave at least half a deck dealt
  assert.equal(g.cutDecks, 5.5);
});
