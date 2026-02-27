import { PhysicsConfig, AIConfig, Difficulty } from '@/types/game';

export const PHYSICS_CONFIG: PhysicsConfig = {
  engine: {
    gravity: { x: 0, y: 0 },
  },

  table: {
    width: 500,
    height: 750,
    wallThickness: 20,
    goalWidth: 188,  // Proportional to new width (37.5%)
  },

  puck: {
    radius: 12,
    mass: 0.1,
    restitution: 0.98,  // Increased for better bounces without energy corrector
    friction: 0,
    frictionAir: 0.0005,  // Near-zero for consistent speed
    maxSpeed: 25,
  },

  paddle: {
    radius: 30,
    mass: 1,
    restitution: 0.8,
    friction: 0.1,
    velocityTransfer: 0.8,  // 80% of paddle velocity transfers to puck
    maxVelocity: 30,        // Higher cap for responsive hits
  },

  wall: {
    restitution: 0.9,
    friction: 0,
  },

  game: {
    maxScore: 7,
    countdownSeconds: 3,
    goalPauseMs: 3500,
  },
};

export const AI_CONFIGS: Record<Difficulty, AIConfig> = {
  easy: {
    reactionDelay: 450,      // Slow reactions - updates target every 450ms
    speedMultiplier: 0.35,   // Very slow movement
    predictionAccuracy: 0.45, // Lots of prediction error (55 pixel spread)
    aggressiveness: 0.3,     // Stays near goal line
  },
  medium: {
    reactionDelay: 180,      // Moderate reactions
    speedMultiplier: 0.7,    // Decent speed
    predictionAccuracy: 0.75, // Some prediction error (25 pixel spread)
    aggressiveness: 0.6,     // Balanced positioning
  },
  hard: {
    reactionDelay: 35,       // Very fast reactions
    speedMultiplier: 1.15,   // Faster than base speed
    predictionAccuracy: 0.98, // Near-perfect prediction (2 pixel spread)
    aggressiveness: 0.9,     // Pushes forward aggressively
  },
};
