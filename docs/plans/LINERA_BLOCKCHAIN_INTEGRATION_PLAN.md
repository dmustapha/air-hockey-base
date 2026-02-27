# Comprehensive Plan: Real Linera Blockchain Integration

## Overview & Goals

Transform the Cyber Air Hockey game from **mock blockchain mode** to **real Linera blockchain transactions** with:
- Real gas token consumption
- On-chain game stakes and payouts
- Verifiable transaction history
- MetaMask wallet integration
- Testnet token faucet integration

### Current State Analysis

| Component | Status | Issue |
|-----------|--------|-------|
| Smart Contracts (Rust) | ✅ Written | Not compiled/deployed |
| GraphQL Definitions | ✅ Complete | Not connected to real chain |
| MockLineraClient | ✅ Working | Using fake data |
| RealLineraClient | ⚠️ Partial | TODOs, missing @linera/client |
| MetaMask Integration | ✅ Framework ready | Not activated |
| Environment Config | ❌ Empty | No chain IDs, no app ID |
| Game Sync (WebSocket) | ⚠️ Broken | Render server sleeping issue |

### Success Criteria
- [ ] Players connect real MetaMask wallets
- [ ] Players receive testnet tokens from Linera faucet
- [ ] Game creation locks real stake on-chain
- [ ] Game join locks matching stake on-chain
- [ ] Winner receives pot (2x stake) automatically
- [ ] All transactions visible in Linera explorer
- [ ] Gas fees deducted from wallet balance
- [ ] Games sync properly between players

---

## Architecture Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   MetaMask   │◄──►│  Next.js App │◄──►│  WebSocket   │          │
│  │   Extension  │    │  (Frontend)  │    │   Client     │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                   │                    │                  │
│         │ Sign Txs          │ Linera Client      │ Game State       │
│         ▼                   ▼                    ▼                  │
└─────────────────────────────────────────────────────────────────────┘
          │                   │                    │
          │                   │                    │
          ▼                   ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  LINERA TESTNET │  │  LINERA TESTNET │  │  RENDER/VERCEL  │
│    (Signing)    │  │   (RPC Node)    │  │  (WebSocket)    │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ • Sign blocks   │  │ • GraphQL API   │  │ • Room mgmt     │
│ • Sign ops      │  │ • Query state   │  │ • Real-time     │
│                 │  │ • Submit txs    │  │ • Game sync     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  AIR HOCKEY     │
                   │  SMART CONTRACT │
                   ├─────────────────┤
                   │ • Create game   │
                   │ • Join game     │
                   │ • Submit result │
                   │ • Cancel game   │
                   │ • Claim winnings│
                   │                 │
                   │ State:          │
                   │ • games[]       │
                   │ • player_stats  │
                   │ • stake_pool    │
                   └─────────────────┘
```

---

## Component Breakdown

### 1. Smart Contract (Already Written)
**Location**: `/contracts/air-hockey/`

| File | Purpose | Status |
|------|---------|--------|
| `lib.rs` | ABI definitions, Operation enum | ✅ Complete |
| `contract.rs` | Core business logic | ✅ Complete |
| `state.rs` | On-chain state management | ✅ Complete |
| `service.rs` | GraphQL query handler | ✅ Complete |

**Operations**:
- `Initialize(owner)` - Set contract owner
- `CreateGame(stake, room_code)` - Lock stake, create game
- `JoinGame(game_id)` - Lock matching stake, activate game
- `SubmitResult(game_id, scores)` - Determine winner, transfer pot
- `CancelGame(game_id)` - Refund creator stake
- `ClaimWinnings(game_id)` - Manual claim (if needed)

### 2. Frontend Client
**Location**: `/src/lib/linera/`

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `client.ts` | Mock implementation | None (keep for dev) |
| `linera-client.ts` | Real implementation | Complete TODOs |
| `config.ts` | Environment config | Add validation |
| `graphql.ts` | GraphQL queries | Verify against contract |
| `metamask.ts` | Wallet integration | Minor fixes |
| `index.ts` | Module exports | None |

### 3. React Integration
**Location**: `/src/`

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `providers/LineraProvider.tsx` | Context provider | Fix hardcoded chainId |
| `hooks/useLinera.ts` | High-level API | Remove mock-signature |
| `hooks/useMetaMask.ts` | Wallet hook | Verify working |
| `components/cyber/game/CreateGameModal.tsx` | Game creation UI | Use real blockchain call |

---

## Data Models & Flow

### Transaction Flow: Create Game

```
1. User clicks "Create Game" with 10 LINERA stake
   │
