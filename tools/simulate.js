// Headless simulator: plays the app's own game, counting, strategy and betting
// code. Usage:
//   node tools/simulate.js                      one 500-hand session, seed 1
//   node tools/simulate.js --hands 500 --seed 7 --spread 1-12
//   node tools/simulate.js --runs 2000          many sessions, summary stats
//   node tools/simulate.js --flat --no-deviations   flat min bet, basic strategy
//   node tools/simulate.js --cut 1           cut card 1 deck from the back (default 1.5)
//   node tools/simulate.js --surrender         late surrender allowed (with the chart's surrender indices)
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// ---------- options ----------
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const options = {
  hands: parseInt(opt('hands', '500')),
  seed: parseInt(opt('seed', '1')),
  runs: parseInt(opt('runs', '1')),
  spread: opt('spread', '1-12'),
  minBet: parseInt(opt('min', '5')),
  maxBet: parseInt(opt('max', '500')),
  bankroll: parseInt(opt('bankroll', '1000')),
  deviations: !args.includes('--no-deviations'),
  flat: args.includes('--flat'),
  surrender: args.includes('--surrender'),
  cutDecks: parseFloat(opt('cut', '1.5')),
  json: args.includes('--json')
};

// ---------- load the app's modules into a sandbox with a seeded Math.random ----------
function loadModules(seed) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  // mulberry32: small, fast, reproducible PRNG
  vm.runInContext(`(function () {
    let a = ${seed >>> 0};
    Math.random = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();`, sandbox);
  for (const file of ['counting.js', 'betting.js', 'strategy.js', 'game.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox);
  }
  return sandbox.window;
}

// ---------- independent references used to check the app ----------
const hiLo = rank => ('23456'.includes(rank) && rank.length === 1 ? 1 : ['10', 'J', 'Q', 'K', 'A'].includes(rank) ? -1 : 0);
const isTen = rank => ['10', 'J', 'Q', 'K'].includes(rank);
const cardValue = rank => (rank === 'A' ? 11 : isTen(rank) ? 10 : parseInt(rank));

// Blackjack Apprenticeship H17 Deviation Chart (2018), typed in separately
// from strategy.js so the two can be checked against each other.
// dir '+' = make `play` at that true count and above; '-' = at that true
// count and below; rc = the chart's 0+ / 0- (positive / negative RUNNING count).
// orElse = the play when doubling isn't possible.
const REFERENCE_DEVIATIONS = {
  'pair 10 v 4':  { index: 6,  dir: '+', play: 'SPLIT' },
  'pair 10 v 5':  { index: 5,  dir: '+', play: 'SPLIT' },
  'pair 10 v 6':  { index: 4,  dir: '+', play: 'SPLIT' },
  'soft 19 v 4':  { index: 3,  dir: '+', play: 'DOUBLE', orElse: 'STAND' },
  'soft 19 v 5':  { index: 1,  dir: '+', play: 'DOUBLE', orElse: 'STAND' },
  'soft 19 v 6':  { index: 0,  dir: '-', rc: true, play: 'STAND' },
  'soft 17 v 2':  { index: 1,  dir: '+', play: 'DOUBLE', orElse: 'HIT' },
  'hard 16 v 9':  { index: 4,  dir: '+', play: 'STAND' },
  'hard 16 v 10': { index: 0,  dir: '+', rc: true, play: 'STAND' },
  'hard 16 v 11': { index: 3,  dir: '+', play: 'STAND' },
  'hard 15 v 10': { index: 4,  dir: '+', play: 'STAND' },
  'hard 15 v 11': { index: 5,  dir: '+', play: 'STAND' },
  'hard 13 v 2':  { index: -1, dir: '-', play: 'HIT' },
  'hard 12 v 2':  { index: 3,  dir: '+', play: 'STAND' },
  'hard 12 v 3':  { index: 2,  dir: '+', play: 'STAND' },
  'hard 12 v 4':  { index: 0,  dir: '-', rc: true, play: 'HIT' },
  'hard 10 v 10': { index: 4,  dir: '+', play: 'DOUBLE', orElse: 'HIT' },
  'hard 10 v 11': { index: 3,  dir: '+', play: 'DOUBLE', orElse: 'HIT' },
  'hard 9 v 2':   { index: 1,  dir: '+', play: 'DOUBLE', orElse: 'HIT' },
  'hard 9 v 7':   { index: 3,  dir: '+', play: 'DOUBLE', orElse: 'HIT' },
  'hard 8 v 6':   { index: 2,  dir: '+', play: 'DOUBLE', orElse: 'HIT' }
};

