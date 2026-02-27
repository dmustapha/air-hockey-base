# Comprehensive Linera Integration Plan for Air Hockey

## Overview and Goals

This plan details the step-by-step process to integrate REAL Linera blockchain functionality into the Air Hockey game for submission to the Linera hackathon. The goal is to replace the current mock implementation with actual on-chain transactions using the `@linera/client` WASM library running in the browser.

### Submission Requirements
1. Live demo running against **Testnet Conway** (`https://rpc.testnet-conway.linera.net`)
2. Using the **Linera Web client library** (`@linera/client`) - the preferred approach

### Current State Summary
| Component | Status | Action Required |
|-----------|--------|-----------------|
| Smart Contract (Rust) | Written but not deployed | Deploy to Conway testnet |
| `@linera/client` v0.15.10 | Installed but unused | Integrate into frontend |
| Frontend Mock Client | Active | Replace with real client |
| Server Linera Service | Mock mode enabled | Configure for real chain |
| COOP/COEP Headers | Configured | Verify working |
| Environment Variables | Partial | Complete with deployed IDs |

---

## Architecture Design

### Target Architecture (Browser-First)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────┐    ┌────────────────────────────────────────────┐   │
│  │   Next.js App      │    │        @linera/client (WASM)               │   │
│  │   (React UI)       │───►│  ┌─────────┐  ┌────────┐  ┌────────────┐   │   │
│  └────────────────────┘    │  │ Faucet  │  │ Client │  │ Application│   │   │
│                            │  └────┬────┘  └───┬────┘  └─────┬──────┘   │   │
│  ┌────────────────────┐    │       │           │             │          │   │
│  │   PrivateKey       │────│───────┼───────────┼─────────────┘          │   │
│  │   Signer           │    │       │           │                        │   │
│  │   (from wallet)    │    │       │           │                        │   │
│  └────────────────────┘    └───────┼───────────┼────────────────────────┘   │
│                                    │           │                             │
└────────────────────────────────────┼───────────┼─────────────────────────────┘
                                     │           │
                                     ▼           ▼
                        ┌────────────────────────────────────┐
                        │    Linera Conway Testnet           │
                        │  • Faucet: faucet.testnet-conway   │
                        │  • RPC: rpc.testnet-conway         │
                        │  • Air Hockey Contract             │
                        └────────────────────────────────────┘
```

### Key Design Decisions

1. **Browser-first approach**: Use `@linera/client` WASM directly in browser, not through backend
2. **PrivateKey Signer**: Use the built-in `signer.PrivateKey` class for development/demo (creates random key or from mnemonic)
3. **Faucet integration**: Auto-claim chain and tokens for new users
4. **Existing server unchanged**: Server continues handling WebSocket game sync; blockchain operations move to client

---

## Component Breakdown

### 1. Smart Contract (Already Complete)

**Location**: `/contracts/air-hockey/`

| File | Purpose |
|------|---------|
| `lib.rs` | ABI: Operation enum (CreateGame, JoinGame, SubmitResult, CancelGame) |
| `contract.rs` | Business logic, state mutations |
| `state.rs` | On-chain state: games, player_stats, stake_pool |
| `service.rs` | GraphQL query service for reads |

**GraphQL Schema** (from service.rs):
```graphql
# Queries
query {
  totalStakePool: String!
  nextGameId: Int!
  owner: String!
  # Note: Full game queries require extending service.rs
}

# Mutations (via contract operations)
mutation CreateGame($stake: String!, $roomCode: String!)
mutation JoinGame($gameId: Int!)
mutation SubmitResult($gameId: Int!, $player1Score: Int!, $player2Score: Int!)
mutation CancelGame($gameId: Int!)
```

### 2. New Linera Client Module

**New Files to Create**:

| File | Purpose |
|------|---------|
| `/src/lib/linera/real-client.ts` | Real LineraClient implementation using @linera/client |
| `/src/lib/linera/wallet-storage.ts` | LocalStorage persistence for wallet keys |
| `/src/lib/linera/linera-provider.tsx` | React context provider |

### 3. Files to Modify

| File | Changes |
|------|---------|
| `/src/lib/linera/index.ts` | Export real client when `USE_MOCK_LINERA=false` |
| `/src/lib/linera/config.ts` | Update default URLs, add validation |
| `/src/app/providers.tsx` | Wrap with LineraProvider |
| `/src/hooks/useLinera.ts` | Use context from LineraProvider |

---

## Data Flow

### Flow 1: Initial Connection

```
1. User visits site
   │
