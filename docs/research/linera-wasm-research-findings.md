# Linera WASM Integration Research Findings

**Date**: January 22, 2026
**Status**: Research Complete - Critical Issues Found

---

## Executive Summary

Our previous @linera/client implementation **was removed because of static import issues**. However, there IS a working solution used by the official Linera template. The key differences are:

| Aspect | Our Previous Attempt | Working Template |
|--------|---------------------|------------------|
| WASM Loading | Static imports (failed) | Dynamic from `/public/` folder |
| COEP Header | `require-corp` | `credentialless` |
| Implementation | GraphQL-only (no WASM) | Full WASM client |
| Status | Deleted | Working |

---

## Critical Finding #1: Our Previous Implementation Was NOT Using WASM

The deleted `ProductionLineraClient` (commit `775106a`) used **direct GraphQL fetch calls**, NOT the `@linera/client` WASM module:

```typescript
// Previous implementation - GraphQL only
private async executeGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
}
```

**Why this matters**: The Linera submission requires "using the Linera Web client library" - a GraphQL-only approach may NOT meet this requirement.

---

## Critical Finding #2: Working WASM Loading Pattern Exists

The [linera-dynamic-template](https://github.com/uratmangun/linera-dynamic-template) shows a **working solution**:

### linera-loader.ts Pattern
```typescript
// Copies WASM to /public/linera/ and loads dynamically
let cachedLinera: typeof import('@linera/client') | null = null;

export async function loadLinera() {
  if (cachedLinera) return cachedLinera;

  // webpack ignore to prevent bundling issues
  const module = await import(/* webpackIgnore: true */ '/linera/linera_web.js');
  await module.default('/linera/linera_web_bg.wasm');

  cachedLinera = module;
  return module;
}
```

### Required Files in `/public/linera/`
- `linera_web.js` (copy from `node_modules/@linera/client/dist/linera.js`)
- `linera_web_bg.wasm` (copy from `node_modules/@linera/client/dist/linera_bg.wasm` - 13MB)

---

## Critical Finding #3: COEP Header Difference

| Header | Our Config | Working Template |
|--------|-----------|------------------|
| Cross-Origin-Embedder-Policy | `require-corp` | `credentialless` |

### Impact:
- **`require-corp`**: Stricter. Requires all cross-origin resources to have CORP/CORS headers.
- **`credentialless`**: More flexible. Allows cross-origin resources without explicit permission.

### Browser Support for `credentialless`:
- Chrome/Edge: Supported
- Firefox: Supported
- **Safari: NOT SUPPORTED**

This means **Safari users will NOT be able to use the WASM client**.

---

## Critical Finding #4: Why Static Imports Failed

From Next.js issue [#25852](https://github.com/vercel/next.js/issues/25852):

1. **Server-Side Rendering (SSR)** tries to load WASM on the server
2. Webpack 5 places WASM files in unexpected directories
3. Path mismatch causes `ENOENT` errors

### Solutions:
1. **Disable SSR** for WASM components: `ssr: false`
2. **Dynamic imports** with webpack ignore
3. **Load from `/public/` folder** instead of node_modules

---

## Current Codebase State

### What We Have:
- `@linera/client@0.15.10` installed (but unused)
- COOP/COEP headers configured in `next.config.ts`
- `serverExternalPackages: ['@linera/client']` configured
- `MockLineraClient` active for all operations

### What We're Missing:
1. WASM files in `/public/linera/` folder
2. Dynamic WASM loader function
3. Real client using `@linera/client` classes
4. `credentialless` COEP header (we have `require-corp`)

---

## Package Analysis: @linera/client@0.15.10

### WASM Files (total ~26MB):
| File | Size | Location |
|------|------|----------|
| `linera_bg.wasm` | 13 MB | `/dist/` |
| `index_bg.wasm` | 14 MB | `/dist/wasm/` |

### Key Classes Available:
```typescript
// Core classes
export class Client { constructor(wallet: Wallet, signer: Signer, options?: Options); }
export class Chain { balance(): Promise<string>; application(id: string): Promise<Application>; }
export class Application { query(query: string, options?: QueryOptions): Promise<string>; }
export class Wallet { setOwner(chain_id: any, owner: any): Promise<void>; }
export class Faucet { createWallet(): Promise<Wallet>; claimChain(wallet: Wallet, owner: AccountOwner): Promise<string>; }

// Signers
export class PrivateKey implements Signer { static createRandom(): PrivateKey; sign(...): Promise<string>; }
export class Composite implements Signer { constructor(...signers: Signer[]); }
```

### Dependencies:
- `ethers@^6.15.0` - Required for EIP-191 signing

---

## Verified Working Pattern (from linera-dynamic-template)

### 1. next.config.ts
```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ['@linera/client', 'pino', 'thread-stream'],
  turbopack: {},
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },  // NOT require-corp
        { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
      ],
    }];
  }
};
```

### 2. Copy WASM Files (build step)
```bash
# Add to package.json scripts
"copy-wasm": "cp node_modules/@linera/client/dist/linera.js public/linera/linera_web.js && cp node_modules/@linera/client/dist/linera_bg.wasm public/linera/linera_web_bg.wasm"
```

### 3. Dynamic Loader
```typescript
// src/lib/linera/linera-loader.ts
let cachedLinera: any = null;

export async function loadLinera() {
  if (cachedLinera) return cachedLinera;

  const module = await import(/* webpackIgnore: true */ '/linera/linera_web.js');
  await module.default('/linera/linera_web_bg.wasm');

  cachedLinera = module;
  return module;
}
```

### 4. Client Adapter
```typescript
// src/lib/linera/linera-adapter.ts
class LineraAdapter {
  private linera: any = null;
  private client: any = null;

  async connect(): Promise<string> {
    this.linera = await loadLinera();

    const faucet = new this.linera.Faucet(FAUCET_URL);
    const wallet = await faucet.createWallet();

    const signer = this.linera.signer.PrivateKey.createRandom();
    const owner = signer.address();

    const chainId = await faucet.claimChain(wallet, owner);
    this.client = await Promise.resolve(new this.linera.Client(wallet, signer));

    return owner;
  }

  async queryApplication(appId: string, query: string): Promise<any> {
    const chain = await this.client.chain(this.chainId);
    const app = await chain.application(appId);
    return await app.query(query);
  }
}
```

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Safari not working | HIGH | MEDIUM | Document limitation, provide fallback |
| 13MB WASM slow to load | MEDIUM | MEDIUM | Loading indicator, service worker cache |
| Vercel WASM size limits | LOW | HIGH | Test early, fallback to serverless |
| Conway testnet unstable | LOW | MEDIUM | Retry logic, graceful degradation |

---

## Recommended Implementation Order

### Phase 0: Setup (30 min)
1. Change COEP header from `require-corp` to `credentialless`
2. Create `/public/linera/` directory
3. Add WASM copy script to package.json
4. Copy WASM files from node_modules

### Phase 1: WASM Loading (1 hour)
1. Create `src/lib/linera/linera-loader.ts`
2. Test that WASM loads without errors
3. Verify `self.crossOriginIsolated === true` in browser console

### Phase 2: Client Implementation (2-3 hours)
1. Create `src/lib/linera/real-client.ts` using dynamic loader
2. Use `PrivateKey` signer for simplicity
3. Implement Faucet → Wallet → Client flow
4. Implement game operations via GraphQL queries

### Phase 3: Integration (1-2 hours)
1. Update `getLineraClient()` to use real client
2. Test create/join/submit game flows
3. Verify on-chain state persistence

### Phase 4: Deploy & Test (1 hour)
1. Deploy to Vercel with WASM files
2. Test on Chrome, Firefox, Edge
3. Document Safari limitation

---

## Decision Point

Before proceeding, choose one of these approaches:

### Option A: Full WASM Client (Recommended for Submission)
- Meets "Linera Web client library" requirement
- Uses @linera/client properly
- ~26MB WASM download
- Safari not supported

### Option B: GraphQL-Only (Simpler but may not qualify)
- Direct GraphQL queries to Linera node
- Smaller bundle size
- Works in all browsers
- May not meet submission "Web client library" requirement

### Option C: Hybrid
- WASM client for supported browsers
- GraphQL fallback for Safari
- More complex but best coverage

---

## Sources

- [linera-dynamic-template](https://github.com/uratmangun/linera-dynamic-template) - Working Next.js + Linera template
- [Linera Interactivity Docs](https://linera.dev/developers/frontend/interactivity.html) - Official frontend guide
- [Next.js WASM Issue #25852](https://github.com/vercel/next.js/issues/25852) - SSR WASM problems
- [MDN COEP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy) - credentialless vs require-corp
- [Chrome COEP credentialless](https://developer.chrome.com/blog/coep-credentialless-origin-trial) - Browser support details

---

## Conclusion

**The WASM approach CAN work**, but requires:
1. Dynamic loading from `/public/` folder (not static imports)
2. `credentialless` COEP header (not `require-corp`)
3. SSR disabled for WASM components
4. Acceptance that Safari won't be supported

The working template proves this is viable. Our previous attempt failed because we used static imports and didn't copy WASM to the public folder.
