# 🏠 Dorm Solution — Backend API Server (`/server`)

Production-ready Node.js & Express.js REST API server powering the **Dorm Solution (11/38 Home)** management ecosystem. Features MongoDB persistence, high-performance Redis Cloud caching, automated cache invalidation, monthly financial carry-forward balance calculations, Socket.IO real-time events, and Firebase authentication.

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| **Node.js (v18+) & Express.js** | Core REST API framework and routing (ES Modules) |
| **MongoDB & Mongoose (v9)** | Primary authoritative database & schema modeling |
| **Redis Cloud (`redis` v4+)** | Server-side Cache-Aside caching with TTL & auto-invalidation |
| **Firebase Admin SDK** | Token verification & Google OAuth authorization |
| **JSON Web Tokens (JWT)** | Role-based stateless session management |
| **Socket.IO (v4)** | Real-time notifications and synchronized updates |
| **Winston** | Production logging with standardized cache tags and file rotation |
| **Helmet & Express Rate Limit** | HTTP security headers and IP rate limiting |

---

## ⚡ High-Performance Redis Caching Architecture

The server implements a production-grade **Cache-Aside Pattern** with automatic multi-domain invalidation and graceful fallback.

```
 Client Request (GET)
        │
        ▼
 ┌──────────────┐      Cache HIT       ┌────────────────┐
 │ Redis Cloud  │ ───────────────────► │ Return Cached  │
 └──────┬───────┘                      └────────────────┘
        │ Cache MISS
        ▼
 ┌──────────────┐     Store with TTL   ┌────────────────┐
 │ MongoDB Atlas│ ───────────────────► │ Save in Redis  │
 └──────┬───────┘                      └───────┬────────┘
        │                                      │
        └──────────────────────────────────────┴──► Response
```

### 1. Fail-Safe Offline Degradation
- Redis is an **optional acceleration layer**, not a single point of failure.
- Express HTTP server binds to `0.0.0.0:${PORT}` **immediately** upon MongoDB connection.
- Redis initializes in the background and will never block Render port detection or server startup.
- If Redis is unavailable or offline, all API requests gracefully fall back to MongoDB with `X-Cache: BYPASS`.
- Bounded reconnection strategy (stops after 3 retries) prevents infinite loop crashes.

### 2. Configured TTL Durations

| Domain | TTL | Invalidation Trigger |
|---|---|---|
| **Dashboards (Manager & Member)** | `60s` | Any meal, expense, member, payment, or notice mutation |
| **Financial Summaries & Balances** | `60s` | Payments recorded, expenses added/edited/deleted |
| **Meals & Meal Rates** | `120s` | Meal counts updated, meal rate adjusted |
| **Expenses & Grocery Logs** | `120s` | Grocery or common costs added, edited, or deleted |
| **Market / Bazaar Schedules** | `120s` | Duty assigned or rotation modified |
| **Weekly Meal Menu** | `300s` | Weekly plan altered |
| **Members & Rooms** | `300s` | Member status changed, room allocation modified |
| **Public Overview & Community** | `120s` | Dependent domain changes |
| **Notices & Announcements** | `300s` | Notice published, edited, or deleted |
| **Settings** | `300s` | Global system settings updated |

### 3. Automatic Cache Invalidation
When any `POST`, `PUT`, `PATCH`, or `DELETE` mutation succeeds, the domain invalidator (`cacheInvalidator.js`) deletes dependent cache patterns across Redis:
- **Grocery & Expenses:** Clears expense summaries, grocery history, and triggers financial recalculation.
- **Meals:** Clears daily meal counts, user-specific meal summaries, and recalculates meal rates.
- **Members:** Clears member lists and recalculates common costs per member.
- **Financial Operations:** Clears all dashboard and public community accounting summaries.

### 4. Protected Admin Monitoring Endpoint
Managers and admins can monitor live cache performance:
```http
GET /api/admin/cache-stats
Authorization: Bearer <manager-jwt-token>
```

**Response Shape:**
```json
{
  "status": "success",
  "data": {
    "redisConnectionStatus": "connected",
    "redisEnabled": true,
    "cacheHitCount": 14,
    "cacheMissCount": 4,
    "cacheHitRatio": "77.78%",
    "cacheHitRatioRaw": 0.7778,
    "cacheSetCount": 4,
    "cacheInvalidationCount": 2,
    "cacheErrorCount": 0,
    "uptimeSeconds": 360,
    "timestamp": "2026-11-24T17:05:14.000Z",
    "redisServer": {
      "version": "7.4.2",
      "usedMemoryHuman": "1.82M",
      "connectedClients": 2,
      "totalCommandsProcessed": 512,
      "uptimeInSeconds": 86420
    }
  }
}
```

---

## 💰 Financial Data Integrity & Carry-Forward Engine

Dorm Solution features an exact monthly carry-forward accounting engine in `meal.controller.js` and `carryForward.test.mjs`:
- **Closing Balance Formula:**
  $$\text{Closing Balance} = \text{Stored Prior Carry} + \text{Payments Paid} - \text{Total Consumed Cost}$$
- **Chain Propagation:** Previous month's closing credit/debt cascades forward into the subsequent month without loss or duplication.
- **Idempotency:** Re-computing month snapshots produces deterministic, rounded 2-decimal closing balances.
- **Authoritative Database:** Redis caches only finalized calculations; MongoDB is always the single source of truth for financial balances.

---

## 📂 Server Directory Structure