// Late surrender from the same chart: basic SUR cells, then the indices
const REFERENCE_SURRENDER_BASIC = new Set(['17 v 11', '16 v 9', '16 v 10', '16 v 11', '15 v 10']);
const REFERENCE_SURRENDER_DEV = {
  '16 v 8':  { index: 4,  dir: '+', surrender: true },
  '16 v 9':  { index: -1, dir: '-', surrender: false },
  '15 v 9':  { index: 2,  dir: '+', surrender: true },
  '15 v 10': { index: 0,  dir: '-', rc: true, surrender: false },
  '15 v 11': { index: -1, dir: '+', surrender: true }
};

const refActive = (r, c) => (r.rc
  ? (r.dir === '+' ? c.rc > 0 : c.rc < 0)
  : (r.dir === '+' ? c.tc >= r.index : c.tc <= r.index));

// ---------- one session ----------
function runSession(o, seed) {
  const W = loadModules(seed);
  const game = new W.BlackjackGame(6);
  game.setCutDecks(o.cutDecks);
  const counter = new W.CardCounter(6);
  const strategy = new W.BasicStrategy();
  const betting = new W.BettingSystem(o.bankroll, o.minBet, o.maxBet);

  const s = {
    seed, handsPlayed: 0, shoes: 1, brokeAtHand: null,
    wagered: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0,
    peak: o.bankroll, maxDrawdown: 0, history: [o.bankroll],
    betsByTier: {}, netByTcBucket: {},
    insurance: { taken: 0, won: 0, net: 0 },
    deviations: {}, deviationChecks: 0, deviationMismatches: [],
    surrenders: 0, surrenderChecks: 0, surrenderMismatches: [],
    countChecks: 0, countErrors: 0, cardsRemainingErrors: 0
  };
  let shadowRC = 0; // independent Hi-Lo running count
  const see = card => { counter.countCard(card.rank); shadowRC += hiLo(card.rank); };

  for (let n = 0; n < o.hands; n++) {
    if (game.needsShuffle()) {
      game.initShoe();
      counter.reset();
      shadowRC = 0;
      s.shoes++;
    }

    // ---- bet ----
    const tcAtBet = counter.getTrueCount();
    const target = o.flat ? o.minBet : counter.getSuggestedBet(o.minBet, o.maxBet, o.spread);
    if (!betting.setBet(target)) { s.brokeAtHand = n; break; }
    const bet = betting.placeBet();
    let staked = bet;
    s.betsByTier[bet] = (s.betsByTier[bet] || 0) + 1;

    // ---- deal ----
    for (const step of game.startRound(1)) if (!step.hole) see(step.card);
    const gs = game.getState();
    const first = gs.spots[0].hands[0];
    first.bet = bet;
    const up = gs.dealerCards[0].rank;
    const upKey = up === 'A' ? 11 : isTen(up) ? 10 : parseInt(up);

    // ---- insurance, then the dealer peeks ----
    let ins = 0;
    if (up === 'A' && !first.hasBlackjack && o.deviations && strategy.shouldTakeInsurance(counter.getTrueCount())) {
      if (betting.withdraw(bet / 2)) { ins = bet / 2; s.insurance.taken++; }
    }
    const dealerBJ = (up === 'A' || isTen(up)) && game.dealerHasBlackjack();

    if (dealerBJ) {
      see(game.revealHole());
    } else {
      // ---- player plays every hand (splits add hands) ----
      for (;;) {
        const hands = gs.spots[0].hands;
        const h = hands.findIndex(x => !x.isStood);
        if (h < 0) break;
        const hand = hands[h];
        const canD = game.canDouble(0, h) && betting.getBankroll() >= hand.bet;
        const canS = game.canSplit(0, h) && betting.getBankroll() >= hand.bet;
        const canR = o.surrender && game.canSurrender(0, h);
        const count = { tc: counter.getTrueCount(), rc: counter.getRunningCount() };
        const rec = strategy.getRecommendation(hand.cards, up, canD, canS, o.deviations ? count : null, canR);

        if (canR && checkSurrender(s, hand, upKey, o.deviations ? count : null, rec)) {
          // surrender decision verified; nothing else to check for this hand
        } else if (o.deviations) {
          checkDeviation(s, strategy, hand, upKey, up, count, canD, canS, rec);
        }

        if (rec.code === 'R') {
          game.surrender(0, h);
          s.surrenders++;
        } else if (rec.code === 'P') {
          betting.withdraw(hand.bet); staked += hand.bet;
          game.split(0, h).forEach(see);
        } else if (rec.code === 'D') {
          betting.withdraw(hand.bet); staked += hand.bet;
          hand.bet *= 2;
          see(game.double(0, h));
        } else if (rec.code === 'H') {
          see(game.hit(0, h));
        } else {
          game.stand(0, h);
        }
      }
      see(game.revealHole());
      const anyLive = gs.spots[0].hands.some(x => !x.isBusted && !x.hasBlackjack && !x.surrendered);
      if (anyLive) game.dealerPlay().forEach(see);
    }

    // ---- settle ----
    let payout = 0;
    let outcome = 'push';
    for (const hand of gs.spots[0].hands) {
      const res = game.getHandResult(hand.cards, gs.dealerCards, hand.hasBlackjack, dealerBJ, hand.surrendered);
      payout += hand.bet * game.getPayoutMultiplier(res);
      if (res === 'blackjack') s.blackjacks++;
    }
    if (ins > 0) {
      const insPay = dealerBJ ? ins * 3 : 0;
      payout += insPay;
      s.insurance.net += insPay - ins;
      if (dealerBJ) s.insurance.won++;
    }
    betting.payout(payout);
    const net = payout - staked - ins;
    outcome = net > 0 ? 'win' : net < 0 ? 'loss' : 'push';
    s[outcome === 'win' ? 'wins' : outcome === 'loss' ? 'losses' : 'pushes']++;
    s.wagered += staked + ins;
    s.handsPlayed++;

    const bucket = tcAtBet <= 0 ? 'TC ≤ 0' : tcAtBet < 2 ? 'TC 0–2' : tcAtBet < 4 ? 'TC 2–4' : 'TC ≥ 4';
    const b = s.netByTcBucket[bucket] || (s.netByTcBucket[bucket] = { hands: 0, net: 0, wagered: 0 });
    b.hands++; b.net += net; b.wagered += staked + ins;

    // ---- verify the count against the independent tally ----
    s.countChecks++;
    if (counter.getRunningCount() !== shadowRC) s.countErrors++;
    if (counter.getCardsRemaining() !== game.getShoeSize()) s.cardsRemainingErrors++;

    const bank = betting.getBankroll();
    s.history.push(bank);
    s.peak = Math.max(s.peak, bank);
    s.maxDrawdown = Math.max(s.maxDrawdown, s.peak - bank);
  }

  s.finalBankroll = betting.getBankroll();
  s.net = s.finalBankroll - o.bankroll;
  s.avgBet = s.handsPlayed ? s.wagered / s.handsPlayed : 0;
  return s;
}

