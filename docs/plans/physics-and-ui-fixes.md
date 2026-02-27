# Physics & UI Fixes Comprehensive Plan

## Overview & Goals

Fix four critical issues in the Air Hockey game:

1. **Puck Speed Irregularity**: Puck speeds up in the middle and slows down at edges
2. **Paddle Hit Force**: Player paddle velocity should affect puck speed
3. **Scoreboard Position**: Move scoreboard outside the playing field
4. **Puck Starting Position**: After goals, puck should start stationary at loser's end

---

## Issue Analysis

### Issue 1: Puck Speed Irregularity

**Root Cause**: The `EnergyCorrector` class creates artificial speed variation:
- Records `targetSpeed` when puck is hit (minimum 8)
- Every 500ms, if speed dropped >20%, it **boosts** the puck back up
- Air friction (`frictionAir: 0.002`) causes gradual slowdown between boosts
- Result: Puck slows down → boost → slows down → boost = "speeds up in middle" effect

**Current Code** (`energyCorrector.ts:51-56`):
```typescript
if (currentSpeed < this.targetSpeed * 0.8) {
  const boost = this.targetSpeed / currentSpeed;
  Body.setVelocity(this.puck, {
    x: this.puck.velocity.x * boost,
    y: this.puck.velocity.y * boost,
  });
}
```

### Issue 2: Paddle Hit Force Not Affecting Velocity

**Root Cause**: Paddles are **teleported** using `Body.setPosition()`, which:
- Sets position instantly without physics simulation
- Results in **zero paddle velocity** in Matter.js
- Puck bounces based only on `restitution`, not paddle momentum

**Current Code** (`engine.ts:121`):
```typescript
Body.setPosition(paddle, { x: clampedX, y: clampedY });
```

**Real Air Hockey Physics**:
- Striker (paddle) momentum transfers to puck on collision
- Faster swings = faster puck

### Issue 3: Scoreboard in Playing Field

**Root Cause**: `ScoreOverlay` uses absolute positioning overlaid on canvas:
- `absolute top-0 left-0 right-0` places it OVER the game canvas
- Canvas and overlay share the same container in `GameHUD`

**Current Layout** (`GameHUD.tsx:27-32`):
```tsx
<div className={`relative w-full h-full`}>
  <div className="relative w-full h-full">{children}</div> {/* Canvas */}
  {status === 'playing' && <ScoreOverlay />}  {/* ON TOP of canvas */}
</div>
```

### Issue 4: Puck Starting Position

**Root Cause**: `resetPuck()` always positions at center:
- Game start: center position + random velocity (correct)
- After goal: center position + velocity toward loser (incorrect)

**Current Code** (`engine.ts:130-148`):
```typescript
Body.setPosition(puck, {
  x: table.width / 2,
  y: table.height / 2,  // Always center!
});
Body.setVelocity(puck, { x: vx, y: vy }); // Always moving!
```

**Desired Behavior**:
- Game start: Puck at center, random direction
- After goal: Puck **stationary** at **loser's end** (near their goal line)

---

## Architecture Design

### Component Changes

| File | Changes |
|------|---------|
| `/src/lib/physics/config.ts` | Remove `frictionAir`, add paddle velocity config |
| `/src/lib/physics/engine.ts` | Track paddle velocity, new `resetPuck()` logic |
| `/src/lib/physics/energyCorrector.ts` | Delete entirely |
| `/src/lib/physics/bodies.ts` | Remove `frictionAir` from puck |
| `/src/hooks/useGameEngine.ts` | Update resetPuck calls with new parameters |
| `/src/components/cyber/game/GameHUD.tsx` | Restructure layout for external scoreboard |
| `/src/components/cyber/game/ScoreOverlay.tsx` | Redesign for top-bar layout |
| `/src/app/(cyber)/game/page.tsx` | Update container structure |

---

## Data Flow

### Paddle Velocity Tracking

```
Player Input → movePaddle(x, y) → Calculate velocity from delta →
Store velocity → On collision → Apply impulse to puck based on paddle velocity
```