```text
server/
├── src/
│   ├── config/
│   │   ├── db.js                 # MongoDB Mongoose connection
│   │   ├── redis.js              # Redis Cloud connection, fail-safe client & SCAN
│   │   ├── socket.js             # Socket.IO initialization
│   │   └── firebase.js           # Firebase Admin SDK initialization
│   ├── controllers/              # Domain request handlers
│   │   ├── auth.controller.js
│   │   ├── complaint.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── expense.controller.js
│   │   ├── marketSchedule.controller.js
│   │   ├── meal.controller.js    # Carry-forward engine & meal rate logic
│   │   ├── member.controller.js
│   │   ├── notice.controller.js
│   │   ├── payment.controller.js
│   │   ├── public.controller.js
│   │   ├── room.controller.js
│   │   └── user.controller.js
│   ├── middlewares/
│   │   ├── auth.middleware.js     # JWT & role check (requireManager, requireMember)
│   │   ├── cache.middleware.js    # GET Cache-Aside middleware with X-Cache headers
│   │   ├── errorHandler.js        # Global error interceptor
│   │   ├── rateLimiter.js         # Express rate limiting
│   │   └── notFound.js            # 404 handler
│   ├── models/                    # Mongoose database models
│   │   ├── expense.model.js
│   │   ├── marketSchedule.model.js
│   │   ├── mealEntry.model.js
│   │   ├── member.model.js
│   │   ├── monthlyBalance.model.js
│   │   ├── notice.model.js
│   │   ├── payment.model.js
│   │   ├── room.model.js
│   │   ├── settings.model.js
│   │   └── user.model.js
│   ├── routes/                    # Express routing tables
│   │   ├── admin.routes.js        # /api/admin/cache-stats
│   │   ├── auth.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── expense.routes.js
│   │   ├── meal.routes.js
│   │   ├── public.routes.js
│   │   └── ...
│   └── utils/                     # Helpers & test suites
│       ├── apiResponse.js         # Unified envelope response helpers
│       ├── cacheKeys.js           # Deterministic key generator & query hash
│       ├── cacheInvalidator.js    # Multi-domain cache purge utility
│       ├── cacheMetrics.js        # Real-time metrics aggregator
│       ├── logger.js              # Winston logging configuration
│       ├── carryForward.test.mjs  # 11 Unit tests for financial balance engine
│       ├── redisCaching.test.mjs  # 10 Unit tests for Redis TTL & degradation
│       └── cacheVerification.test.mjs # 9 Live integration tests (Atlas + Redis Cloud)
├── server.js                      # Server entry point & graceful shutdown
└── package.json
```

---

## 🔧 Environment Variables (`.env`)

Create a `.env` file in `/server` matching the structure below:

```env
# ─── Server ────────────────────────────────────────────────
PORT=5000
NODE_ENV=development
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=30d
CLIENT_URL=http://localhost:5173

# ─── MongoDB Atlas ─────────────────────────────────────────
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/dorm_db

# ─── Firebase Admin SDK ────────────────────────────────────
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"

# ─── Redis Cloud Caching ───────────────────────────────────
REDIS_HOST=your-redis-host.db.redis.io
REDIS_PORT=16992
REDIS_USERNAME=default
REDIS_PASSWORD=your_redis_cloud_password
REDIS_ENABLED=true
# Set REDIS_TLS=true ONLY if your Redis database uses TLS/SSL (e.g. rediss:// or TLS port 6380).
# For standard free Redis Cloud instances on custom ports like 16992, keep this false:
REDIS_TLS=false

# ─── n8n AI Chat Webhook (Optional) ────────────────────────
N8N_WEBHOOK_URL=http:/somthing/webhook/your-webhook-id/chat
```

---

## 🧪 Automated Test Suite

The server includes 30 automated tests across three comprehensive suites:

```bash
cd server
npm test
```

### Suites Tested:
1. **Carry-Forward Financial Math (`carryForward.test.mjs` - 11 Tests):**
   - Positive/negative credit carry propagation across 3-month chains.
   - Zero-balance settlement.
   - Missing prior snapshot defaults to 0 without phantom debt.
   - Two-decimal rounding stability.
   - Dashboard balance vs member breakdown equality.
2. **Redis Infrastructure & Fail-Safe (`redisCaching.test.mjs` - 10 Tests):**
   - Deterministic query hashing regardless of parameter key order.
   - Production TTL bounds sanity.
   - Safe offline degradation (`safeGet`, `safeSet`, `safeDel` return safe fallbacks).
   - Middleware `X-Cache: BYPASS` when Redis is disabled.
3. **Live Redis Cloud Verification (`cacheVerification.test.mjs` - 9 Tests):**
   - Admin stats protection (401 unauthenticated, 403 member, 200 manager).
   - Lifecycle proof: `Cache MISS` $\rightarrow$ `Cache SET` $\rightarrow$ `Cache HIT`.
   - Mutation invalidation: `[CACHE INVALIDATED]` $\rightarrow$ fresh fetch $\rightarrow$ `Cache MISS`.
   - Admin metrics accuracy verification.

---

## 🚀 Running Locally & Deployment

### Local Development:
```bash
cd server
npm install
npm run dev
```

### Production Deployment (Render):
1. Connect repository to Render as a **Web Service**.
2. **Build Command:** `npm install`
3. **Start Command:** `npm start`
4. Set environment variables (`MONGODB_URI`, `JWT_SECRET`, `FIREBASE_*`, `REDIS_*`).
5. Render will automatically detect the open port and bind within seconds.