2. Frontend validates balance >= 10 + gas
   │
3. MetaMask prompts signature
   │  └── User signs CreateGame operation
   │
4. Linera client submits to RPC node
   │  └── GraphQL mutation: createGame(stake: "10", roomCode: "ABC123")
   │
5. Contract executes:
   │  ├── Verify signer has balance
   │  ├── Transfer 10 LINERA to contract
   │  ├── Create Game { id: 1, creator: 0x..., stake: 10, status: waiting }
   │  └── Emit GameCreated event
   │
6. Frontend receives confirmation
   │  └── TxReceipt { hash, blockNumber, gameId: 1 }
   │
7. UI updates: "Game #1 created, waiting for opponent"
```

### Transaction Flow: Join Game

```
1. User enters room code "ABC123"
   │
2. Frontend queries: getGame(roomCode: "ABC123") → Game #1
   │
3. Frontend validates balance >= game.stake + gas
   │
4. MetaMask prompts signature
   │  └── User signs JoinGame operation
   │
5. Contract executes:
   │  ├── Verify game status === 'waiting'
   │  ├── Transfer 10 LINERA to contract (matching stake)
   │  ├── Update Game { opponent: 0x..., status: active }
   │  └── Emit GameJoined event
   │
6. Both players notified via WebSocket
   │
7. Game starts
```

### Transaction Flow: Submit Result

```
1. Game ends with scores: Player1=7, Player2=5
   │
2. Host (Player 1) submits result
   │  └── Both players sign score agreement (optional: dispute mechanism)
   │
3. Contract executes:
   │  ├── Verify caller is participant
   │  ├── Determine winner (7 > 5 → Player1)
   │  ├── Transfer 20 LINERA (pot) to winner
   │  ├── Update player stats
   │  └── Emit GameCompleted event
   │
4. Winner's balance increased by 20 LINERA
   │
5. UI shows: "You won 20 LINERA!"
```

---

## Dependencies & Tech Stack

### New Dependencies Required

```json
{
  "dependencies": {
    "@linera/client": "^0.12.0",
    "@linera/wasm": "^0.12.0"
  }
}
```

### Linera Testnet Configuration

| Setting | Value |
|---------|-------|
| Network | Linera Testnet (Archimedes) |
| Faucet URL | `https://faucet.testnet-archimedes.linera.net` |
| RPC Node | `https://rpc.testnet-archimedes.linera.net` |
| Explorer | `https://explorer.testnet-archimedes.linera.net` |
| Token | LINERA (18 decimals) |

### Toolchain Requirements

| Tool | Version | Purpose |
|------|---------|---------|
| Rust | 1.75+ | Contract compilation |
| linera CLI | 0.12+ | Deploy & interact |
| wasm32-unknown-unknown | target | WASM compilation |
| Node.js | 20+ | Frontend build |

---

## Implementation Phases

### Phase 1: Fix WebSocket Sync Issue (Priority)
**Goal**: Fix the immediate game sync problem

1.1. **Diagnose Render Server**
   - Check if server is sleeping (free tier issue)
   - Add keep-alive ping to prevent sleep
   - Verify CORS is working with new Vercel domain

1.2. **Update WebSocket URL**
   - Ensure `NEXT_PUBLIC_WS_URL` is correct in Vercel
   - Verify wss:// protocol (not ws://)

1.3. **Test Sync**
   - Create game on device A
   - Join on device B
   - Verify both see each other

### Phase 2: Compile & Deploy Smart Contract
**Goal**: Get contract running on Linera testnet

2.1. **Install Linera CLI**
   ```bash
   curl -L https://linera.io/install.sh | bash
   ```

2.2. **Build Contract**
   ```bash
   cd contracts/air-hockey
   cargo build --release --target wasm32-unknown-unknown
   ```

