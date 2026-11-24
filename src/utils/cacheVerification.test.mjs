/**
 * cacheVerification.test.mjs
 *
 * Live End-to-End verification test suite for Redis caching and monitoring:
 * 1. Admin monitoring endpoint security (401/403/200)
 * 2. Cache MISS on initial request
 * 3. Cache SET verification in Redis Cloud
 * 4. Cache HIT on subsequent request
 * 5. Automatic Cache Invalidation on data mutation
 * 6. Fresh data retrieval and re-caching after invalidation
 * 7. Verification of Cache Stats aggregation (hits, misses, sets, invalidations, hit ratio)
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import { connectRedis, disconnectRedis, isRedisAvailable, safeGet, deleteByPattern } from '../config/redis.js';
import { cacheMetrics } from './cacheMetrics.js';
import { cacheInvalidator } from './cacheInvalidator.js';
import User from '../models/user.model.js';
import mongoose from 'mongoose';

let server;
let baseUrl;
let managerToken;
let memberToken;

async function setup() {
  console.log('🔄 Setting up test environment...');

  // Connect to MongoDB and Redis
  await connectDB();
  await connectRedis();

  assert.ok(isRedisAvailable(), 'Redis must be connected for live verification');

  // Reset cache metrics
  cacheMetrics.reset();

  // Find or create a manager user for authenticated test
  let managerUser = await User.findOne({ role: 'manager' });
  if (!managerUser) {
    managerUser = await User.create({
      firebaseUid: 'test_manager_uid_' + Date.now(),
      email: `test_manager_${Date.now()}@example.com`,
      displayName: 'Test Manager',
      role: 'manager',
    });
  }

  let memberUser = await User.findOne({ role: 'member' });
  if (!memberUser) {
    memberUser = await User.create({
      firebaseUid: 'test_member_uid_' + Date.now(),
      email: `test_member_${Date.now()}@example.com`,
      displayName: 'Test Member',
      role: 'member',
    });
  }

  managerToken = jwt.sign(
    { id: managerUser._id, role: managerUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  memberToken = jwt.sign(
    { id: memberUser._id, role: memberUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Start HTTP server on dynamic port (0)
  server = createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`🚀 Live test server running on ${baseUrl}`);
      resolve();
    });
  });
}

async function teardown() {
  console.log('\n🧹 Cleaning up test environment...');
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectRedis();
  await mongoose.disconnect();
}

async function runLiveVerification() {
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${name}`);
      console.error(`     ${err.message}`);
      failed++;
    }
  };

  try {
    await setup();

    console.log('\n--- 1. Protected Admin Monitoring Endpoint (/api/admin/cache-stats) ---');

    await test('Rejects unauthenticated request with 401', async () => {
      const res = await fetch(`${baseUrl}/api/admin/cache-stats`);
      assert.equal(res.status, 401, 'Should return 401 when no token is provided');
    });

    await test('Rejects member role with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/admin/cache-stats`, {
        headers: { Authorization: `Bearer ${memberToken}` },
      });
      assert.equal(res.status, 403, 'Should return 403 when role is member');
    });

    await test('Allows manager role with 200 OK and returns structured stats', async () => {
      const res = await fetch(`${baseUrl}/api/admin/cache-stats`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.status, 'success');
      assert.equal(json.data.redisConnectionStatus, 'connected');
      assert.equal(json.data.redisEnabled, true);
      assert.equal(typeof json.data.cacheHitCount, 'number');
      assert.equal(typeof json.data.cacheMissCount, 'number');
      assert.equal(typeof json.data.cacheHitRatio, 'string');
      assert.equal(typeof json.data.cacheSetCount, 'number');
      assert.equal(typeof json.data.cacheInvalidationCount, 'number');

      // Verify no sensitive credentials leaked
      const rawBody = JSON.stringify(json);
      assert.ok(!rawBody.includes(process.env.REDIS_PASSWORD), 'Must not leak Redis password');
      assert.ok(!rawBody.includes(process.env.JWT_SECRET), 'Must not leak JWT secret');
    });

    console.log('\n--- 2. Cache-Aside Lifecycle Verification (MISS -> SET -> HIT) ---');

    // Clean up any existing keys for public overview to start fresh
    await deleteByPattern('dorms:public:overview:*');
    cacheMetrics.reset();

    let firstPayload;

    await test('Request 1: Cache MISS on initial fetch from MongoDB', async () => {
      const res = await fetch(`${baseUrl}/api/public/overview`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-cache'), 'MISS', 'Initial request header must be MISS');
      firstPayload = await res.json();
      assert.equal(firstPayload.success, true);

      // Allow async cache set to finish in background
      await new Promise((r) => setTimeout(r, 400));
    });

    await test('Verification: Data is successfully stored in Redis Cloud (Cache SET)', async () => {
      const cached = await safeGet('dorms:public:overview:current:current');
      assert.ok(cached !== null, 'Redis must contain cached data under key dorms:public:overview:current:current');
      assert.deepEqual(cached.data, firstPayload.data, 'Cached content in Redis must match response');
    });

    await test('Request 2: Cache HIT on subsequent fetch (skips MongoDB)', async () => {
      const res = await fetch(`${baseUrl}/api/public/overview`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-cache'), 'HIT', 'Subsequent request header must be HIT');
      const secondPayload = await res.json();
      assert.deepEqual(secondPayload.data, firstPayload.data, 'HIT response payload must match original');
    });

    console.log('\n--- 3. Automatic Cache Invalidation & Fresh Fetch ---');

    await test('Mutation: Invalidate dependent caches triggers [CACHE INVALIDATED]', async () => {
      // Trigger invalidation for notices and overview
      await cacheInvalidator.invalidateNotices();

      // Check that key was removed from Redis
      const cachedAfterInvalidation = await safeGet('dorms:public:overview:current:current');
      assert.equal(cachedAfterInvalidation, null, 'Cache key must be deleted after invalidation');
    });

    await test('Request 3: Returns fresh data from MongoDB with Cache MISS after invalidation', async () => {
      const res = await fetch(`${baseUrl}/api/public/overview`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-cache'), 'MISS', 'Request after invalidation must be MISS');

      // Allow background re-cache
      await new Promise((r) => setTimeout(r, 400));

      // Key is re-cached in Redis
      const reCached = await safeGet('dorms:public:overview:current:current');
      assert.ok(reCached !== null, 'Redis must be re-populated with fresh data');
    });

    console.log('\n--- 4. Cache Stats Accuracy Verification ---');

    await test('Admin monitoring stats accurately reflect hits, misses, sets, and invalidations', async () => {
      const res = await fetch(`${baseUrl}/api/admin/cache-stats`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      const stats = json.data;

      console.log('    📊 Live Cache Stats Output:');
      console.log(`       Redis Status: ${stats.redisConnectionStatus}`);
      console.log(`       Cache Hits: ${stats.cacheHitCount}`);
      console.log(`       Cache Misses: ${stats.cacheMissCount}`);
      console.log(`       Cache Sets: ${stats.cacheSetCount}`);
      console.log(`       Cache Invalidations: ${stats.cacheInvalidationCount}`);
      console.log(`       Cache Hit Ratio: ${stats.cacheHitRatio}`);

      assert.ok(stats.cacheHitCount >= 1, 'Should record at least 1 cache hit');
      assert.ok(stats.cacheMissCount >= 2, 'Should record at least 2 cache misses (initial + post-invalidation)');
      assert.ok(stats.cacheSetCount >= 2, 'Should record at least 2 cache sets');
      assert.ok(stats.cacheInvalidationCount >= 1, 'Should record at least 1 invalidation');
      assert.ok(stats.cacheHitRatioRaw > 0, 'Hit ratio must be greater than 0');
    });

  } finally {
    await teardown();
  }

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`Live Verification Suite: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runLiveVerification();
