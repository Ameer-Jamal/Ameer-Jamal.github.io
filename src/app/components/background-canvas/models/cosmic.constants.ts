import { SandboxTool } from './cosmic.types';

export const COSMIC_CONSTANTS = {
  MAX_LINKS_INTENSE: 6,
  FPS_SAMPLE_SIZE: 30,
  FPS_DOWNGRADE_THRESHOLD: 45,
  FPS_UPGRADE_THRESHOLD: 58,
  FPS_DOWNGRADE_FRAMES: 60,
  FPS_UPGRADE_FRAMES: 180,
  MOUSE_GRAVITY_PAUSE_FRAMES: 120,
  PARTICLE_DENSITY: 8000,
  CONNECTION_DISTANCE: 145,
  MOUSE_ATTRACT_DISTANCE: 370,
  EXPLOSION_RADIUS: 330,
  SPATIAL_HASH_CELL_SIZE: 200
} as const;

export const TOOLS_LIST: SandboxTool[] = [
  { id: 'DEFAULT', name: 'Nova Strike', desc: 'Hold to charge, release shockwave or Super Move — blasts stars into wormholes', icon: '⚡' },
  { id: 'BLACK_HOLE', name: 'Event Horizon', desc: 'Place gravity wells that persist — sling stars into wormholes', icon: '🕳️' },
  { id: 'PAINT_BRUSH', name: 'Stellar Nursery', desc: 'Hold to spray stars until cap, release for a starburst', icon: '🎨' },
  { id: 'REPELLER', name: 'Anti-Gravity', desc: 'Hold to repel and spin stars, release for inversion nova', icon: '🧲' },
  { id: 'TESLA_DISCHARGE', name: 'Tesla Discharge', desc: 'Hold to charge, release a Tesla Storm', icon: '⚡' },
  { id: 'WORMHOLE', name: 'Wormhole Gate', desc: 'Tap to place portals — they stay until CLEAR', icon: '🌀' },
  { id: 'NEBULAR_WIND', name: 'Nebular Wind', desc: 'Hold to blow stars, release a cosmic jet', icon: '🌬️' },
  { id: 'TIME_DILATION', name: 'Chrono Well', desc: 'Hold to slow time, release a time freeze ripple', icon: '⏳' }
];
