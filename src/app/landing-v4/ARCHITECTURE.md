# Landing V4 - Component Architecture

## Component Hierarchy

```
page.tsx (Route)
  └── LiquidMetalPuck (Main Container)
      ├── Sticky Viewport (h-screen)
      │   ├── Background Gradients
      │   │   ├── Dark gradient (#0a0a20 → #000)
      │   │   └── Ambient glows (3 layers)
      │   │
      │   ├── MorphShape (Canvas Wrapper)
      │   │   └── Canvas (@react-three/fiber)
      │   │       └── MetalPuck3D (3D Object)
      │   │           ├── Environment (HDR lighting)
      │   │           ├── Lights (ambient, directional, point)
      │   │           └── mesh
      │   │               ├── geometry (morphing)
      │   │               └── meshStandardMaterial (chrome)
      │   │
      │   ├── AnimatedText (Typography)
      │   │   └── 5 Stage Cards (scroll-driven)
      │   │       ├── title (8xl/9xl gradient)
      │   │       └── subtitle (lg/xl white/50)
      │   │
      │   ├── CTA Button (Glass Morphism)
      │   │   └── Visible at stage 5 (80-100%)
      │   │
      │   └── Scroll Indicator
      │       └── Visible at start (0-8%)
      │
      └── Spacer (h-[400vh]) - Enables scroll
```

## Data Flow

```
User Scrolls
    ↓
useScroll (Framer Motion)
    ↓
scrollYProgress (0-1)
    ↓
    ├→ MetalPuck3D
    │   ↓
    │   Determines stage (0-4)
    │   ↓
    │   Morphs geometry with GSAP
    │   ↓
    │   Updates rotation/position
    │
    ├→ AnimatedText
    │   ↓
    │   Calculates opacity per stage
    │   ↓
    │   Fades in/out with blur
    │
    ├→ CTA Button
    │   ↓
    │   opacity/scale transform
    │
    └→ Scroll Indicator
        ↓
        Fades out after 8%
```

## Morph Stages Mapping

```typescript
scrollYProgress  →  Stage  →  Geometry      →  Text
─────────────────────────────────────────────────────
0.00 - 0.20      →  0      →  Puck          →  "AIR HOCKEY"
0.20 - 0.40      →  1      →  Trophy        →  "COMPETE"
0.40 - 0.60      →  2      →  Hexagon       →  "ASCEND"
0.60 - 0.80      →  3      →  Stats Ring    →  "EVOLVE"
0.80 - 1.00      →  4      →  Game Table    →  "BEGIN"
```

## State Management

```
MetalPuck3D:
  - meshRef (useRef) → THREE.Mesh instance
  - morphStage (useRef) → Current stage (0-4)
  - previousProgress (useRef) → Last scroll value

LiquidMetalPuck:
  - containerRef (useRef) → Scroll container
  - scrollYProgress (MotionValue) → Scroll position

MorphShape:
  - Stateless wrapper, passes scrollProgress down
```

## Animation Timeline (Single Morph)

```
Time: 0s
  ↓ scale.y → 0.8, scale.x → 1.1 (squash)
Time: 0.3s
  ↓ scale.y → 1.1, scale.x → 0.9 (stretch)
Time: 0.6s
  ↓ scale.y → 1, scale.x → 1 (return)
Time: 1.2s
  ↓ Morph complete
  
Parallel:
  - rotation.y += π/2 (smooth turn)
  - geometry vertices lerp (0 → 1)
```

## Performance Strategy

1. **Geometry Caching**
   - All geometries created once in useMemo
   - Reused across morphs

2. **RAF Optimization**
   - useFrame (R3F) handles render loop
   - Framer Motion uses transform (GPU)

3. **Morph Efficiency**
   - GSAP targets only changing values
   - needsUpdate flag prevents extra work

4. **Canvas Size**
   - 600x600px = sweet spot
   - Scales on retina displays

## Lighting Setup

```
Environment (preset: "studio")
  └── HDR 360° environment map

ambientLight (0.2)
  └── Soft base illumination

directionalLight (10, 10, 5) @ 1.5
  └── Main key light (white)

directionalLight (-10, -10, -5) @ 0.5
  └── Fill light (blue tint)

pointLight (0, 5, 0) @ 1.0
  └── Top rim (white)

pointLight (0, 0, 5) @ 0.8
  └── Front rim (cyan)
```

## Material Breakdown

```typescript
MeshStandardMaterial {
  metalness: 1.0       // Pure metal (not plastic)
  roughness: 0.08      // 92% smooth (mirror-like)
  envMapIntensity: 1.2 // 20% boosted reflections
  color: #e8e8e8       // Light gray (silver)
}
```

This creates the liquid chrome effect by:
- Reflecting environment perfectly (metalness: 1)
- Minimal diffusion (roughness: 0.08)
- Enhanced HDR highlights (envMapIntensity: 1.2)

## Critical Files

**Must Edit:**
- `MetalPuck3D.tsx` - 3D object, geometries, morphing logic
- `LiquidMetalPuck.tsx` - Scroll stages, copy, layout

**Optional:**
- `ScrollMorph.tsx` - Utilities, not actively used yet
- `MorphShape.tsx` - Canvas wrapper, rarely needs changes

**Config:**
- `page.tsx` - Entry point, minimal logic

---

This architecture enables:
- Silky 60 FPS morphing
- Declarative scroll-driven animations
- Easy customization of stages/copy
- Premium visual quality