2. LineraProvider mounts
   │  ├── Check localStorage for existing wallet key
   │  └── If found → restore wallet
   │
3. User clicks "Connect Wallet"
   │
4. If no wallet exists:
   │  ├── Generate random PrivateKey signer
   │  ├── Create Faucet instance (faucet.testnet-conway.linera.net)
   │  ├── faucet.createWallet() → Wallet
   │  ├── faucet.claimChain(wallet, owner) → chainId
   │  ├── new Client(wallet, signer, skipProcessInbox=false)
   │  └── Save key to localStorage (encrypted)
   │
5. Store connection state in context
   │
6. UI shows: "Connected: 0x1234...abcd | Balance: 1000 LINERA"
```

### Flow 2: Create Game

```
1. User enters stake (e.g., 10 LINERA) and clicks "Create Game"
   │
2. Frontend generates room code (e.g., "ABCD-1234")
   │
3. Get Application instance:
   │  └── client.application(APPLICATION_ID) → Application
   │
4. Execute mutation via GraphQL:
   │  └── application.query(`
   │        mutation { createGame(stake: "10", roomCode: "ABCD-1234") }
   │      `)
   │
5. Client signs block with PrivateKey signer
   │
6. Transaction submitted to validators
   │
7. Block finalized (~200ms on Conway)
   │
8. Parse response for gameId
   │
9. UI shows: "Game #42 created. Share code: ABCD-1234"
   │
10. Simultaneously: WebSocket notifies server of new game
```

### Flow 3: Join Game

```
1. User enters room code "ABCD-1234"
   │
2. Query for game by room code:
   │  └── application.query(`query { game(roomCode: "ABCD-1234") { id, stake, status } }`)
   │
3. Verify game.status === "waiting" and user has sufficient balance
   │
4. Execute join:
   │  └── application.query(`mutation { joinGame(gameId: 42) }`)
   │
5. Block finalized
   │
6. Both players notified via WebSocket
   │
7. Game starts
```

### Flow 4: Submit Result

```
1. Game ends: Player1=7, Player2=5
   │
2. Host (Player1) submits result:
   │  └── application.query(`
   │        mutation { submitResult(gameId: 42, player1Score: 7, player2Score: 5) }
   │      `)
   │
3. Contract:
   │  ├── Validates caller is participant
   │  ├── Determines winner (7 > 5 → Player1)
   │  ├── Updates game status to "completed"
   │  ├── Updates player stats
   │  └── Note: Actual token transfer requires additional contract logic
   │
4. Winner sees: "You won! +10 LINERA"
```

---

## Implementation Phases

### Phase 1: Smart Contract Deployment (30 min)

**Goal**: Deploy existing contract to Conway testnet

**Steps**:

1.1. Install Linera CLI (if not installed):
```bash
curl -L https://linera.io/install.sh | bash
```

1.2. Add WASM target:
```bash
rustup target add wasm32-unknown-unknown
```

1.3. Build contract:
```bash
cd /Users/MAC/Desktop/dev/linera/air-hockey/contracts/air-hockey
cargo build --release --target wasm32-unknown-unknown
```

1.4. Initialize wallet and claim chain from **Conway** faucet:
```bash
linera wallet init --with-new-chain --faucet https://faucet.testnet-conway.linera.net
linera wallet show  # Note the chain ID
```

1.5. Deploy contract:
```bash
linera publish-and-create \
  target/wasm32-unknown-unknown/release/air_hockey_contract.wasm \
  target/wasm32-unknown-unknown/release/air_hockey_service.wasm \
  --json-argument '{"owner": "<YOUR_CHAIN_ID>"}'
