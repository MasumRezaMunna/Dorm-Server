/**
 * carryForward.test.mjs
 *
 * Pure-function tests for the monthly carry-forward accounting logic.
 *
 * These tests extract and exercise the core arithmetic without requiring a
 * live MongoDB connection, so they run fast and safely in CI.
 *
 * Run with:
 *   node server/src/utils/carryForward.test.mjs
 */

import assert from 'node:assert/strict';

// ─── Pure helper extracted from meal.controller.js ───────────────────────────
// This mirrors the core arithmetic from computeRawAfterMealMap so tests stay
// independent of the database.

const roundTwo = (num) => Math.round((num || 0) * 100) / 100;

/**
 * Simulated version of computeRawAfterMealMap for one member.
 *
 * @param {number} paid            - total payments made in this month
 * @param {number} meals           - total meal count this month
 * @param {number} mealRate        - cost per meal
 * @param {number} commonPerMem    - common cost per member
 * @param {number} storedCarry     - previousBalance from MonthlyBalance (0 if none)
 * @returns {number} closingBalance
 */
function closingBalance(paid, meals, mealRate, commonPerMem, storedCarry = 0) {
  const mealCost  = roundTwo(meals * mealRate);
  const totalCost = roundTwo(mealCost + commonPerMem);
  return roundTwo(storedCarry + paid - totalCost);
}

/**
 * Simulates three consecutive months of carry-forward for one member.
 * Month A feeds into B, B feeds into C.
 *
 * @param {object} monthA  - { paid, meals, mealRate, commonPerMem }
 * @param {object} monthB  - { paid, meals, mealRate, commonPerMem }
 * @param {object} monthC  - { paid, meals, mealRate, commonPerMem }
 * @returns {{ closeA, closeB, closeC, paidAmountB, paidAmountC }}
 */
