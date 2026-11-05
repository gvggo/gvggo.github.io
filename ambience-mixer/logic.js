/* Ambience Mixer core logic — pure functions, no audio/DOM. */
(function (root) {
  const SOUNDS = [
    { id: "rain", name: "Rain", emoji: "🌧️" },
    { id: "ocean", name: "Ocean waves", emoji: "🌊" },
    { id: "wind", name: "Wind", emoji: "🌬️" },
    { id: "fire", name: "Campfire", emoji: "🔥" },
    { id: "birds", name: "Birds", emoji: "🐦" },
    { id: "crickets", name: "Night crickets", emoji: "🦗" },
    { id: "brown", name: "Brown noise", emoji: "🟤" },
    { id: "drone", name: "Warm drone", emoji: "🎐" }
  ];
  const IDS = SOUNDS.map((s) => s.id);
  const PRESETS = {
    "Rainy library": { rain: 70, brown: 25, drone: 15 },
    "Beach nap": { ocean: 75, wind: 20, birds: 15 },
    "Cabin campfire": { fire: 70, wind: 30, crickets: 25 },
    "Deep focus": { brown: 60, drone: 25 },
    "Summer night": { crickets: 60, wind: 15, fire: 20 },
    "Forest morning": { birds: 55, wind: 35, rain: 10 }
  };
  function clampVol(v) { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0; }
  function normalizeMix(mix) {
    const out = {};
    for (const id of IDS) { const v = clampVol(mix && mix[id]); if (v > 0) out[id] = v; }
    return out;
  }
  function encodeMix(mix) {
    const m = normalizeMix(mix);
    const parts = IDS.filter((id) => m[id]).map((id) => id + ":" + m[id]);
    return parts.length ? "#mix=" + parts.join(",") : "";
  }
  function decodeMix(hash) {
    const m = /(?:^|[#&])mix=([^&]*)/.exec(String(hash || ""));
    if (!m) return null;
    const mix = {};
    for (const p of m[1].split(",")) { const [id, v] = p.split(":"); if (IDS.includes(id)) mix[id] = clampVol(v); }
    const n = normalizeMix(mix);
    return Object.keys(n).length ? n : null;
  }
  function describeMix(mix) {
    const m = normalizeMix(mix);
    const top = IDS.filter((id) => m[id]).sort((a, b) => m[b] - m[a]).map((id) => SOUNDS.find((s) => s.id === id));
    return top.map((s) => s.emoji + " " + s.name).join(" + ") || "Silence";
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }
  // Perceptual volume curve: slider 0-100 -> gain 0-1 (squared feels more linear to ears)
  function sliderToGain(v) { const x = clampVol(v) / 100; return x * x; }
  // Noise generators. rng: () => [0,1). Returns Float32Array in [-1,1].
  function makeNoise(type, length, rng) {
    rng = rng || Math.random;
    const out = new Float32Array(length);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < length; i++) {
      const w = rng() * 2 - 1;
      if (type === "white") out[i] = w;
      else if (type === "pink") { // Paul Kellet's refined method
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else { last = (last + 0.02 * w) / 1.02; out[i] = last * 3.5; } // brown
    }
    let peak = 0; for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(out[i]));
    if (peak > 1) for (let i = 0; i < length; i++) out[i] /= peak;
    return out;
  }
  root.Ambience = { SOUNDS, IDS, PRESETS, clampVol, normalizeMix, encodeMix, decodeMix, describeMix, fmtTime, sliderToGain, makeNoise };
})(typeof window !== "undefined" ? window : globalThis);
