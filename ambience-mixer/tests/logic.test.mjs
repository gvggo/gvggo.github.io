import fs from "fs"; import vm from "vm"; import assert from "assert/strict";
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL("../logic.js", import.meta.url), "utf8"), ctx);
const A = ctx.Ambience; let n = 0; const t = (name, fn) => { fn(); n++; console.log("  ✓", name); };
const plain = (o) => JSON.parse(JSON.stringify(o));

t("mix link round-trips", () => { const m = { rain: 70, fire: 30 }; assert.equal(A.encodeMix(m), "#mix=rain:70,fire:30"); assert.deepEqual(plain(A.decodeMix("#mix=rain:70,fire:30")), m); });
t("decode ignores unknown sounds and clamps volume", () => { assert.deepEqual(plain(A.decodeMix("#mix=rain:250,evil:50,wind:-4")), { rain: 100 }); assert.equal(A.decodeMix("#nothing"), null); assert.equal(A.decodeMix("#mix=wind:0"), null); });
t("every preset uses valid sounds", () => { for (const [k, p] of Object.entries(A.PRESETS)) for (const id of Object.keys(p)) assert.ok(A.IDS.includes(id), k + ":" + id); });
t("describeMix orders by volume", () => { assert.equal(A.describeMix({ fire: 20, rain: 80 }), "🌧️ Rain + 🔥 Campfire"); assert.equal(A.describeMix({}), "Silence"); });
t("timer format", () => { assert.equal(A.fmtTime(1500), "25:00"); assert.equal(A.fmtTime(59.2), "01:00"); assert.equal(A.fmtTime(-3), "00:00"); });
t("volume curve", () => { assert.equal(A.sliderToGain(0), 0); assert.equal(A.sliderToGain(100), 1); assert.equal(A.sliderToGain(50), 0.25); });
for (const type of ["white", "pink", "brown"]) t(type + " noise stays in [-1,1] and isn't silent", () => {
  let seed = 42; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const b = A.makeNoise(type, 44100, rng); let peak = 0, sum = 0;
  for (const v of b) { assert.ok(v >= -1 && v <= 1 && Number.isFinite(v)); peak = Math.max(peak, Math.abs(v)); sum += v * v; }
  assert.ok(peak > 0.1 && Math.sqrt(sum / b.length) > 0.02);
});
t("brown noise is low-frequency heavy (smoother than white)", () => {
  const diff = (b) => { let d = 0; for (let i = 1; i < b.length; i++) d += Math.abs(b[i] - b[i - 1]); return d / b.length; };
  const w = A.makeNoise("white", 20000), br = A.makeNoise("brown", 20000);
  assert.ok(diff(br) < diff(w) / 5);
});
console.log(`\nambience-mixer: ${n} tests passed`);