### Puck Reset Flow

```
Goal Scored → incrementScore() → setStatus('goal') →
Wait goalPauseMs → resetPuck(serveToward, isGameStart=false) →
Position at loser's end, velocity = 0
```

---

## Implementation Phases

### Phase 1: Remove Energy Corrector & Fix Puck Speed

**Files to modify:**
- `/src/lib/physics/config.ts`
- `/src/lib/physics/bodies.ts`
- `/src/lib/physics/engine.ts`

**Changes:**

1. **config.ts**: Set `frictionAir: 0` (true frictionless surface)
```typescript
puck: {
  radius: 12,
  mass: 0.1,
  restitution: 0.95,
  friction: 0,
  frictionAir: 0,  // Changed from 0.002
  maxSpeed: 20,
},
```

2. **bodies.ts**: Remove `frictionAir` from puck creation (will use config value)

3. **engine.ts**:
   - Remove `EnergyCorrector` import and usage
   - Remove `energyCorrector` from `GameEngine` interface
   - Remove `energyCorrector.onHit()` and `energyCorrector.onGoal()` calls
   - Remove `energyCorrector.update()` from `updatePhysics()`

**Result**: Puck maintains constant speed after collision until next impact.

---

### Phase 2: Implement Paddle Velocity Transfer

**Files to modify:**
- `/src/lib/physics/config.ts`
- `/src/lib/physics/engine.ts`

**New Config** (`config.ts`):
```typescript
paddle: {
  radius: 25,
  mass: 1,
  restitution: 0.8,
  friction: 0.1,
  velocityTransfer: 0.5,  // NEW: 50% of paddle velocity transfers to puck
  maxVelocity: 15,        // NEW: Cap paddle velocity contribution
},
```

**Engine Changes** (`engine.ts`):

1. Add paddle velocity tracking:
```typescript
interface PaddleState {
  lastPosition: { x: number; y: number };
  velocity: { x: number; y: number };
  lastMoveTime: number;
}

const paddleStates: Record<Player, PaddleState> = {
  player1: { lastPosition: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, lastMoveTime: 0 },
  player2: { lastPosition: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, lastMoveTime: 0 },
};
```

2. Update `movePaddle()` to calculate velocity:
```typescript
function movePaddle(player: Player, x: number, y: number): void {
  const paddle = player === 'player1' ? paddle1 : paddle2;
  const state = paddleStates[player];
  const now = performance.now();

  // Calculate velocity from position delta
  const dt = Math.max(now - state.lastMoveTime, 1) / 1000;
  const clampedX = /* existing clamping */;
  const clampedY = /* existing clamping */;

  state.velocity = {
    x: (clampedX - state.lastPosition.x) / dt,
    y: (clampedY - state.lastPosition.y) / dt,
  };

  state.lastPosition = { x: clampedX, y: clampedY };
  state.lastMoveTime = now;

  Body.setPosition(paddle, { x: clampedX, y: clampedY });
}
```

3. On paddle-puck collision, apply velocity impulse:
```typescript
// In collision handler
if (labels.includes('player1') || labels.includes('player2')) {
  const paddleLabel = labels.find(l => l === 'player1' || l === 'player2') as Player;
  const paddleVel = paddleStates[paddleLabel].velocity;

  // Apply paddle velocity to puck
  const transfer = PHYSICS_CONFIG.paddle.velocityTransfer;
  const maxVel = PHYSICS_CONFIG.paddle.maxVelocity;

  const velX = Math.max(-maxVel, Math.min(maxVel, paddleVel.x)) * transfer;
  const velY = Math.max(-maxVel, Math.min(maxVel, paddleVel.y)) * transfer;

  Body.setVelocity(puck, {
    x: puck.velocity.x + velX,
    y: puck.velocity.y + velY,
  });

  callbacks.onPaddleHit();
}
```

---

### Phase 3: Fix Puck Starting Position