```

1.6. Record outputs:
- **Application ID**: 64-character hex string
- **Chain ID**: From `linera wallet show`

1.7. Update `/contracts/deploy.sh`:
- Change faucet URL from `archimedes` to `conway`
- Update RPC URL similarly

---

### Phase 2: Real Linera Client Implementation (2-3 hours)

**Goal**: Create browser-compatible Linera client using `@linera/client`

#### 2.1 Create Wallet Storage Module

**File**: `/src/lib/linera/wallet-storage.ts`

```typescript
// Purpose: Persist wallet private key in localStorage (encrypted ideally)
// For demo: Simple localStorage, production should use encryption

interface StoredWallet {
  privateKey: string;  // hex-encoded private key
  chainId: string;
  createdAt: number;
}

export function saveWallet(privateKey: string, chainId: string): void;
export function loadWallet(): StoredWallet | null;
export function clearWallet(): void;
export function hasWallet(): boolean;
```

#### 2.2 Create Real Linera Client

**File**: `/src/lib/linera/real-client.ts`

```typescript
import initialize, { Faucet, Client, Wallet, Application, signer } from '@linera/client';

interface RealLineraClientConfig {
  faucetUrl: string;
  applicationId: string;
}

export class RealLineraClient implements LineraClient {
  private faucet: Faucet | null = null;
  private wallet: Wallet | null = null;
  private client: Client | null = null;
  private signer: signer.PrivateKey | null = null;
  private application: Application | null = null;
  private chainId: string | null = null;
  private isInitialized = false;

  constructor(private config: RealLineraClientConfig) {}

  // Initialize WASM module (must be called first)
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await initialize();
    this.faucet = new Faucet(this.config.faucetUrl);
    this.isInitialized = true;
  }

  // Connect: Create or restore wallet
  async connect(): Promise<string> {
    await this.initialize();

    // Check for existing wallet
    const stored = loadWallet();
    if (stored) {
      this.signer = new signer.PrivateKey(stored.privateKey);
      this.chainId = stored.chainId;
    } else {
      // Create new wallet
      this.signer = signer.PrivateKey.createRandom();
      this.wallet = await this.faucet!.createWallet();

      // Claim chain with tokens
      const owner = this.signer.address();
      this.chainId = await this.faucet!.claimChain(this.wallet, owner);

      // Save for future sessions
      saveWallet(/* privateKey hex */, this.chainId);
    }

    // Create client
    this.client = new Client(this.wallet!, this.signer, false);

    // Connect to application
    this.application = await this.client.application(this.config.applicationId);

    return this.signer.address();
  }

  // Game operations via GraphQL
  async createGame(params: CreateGameParams): Promise<TxReceipt & { gameId: number }> {
    const query = `mutation { createGame(stake: "${params.stake}", roomCode: "${params.roomCode}") }`;
    const result = await this.application!.query(query);
    const gameId = JSON.parse(result).createGame;
    return {
      hash: generateTxHash(), // From block data
      blockNumber: Date.now(),
      status: 'success',
      gasUsed: BigInt(21000),
      gameId,
    };
  }

  async joinGame(params: JoinGameParams): Promise<TxReceipt> {
    const query = `mutation { joinGame(gameId: ${params.gameId}) }`;
    await this.application!.query(query);
    return { hash: generateTxHash(), blockNumber: Date.now(), status: 'success', gasUsed: BigInt(21000) };
  }

  async submitResult(params: SubmitResultParams): Promise<TxReceipt> {
    const query = `mutation { submitResult(gameId: ${params.gameId}, player1Score: ${params.player1Score}, player2Score: ${params.player2Score}) }`;
    await this.application!.query(query);
    return { hash: generateTxHash(), blockNumber: Date.now(), status: 'success', gasUsed: BigInt(21000) };
  }

  async cancelGame(gameId: number): Promise<TxReceipt> {
    const query = `mutation { cancelGame(gameId: ${gameId}) }`;
    await this.application!.query(query);
    return { hash: generateTxHash(), blockNumber: Date.now(), status: 'success', gasUsed: BigInt(21000) };
  }

  // Balance query
  async getBalance(address: string): Promise<BalanceResponse> {
    const balance = await this.client!.balance();
    return {
      available: BigInt(balance),
      locked: BigInt(0),
    };
  }

  // Query operations
  async getGame(gameId: number): Promise<ChainGame | null> {
    const query = `query { game(id: ${gameId}) { id creator opponent stake status winner player1Score player2Score roomCode createdAt } }`;
    const result = await this.application!.query(query);
    return parseGameResponse(result);
  }

  async getOpenGames(): Promise<GameListResponse> {
    const query = `query { openGames { id creator stake status roomCode createdAt } }`;
    const result = await this.application!.query(query);
    return parseGamesResponse(result);
  }

  // ... implement remaining methods
}
```

#### 2.3 Update Index Exports

**File**: `/src/lib/linera/index.ts`

```typescript
import { USE_MOCK_CLIENT } from './config';
import { MockLineraClient, getLineraClient as getMockClient } from './client';
import { RealLineraClient } from './real-client';

