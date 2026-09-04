/* PIGEON FLUID — edit this file first. */
window.FLUID_CONFIG = {
  SIM_RESOLUTION: 128,
  PRESSURE_ITERATIONS: 18,
  FORCE: 520,
  SPLAT_RADIUS: 0.018,
  VELOCITY_DISSIPATION: 0.992,
  DYE_DISSIPATION: 0.986,
  COLOR_SLOW: "#002338",
  COLOR_FAST: "#19beff",
  HIGHLIGHT: "#fff2d2",
  HIGHLIGHT_AMOUNT: 0.1,
  DYE_AMOUNT: 1.35,

  // ---------- COLOR BLENDING ----------

  // Options:
  // "add"       = glowing/light behavior
  // "ink"       = lerp between background and pigment
  // "multiply"  = Photoshop-style multiply
  // "pigment"   = subtractive-ish pigment mixing
  BLEND_MODE: "",

  // Controls how strongly the dye covers/darkens the background.
  // Mostly used by ink, multiply, and pigment modes.
  INK_OPACITY: 0.85,

  // ---------- BACKGROUND ----------
  BACKGROUND: "#ecebe7",
  HOVER_INTERACTION: true,
  IDLE_MOTION: true,
  IDLE_INTERVAL_MS: 2200,
  IDLE_FORCE: 0.32,
  HIDE_HINT_ON_INTERACTION: true
};