**Files to modify:**
- `/src/lib/physics/engine.ts`
- `/src/hooks/useGameEngine.ts`

**New `resetPuck()` signature:**
```typescript
function resetPuck(options?: {
  serveToward?: Player;  // Which player gets the puck
  isGameStart?: boolean; // true = center with velocity, false = loser's end stationary
}): void
```

**Implementation:**
```typescript
function resetPuck(options?: { serveToward?: Player; isGameStart?: boolean }): void {
  const { table, puck: puckConfig } = PHYSICS_CONFIG;
  const { serveToward, isGameStart = true } = options || {};

  if (isGameStart) {
    // GAME START: Center position with random velocity
    Body.setPosition(puck, {
      x: table.width / 2,
      y: table.height / 2,
    });

    const vx = (Math.random() - 0.5) * 4;
    const vy = Math.random() > 0.5 ? 5 : -5;
    Body.setVelocity(puck, { x: vx, y: vy });
  } else {
    // AFTER GOAL: Stationary at loser's end
    const posY = serveToward === 'player1'
      ? table.height * 0.75  // Bottom half for player 1
      : table.height * 0.25; // Top half for player 2

    Body.setPosition(puck, {
      x: table.width / 2,
      y: posY,
    });

    // Stationary!
    Body.setVelocity(puck, { x: 0, y: 0 });
  }

  Body.setAngularVelocity(puck, 0);
}
```

**useGameEngine.ts changes:**

```typescript
// Game start (scores 0-0)
useEffect(() => {
  if (status === 'playing' && gameEngineRef.current) {
    const store = useGameStore.getState();
    if (store.scores.player1 === 0 && store.scores.player2 === 0) {
      gameEngineRef.current.resetPuck({ isGameStart: true });
    }
  }
}, [status]);

// After goal
useEffect(() => {
  if (status === 'goal') {
    const timer = setTimeout(() => {
      if (gameEngineRef.current) {
        const serveToward = lastScorer === 'player1' ? 'player2' : 'player1';
        gameEngineRef.current.resetPuck({ serveToward, isGameStart: false });
      }
      setStatus('playing');
    }, PHYSICS_CONFIG.game.goalPauseMs);
    return () => clearTimeout(timer);
  }
}, [status, lastScorer, setStatus]);
```

---

### Phase 4: Move Scoreboard Outside Playing Field

**Files to modify:**
- `/src/app/(cyber)/game/page.tsx`
- `/src/components/cyber/game/GameHUD.tsx`
- `/src/components/cyber/game/ScoreOverlay.tsx`

**New Layout Structure:**

```
┌─────────────────────────────────────┐
│     [SCOREBOARD - Above Canvas]     │
│   Player1: 0    VS    Player2: 6    │
├─────────────────────────────────────┤
│                                     │
│         [GAME CANVAS]               │
│                                     │
│         (No overlay on top)         │
│                                     │
└─────────────────────────────────────┘
```

**game/page.tsx changes:**
```tsx
<div className="min-h-screen flex items-center justify-center p-4">
  <div className="relative w-full max-w-md mx-auto">
    {/* Scoreboard OUTSIDE and ABOVE canvas */}
    <ScoreOverlay className="mb-4" />

    {/* Game container */}
    <div className="relative">
      {/* Decorative frame... */}
      <GameHUD>
        <GameCanvas ref={canvasRef} getBodies={getBodies} />
      </GameHUD>
    </div>
  </div>
</div>
```

**GameHUD.tsx changes:**
- Remove `<ScoreOverlay />` from inside GameHUD
- Keep other overlays (Countdown, Pause, PreMatch, PostMatch)

**ScoreOverlay.tsx changes:**
- Change from `absolute` to `relative` positioning
- Create horizontal bar layout instead of overlay
- Add proper margins/padding for standalone display

