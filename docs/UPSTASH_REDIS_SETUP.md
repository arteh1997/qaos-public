# Upstash Redis Setup Guide

## Overview

The application uses **Upstash Redis** for distributed rate limiting across serverless instances. This ensures consistent rate limiting behavior in production multi-instance deployments (e.g., Vercel, AWS Lambda).

## Why Upstash Redis?

### The Problem with In-Memory Rate Limiting

In serverless environments, each function instance has its own memory. This means:
- User A triggers Instance 1 → uses rate limit counter in Instance 1's memory
- User A triggers Instance 2 → sees fresh counter in Instance 2's memory
- **Result**: User can bypass rate limits by triggering multiple instances

### The Solution: Distributed Rate Limiting with Redis

Redis provides a shared data store across all instances:
- All instances read/write from the same Redis database
- Rate limits are enforced consistently across all traffic
- Uses sliding window algorithm for accurate rate limiting

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Vercel     │     │  Vercel     │     │  Vercel     │
│  Instance 1 │────▶│  Upstash    │◀────│  Instance 2 │
│             │     │  Redis      │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                           ▲
                           │
                           ▼
                    Shared State:
                    ratelimit:user123 = [timestamps...]
```

## Setup Instructions

### 1. Create Upstash Redis Database

1. Go to [https://console.upstash.com/](https://console.upstash.com/)
2. Sign up or log in
3. Click "Create Database"
4. Configure:
   - **Name**: `restaurant-inventory-ratelimit` (or your preference)
   - **Region**: Choose closest to your deployment region
     - For Vercel US: `us-east-1` or `us-west-1`
     - For Vercel EU: `eu-west-1`
   - **Type**: Regional (Free tier available)
5. Click "Create"

### 2. Get API Credentials

After creating the database:

1. Click on your database name
2. Scroll to "REST API" section
3. Copy the following values:
   - **UPSTASH_REDIS_REST_URL**: `https://xxx-yyy-zzz.upstash.io`
   - **UPSTASH_REDIS_REST_TOKEN**: `AX...` (long token)

### 3. Add Environment Variables

#### Local Development (.env.local)

```bash
# Upstash Redis (for distributed rate limiting)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

#### Production (Vercel)

1. Go to your Vercel project dashboard
2. Click "Settings" → "Environment Variables"
3. Add both variables:
   - **Name**: `UPSTASH_REDIS_REST_URL`
   - **Value**: Your URL
   - **Environments**: Production, Preview, Development

   - **Name**: `UPSTASH_REDIS_REST_TOKEN`
   - **Value**: Your token
   - **Environments**: Production, Preview, Development

4. Click "Save"
5. Redeploy your application

## How It Works

### Rate Limit Algorithm: Sliding Window with Sorted Sets

The implementation uses Redis sorted sets to track request timestamps:

```typescript
// Key structure in Redis
ratelimit:login:192.168.1.1 → SortedSet [
  {score: 1707394800000, member: "1707394800000-0.123"},
  {score: 1707394801000, member: "1707394801000-0.456"},
  {score: 1707394802000, member: "1707394802000-0.789"},
  // ... up to limit
]
```

### Request Flow

1. **Remove old entries**: `ZREMRANGEBYSCORE` removes timestamps outside window
2. **Add current request**: `ZADD` adds current timestamp
3. **Count requests**: `ZCARD` counts total entries in window
4. **Check limit**: Compare count against configured limit
5. **Set TTL**: `EXPIRE` cleans up old keys automatically

### Example Rate Limit Check

```typescript
// User makes login request
const result = await rateLimit('login:user@example.com', {
  limit: 5,        // 5 attempts
  windowMs: 900000 // per 15 minutes
})

if (!result.success) {
  return NextResponse.json(
    { message: 'Too many attempts. Try again later.' },
    { status: 429, headers: getRateLimitHeaders(result) }
  )
}
```

## Fallback Behavior

If Upstash Redis is **not configured**, the app automatically falls back to in-memory rate limiting:

- ✅ **Development**: Works fine (single instance)
- ⚠️ **Production**: Not recommended (can be bypassed in multi-instance)

You'll see this warning in logs:
```
⚠️  Upstash Redis not configured. Rate limiting will use in-memory fallback.
```

## Rate Limit Configuration

Current limits (defined in `lib/rate-limit.ts`):

| Endpoint Type | Limit | Window | Purpose |
|--------------|-------|--------|---------|
| `api` | 100 req | 1 min | General API endpoints |
| `auth` | 10 req | 1 min | Authentication endpoints |
| `createUser` | 5 req | 1 min | User creation (anti-spam) |
| `reports` | 20 req | 1 min | Report generation |

## Monitoring

### Check Rate Limit Status

You can monitor rate limits via response headers:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1707394800000
```

### Upstash Dashboard

Monitor Redis usage in Upstash console:
- **Requests/sec**: Should correlate with app traffic
- **Storage**: Minimal (only active rate limit windows)
- **Latency**: Should be < 50ms for REST API

## Testing

### Unit Tests

Rate limit tests use in-memory fallback (no Redis required):

```bash
npm test -- tests/lib/rate-limit.test.ts
```

All 16 tests should pass regardless of Redis configuration.

### Integration Tests

To test with actual Redis:

1. Set env vars in test environment
2. Run integration tests:
   ```bash
   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... npm test
   ```

## Troubleshooting

### "Rate limiting using in-memory fallback" Warning

**Cause**: Environment variables not set
**Fix**: Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env.local`

### "Redis rate limit error" in Logs

**Cause**: Network issue or invalid credentials
**Fix**:
1. Verify credentials in Upstash console
2. Check network connectivity
3. Verify region matches your deployment

### Rate Limits Not Working in Production

**Cause**: Environment variables not set in Vercel
**Fix**: Add variables in Vercel dashboard → Settings → Environment Variables

## Cost Considerations

### Upstash Free Tier

- **Requests**: 10,000 commands/day
- **Storage**: 256 MB
- **Bandwidth**: 200 MB/month

For typical rate limiting usage:
- 1 rate limit check = ~4 Redis commands (ZREMRANGEBYSCORE, ZADD, ZCARD, EXPIRE)
- 10,000 commands = ~2,500 rate limit checks/day
- Should be sufficient for small-to-medium apps

### Scaling Beyond Free Tier

If you exceed free tier:
- **Pay-as-you-go**: $0.2 per 100K commands
- **Pro Plan**: $10/month for 1M commands
- Upstash automatically scales

## Security Best Practices

1. **Never commit tokens**: Add `.env.local` to `.gitignore`
2. **Rotate tokens periodically**: Generate new tokens in Upstash console
3. **Use separate databases**: Development vs Production
4. **Monitor usage**: Set up alerts for unusual traffic

## Migration from In-Memory

If you're already deployed with in-memory rate limiting:

1. Add Upstash Redis credentials to environment
2. Deploy updated code
3. No data migration needed (fresh start)
4. Old in-memory counters expire naturally

## Additional Resources

- [Upstash Documentation](https://docs.upstash.com/redis)
- [Redis Sorted Sets](https://redis.io/docs/data-types/sorted-sets/)
- [Rate Limiting Algorithms](https://blog.upstash.com/rate-limiting-algorithms)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
