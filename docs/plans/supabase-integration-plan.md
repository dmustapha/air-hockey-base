# Comprehensive Implementation Plan: Supabase Integration for Air Hockey Multiplayer

> **Status**: Ready to implement after Railway/Vercel deployment
> **Estimated Time**: 10-12 days
> **Created**: 2026-01-22

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Architecture Design](#2-architecture-design)
3. [Database Schema](#3-database-schema)
4. [Row Level Security (RLS)](#4-row-level-security-rls-policies)
5. [File Structure](#5-file-structure-for-new-code)
6. [Implementation Phases](#6-implementation-phases)
7. [API Routes](#7-api-routes-needed)
8. [Sync Strategy](#8-sync-strategy-details)
9. [Security Considerations](#9-security-considerations)
10. [Testing Strategy](#10-testing-strategy)
11. [Risks & Mitigations](#11-potential-risks--mitigations)
12. [Environment Variables](#12-environment-variables)

---

## 1. Overview & Goals

### Primary Objectives

1. **User Account Persistence**: Sync wallet-based user profiles to Supabase database
2. **Global Match History**: Store all match records in a centralized database
3. **Real Leaderboards**: Replace mock data with actual global rankings
4. **Player Stats Sync**: Persist ELO, wins, losses, XP, and levels to database
5. **Friend System**: Complete friend request/accept/list functionality (new feature)

### Design Principles

- **Optimistic Updates**: UI updates immediately, database syncs in background
- **Offline-First**: localStorage remains the source of truth, syncs when online
- **Graceful Degradation**: App works fully offline, syncs when connection restored
- **Anti-Cheat**: Row Level Security (RLS) prevents unauthorized stat manipulation
- **Migration Support**: Existing localStorage data migrates to Supabase on first sync

---

## 2. Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (Next.js)                         │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ playerStore  │  │matchHistory  │  │achievement   │              │
│  │  (Zustand)   │  │   Store      │  │   Store      │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         ▼                 ▼                 ▼                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Supabase Sync Layer                       │   │
│  │  - useSupabaseSync hook                                      │   │
│  │  - Optimistic updates + background sync                      │   │
│  │  - Conflict resolution (server wins for stats)               │   │
│  │  - Offline queue                                             │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Supabase                                     │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   users      │  │   matches    │  │achievements  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  friendships │  │friend_requests│  │  leaderboard │ (VIEW)      │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Row Level Security (RLS)                        │   │
│  │  - Users can only update their own profile                   │   │
│  │  - Match records are write-once                              │   │
│  │  - Server validates match results                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
1. User connects MetaMask → Get wallet address
2. Check Supabase for existing user with this wallet
3. If new user:
   - Create Supabase user record with wallet as ID
   - Migrate localStorage data if exists
4. If existing user:
   - Fetch user data from Supabase
   - Merge with any newer localStorage data (conflict resolution)
5. Subscribe to realtime updates for friend requests
```

---

## 3. Database Schema

### Table: `users`

```sql
CREATE TABLE users (
  -- Primary key is the wallet address (lowercased)
  id VARCHAR(42) PRIMARY KEY,  -- Ethereum wallet address

  -- Profile info
  username VARCHAR(32) NOT NULL,
  avatar_index SMALLINT DEFAULT 0,
  title_id VARCHAR(64),

  -- Rank data
  elo INTEGER DEFAULT 1200,
  peak_elo INTEGER DEFAULT 1200,
  tier VARCHAR(16) DEFAULT 'GOLD',
  division VARCHAR(4) DEFAULT 'III',

  -- Level data
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  xp_to_next_level INTEGER DEFAULT 100,
  total_xp BIGINT DEFAULT 0,

  -- Stats
  total_matches INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_streak INTEGER DEFAULT 0,
  max_win_streak INTEGER DEFAULT 0,
  total_goals_scored INTEGER DEFAULT 0,
  total_goals_conceded INTEGER DEFAULT 0,
  total_play_time INTEGER DEFAULT 0,  -- seconds
  max_combo INTEGER DEFAULT 0,
  perfect_games INTEGER DEFAULT 0,
  comeback_wins INTEGER DEFAULT 0,

  -- Metadata
  season INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_played_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT username_length CHECK (char_length(username) >= 2 AND char_length(username) <= 16),
  CONSTRAINT valid_elo CHECK (elo >= 0),
  CONSTRAINT valid_level CHECK (level >= 1 AND level <= 100)
);

-- Index for leaderboard queries
CREATE INDEX idx_users_elo ON users(elo DESC);
CREATE INDEX idx_users_tier_elo ON users(tier, elo DESC);
CREATE INDEX idx_users_username ON users(LOWER(username));
```

### Table: `matches`

```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Players
  player_id VARCHAR(42) NOT NULL REFERENCES users(id),
  opponent_id VARCHAR(42) REFERENCES users(id),  -- NULL for AI matches

  -- Match info
  match_type VARCHAR(16) NOT NULL,  -- 'ranked', 'casual'
  game_mode VARCHAR(16) NOT NULL,   -- 'ai', 'multiplayer'
  difficulty VARCHAR(16),           -- 'easy', 'medium', 'hard' for AI

  -- Scores
  player_score SMALLINT NOT NULL,
  opponent_score SMALLINT NOT NULL,
  result VARCHAR(8) NOT NULL,       -- 'win', 'loss'

  -- Rewards
  elo_change INTEGER DEFAULT 0,
  xp_gained INTEGER DEFAULT 0,

  -- Performance
  duration INTEGER NOT NULL,        -- seconds
  max_combo SMALLINT DEFAULT 0,
  comeback_win BOOLEAN DEFAULT FALSE,
  perfect_game BOOLEAN DEFAULT FALSE,

  -- Opponent info (for display)
  opponent_name VARCHAR(64) NOT NULL,
  opponent_elo INTEGER,
  opponent_tier VARCHAR(16),

  -- Metadata
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Validation
  CONSTRAINT valid_scores CHECK (player_score >= 0 AND opponent_score >= 0),
  CONSTRAINT valid_result CHECK (result IN ('win', 'loss'))
);

-- Index for player match history
CREATE INDEX idx_matches_player ON matches(player_id, timestamp DESC);
CREATE INDEX idx_matches_timestamp ON matches(timestamp DESC);
```

### Table: `achievements`

```sql
CREATE TABLE user_achievements (
  user_id VARCHAR(42) NOT NULL REFERENCES users(id),
  achievement_id VARCHAR(64) NOT NULL,
  current_value INTEGER DEFAULT 0,
  unlocked_at TIMESTAMPTZ,
  notified BOOLEAN DEFAULT FALSE,

  PRIMARY KEY (user_id, achievement_id)
);

-- Index for user achievement queries
CREATE INDEX idx_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_achievements_unlocked ON user_achievements(user_id, unlocked_at) WHERE unlocked_at IS NOT NULL;
```

### Table: `friendships`

```sql
CREATE TABLE friendships (
  user_id VARCHAR(42) NOT NULL REFERENCES users(id),
  friend_id VARCHAR(42) NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, friend_id),
  CONSTRAINT no_self_friend CHECK (user_id != friend_id)
);

-- Reciprocal friendships (both directions stored)
CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);
```

### Table: `friend_requests`

```sql
CREATE TABLE friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id VARCHAR(42) NOT NULL REFERENCES users(id),
  to_user_id VARCHAR(42) NOT NULL REFERENCES users(id),
  status VARCHAR(16) DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT no_self_request CHECK (from_user_id != to_user_id),
  CONSTRAINT unique_pending_request UNIQUE (from_user_id, to_user_id)
);

CREATE INDEX idx_friend_requests_to ON friend_requests(to_user_id, status);
CREATE INDEX idx_friend_requests_from ON friend_requests(from_user_id, status);
```

### View: `leaderboard`

```sql
CREATE VIEW leaderboard AS
SELECT
  id,
  username,
  elo,
  peak_elo,
  tier,
  division,
  wins,
  losses,
  CASE WHEN (wins + losses) > 0
    THEN ROUND(wins::NUMERIC / (wins + losses) * 100, 1)
    ELSE 0
  END as win_rate,
  level,
  RANK() OVER (ORDER BY elo DESC) as rank
FROM users
WHERE total_matches > 0
ORDER BY elo DESC;
```

---

## 4. Row Level Security (RLS) Policies

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Users: Read all, update own
CREATE POLICY "Users are viewable by everyone"
  ON users FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE USING (auth.uid()::text = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT WITH CHECK (auth.uid()::text = id);

-- Matches: Read all, insert own
CREATE POLICY "Matches are viewable by everyone"
  ON matches FOR SELECT USING (true);

CREATE POLICY "Users can insert own matches"
  ON matches FOR INSERT WITH CHECK (auth.uid()::text = player_id);

-- Achievements: Users manage own
CREATE POLICY "Users can view own achievements"
  ON user_achievements FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage own achievements"
  ON user_achievements FOR ALL USING (auth.uid()::text = user_id);

-- Friendships: View own, manage reciprocal
CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  USING (auth.uid()::text = user_id OR auth.uid()::text = friend_id);

-- Friend requests: View own, create for others
CREATE POLICY "Users can view relevant friend requests"
  ON friend_requests FOR SELECT
  USING (auth.uid()::text = from_user_id OR auth.uid()::text = to_user_id);

CREATE POLICY "Users can send friend requests"
  ON friend_requests FOR INSERT
  WITH CHECK (auth.uid()::text = from_user_id);

CREATE POLICY "Users can update received requests"
  ON friend_requests FOR UPDATE
  USING (auth.uid()::text = to_user_id);
```

---

## 5. File Structure for New Code

```
src/
├── lib/
│   └── supabase/
│       ├── client.ts              # Supabase client initialization
│       ├── types.ts               # Database types (generated from schema)
│       ├── auth.ts                # Wallet-based authentication
│       ├── users.ts               # User CRUD operations
│       ├── matches.ts             # Match history operations
│       ├── achievements.ts        # Achievement sync operations
│       ├── friends.ts             # Friend system operations
│       ├── leaderboard.ts         # Leaderboard queries
│       └── index.ts               # Barrel export
│
├── hooks/
│   ├── useSupabaseSync.ts         # Main sync orchestration hook
│   ├── useSupabaseAuth.ts         # Authentication hook
│   ├── useLeaderboard.ts          # Leaderboard data hook
│   ├── useFriends.ts              # Friend list hook
│   ├── useFriendRequests.ts       # Friend request management hook
│   └── useOnlineStatus.ts         # Connection status hook
│
├── stores/
│   ├── syncStore.ts               # Sync state management
│   └── friendStore.ts             # Friend list state (NEW)
│
├── components/
│   └── cyber/
│       └── friends/               # NEW directory
│           ├── FriendList.tsx
│           ├── FriendCard.tsx
│           ├── FriendRequestCard.tsx
│           ├── FriendRequestsPanel.tsx
│           ├── AddFriendModal.tsx
│           ├── FriendSearchInput.tsx
│           └── index.ts
│
└── app/
    └── (cyber)/
        └── friends/               # NEW route
            └── page.tsx           # Friends page
```

---

## 6. Implementation Phases

### Phase 1: Supabase Setup & Foundation (Day 1)

#### 1.1 Create Supabase Project
- [ ] Create new Supabase project at https://supabase.com
- [ ] Configure environment variables
- [ ] Run database schema SQL in Supabase SQL Editor

#### 1.2 Install Dependencies
```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

#### 1.3 Create Supabase Client

**File: `/src/lib/supabase/client.ts`**
```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We use wallet for auth
  },
});
```

#### 1.4 Generate TypeScript Types
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts
```

---

### Phase 2: Wallet-Based Authentication (Day 1-2)

#### 2.1 Create Auth Module

**File: `/src/lib/supabase/auth.ts`**

Key functions:
- `signInWithWallet(address: string, signMessage: (msg: string) => Promise<string>)`
- `signOut()`
- `getCurrentUser()`

#### 2.2 Modify WalletAuthProvider

**File: `/src/providers/WalletAuthProvider.tsx`**

Add Supabase auth integration:
- After MetaMask connection, create/verify Supabase session
- Sign a message with wallet to prove ownership
- Store session token for API requests

---

### Phase 3: User Data Sync (Day 2-3)

#### 3.1 Create Users Module

**File: `/src/lib/supabase/users.ts`**

Key functions:
- `getUser(walletAddress: string): Promise<User | null>`
- `createUser(walletAddress: string, data: UserData): Promise<User>`
- `updateUser(walletAddress: string, data: Partial<UserData>): Promise<void>`
- `syncUserFromLocal(walletAddress: string, localData: PlayerProfile): Promise<User>`

#### 3.2 Create Sync Hook

**File: `/src/hooks/useSupabaseSync.ts`**

Master sync hook that:
1. Listens to local store changes
2. Debounces updates (500ms)
3. Queues offline operations
4. Processes queue when online
5. Handles conflicts (server wins for stats)

#### 3.3 Modify Player Store

**File: `/src/stores/playerStore.ts`**

Add sync integration:
- Emit events on changes
- Accept remote updates
- Handle merge conflicts

---

### Phase 4: Match History Sync (Day 3-4)

#### 4.1 Create Matches Module

**File: `/src/lib/supabase/matches.ts`**

Key functions:
- `recordMatch(match: MatchRecord): Promise<void>`
- `getMatchHistory(userId: string, page: number, limit: number): Promise<Match[]>`
- `getMatchById(matchId: string): Promise<Match | null>`

#### 4.2 Modify Match History Store

**File: `/src/stores/matchHistoryStore.ts`**

- Add `syncToSupabase` action
- Handle match upload on creation
- Paginate from Supabase for older matches

---

### Phase 5: Leaderboard (Day 4)

#### 5.1 Create Leaderboard Module

**File: `/src/lib/supabase/leaderboard.ts`**

Key functions:
- `getGlobalLeaderboard(page: number, limit: number): Promise<LeaderboardEntry[]>`
- `getLeaderboardByTier(tier: RankTier): Promise<LeaderboardEntry[]>`
- `getUserRank(userId: string): Promise<number>`
- `getTotalPlayers(): Promise<number>`

#### 5.2 Create Leaderboard Hook

**File: `/src/hooks/useLeaderboard.ts`**

```typescript
export function useLeaderboard(options: {
  tier?: RankTier;
  page?: number;
  limit?: number;
}) {
  // Fetch from Supabase
  // Cache results
  // Polling for updates
}
```

#### 5.3 Modify Leaderboard Page

**File: `/src/app/(cyber)/leaderboard/page.tsx`**

Replace mock data with real Supabase data:
- Use `useLeaderboard` hook
- Show loading states
- Handle errors gracefully

---

### Phase 6: Friend System (Day 5-7)

#### 6.1 Create Friends Module

**File: `/src/lib/supabase/friends.ts`**

Key functions:
- `sendFriendRequest(fromId: string, toId: string): Promise<void>`
- `acceptFriendRequest(requestId: string): Promise<void>`
- `rejectFriendRequest(requestId: string): Promise<void>`
- `removeFriend(userId: string, friendId: string): Promise<void>`
- `getFriends(userId: string): Promise<Friend[]>`
- `getPendingRequests(userId: string): Promise<FriendRequest[]>`
- `searchUsers(query: string): Promise<User[]>`

#### 6.2 Create Friend Store

**File: `/src/stores/friendStore.ts`**

```typescript
interface FriendStore {
  friends: Friend[];
  pendingRequests: FriendRequest[];
  sentRequests: FriendRequest[];

  // Actions
  loadFriends: () => Promise<void>;
  loadRequests: () => Promise<void>;
  sendRequest: (toUserId: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
}
```

#### 6.3 Create Friend UI Components

**Directory: `/src/components/cyber/friends/`**

- `FriendList.tsx` - Display list of friends with online status
- `FriendCard.tsx` - Individual friend card with actions
- `FriendRequestCard.tsx` - Pending request with accept/reject
- `FriendRequestsPanel.tsx` - List all pending requests
- `AddFriendModal.tsx` - Search and send requests
- `FriendSearchInput.tsx` - User search component

#### 6.4 Create Friends Page

**File: `/src/app/(cyber)/friends/page.tsx`**

- Three tabs: Friends, Requests, Find Friends
- Integration with friend store
- Realtime updates for requests

#### 6.5 Realtime Subscriptions

```typescript
const subscription = supabase
  .channel('friend-requests')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'friend_requests',
    filter: `to_user_id=eq.${userId}`,
  }, handleRequestChange)
  .subscribe();
```

---

### Phase 7: Achievement Sync (Day 7-8)

#### 7.1 Create Achievements Module

**File: `/src/lib/supabase/achievements.ts`**

Key functions:
- `syncAchievements(userId: string, local: AchievementProgress[]): Promise<void>`
- `getAchievements(userId: string): Promise<AchievementProgress[]>`

#### 7.2 Modify Achievement Store

**File: `/src/stores/achievementStore.ts`**

Add sync capability while preserving offline functionality.

---

### Phase 8: Migration & Polish (Day 8-9)

#### 8.1 Migration System

**File: `/src/lib/supabase/migration.ts`**

```typescript
export async function migrateLocalDataToSupabase(
  walletAddress: string,
  playerData: PlayerProfile,
  matchHistory: MatchRecord[],
  achievements: AchievementProgress[]
): Promise<MigrationResult> {
  // 1. Create/update user record
  // 2. Upload match history (batch)
  // 3. Sync achievement progress
  // 4. Mark migration complete
}
```

#### 8.2 Offline Queue System

**File: `/src/lib/supabase/offlineQueue.ts`**

```typescript
interface QueuedOperation {
  id: string;
  type: 'user_update' | 'match_record' | 'achievement_sync';
  data: any;
  timestamp: number;
  retries: number;
}

// Persist queue to localStorage
// Process when online
// Retry with backoff
```

#### 8.3 Error Handling & Retry

- Exponential backoff for failed requests
- Toast notifications for sync errors
- Manual retry option in settings

---

### Phase 9: Testing & Refinement (Day 9-10)

#### 9.1 Test Scenarios

- [ ] **New user flow**: Fresh wallet connects, plays games, data syncs
- [ ] **Existing user flow**: User with localStorage data connects, migration works
- [ ] **Offline play**: User plays offline, data syncs when back online
- [ ] **Multi-device**: User plays on device A, stats appear on device B
- [ ] **Friend system**: Send/accept/reject requests, realtime updates work
- [ ] **Leaderboard**: Rankings update after matches

#### 9.2 Performance Testing

- Leaderboard pagination (10,000+ users)
- Match history pagination
- Sync latency measurements

---

## 7. API Routes Needed

For server-side operations (if needed):

```
/api/supabase/
├── auth/
│   └── verify-wallet.ts    # Verify wallet signature, return JWT
├── matches/
│   └── record.ts           # Record match with server validation
└── friends/
    ├── request.ts          # Send friend request
    └── respond.ts          # Accept/reject request
```

Note: Most operations can be done client-side with RLS. API routes only needed for:
- Complex validation (match result verification)
- Server-side session management

---

## 8. Sync Strategy Details

### Conflict Resolution

| Data Type | Strategy | Reason |
|-----------|----------|--------|
| Profile (username, avatar) | Client wins | User preference |
| Stats (wins, elo, etc.) | Server wins | Anti-cheat |
| Match history | Server is source of truth | Immutable records |
| Achievements | Merge (union) | Progress should accumulate |
| Friend requests | Server wins | Real-time accuracy |

### Sync Timing

| Event | Action |
|-------|--------|
| Wallet connect | Full sync from server |
| Profile change | Debounced update (500ms) |
| Match complete | Immediate sync |
| Achievement unlock | Immediate sync |
| Friend action | Immediate sync |
| App foreground | Check for updates |

### Offline Queue

```typescript
// Stored in localStorage
interface SyncQueue {
  operations: QueuedOperation[];
  lastProcessed: number;
}

// Process queue on:
// 1. Connection restored
// 2. App foreground
// 3. Manual trigger
```

---

## 9. Security Considerations

### Anti-Cheat Measures

1. **Server-Side Validation**: Match results validated by WebSocket server before recording
2. **RLS Policies**: Users can only modify their own data
3. **Stat Calculations**: ELO/XP calculated server-side, client only displays
4. **Rate Limiting**: Max 10 matches per minute per user
5. **Anomaly Detection**: Flag suspicious stat patterns (future)

### Data Privacy

1. **Wallet Address as ID**: No email/password required
2. **Public Data**: Username, stats, rank visible to all
3. **Private Data**: Friend requests only visible to participants
4. **Data Export**: Users can request their data (GDPR compliance)

---

## 10. Testing Strategy

### Unit Tests

```
/src/lib/supabase/__tests__/
├── users.test.ts
├── matches.test.ts
├── friends.test.ts
└── leaderboard.test.ts
```

### Integration Tests

```
/src/__tests__/integration/
├── sync-flow.test.ts
├── friend-system.test.ts
└── migration.test.ts
```

### E2E Tests

```
/cypress/e2e/
├── leaderboard.cy.ts
├── friends.cy.ts
└── offline-sync.cy.ts
```

---

## 11. Potential Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Supabase rate limits | Medium | High | Batch operations, caching |
| Sync conflicts | Medium | Medium | Clear conflict resolution rules |
| Offline data loss | Low | High | Robust queue persistence |
| RLS bypass attempts | Low | High | Thorough policy testing |
| Migration failures | Medium | Medium | Rollback capability, retry logic |
| Realtime connection drops | Medium | Low | Auto-reconnect with backoff |

---

## 12. Environment Variables

Add to `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: Service role for server-side operations
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Quick Reference: Files to Create

| File | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Supabase client initialization |
| `src/lib/supabase/types.ts` | Generated database types |
| `src/lib/supabase/auth.ts` | Wallet-based authentication |
| `src/lib/supabase/users.ts` | User CRUD operations |
| `src/lib/supabase/matches.ts` | Match history operations |
| `src/lib/supabase/achievements.ts` | Achievement sync |
| `src/lib/supabase/friends.ts` | Friend system operations |
| `src/lib/supabase/leaderboard.ts` | Leaderboard queries |
| `src/lib/supabase/migration.ts` | Data migration utilities |
| `src/lib/supabase/offlineQueue.ts` | Offline operation queue |
| `src/hooks/useSupabaseSync.ts` | Main sync hook |
| `src/hooks/useLeaderboard.ts` | Leaderboard data hook |
| `src/hooks/useFriends.ts` | Friend list hook |
| `src/stores/friendStore.ts` | Friend state management |
| `src/app/(cyber)/friends/page.tsx` | Friends page |

## Quick Reference: Files to Modify

| File | Changes |
|------|---------|
| `src/providers/WalletAuthProvider.tsx` | Add Supabase auth integration |
| `src/stores/playerStore.ts` | Add sync integration |
| `src/stores/matchHistoryStore.ts` | Add Supabase persistence |
| `src/stores/achievementStore.ts` | Add sync capability |
| `src/app/(cyber)/leaderboard/page.tsx` | Replace mock data |

---

## Checklist Summary

- [ ] Phase 1: Supabase project setup
- [ ] Phase 2: Wallet authentication
- [ ] Phase 3: User data sync
- [ ] Phase 4: Match history sync
- [ ] Phase 5: Leaderboard backend
- [ ] Phase 6: Friend system (full stack)
- [ ] Phase 7: Achievement sync
- [ ] Phase 8: Migration & offline support
- [ ] Phase 9: Testing & polish

**Total Estimated Time: 10-12 days**