// Checks a two-card decision against the reference surrender rules. Returns
// true when the reference says surrender (so no other check applies).
function checkSurrender(s, hand, upKey, count, rec) {
  const [a, b] = hand.cards;
  const pairKey = r => (isTen(r) ? '10' : r);
  const total = cardValue(a.rank) + cardValue(b.rank);
  const soft = (a.rank === 'A' || b.rank === 'A') && total <= 21;
  if (soft || pairKey(a.rank) === pairKey(b.rank)) {
    if (rec.code === 'R') s.surrenderMismatches.push({ key: 'pair/soft', tc: count && count.tc, got: rec.action, expected: 'play on' });
    return false;
  }
  const key = `${total} v ${upKey}`;
  const basic = REFERENCE_SURRENDER_BASIC.has(key);
  const ref = REFERENCE_SURRENDER_DEV[key];
  let expected = basic;
  if (count && ref && refActive(ref, count)) {
    expected = ref.surrender;
    if (expected !== basic) {
      const name = 'surrender ' + key;
      const d = s.deviations[name] || (s.deviations[name] = { times: 0, play: expected ? 'SURRENDER' : 'NO-SURRENDER' });
      d.times++;
    }
  }
  const got = rec.code === 'R';
  if (expected || got || ref || basic) {
    s.surrenderChecks++;
    if (got !== expected) s.surrenderMismatches.push({ key, tc: count && count.tc, got: rec.action, expected: expected ? 'SURRENDER' : 'play on' });
  }
  return expected;
}