let realClientInstance: RealLineraClient | null = null;

export function getLineraClient(): LineraClient {
  if (USE_MOCK_CLIENT) {
    return getMockClient();
  }

  if (!realClientInstance) {
    realClientInstance = new RealLineraClient({
      faucetUrl: LINERA_CONFIG.faucetUrl,
      applicationId: LINERA_CONFIG.applicationId,
    });
  }

  return realClientInstance;
}
```

---

### Phase 3: React Integration (1-2 hours)

**Goal**: Create LineraProvider and update hooks

#### 3.1 Create LineraProvider

**File**: `/src/providers/LineraProvider.tsx`

```typescript
'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getLineraClient, LINERA_CONFIG, USE_MOCK_CLIENT } from '@/lib/linera';
import type { WalletState, ChainGame, GameLobbyItem } from '@/lib/linera/types';

interface LineraContextValue {
  // Connection state
  isInitialized: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  walletAddress: string | null;
  chainId: string | null;
  balance: string | null;

  // Error state
  error: Error | null;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;

  // Game operations
  createGame: (stake: string, roomCode: string) => Promise<number>;
  joinGame: (gameId: number) => Promise<void>;
  submitResult: (gameId: number, p1: number, p2: number) => Promise<void>;
  cancelGame: (gameId: number) => Promise<void>;

  // Queries
  getOpenGames: () => Promise<GameLobbyItem[]>;
  getGame: (gameId: number) => Promise<ChainGame | null>;
  refreshBalance: () => Promise<void>;

  // Mode indicator
  isMockMode: boolean;
}

const LineraContext = createContext<LineraContextValue | null>(null);

export function LineraProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => getLineraClient());
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      try {
        if ('initialize' in client) {
          await client.initialize();
        }
        setIsInitialized(true);

        // Check for existing wallet
        if (hasWallet()) {
          // Auto-reconnect
          await connect();
        }
      } catch (err) {
        console.error('[LineraProvider] Init failed:', err);
        setError(err instanceof Error ? err : new Error('Initialization failed'));
      }
    };
    init();
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const address = await client.connect();
      setWalletAddress(address);
      setIsConnected(true);

      // Fetch balance
      const bal = await client.getBalance(address);
      setBalance(formatStake(bal.available));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Connection failed'));
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [client]);

  // ... implement other methods

  return (
    <LineraContext.Provider value={{
      isInitialized,
      isConnected,
      isConnecting,
      walletAddress,
      chainId,
      balance,
      error,
      connect,
      disconnect,
      clearError,
      createGame,
      joinGame,
      submitResult,
      cancelGame,
      getOpenGames,
      getGame,
      refreshBalance,
      isMockMode: USE_MOCK_CLIENT,
    }}>
      {children}
    </LineraContext.Provider>
  );
}

export function useLineraContext() {
  const context = useContext(LineraContext);
  if (!context) {
    throw new Error('useLineraContext must be used within LineraProvider');
  }
  return context;
}
```

#### 3.2 Update App Providers

**File**: `/src/app/providers.tsx`

```typescript
'use client';

