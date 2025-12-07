# BotID Setup Guide

This guide walks you through setting up and configuring BotID protection in your Next.js application.

## Quick Start

### 1. Installation

The `botid` package is already installed. Verify it's in your `package.json`:

```bash
npm list botid
```

### 2. Configuration

BotID is already configured in your project:

- ✅ `next.config.mjs` - Uses `withBotId` wrapper
- ✅ `app/layout.tsx` - Includes `BotIDProvider`
- ✅ `lib/botid.ts` - Server-side verification utilities
- ✅ `components/botid-provider.tsx` - Client-side component

### 3. Protected Routes

The following routes are already protected:

- `POST /api/feedback` - Feedback submission
- `POST /api/notification-banners/dismiss` - Banner dismissal
- `POST /api/admin/*` - All admin endpoints

## Adding Protection to New Routes

### Step 1: Add Route to Protected List

Edit `components/botid-provider.tsx`:

```typescript
export function BotIDProvider() {
  const protectedRoutes = [
    { path: '/api/feedback', method: 'POST' },
    { path: '/api/my-new-endpoint', method: 'POST' },  // Add this
    { path: '/api/admin/*', method: '*' },
  ]

  return <BotIdClient protect={protectedRoutes} />
}
```

### Step 2: Add Server-Side Verification

Edit your route handler (e.g., `app/api/my-new-endpoint/route.ts`):

```typescript
import { NextResponse } from 'next/server'
import { verifyBotID, logBotIDVerification } from '@/lib/botid'

export async function POST(request: Request) {
  // Verify request is from a real user
  const result = await verifyBotID()
  logBotIDVerification(result, { 
    route: '/api/my-new-endpoint',
    method: 'POST'
  })

  // Reject bots (but allow verified bots like search engines)
  if (result.isBot && !result.isVerifiedBot) {
    return NextResponse.json(
      { 
        error: 'Access denied',
        message: 'This request appears to be from an automated bot',
        code: 'BOT_DETECTED'
      },
      { status: 403 }
    )
  }

  // Your API logic here
  const data = await request.json()
  
  return NextResponse.json({
    success: true,
    data: data
  })
}
```

## Testing BotID

### Local Testing

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Test a protected endpoint:**
   - Open your browser to `http://localhost:3000`
   - Open DevTools (F12)
   - Go to the Console tab
   - Make a request to a protected endpoint:
     ```javascript
     fetch('/api/feedback', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         title: 'Test',
         description: 'Test feedback'
       })
     }).then(r => r.json()).then(console.log)
     ```

3. **Check the response:**
   - In development, you should get a successful response
   - Check the console logs for BotID verification results

### Production Testing

1. **Deploy to Vercel:**
   ```bash
   vercel deploy
   ```

2. **Test from your deployed URL:**
   - Use the same fetch request as above
   - BotID will run real challenges
   - Bots will be blocked with 403 responses

### Using curl (Will Be Blocked)

```bash
# This will be blocked because curl doesn't run JavaScript
curl -X POST https://your-domain.com/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Test"}'

# Response: 403 Forbidden
```

## Monitoring BotID

### Console Logs

BotID logs verification results to the console:

```
[BotID] Legitimate user verified: {
  timestamp: "2025-12-07T20:30:00.000Z",
  isHuman: true,
  isBot: false,
  isVerifiedBot: false,
  bypassed: false,
  route: "/api/feedback",
  method: "POST"
}
```

### Vercel Dashboard

Monitor BotID activity in your Vercel project:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click **Firewall** → **Rules**
4. View blocked requests and bot detection metrics

### Enabling Deep Analysis

For more accurate bot detection:

1. Go to Vercel Dashboard
2. Select your project
3. Click **Firewall** → **Rules**
4. Enable **Vercel BotID Deep Analysis**
5. Update your code to use deep analysis:

```typescript
const result = await verifyBotID({ checkLevel: 'deepAnalysis' })
```

## Configuration Options

### Client-Side Options

Configure protected routes in `BotIDProvider`:

```typescript
const protectedRoutes = [
  { 
    path: '/api/feedback', 
    method: 'POST',
    advancedOptions: {
      checkLevel: 'deepAnalysis'  // Optional: use deep analysis
    }
  },
]
```

### Server-Side Options

Configure verification in route handlers:

```typescript
// Use deep analysis
const result = await verifyBotID({ checkLevel: 'deepAnalysis' })

// Development mode (bypass verification)
const result = await verifyBotID({ isDevelopment: true })
```

## Handling Different Bot Types

### Verified Bots (Search Engines, Monitoring)

```typescript
if (result.isVerifiedBot) {
  console.log(`Verified bot: ${result.verifiedBotName}`)
  // Allow the request
  return NextResponse.json({ success: true })
}
```

### Unverified Bots

```typescript
if (result.isBot && !result.isVerifiedBot) {
  // Block the request
  return NextResponse.json(
    { error: 'Access denied' },
    { status: 403 }
  )
}
```

### Humans

```typescript
if (result.isHuman) {
  // Process the request normally
  return NextResponse.json({ success: true })
}
```

## Troubleshooting

### Issue: All requests are blocked

**Solution:**
1. Ensure `BotIDProvider` is mounted in `app/layout.tsx`
2. Check that the route is in the protected routes list
3. Verify you're making requests from a browser (not curl)
4. Check browser console for errors

### Issue: Legitimate users are blocked

**Solution:**
1. Check the BotID logs for false positives
2. Enable BotID Deep Analysis for better accuracy
3. Review the `isVerifiedBot` field - some legitimate bots might be blocked
4. Consider adjusting your verification logic

### Issue: BotID script not loading

**Solution:**
1. Check CSP headers allow `https://vercel.com`
2. Verify `withBotId` wrapper is applied in `next.config.mjs`
3. Check browser Network tab for script loading errors
4. Ensure you're deployed on Vercel (required for production)

## Best Practices

1. **Always verify on the server** - Never trust client-side checks alone
2. **Log verification results** - Monitor for patterns and false positives
3. **Protect sensitive endpoints** - Apply BotID to:
   - Form submissions
   - API endpoints that modify data
   - Authentication endpoints
   - Resource-intensive operations
4. **Allow verified bots** - Don't block legitimate bots like search engines
5. **Combine with other security** - Use rate limiting, input validation, etc.
6. **Monitor metrics** - Track bot detection rates and adjust as needed

## Security Considerations

- BotID protects against **automated bots**, not sophisticated attacks
- It's one layer of defense, not a complete security solution
- Combine with:
  - Rate limiting
  - Input validation
  - Authentication/authorization
  - Web Application Firewall (WAF)
  - IP blocking
  - CORS policies

## Performance

- **Client-side:** ~50-100ms for challenge (async, non-blocking)
- **Server-side:** <1ms for verification (header check only)
- **Network:** One additional request for BotID script (cached)

## Next Steps

1. ✅ BotID is installed and configured
2. ✅ Protected routes are set up
3. 📝 Test BotID locally with `npm run dev`
4. 🚀 Deploy to Vercel
5. 📊 Monitor BotID activity in Vercel dashboard
6. 🔧 Adjust configuration based on your needs

## References

- [BotID NPM Package](https://www.npmjs.com/package/botid)
- [Vercel BotID Docs](https://vercel.com/docs/botid/get-started)
- [BOTID_IMPLEMENTATION.md](./BOTID_IMPLEMENTATION.md) - Detailed implementation guide
- [BOTID_EXAMPLES.md](./BOTID_EXAMPLES.md) - Code examples