2.3. **Create Wallet**
   ```bash
   linera wallet init --faucet https://faucet.testnet-archimedes.linera.net
   linera wallet show  # Get chain ID
   ```

2.4. **Deploy Contract**
   ```bash
   linera publish-and-create \
     target/wasm32-unknown-unknown/release/air_hockey_contract.wasm \
     target/wasm32-unknown-unknown/release/air_hockey_service.wasm \
     --json-argument '{"owner": "<YOUR_CHAIN_ID>"}'
   ```

2.5. **Record Deployment**
   - Save Application ID
   - Save Chain ID
   - Update `.env` files

### Phase 3: Install Frontend Dependencies
**Goal**: Enable real Linera client in frontend

3.1. **Install Packages**
   ```bash
   cd /Users/MAC/Desktop/dev/linera/air-hockey
   npm install @linera/client @linera/wasm
   ```

3.2. **Verify WASM Loading**
   - Check if @linera/client initializes
   - Handle browser WASM requirements

3.3. **Update Next.js Config**
   ```typescript
   // next.config.ts
   webpack: (config) => {
     config.experiments = { ...config.experiments, asyncWebAssembly: true };
     return config;
   }
   ```

### Phase 4: Complete RealLineraClient
**Goal**: Make RealLineraClient fully functional

4.1. **Fix TODOs in linera-client.ts**
   - Line 207: Complete notification parsing
   - Implement proper error handling
   - Add retry logic for failed transactions

4.2. **Connect to Deployed Contract**
   ```typescript
   const client = new RealLineraClient({
     applicationId: process.env.NEXT_PUBLIC_LINERA_APPLICATION_ID,
     chainId: process.env.NEXT_PUBLIC_LINERA_CHAIN_ID,
     nodeUrl: process.env.NEXT_PUBLIC_LINERA_NODE_URL,
   });
   ```

4.3. **Implement Real Mutations**
   - createGame() → GraphQL mutation with signature
   - joinGame() → GraphQL mutation with signature
   - submitResult() → GraphQL mutation with signature

4.4. **Add Balance Queries**
   - Query real chain balance
   - Show available vs locked balance

### Phase 5: Update Frontend Components
**Goal**: Connect UI to real blockchain

5.1. **Fix CreateGameModal**
   - Remove 1500ms mock delay
   - Use real createGame() call
   - Show real transaction hash

5.2. **Fix useLinera Hook**
   - Remove 'mock-signature' placeholder
   - Use MetaMask for real signatures
   - Add transaction confirmation tracking

5.3. **Update Wallet Display**
   - Show real balance from chain
   - Show pending transactions
   - Add transaction history link

5.4. **Add Gas Estimation**
   - Estimate gas before transaction
   - Show gas cost to user
   - Fail gracefully if insufficient gas

### Phase 6: Environment Configuration
**Goal**: Configure for production

6.1. **Update .env.local**
   ```env
   NEXT_PUBLIC_USE_MOCK_LINERA=false
   NEXT_PUBLIC_WS_URL=wss://cyber-air-hockey.onrender.com
   NEXT_PUBLIC_LINERA_APPLICATION_ID=<deployed-app-id>
   NEXT_PUBLIC_LINERA_CHAIN_ID=<your-chain-id>
   NEXT_PUBLIC_LINERA_FAUCET_URL=https://faucet.testnet-archimedes.linera.net
   NEXT_PUBLIC_LINERA_NODE_URL=https://rpc.testnet-archimedes.linera.net
   ```

6.2. **Update Vercel Environment**
   - Add all LINERA env vars
   - Redeploy

6.3. **Update Render Environment**
   - Ensure server has correct CORS
   - Keep-alive configuration

### Phase 7: Testing & Verification
**Goal**: Ensure everything works end-to-end

7.1. **Local Testing**
   - Start local dev server
   - Connect MetaMask
   - Get testnet tokens
   - Create game
   - Join from another browser
   - Play and submit result
   - Verify winner received tokens

7.2. **Production Testing**
   - Deploy to Vercel
   - Test with real testnet
   - Monitor transaction times
   - Check gas consumption