import { ReactNode } from 'react';
import { LineraProvider } from '@/providers/LineraProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LineraProvider>
      {children}
    </LineraProvider>
  );
}
```

---

### Phase 4: Smart Contract Enhancement (1 hour)

**Goal**: Add missing GraphQL queries to service.rs

The current `service.rs` only has basic queries. We need to add:

#### 4.1 Add Game Queries to service.rs

```rust
#[Object]
impl QueryRoot {
    // Existing methods...

    /// Get a single game by ID
    async fn game(&self, id: u64) -> Option<GameInfo> {
        // Need to pass state reference or store games in QueryRoot
    }

    /// Get all open games
    async fn open_games(&self) -> GamesResponse {
        // Query games with status == Waiting
    }

    /// Get games for a specific player
    async fn player_games(&self, address: String) -> GamesResponse {
        // Query games where creator or opponent == address
    }
}
```

**Note**: The current service.rs implementation has a limitation - it doesn't include the games/player_stats maps in QueryRoot. This needs to be refactored to pass a reference to state or use async resolvers.

---

### Phase 5: Environment Configuration (15 min)

**Goal**: Set up all environment variables

#### 5.1 Frontend (.env.local)

```bash
# Disable mock mode
NEXT_PUBLIC_USE_MOCK_LINERA=false

# Conway testnet configuration
NEXT_PUBLIC_LINERA_FAUCET_URL=https://faucet.testnet-conway.linera.net
NEXT_PUBLIC_LINERA_NODE_URL=https://rpc.testnet-conway.linera.net
NEXT_PUBLIC_LINERA_NETWORK=Linera Conway Testnet

# Deployed contract (from Phase 1)
NEXT_PUBLIC_LINERA_APPLICATION_ID=<APPLICATION_ID_FROM_DEPLOY>
NEXT_PUBLIC_LINERA_CHAIN_ID=<CHAIN_ID_FROM_DEPLOY>

# Backend API (Railway)
NEXT_PUBLIC_API_URL=https://your-railway-app.up.railway.app
NEXT_PUBLIC_WS_URL=wss://your-railway-app.up.railway.app/ws
```

#### 5.2 Server (.env)

```bash
PORT=4000
LINERA_SERVICE_PORT=8081
LINERA_APPLICATION_ID=<APPLICATION_ID_FROM_DEPLOY>
LINERA_CHAIN_ID=<CHAIN_ID_FROM_DEPLOY>
```

#### 5.3 Vercel Environment Variables

Add all `NEXT_PUBLIC_*` variables in Vercel dashboard.

#### 5.4 Railway Environment Variables

Add server `.env` variables in Railway dashboard.

---

### Phase 6: WASM Loading Configuration (30 min)

**Goal**: Ensure @linera/client WASM loads correctly in browser

#### 6.1 Verify Next.js Config

The existing `next.config.ts` already has:
- COOP/COEP headers for SharedArrayBuffer
- @linera/client marked as external

**Additional changes needed**:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  // ... existing config

  // Enable experimental features for WASM
  experimental: {
    // Allow top-level await for WASM initialization
    esmExternals: true,
  },

  // Webpack config updates
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Enable WASM experiments
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
        topLevelAwait: true,
      };

      // Handle WASM files
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'webassembly/async',
      });
    }
    return config;
  },
};
```

#### 6.2 Dynamic Import for WASM Module

Since @linera/client uses WASM, it must be dynamically imported on the client side:

```typescript
// In real-client.ts
export async function initializeLineraClient(): Promise<typeof import('@linera/client')> {
  if (typeof window === 'undefined') {
    throw new Error('Linera client can only be used in browser');
  }

  const linera = await import('@linera/client');
  await linera.default(); // Initialize WASM
  return linera;
}
```

---

### Phase 7: UI Updates (1 hour)

**Goal**: Update game creation/joining UI to use real blockchain

#### 7.1 CreateGameModal Updates

**File**: `/src/components/cyber/game/CreateGameModal.tsx`

- Remove mock delay
- Use `useLineraContext()` instead of mock client
- Show real transaction status
- Display chain transaction hash on success

