/* PIGEON FLUID — edit this file first. */
window.FLUID_CONFIG = {
  SIM_RESOLUTION: 128,
  PRESSURE_ITERATIONS: 18,
  FORCE: 520,
  SPLAT_RADIUS: 0.018,
  VELOCITY_DISSIPATION: 0.992,
  DYE_DISSIPATION: 0.9986,
  COLOR_SLOW: "#3b7eb4",
  COLOR_FAST: "#1975ff",
  HIGHLIGHT: "#fff2fd",
  HIGHLIGHT_AMOUNT: 0.1,
  DYE_AMOUNT: 1.35,

  // ---------- COLOR BLENDING ----------

  // Options:
  // "add"       = glowing/light behavior
  // "ink"       = lerp between background and pigment
  // "multiply"  = Photoshop-style multiply
  // "pigment"   = subtractive-ish pigment mixing
  BLEND_MODE: "ink",

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