function simulateChain(monthA, monthB, monthC) {
  // Month A: no prior carry-forward
  const closeA = closingBalance(monthA.paid, monthA.meals, monthA.mealRate, monthA.commonPerMem, 0);

  // Month B: carry-forward from A
  const paidAmountB = roundTwo(monthB.paid + closeA);
  const closeB      = closingBalance(monthB.paid, monthB.meals, monthB.mealRate, monthB.commonPerMem, closeA);

  // Month C: carry-forward from B (which already includes closeA)
  const paidAmountC = roundTwo(monthC.paid + closeB);
  const closeC      = closingBalance(monthC.paid, monthC.meals, monthC.mealRate, monthC.commonPerMem, closeB);

  return { closeA, closeB, paidAmountB, paidAmountC, closeC };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2705 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u274c ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// ── 1. Positive balance (overpayment) carried into next month ─────────────────
console.log('\n1. Positive balance carry-forward');
test('member overpaid by 200, credit propagates to next month', () => {
  // Month A: paid 1200, cost 1000 → closing +200
  const closeA = closingBalance(1200, 10, 80, 200, 0);
  assert.equal(closeA, 200, `Expected 200, got ${closeA}`);

  // Month B: paid 900, cost 1000; effective = 900+200=1100 → closing +100
  const closeB = closingBalance(900, 10, 80, 200, closeA);
  assert.equal(closeB, 100, `Expected 100, got ${closeB}`);
});

// ── 2. Negative balance (underpayment) carried into next month ────────────────
console.log('\n2. Negative balance carry-forward');
test('member underpaid by 300, debt propagates to next month', () => {
  // Month A: paid 700, cost 1000 → closing -300
  const closeA = closingBalance(700, 10, 80, 200, 0);
  assert.equal(closeA, -300, `Expected -300, got ${closeA}`);

  // Month B: paid 1000, cost 1000; effective = 1000-300=700 → closing -300
  const closeB = closingBalance(1000, 10, 80, 200, closeA);
  assert.equal(closeB, -300, `Expected -300, got ${closeB}`);

  // Month C: paid 1300, cost 1000; effective = 1300-300=1000 → closing 0
  const closeC = closingBalance(1300, 10, 80, 200, closeB);
  assert.equal(closeC, 0, `Expected 0, got ${closeC}`);
});

// ── 3. Zero balance — no carry needed ─────────────────────────────────────────
console.log('\n3. Zero balance');
test('exactly settled member produces zero carry-forward', () => {
  const closeA = closingBalance(1000, 10, 80, 200, 0);
  assert.equal(closeA, 0, `Expected 0, got ${closeA}`);

  const closeB = closingBalance(1000, 10, 80, 200, 0);
  assert.equal(closeB, 0);
});

// ── 4. Three-month chain: A's balance must survive into C ─────────────────────
console.log('\n4. Three-month chain (A \u2192 B \u2192 C)');
test('close_A propagates into C via B without loss', () => {
  const { closeA, closeB, closeC } = simulateChain(
    { paid: 1200, meals: 10, mealRate: 80, commonPerMem: 200 },  // A: +200
    { paid: 1000, meals: 10, mealRate: 80, commonPerMem: 200 },  // B: 0+200=still +200
    { paid: 1000, meals: 10, mealRate: 80, commonPerMem: 200 },  // C: 0+200=still +200
  );
  assert.equal(closeA, 200);
  assert.equal(closeB, 200); // close_A flows into B
  assert.equal(closeC, 200); // close_A (via B) flows into C
});

test('accumulated debt compounds correctly across three months', () => {
  const { closeA, closeB, closeC } = simulateChain(
    { paid: 700,  meals: 10, mealRate: 80, commonPerMem: 200 },  // A: -300
    { paid: 800,  meals: 10, mealRate: 80, commonPerMem: 200 },  // B: (-300)+800-1000=-500
    { paid: 1200, meals: 10, mealRate: 80, commonPerMem: 200 },  // C: (-500)+1200-1000=-300
  );
  assert.equal(closeA, -300);
  assert.equal(closeB, -500);
  assert.equal(closeC, -300);
});

// ── 5. Idempotency: same carry-forward value on repeated computation ───────────
console.log('\n5. Idempotency');
test('computing the snapshot twice yields the same closing balance', () => {
  const storedCarry = 200; // as if closeA=200 was written to MonthlyBalance
  const close1 = closingBalance(1000, 10, 80, 200, storedCarry);
  const close2 = closingBalance(1000, 10, 80, 200, storedCarry);
  assert.equal(close1, close2, 'Repeated computation must be deterministic');
  // $setOnInsert in the real code ensures the DB value is never overwritten,
  // so the same number is always used for subsequent months.
});

// ── 6. New member with no prior MonthlyBalance doc ────────────────────────────
console.log('\n6. New member with no prior carry-forward doc');
test('missing storedCarryMap entry defaults to 0 (no artificial debt or credit)', () => {
  const carry = undefined ?? 0;
  const close  = closingBalance(1000, 10, 80, 200, carry);
  assert.equal(close, 0, 'New member with exact payment should have 0 balance');
});

test('new member underpayment in first month correctly produces negative balance', () => {
  const carry = undefined ?? 0;
  const close  = closingBalance(600, 10, 80, 200, carry);
  assert.equal(close, -400);
});

// ── 7. Rounding stability ─────────────────────────────────────────────────────
console.log('\n7. Rounding stability');
test('two-decimal rounding is stable across chain', () => {
  const mealRate     = roundTwo(1000 / 3 / 30); // recurring decimal
  const commonPerMem = roundTwo(300 / 5);
  const closeA = closingBalance(500, 30, mealRate, commonPerMem, 0);
  const closeB = closingBalance(500, 30, mealRate, commonPerMem, closeA);
  assert.ok(isFinite(closeA), `closeA is not finite: ${closeA}`);
  assert.ok(isFinite(closeB), `closeB is not finite: ${closeB}`);
  assert.ok(!isNaN(closeA),   'closeA is NaN');
  assert.ok(!isNaN(closeB),   'closeB is NaN');
});

// ── 8. Bug regression: old formula (without carry) would lose balance ──────────
console.log('\n8. Regression: old formula breaks chain (documents the bug that was fixed)');
test("old formula (no storedCarry) drops A's balance when computing B\u2192C snapshot", () => {
  const closeA = closingBalance(1200, 10, 80, 200, 0); // 200

  // OLD (buggy): computing B's closing balance WITHOUT applying closeA
  const closeBBuggy = closingBalance(1000, 10, 80, 200, 0);    // 0 — balance lost

  // NEW (fixed): computing B's closing balance WITH closeA
  const closeBFixed = closingBalance(1000, 10, 80, 200, closeA); // 200

  assert.equal(closeBBuggy,  0,   'Buggy formula produces 0 (balance lost)');
  assert.equal(closeBFixed, 200,  'Fixed formula preserves the 200 credit from A');
  assert.notEqual(closeBBuggy, closeBFixed, 'Old and new must differ when carry != 0');
});

// ── 9. Dashboard Net Balance vs Member Breakdown Table Totals ─────────────────
console.log('\n9. Dashboard net balance vs member breakdown table totals');

test('Dashboard net balance matches breakdown table total after deduction', () => {
  // Members in October 2026:
  const members = [
    { name: 'Nirob',  rawPayment: 0,       carry: 6.00,    totalCost: 3.33 },
    { name: 'Munna',  rawPayment: 1000.00, carry: -272.10, totalCost: 1002.69 },
    { name: 'Rafat',  rawPayment: 700.00,  carry: -56.05,  totalCost: 711.21 },
    { name: 'Sabit',  rawPayment: 800.00,  carry: 340.55,  totalCost: 836.13 },
    { name: 'Mahbub', rawPayment: 0,       carry: 6.00,    totalCost: 3.33 },
    { name: 'Shuvo',  rawPayment: 705.20,  carry: 178.00,  totalCost: 836.13 },
  ];

  const totalRawPayments = roundTwo(members.reduce((s, m) => s + m.rawPayment, 0));
  const totalCarry       = roundTwo(members.reduce((s, m) => s + m.carry, 0));
  const totalExpenses    = 3393.00;

  // Breakdown table calculates:
  const tableEffectivePaid = roundTwo(members.reduce((s, m) => s + roundTwo(m.rawPayment + m.carry), 0));
  const tableAfterDeduction = roundTwo(tableEffectivePaid - totalExpenses);

  // Buggy dashboard calculated (raw payments only):
  const buggyDashboardNet = roundTwo(totalRawPayments - totalExpenses);

  // Fixed dashboard calculates (effective paid including carry):
  const fixedDashboardNet = roundTwo(tableEffectivePaid - totalExpenses);

  assert.equal(totalRawPayments, 3205.20, 'Raw payments total is 3205.20');
  assert.equal(tableEffectivePaid, 3407.60, 'Table effective paid is 3407.60');
  assert.equal(buggyDashboardNet, -187.80, 'Buggy dashboard showed -187.80');
  assert.equal(fixedDashboardNet, 14.60, 'Fixed dashboard shows +14.60');
  assert.equal(fixedDashboardNet, tableAfterDeduction, 'Dashboard net balance matches table after deduction exactly');
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