#### 7.2 JoinGameModal Updates

**File**: `/src/components/cyber/game/JoinGameModal.tsx`

- Query real game data from chain
- Verify stake amount matches
- Show transaction confirmation

#### 7.3 Wallet Display Updates

**File**: `/src/components/cyber/ui/WalletButton.tsx`

- Show real chain balance
- Display chain ID
- Link to Linera explorer

#### 7.4 Add Loading/Error States

- Show "Initializing WASM..." during first load
- Handle wallet creation errors
- Show transaction pending states

---

### Phase 8: Testing Strategy

#### 8.1 Local Testing Checklist

- [ ] WASM module loads without errors
- [ ] Faucet creates wallet successfully
- [ ] Chain claimed with initial tokens
- [ ] Balance query returns correct value
- [ ] Create game transaction succeeds
- [ ] Join game transaction succeeds
- [ ] Submit result transaction succeeds
- [ ] Game state queries work

#### 8.2 Integration Testing

- [ ] Two browsers can create/join game
- [ ] WebSocket sync works alongside blockchain
- [ ] Game results match on both sides
- [ ] Balance updates correctly after game

#### 8.3 Edge Cases

- [ ] Insufficient balance shows error
- [ ] Network timeout handled gracefully
- [ ] Invalid room code shows error
- [ ] Duplicate game join prevented

---

## Deployment Considerations

### Vercel (Frontend)

1. Enable WASM support (may need Pro plan for larger WASM)
2. Set all `NEXT_PUBLIC_*` environment variables
3. Verify COOP/COEP headers in response

### Railway (Backend)

1. Backend doesn't need @linera/client
2. Keep existing mock mode until frontend is ready
3. Consider removing server-side Linera service entirely (blockchain ops move to frontend)

### Performance

- WASM file is ~13MB - first load will be slow
- Cache WASM in service worker for subsequent visits
- Use loading indicator during initialization

---

## Potential Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WASM loading fails on Vercel | Medium | High | Test early, have fallback |
| Conway testnet congestion | Low | Medium | Add retry logic, timeout handling |
| COOP/COEP breaks third-party scripts | Medium | Medium | Use `credentialless` instead of `require-corp` |
| Private key security in localStorage | Medium | Medium | Warn users this is testnet only |
| Service.rs missing game queries | High | High | Extend contract before deploy |

---

## Estimated Timeline

| Phase | Estimated Time |
|-------|---------------|
| Phase 1: Contract Deployment | 30 min |
| Phase 2: Real Client Implementation | 2-3 hours |
| Phase 3: React Integration | 1-2 hours |
| Phase 4: Contract Enhancement | 1 hour |
| Phase 5: Environment Config | 15 min |
| Phase 6: WASM Configuration | 30 min |
| Phase 7: UI Updates | 1 hour |
| Phase 8: Testing | 1-2 hours |
| **Total** | **7-10 hours** |

---

## Critical Files for Implementation

| File | Purpose |
|------|---------|
| `/contracts/air-hockey/src/service.rs` | Must extend GraphQL queries for game/openGames |
| `/src/lib/linera/client.ts` | Pattern to follow for real client implementation |
| `/node_modules/@linera/client/dist/linera.d.ts` | API reference for @linera/client classes |
| `/src/lib/linera/index.ts` | Entry point to swap mock/real client |
| `/next.config.ts` | WASM and header configuration |

---

## Summary

This plan provides a complete roadmap for integrating real Linera blockchain functionality:

1. **Deploy the smart contract** to Conway testnet using the Linera CLI
2. **Implement a browser-based client** using `@linera/client` WASM
3. **Use PrivateKey signer** for demo simplicity (can upgrade to MetaMask/Dynamic later)
4. **Keep the WebSocket server** for real-time game sync (blockchain handles game state persistence)
5. **Test thoroughly** before deployment to ensure WASM loads correctly on Vercel

The recommended approach meets all Linera submission requirements:
- Live demo on Web against Testnet Conway
- Using the Linera Web client library (`@linera/client`)