7.3. **Edge Cases**
   - Test cancel game flow
   - Test disconnect during game
   - Test insufficient balance
   - Test network errors

---

## Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Insufficient balance | Show error before transaction |
| Transaction rejected | Show "Transaction rejected" message |
| Network timeout | Retry with exponential backoff |
| Game cancelled mid-play | Refund stakes automatically |
| Player disconnects | Allow reconnection within timeout |
| Double-spend attempt | Contract rejects, show error |
| Invalid game ID | Show "Game not found" error |
| Opponent leaves | Allow claim after timeout |

---

## Testing Strategy

### Unit Tests
- [ ] Smart contract operations (Rust tests)
- [ ] GraphQL query parsing
- [ ] Balance calculations
- [ ] Stake validation

### Integration Tests
- [ ] MetaMask connection flow
- [ ] Faucet token request
- [ ] Create → Join → Play → Submit flow
- [ ] Cancel game refund

### E2E Tests
- [ ] Full game on testnet
- [ ] Multi-browser sync
- [ ] Transaction confirmation

---

## Potential Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| @linera/client not compatible | Medium | High | Test import early, fallback to API |
| Testnet congestion | Low | Medium | Add retry logic, show status |
| WASM loading issues | Medium | High | Lazy load, error boundary |
| MetaMask rejection | Low | Low | Clear error messages |
| Contract bugs | Medium | High | Thorough testing before deploy |
| Render server sleep | High | Medium | Add keep-alive or upgrade plan |
| Gas estimation wrong | Low | Medium | Add buffer, allow manual override |

---

## Critique & Refinement

### Critique 1: Order of Implementation
**Issue**: Should we fix sync first or blockchain first?
**Resolution**: Fix WebSocket sync FIRST (Phase 1). Users can't test blockchain if games don't sync.

### Critique 2: Mock Mode Fallback
**Issue**: What if Linera testnet is down?
**Resolution**: Keep mock mode as fallback. Add UI toggle for testing.

### Critique 3: Gas Token Acquisition
**Issue**: How do new users get gas tokens?
**Resolution**: Auto-request from faucet on first connect. Show faucet link if fails.

### Critique 4: Transaction Speed
**Issue**: Linera transactions may take time
**Resolution**: Show pending state with spinner. Use optimistic updates for better UX.

### Critique 5: Security
**Issue**: What prevents score manipulation?
**Resolution**: Only host submits result. Add dispute mechanism in future.

### Critique 6: Contract Upgrade Path
**Issue**: What if contract has bugs?
**Resolution**: Include owner-only upgrade function. Deploy to new app ID if needed.

---

## Final Checklist

### Pre-Implementation
- [ ] Linera CLI installed and working
- [ ] Testnet tokens available
- [ ] Contract compiles without errors
- [ ] @linera/client compatible with Next.js 16

### Phase 1 Complete
- [ ] WebSocket sync working
- [ ] Games connect properly

### Phase 2 Complete
- [ ] Contract deployed to testnet
- [ ] Application ID recorded
- [ ] Can query contract via GraphQL

### Phase 3-4 Complete
- [ ] Frontend imports @linera/client
- [ ] WASM initializes in browser
- [ ] MetaMask connects successfully

### Phase 5-6 Complete
- [ ] Create game works on-chain
- [ ] Join game works on-chain
- [ ] Result submission works on-chain
- [ ] Balance updates correctly

### Phase 7 Complete
- [ ] Full game tested on testnet
- [ ] Gas fees visible and deducted
- [ ] Winner receives pot
- [ ] All edge cases handled

---

## Summary

This plan transforms the Air Hockey game from **mock mode** to **real Linera blockchain** with:

1. **Real stakes**: Players lock actual LINERA tokens
2. **Real gas**: Transactions consume gas fees
3. **Real payouts**: Winners receive pot automatically
4. **Verifiable**: All transactions on-chain

**Priority Order**:
1. Fix WebSocket sync (immediate playability)
2. Deploy smart contract
3. Connect frontend to chain
4. Test end-to-end

**Estimated Effort**: 12-17 hours for complete integration

---

*Plan created: 2026-01-12*
*Status: Awaiting approval*
