# Cinematic Intro Storyboard

## Timeline: 4 Seconds (120 Frames @ 30fps)

---

### Phase 1: Initialize (0-1 second | Frames 0-30)

```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│              ●   ○   ●              │  ← Pulsing cyan light
│             (breathing)             │     (expanding/contracting)
│                                     │
│           INITIALIZE...             │  ← Fades in/out
│                                     │
│                                     │
└─────────────────────────────────────┘

Effect: Calm, mysterious start
Color: Deep black + single cyan glow
Motion: Soft pulse, gentle fade
```

---

### Phase 2: Hyperspace (1-2 seconds | Frames 30-60)

```
┌─────────────────────────────────────┐
│  ╲                 ╱               │
│   ╲    ╱       ╲  ╱                │
│    ╲  ╱    ◉   ╲╱                  │  ← Lines converge to center
│     ╲╱   (rush) ╱╲                 │     (like entering hyperspace)
│     ╱╲         ╱  ╲                │
│    ╱  ╲       ╱    ╲               │
│   ╱    ╲     ╱      ╲              │
└─────────────────────────────────────┘

Effect: Speed, motion, journey
Color: Cyan streaks on black
Motion: Lines shoot outward from center
Animation: 20 lines, varying speeds
```

---

### Phase 3: Puck Formation (2-3 seconds | Frames 60-90)

```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│            ┌─────────┐              │
│            │    ◉    │  →→→→→      │  ← Puck forms and SLAMS
│            │ (glow)  │   RUSH       │     toward camera
│            └─────────┘  [blur]      │     with motion blur
│                                     │
│                                     │
└─────────────────────────────────────┘

Effect: Power building, anticipation
Color: White core, cyan halo
Motion: Form (60-75), Grow (75-85), Rush (85-90)
Visual: Puck gets HUGE as it rushes forward
```

---

### Phase 4: Title Slam (3-4 seconds | Frames 90-120)

```
Frame 90-95: Impact Flash
┌─────────────────────────────────────┐
│                                     │
│         ███████████████████         │
│         █ WHITE FLASH      █        │  ← Brief white screen
│         █  (impact)        █        │     (like explosion)
│         ███████████████████         │
│                                     │
└─────────────────────────────────────┘

Frame 95-105: Title Collision
┌─────────────────────────────────────┐
│                                     │
│    ←←←← CYBER   ●   AIR HOCKEY →→→→│  ← Words fly in
│         (left)  │    (right)       │     from sides
│                 ↓                   │     and COLLIDE
│              [CRASH]                │     at center
│         *  ★  ✦  ★  *              │  ← Particle explosion
│                                     │
└─────────────────────────────────────┘

Frame 105-120: Final Pose
┌─────────────────────────────────────┐
│                                     │
│            CYBER                    │  ← Title settles
│        AIR HOCKEY                   │     with glowing effect
│                                     │
│      *    ★    ✦    ★    *         │  ← Particles fade out
│                                     │
└─────────────────────────────────────┘

Effect: IMPACT, power, arrival
Colors: White flash → Cyan + White text
Motion: Horizontal slam + particle burst
Particles: 30 dots, cyan/amber, radial explosion
```

---

## Animation Details

### Timing Breakdown
| Phase | Duration | Frames | Emotion          | Key Visual           |
|-------|----------|--------|------------------|----------------------|
| 1     | 1s       | 0-30   | Mysterious       | Pulsing light        |
| 2     | 1s       | 30-60  | Speed            | Hyperspace lines     |
| 3     | 1s       | 60-90  | Power            | Puck rush + blur     |
| 4     | 1s       | 90-120 | IMPACT           | Title slam + explosion|

### Color Progression
```
Black → Cyan glow → Cyan streaks → White/Cyan puck → WHITE FLASH → Cyan text
```

### Motion Principles
1. **Easing:** Ease-in-out for organic feel
2. **Overshoot:** Slight bounce on title collision
3. **Blur:** Motion blur on fast-moving puck
4. **Glow:** Heavy use of boxShadow for neon effect

### Sound Design (Future)
| Frame   | Sound Effect              |
|---------|---------------------------|
| 0-30    | Low hum, powering up      |
| 30-60   | Whoosh, rising pitch      |
| 60-90   | Deep thud, wind rush      |
| 90      | MASSIVE IMPACT SLAM       |
| 90-120  | Particle scatter, reverb  |

---

## Technical Implementation

### Remotion Interpolation
```typescript
// Example: Puck rush Z-position
const puckZ = interpolate(
  frame,
  [PHASE_3_END - 10, PHASE_3_END],
  [0, -1000],
  { extrapolateRight: 'clamp' }
);

// Result: Puck "flies" from z=0 to z=-1000 in 10 frames
// Creating camera rush effect
```

### Frame Rate Math
- **30 fps** = 1 frame every 33.33ms
- **120 frames** = 4000ms = 4 seconds
- **Smooth playback** requires consistent 30fps (no dropped frames)

### Performance Budget
- **Total bundle:** ~150KB (CinematicIntro.tsx)
- **Frame render time:** <10ms (ensures 60fps on playback)
- **Memory:** <50MB (30 particles, simple shapes)

---

## Transition to Main Page

After frame 120:
1. Remotion Player fires `onEnded` callback
2. 300ms delay for dramatic pause
3. `setIntroComplete(true)`
4. AnimatePresence fades intro out (500ms)
5. Main content fades in (1000ms)
6. HeroReveal animations begin

**Total transition:** ~1.8 seconds from intro end to hero fully visible

---

This storyboard ensures every frame serves a purpose. No wasted motion. Pure cinematic impact.