// Compares the advisor's play with the separately typed reference chart
function checkDeviation(s, strategy, hand, upKey, up, count, canD, canS, rec) {
  const total = hand.cards.reduce((t, c) => t + cardValue(c.rank), 0);
  const aces = hand.cards.filter(c => c.rank === 'A').length;
  let value = total, a = aces;
  while (value > 21 && a > 0) { value -= 10; a--; }
  const soft = a > 0;
  const isTenPair = hand.cards.length === 2 && isTen(hand.cards[0].rank) && isTen(hand.cards[1].rank);

  let key = null;
  if (isTenPair && canS && REFERENCE_DEVIATIONS[`pair 10 v ${upKey}`]) key = `pair 10 v ${upKey}`;
  else if (soft && REFERENCE_DEVIATIONS[`soft ${value} v ${upKey}`]) key = `soft ${value} v ${upKey}`;
  else if (!soft && REFERENCE_DEVIATIONS[`hard ${value} v ${upKey}`]) key = `hard ${value} v ${upKey}`;
  if (!key) return;
  // Other pairs (e.g. 4,4 = hard 8) follow the pair table first
  if (rec.code === 'P' && !key.startsWith('pair')) return;

  const ref = REFERENCE_DEVIATIONS[key];
  const on = refActive(ref, count);
  const basic = strategy.getRecommendation(hand.cards, up, canD, canS, null).action;
  let expected = on ? ref.play : basic;
  if (expected === 'DOUBLE' && !canD) expected = ref.orElse || 'HIT';
  if (expected === 'SPLIT' && !canS) expected = basic;

  s.deviationChecks++;
  if (rec.action !== expected) {
    s.deviationMismatches.push({ key, tc: count.tc, got: rec.action, expected });
  }
  if (on && expected !== basic) {
    const d = s.deviations[key] || (s.deviations[key] = { times: 0, play: ref.play });
    d.times++;
  }
}

// ---------- reporting ----------
const money = v => (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(v) ? 0 : 2 });
const signed = v => (v > 0 ? '+' : '') + money(v);

function printSession(o, s) {
  console.log(`\nSESSION  seed ${s.seed} · ${s.handsPlayed} hands · ${s.shoes} shoes · spread ${o.flat ? 'flat' : o.spread} · ${o.deviations ? 'basic + BJA H17 chart deviations' : 'basic strategy only'}${o.surrender ? ' + late surrender' : ''} · cut ${o.cutDecks} decks`);
  console.log(`  Bankroll      ${money(o.bankroll)} -> ${money(s.finalBankroll)}   NET ${signed(s.net)}`);
  console.log(`  Wagered       ${money(s.wagered)} (avg ${money(Math.round(s.avgBet * 100) / 100)} per hand)   result ${(s.net / s.wagered * 100).toFixed(2)}% of action`);
  console.log(`  Hands         ${s.wins} won · ${s.losses} lost · ${s.pushes} pushed · ${s.blackjacks} blackjacks`);
  console.log(`  Peak / swing  peak ${money(s.peak)} · biggest drawdown ${money(s.maxDrawdown)}${s.brokeAtHand !== null ? ` · BUSTED at hand ${s.brokeAtHand}` : ''}`);
  console.log('  Bets placed   ' + Object.entries(s.betsByTier).sort((a, b) => a[0] - b[0]).map(([bet, n]) => `${money(+bet)} x${n}`).join(' · '));
  console.log('  Net by count when the bet was made:');
  for (const k of ['TC ≤ 0', 'TC 0–2', 'TC 2–4', 'TC ≥ 4']) {
    const b = s.netByTcBucket[k];
    if (b) console.log(`    ${k.padEnd(8)} ${String(b.hands).padStart(4)} hands  wagered ${money(b.wagered).padStart(7)}  net ${signed(b.net)}`);
  }
  if (o.deviations) {
    console.log(`  Insurance     taken ${s.insurance.taken}x, won ${s.insurance.won}x, net ${signed(s.insurance.net)}`);
    const devs = Object.entries(s.deviations).sort((a, b) => b[1].times - a[1].times);
    console.log(`  Deviations    ${devs.reduce((t, [, d]) => t + d.times, 0)} count-based plays made: ` +
      (devs.map(([k, d]) => `${k.replace('hard ', '').replace(' v 11', ' v A')} ${d.play.toLowerCase()} x${d.times}`).join(', ') || 'none'));
  }
  if (o.surrender) console.log(`  Surrender     ${s.surrenders} hands surrendered`);
  console.log('  CHECKS');
  console.log(`    Running count matched an independent Hi-Lo tally after ${s.countChecks - s.countErrors}/${s.countChecks} hands`);
  console.log(`    Cards-remaining matched the shoe after ${s.countChecks - s.cardsRemainingErrors}/${s.countChecks} hands`);
  if (o.deviations) {
    console.log(`    Advisor matched the reference BJA chart on ${s.deviationChecks - s.deviationMismatches.length}/${s.deviationChecks} index-hand decisions`);
    s.deviationMismatches.slice(0, 5).forEach(m => console.log(`      MISMATCH ${m.key} at TC ${m.tc}: advisor ${m.got}, reference ${m.expected}`));
  }
  if (o.surrender) {
    console.log(`    Surrender decisions matched the reference rules on ${s.surrenderChecks - s.surrenderMismatches.length}/${s.surrenderChecks} surrender-eligible hands`);
    s.surrenderMismatches.slice(0, 5).forEach(m => console.log(`      MISMATCH ${m.key} at TC ${m.tc}: advisor ${m.got}, reference ${m.expected}`));
  }
}

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p / 100 * (sorted.length - 1))))];
}