```tsx
export function ScoreOverlay({ className = '' }: ScoreOverlayProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between gap-4 p-3 rounded-lg"
           style={{ backgroundColor: cyberTheme.colors.bg.panel }}>
        {/* Player 1 Score */}
        <div className="flex items-center gap-3 flex-1">
          <div className="text-4xl font-black" style={{ color: cyberTheme.colors.player.you }}>
            {scores.player1}
          </div>
          <div className="text-sm uppercase">{playerName}</div>
        </div>

        {/* VS */}
        <div className="text-2xl font-bold" style={{ color: cyberTheme.colors.text.muted }}>
          VS
        </div>

        {/* Player 2 Score */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          <div className="text-sm uppercase">{opponentName}</div>
          <div className="text-4xl font-black" style={{ color: cyberTheme.colors.player.opponent }}>
            {scores.player2}
          </div>
        </div>
      </div>

      {/* Combo counter below */}
      {combo.current >= 2 && (
        <div className="flex justify-center mt-2">
          <ComboCounter combo={combo.current} size="sm" />
        </div>
      )}
    </div>
  );
}
```

---

## Verification Plan

### Manual Testing Checklist

- [ ] **Puck Speed**: Puck maintains consistent velocity across entire field
- [ ] **Paddle Hit**: Fast swings send puck faster than gentle taps
- [ ] **Scoreboard**: Score display is above canvas, not overlapping playing field
- [ ] **Game Start**: Puck spawns at center, moves in random direction
- [ ] **After Goal**: Puck spawns stationary at loser's end
- [ ] **Loser Gets Control**: After being scored on, player can control stationary puck

### Edge Cases

- [ ] Paddle stationary when puck hits (should bounce normally)
- [ ] Paddle moving away when puck hits (reduced velocity transfer)
- [ ] Puck doesn't escape playing field boundaries
- [ ] Game starts correctly after reset
- [ ] Multiple goals in sequence work correctly

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Puck too fast after paddle hit | Unplayable | Cap `maxVelocity` transfer |
| Puck too slow without energy correction | Boring | Increase `restitution` to 0.98 |
| Stationary puck is vulnerable | Unfair | Position at 25%/75% of field (near but not at goal) |
| Velocity calculation jitter | Inconsistent hits | Smooth velocity over 2-3 frames |

---

## File Changes Summary

| File | Action |
|------|--------|
| `config.ts` | Modify: frictionAir=0, add paddle velocity config |
| `energyCorrector.ts` | **DELETE** |
| `bodies.ts` | Modify: remove frictionAir from puck |
| `engine.ts` | Modify: paddle velocity tracking, new resetPuck logic |
| `useGameEngine.ts` | Modify: update resetPuck calls |
| `GameHUD.tsx` | Modify: remove ScoreOverlay |
| `ScoreOverlay.tsx` | Modify: new layout, relative positioning |
| `game/page.tsx` | Modify: add ScoreOverlay above canvas |

---

## Critique & Corrections

### Critique 1: Velocity calculation accuracy
**Issue**: Single-frame velocity calculation may be noisy from input jitter.
**Fix**: Use exponential moving average over 3 frames.

### Critique 2: Stationary puck vulnerability
**Issue**: If puck starts stationary, opponent AI could immediately score.
**Fix**: Position at 75% (player1) or 25% (player2) - gives time to react.

### Critique 3: Zero friction might cause infinite rallies
**Issue**: Without any friction, puck never slows down.
**Fix**: Keep tiny friction (0.0005) or rely on wall restitution loss (0.9 < 1.0).

### Critique 4: ScoreOverlay conditional rendering
**Issue**: ScoreOverlay should still show during 'goal' and 'paused' states.
**Fix**: Update conditional: `{['playing', 'paused', 'goal'].includes(status) && <ScoreOverlay />}`

---

## Final Implementation Order

1. Remove EnergyCorrector, set frictionAir to 0.0005
2. Add paddle velocity tracking and transfer on collision
3. Update resetPuck with isGameStart parameter
4. Restructure UI layout to move scoreboard above canvas
5. Test all scenarios
6. Fine-tune velocity transfer coefficient

---

**Plan Status**: Ready for approval

