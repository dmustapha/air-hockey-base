# AI and Paddle Movement Fixes Plan

## Overview & Goals

Fix three critical gameplay issues:
1. **AI doesn't hit stationary puck** - When AI loses and puck is in their half, they should actively hit it
2. **Player paddle can't reach edges** - Paddle constraints too restrictive, gaps at edges
3. **Haphazard player movement** - Input handling has issues causing jittery/breaking movement

---

## Issue Analysis

### Issue 1: AI Doesn't Hit Stationary Puck

**Root Cause**: AI logic in `useAIOpponent.ts` only reacts to:
- `puck.velocity.y < -0.5` (puck moving toward AI)
- `puck.velocity.y > 0.5` (puck moving away)

When puck velocity is near 0 (stationary), there's NO logic to approach and hit it.

**Current Code** (`useAIOpponent.ts:50-75`):
```typescript
if (puck.velocity.y < -0.5) {
  // Predict intercept...
} else if (puck.velocity.y > 0.5) {
  // Return to center...
}
// NO ELSE CASE FOR STATIONARY PUCK!
```

**Solution**: Add logic for when puck is stationary AND in AI's half:
- Check if puck speed < 0.5 (effectively stationary)
- Check if puck is in AI's half (y < table.height / 2)
- If both true, move toward puck to hit it

### Issue 2: Player Paddle Can't Reach Edges

**Root Cause**: Paddle position clamped too conservatively in `engine.ts`:
```typescript
clampedX = Math.max(paddleConfig.radius, Math.min(table.width - paddleConfig.radius, x));
clampedY = Math.max(table.height / 2 + paddleConfig.radius, Math.min(table.height - paddleConfig.radius, y));
```

With `radius=25`, `table.width=400`, `table.height=600`:
- X range: 25 to 375 (50px total gap)
- Y range: 325 to 575 (50px total gap)

The paddle edge CAN technically reach the wall, but the canvas visual doesn't match - there's padding/borders causing misalignment.

**Solution**: Reduce the constraint margin to allow paddle center closer to edges:
- Use `radius * 0.3` instead of `radius` for edge constraints
- This allows paddle to overlap with visual borders slightly
- Physics walls will prevent actual escape

### Issue 3: Haphazard Player Movement

**Root Cause**: Multiple issues in input handling:

1. **Ref passing issue** in `game/page.tsx`:
```typescript
canvasRef: { current: canvasRef.current?.canvas ?? null }
```
This creates a NEW object on every render, breaking ref stability.

2. **Missing pointer lock/capture**: Canvas doesn't capture pointer, causing loss of tracking when moving fast

3. **No input smoothing**: Raw input goes directly to paddle, causing jitter

**Solution**:
- Fix ref passing with proper stable ref
- Add pointer capture on mousedown
- Use document-level mouse tracking (not just canvas)
- Add input smoothing similar to AI movement

---

## Implementation Plan

### Phase 1: Fix AI to Hit Stationary Puck

**File**: `/src/hooks/useAIOpponent.ts`

Add new condition for stationary puck:
```typescript
const puckSpeed = Math.sqrt(puck.velocity.x ** 2 + puck.velocity.y ** 2);
const puckInAIHalf = puck.position.y < table.height / 2;

if (puckSpeed < 0.5 && puckInAIHalf) {
  // Puck is stationary in AI's half - go hit it!
  targetX = puck.position.x;
  targetY = puck.position.y + paddle.radius; // Approach from above
} else if (puck.velocity.y < -0.5) {
  // existing intercept logic...
}
```

### Phase 2: Fix Paddle Edge Constraints

**File**: `/src/lib/physics/engine.ts`

Change constraint margins from `radius` to `radius * 0.3`:
```typescript
// X constraint - allow closer to edges
const edgeMargin = paddleConfig.radius * 0.3; // 7.5px instead of 25px
const clampedX = Math.max(edgeMargin, Math.min(table.width - edgeMargin, x));

// Y constraint - allow closer to edges
if (player === 'player1') {
  clampedY = Math.max(
    table.height / 2 + edgeMargin,
    Math.min(table.height - edgeMargin, y)
  );
}
```

### Phase 3: Fix Player Input Handling

**File**: `/src/hooks/usePlayerInput.ts`

1. Add document-level mouse tracking:
```typescript
// Track on document, not just canvas - prevents losing cursor
document.addEventListener('mousemove', handleMouseMove);
```

2. Add input smoothing:
```typescript
const currentPos = useRef({ x: 0, y: 0 });
const smoothing = 0.5; // 50% smoothing

const smoothedX = currentPos.current.x + (pos.x - currentPos.current.x) * smoothing;
const smoothedY = currentPos.current.y + (pos.y - currentPos.current.y) * smoothing;
```

3. Add pointer capture:
```typescript
canvas.addEventListener('mousedown', () => canvas.setPointerCapture(e.pointerId));
```

**File**: `/src/app/(cyber)/game/page.tsx`

Fix ref passing:
```typescript
// Use a stable ref pattern
const canvasElementRef = useRef<HTMLCanvasElement | null>(null);

useEffect(() => {
  canvasElementRef.current = canvasRef.current?.canvas ?? null;
}, [canvasRef.current?.canvas]);

usePlayerInput({
  canvasRef: canvasElementRef,
  ...
});
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `/src/hooks/useAIOpponent.ts` | Add stationary puck logic |
| `/src/lib/physics/engine.ts` | Reduce paddle edge margins |
| `/src/hooks/usePlayerInput.ts` | Add smoothing, document-level tracking |
| `/src/app/(cyber)/game/page.tsx` | Fix ref stability |

---

## Verification Checklist

- [ ] AI actively moves to hit stationary puck in their half
- [ ] Player paddle can reach all four edges of their half
- [ ] No visible gaps between paddle and edges
- [ ] Paddle movement is smooth without jitter
- [ ] Fast mouse movements don't lose tracking
- [ ] Touch input still works correctly

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Paddle escapes play area | Physics walls will push it back |
| AI too aggressive with stationary puck | Add slight delay before approaching |
| Input smoothing feels laggy | Tune smoothing factor (0.5-0.7) |
| Document listeners leak | Proper cleanup in useEffect return |