function printSummary(o, sessions) {
  const nets = sessions.map(s => s.net).sort((a, b) => a - b);
  const mean = nets.reduce((t, v) => t + v, 0) / nets.length;
  const wagered = sessions.reduce((t, s) => t + s.wagered, 0);
  const totalNet = sessions.reduce((t, s) => t + s.net, 0);
  const up = sessions.filter(s => s.net > 0).length;
  const broke = sessions.filter(s => s.brokeAtHand !== null).length;
  const sd = Math.sqrt(nets.reduce((t, v) => t + (v - mean) ** 2, 0) / nets.length);
  const countErrors = sessions.reduce((t, s) => t + s.countErrors, 0);
  const devMismatch = sessions.reduce((t, s) => t + s.deviationMismatches.length + s.surrenderMismatches.length, 0);
  const devChecks = sessions.reduce((t, s) => t + s.deviationChecks + s.surrenderChecks, 0);
  const hands = sessions.reduce((t, s) => t + s.handsPlayed, 0);

  console.log(`\n${sessions.length} SESSIONS of ${o.hands} hands · spread ${o.flat ? 'flat' : o.spread} · ${o.deviations ? 'basic + BJA chart' : 'basic only'}${o.surrender ? ' + surrender' : ''} · cut ${o.cutDecks} decks · ${hands.toLocaleString()} hands total`);
  console.log(`  Average result  ${signed(Math.round(mean * 100) / 100)} per session (std dev ${money(Math.round(sd))})`);
  console.log(`  Overall edge    ${(totalNet / wagered * 100).toFixed(3)}% of money wagered`);
  console.log(`  Sessions ahead  ${(up / sessions.length * 100).toFixed(1)}%   busted ${(broke / sessions.length * 100).toFixed(1)}%`);
  console.log(`  Range           5th pct ${signed(percentile(nets, 5))} · median ${signed(percentile(nets, 50))} · 95th pct ${signed(percentile(nets, 95))}`);
  console.log(`  Checks          count errors ${countErrors} · deviation mismatches ${devMismatch} of ${devChecks.toLocaleString()} decisions`);
}

// ---------- main ----------
if (options.runs <= 1) {
  const s = runSession(options, options.seed);
  if (options.json) console.log(JSON.stringify({ ...s, history: undefined }, null, 2));
  else printSession(options, s);
} else {
  const sessions = [];
  for (let i = 0; i < options.runs; i++) sessions.push(runSession(options, options.seed + i));
  printSummary(options, sessions);
}
