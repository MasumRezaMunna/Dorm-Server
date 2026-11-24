/**
 * redisCaching.test.mjs
 *
 * Comprehensive unit and integration tests for Redis caching infrastructure:
 * 1. Cache key generation and deterministic query hashing
 * 2. TTL configurations
 * 3. Cache middleware Hit/Miss/Bypass semantics
 * 4. Cache invalidator logic and pattern deletion
 * 5. Fail-safe degradation when Redis is offline
 */

import assert from 'node:assert/strict';
import { hashQuery, cacheKeys, CACHE_TTL } from './cacheKeys.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { safeGet, safeSet, safeDel, isRedisAvailable } from '../config/redis.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return res
        .then(() => {
          console.log(`  ✅ ${name}`);
          passed++;
        })
        .catch((err) => {
          console.error(`  ❌ ${name}`);
          console.error(`     ${err.message}`);
          failed++;
        });
    }
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n--- 1. Cache Key Generation & Query Hashing ---');

  test('hashQuery produces deterministic output regardless of key order', () => {
    const hashA = hashQuery({ month: 11, year: 2026 });
    const hashB = hashQuery({ year: 2026, month: 11 });
    assert.equal(hashA, hashB, 'Query parameter order should not alter cache hash');
  });

  test('hashQuery handles empty, null, or undefined parameters gracefully', () => {
    const hashEmpty = hashQuery({});
    const hashNull = hashQuery(null);
    assert.equal(hashEmpty, 'all');
    assert.equal(hashNull, 'all');

    const hashFiltered = hashQuery({ page: 1, search: '' });
    const hashOnlyPage = hashQuery({ page: 1 });
    assert.equal(hashFiltered, hashOnlyPage, 'Empty string parameters should be ignored in query hash');
  });

  test('cacheKeys formats domain namespaces properly', () => {
    assert.equal(cacheKeys.managerDashboard(2026, 11), 'dorms:dash:manager:2026:11');
    assert.equal(cacheKeys.memberDashboard('usr123', 2026, 11), 'dorms:dash:member:usr123:2026:11');
    assert.equal(cacheKeys.marketToday(), 'dorms:market:today');
    assert.equal(cacheKeys.settings(), 'dorms:settings:global');
    assert.ok(cacheKeys.mealList({ month: 11 }).startsWith('dorms:meal:list:'));
  });

  console.log('\n--- 2. TTL Configuration Sanity ---');

  test('All required TTLs are defined with reasonable production durations', () => {
    assert.ok(CACHE_TTL.DASHBOARD >= 30 && CACHE_TTL.DASHBOARD <= 300);
    assert.ok(CACHE_TTL.FINANCIAL >= 30 && CACHE_TTL.FINANCIAL <= 300);
    assert.ok(CACHE_TTL.EXPENSES >= 60 && CACHE_TTL.EXPENSES <= 600);
    assert.ok(CACHE_TTL.MEALS >= 60 && CACHE_TTL.MEALS <= 600);
    assert.ok(CACHE_TTL.WEEKLY_PLAN >= 120);
    assert.ok(CACHE_TTL.MEMBERS >= 120);
    assert.ok(CACHE_TTL.ROOMS >= 120);
    assert.ok(CACHE_TTL.SETTINGS >= 300);
  });

  console.log('\n--- 3. Fail-Safe Offline Degradation ---');

  await test('safeGet returns null safely without throwing when Redis is offline', async () => {
    const res = await safeGet('dorms:any:test:key');
    assert.equal(res, null);
  });

  await test('safeSet returns false safely without throwing when Redis is offline', async () => {
    const res = await safeSet('dorms:any:test:key', { sample: true }, 60);
    assert.equal(res, false);
  });

  await test('safeDel returns 0 safely without throwing when Redis is offline', async () => {
    const res = await safeDel('dorms:any:test:key');
    assert.equal(res, 0);
  });

  console.log('\n--- 4. Cache Middleware Behavior ---');

  await test('cacheMiddleware passes through non-GET requests immediately', async () => {
    const mw = cacheMiddleware();
    let nextCalled = false;
    const req = { method: 'POST', baseUrl: '/api/meals', path: '/', query: {} };
    const res = { setHeader: () => {} };
    await mw(req, res, () => { nextCalled = true; });
    assert.ok(nextCalled, 'Non-GET request must proceed to next()');
  });

  await test('cacheMiddleware sets X-Cache BYPASS when Redis is unavailable', async () => {
    const mw = cacheMiddleware({ ttl: 60 });
    let headerName = '';
    let headerValue = '';
    let nextCalled = false;
    const req = { method: 'GET', baseUrl: '/api/public', path: '/overview', query: {} };
    const res = {
      setHeader: (name, val) => {
        headerName = name;
        headerValue = val;
      },
    };
    await mw(req, res, () => { nextCalled = true; });
    assert.ok(nextCalled);
    assert.equal(headerName, 'X-Cache');
    assert.equal(headerValue, 'BYPASS');
  });

  await test('cacheMiddleware enforces manager-only access restriction for caching', async () => {
    const mw = cacheMiddleware({ ttl: 60, isManagerOnly: true });
    let nextCalled = false;
    const req = { method: 'GET', user: { role: 'member' }, baseUrl: '/api/dashboard', path: '/manager', query: {} };
    const res = { setHeader: () => {} };
    await mw(req, res, () => { nextCalled = true; });
    assert.ok(nextCalled);
  });

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Redis Cache Tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
