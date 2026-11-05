(function () {
  const A = window.Ambience;
  const $ = (id) => document.getElementById(id);
  const STORE = "ambience:v1";
  let mix = A.decodeMix(location.hash);
  let savedMaster = 70;
  try { const s = JSON.parse(localStorage.getItem(STORE)) || {}; if (!mix && s.mix) mix = A.normalizeMix(s.mix); if (s.master != null) savedMaster = s.master; } catch {}
  mix = mix || {};
  $("master").value = savedMaster;

  let ac = null, master = null, playing = false;
  const voices = {}; // id -> { gain, stop() }

  // ---------- audio engine ----------
  function noiseBuffer(type, seconds) {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    buf.copyToChannel(A.makeNoise(type, len), 0);
    return buf;
  }
  const bufs = {};
  function noise(type) {
    bufs[type] = bufs[type] || noiseBuffer(type, 6);
    const src = ac.createBufferSource(); src.buffer = bufs[type]; src.loop = true;
    src.loopStart = Math.random() * 2; src.start(0, Math.random() * 5); return src;
  }
  function filt(type, freq, q) { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; return f; }
  function lfo(freq, depth, target, offset) {
    const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = freq; g.gain.value = depth;
    o.connect(g); g.connect(target); if (offset != null) target.value = offset; o.start(); return o;
  }
  function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }
  function randomEvents(out, minGap, maxGap, fire) {
    let alive = true, t;
    const loop = () => { if (!alive) return; if (playing) fire(out); t = setTimeout(loop, minGap + Math.random() * (maxGap - minGap)); };
    t = setTimeout(loop, Math.random() * maxGap);
    return () => { alive = false; clearTimeout(t); };
  }
  const BUILD = {
    rain(out) {
      const s = noise("pink"); chain(s, filt("highpass", 500), filt("lowpass", 9000), out);
      const s2 = noise("white"); const g = ac.createGain(); g.gain.value = 0.18; chain(s2, filt("bandpass", 3200, 0.6), g, out);
      return [s, s2];
    },
    ocean(out) {
      const s = noise("brown"), f = filt("lowpass", 700), g = ac.createGain(); g.gain.value = 0.55;
      chain(s, f, g, out); const l1 = lfo(0.075, 0.45, g.gain), l2 = lfo(0.075, 350, f.frequency);
      return [s, l1, l2];
    },
    wind(out) {
      const s = noise("white"), f = filt("bandpass", 600, 1.2), g = ac.createGain(); g.gain.value = 0.7;
      chain(s, f, g, out); const l1 = lfo(0.11, 320, f.frequency), l2 = lfo(0.05, 0.3, g.gain);
      return [s, l1, l2];
    },
    fire(out) {
      const s = noise("brown"), g = ac.createGain(); g.gain.value = 0.8; chain(s, filt("lowpass", 380), g, out);
      const stop = randomEvents(out, 40, 380, (o) => {
        const len = Math.floor(ac.sampleRate * (0.004 + Math.random() * 0.012));
        const b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        const src = ac.createBufferSource(), cg = ac.createGain(); src.buffer = b; cg.gain.value = 0.3 + Math.random() * 0.7;
        chain(src, filt("highpass", 1200 + Math.random() * 2500), cg, o); src.start();
      });
      return [s, { stop }];
    },
    birds(out) {
      const stop = randomEvents(out, 700, 3200, (o) => {
        const notes = 1 + Math.floor(Math.random() * 4), base = 2400 + Math.random() * 2200, t0 = ac.currentTime;
        for (let k = 0; k < notes; k++) {
          const os = ac.createOscillator(), g = ac.createGain(), t = t0 + k * (0.09 + Math.random() * 0.06), d = 0.06 + Math.random() * 0.08;
          os.type = "sine"; os.frequency.setValueAtTime(base, t); os.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.5), t + d);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
          chain(os, g, o); os.start(t); os.stop(t + d + 0.02);
        }
      });
      return [{ stop }];
    },
    crickets(out) {
      const os = ac.createOscillator(); os.frequency.value = 4400; const am = ac.createGain(); am.gain.value = 0.5;
      const pulse = ac.createOscillator(); pulse.type = "square"; pulse.frequency.value = 28; const pd = ac.createGain(); pd.gain.value = 0.5;
      pulse.connect(pd); pd.connect(am.gain); const chirp = ac.createGain(); chirp.gain.value = 0.12;
      const slow = ac.createOscillator(); slow.type = "square"; slow.frequency.value = 1.6; const sd = ac.createGain(); sd.gain.value = 0.12;
      slow.connect(sd); sd.connect(chirp.gain);
      chain(os, am, chirp, out); os.start(); pulse.start(); slow.start();
      return [os, pulse, slow];
    },
    brown(out) { const s = noise("brown"); chain(s, filt("lowpass", 1200), out); return [s]; },
    drone(out) {
      const g = ac.createGain(); g.gain.value = 0.12; g.connect(out); const nodes = [];
      [110, 164.81, 220, 277.18].forEach((f, i) => { const o = ac.createOscillator(); o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 8; o.connect(g); o.start(); nodes.push(o); });
      nodes.push(lfo(0.06, 0.05, g.gain)); return nodes;
    }
  };
  function ensureAudio() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = A.sliderToGain($("master").value);
    const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
  }
  function setVoice(id, vol) {
    if (!ac) return;
    const target = A.sliderToGain(vol);
    if (target > 0 && !voices[id]) {
      const g = ac.createGain(); g.gain.value = 0; g.connect(master);
      voices[id] = { gain: g, nodes: BUILD[id](g) };
    }
    const v = voices[id]; if (!v) return;
    v.gain.gain.cancelScheduledValues(ac.currentTime);
    v.gain.gain.setTargetAtTime(target, ac.currentTime, 0.15);
    if (target === 0) {
      clearTimeout(v.kill);
      v.kill = setTimeout(() => { if (voices[id] === v && A.sliderToGain(mix[id] || 0) === 0) { v.nodes.forEach((n) => { try { n.stop(); } catch {} }); v.gain.disconnect(); delete voices[id]; } }, 1200);
    } else clearTimeout(v.kill);
  }
  async function play() {
    ensureAudio(); await ac.resume(); playing = true;
    master.gain.setTargetAtTime(A.sliderToGain($("master").value), ac.currentTime, 0.2);
    A.IDS.forEach((id) => setVoice(id, mix[id] || 0));
    ui();
  }
  function pause() { if (!ac) return; playing = false; master.gain.setTargetAtTime(0, ac.currentTime, 0.2); setTimeout(() => { if (!playing) ac.suspend(); }, 800); ui(); }

  // ---------- UI ----------
  function save() { localStorage.setItem(STORE, JSON.stringify({ mix, master: +$("master").value })); const h = A.encodeMix(mix); history.replaceState(null, "", h || location.pathname); }
  function ui() {
    $("playBtn").textContent = playing ? "❚❚" : "▶"; $("playBtn").classList.toggle("on", playing); $("playBtn").setAttribute("aria-label", playing ? "Pause" : "Play");
    const any = Object.keys(A.normalizeMix(mix)).length;
    $("mixName").textContent = any ? A.describeMix(mix) : "Pick a preset or raise a slider";
    $("status").textContent = playing ? "Playing — tweak sliders live." : any ? "Paused. Tap play." : "Tap play to start (browsers need a tap before playing sound).";
    A.SOUNDS.forEach((s) => { const el = document.querySelector(`[data-snd="${s.id}"]`); const v = mix[s.id] || 0; el.classList.toggle("active", v > 0); el.querySelector("input").value = v; el.querySelector(".v").textContent = v ? v + "%" : "off"; });
  }
  const grid = $("sounds");
  A.SOUNDS.forEach((s) => {
    const d = document.createElement("div"); d.className = "snd"; d.dataset.snd = s.id;
    d.innerHTML = `<div class="head"><span class="em">${s.emoji}</span><span class="v">off</span></div><b>${s.name}</b><input type="range" min="0" max="100" value="0" aria-label="${s.name} volume" />`;
    d.querySelector("input").addEventListener("input", (e) => { mix[s.id] = +e.target.value; if (!mix[s.id]) delete mix[s.id]; save(); if (playing) setVoice(s.id, mix[s.id] || 0); ui(); });
    grid.appendChild(d);
  });
  Object.entries(A.PRESETS).forEach(([name, p]) => {
    const b = document.createElement("button"); b.className = "btn chip"; b.textContent = name;
    b.addEventListener("click", () => { mix = { ...p }; save(); if (!playing) play(); else A.IDS.forEach((id) => setVoice(id, mix[id] || 0)); ui(); });
    $("presets").appendChild(b);
  });
  $("playBtn").addEventListener("click", () => (playing ? pause() : play()));
  $("master").addEventListener("input", () => { save(); if (ac && playing) master.gain.setTargetAtTime(A.sliderToGain($("master").value), ac.currentTime, 0.1); });
  $("clearBtn").addEventListener("click", () => { mix = {}; save(); A.IDS.forEach((id) => setVoice(id, 0)); ui(); });
  $("shareBtn").addEventListener("click", async () => {
    const h = A.encodeMix(mix); if (!h) return toast("Raise a slider first, then share.");
    const url = "https://gvggo.github.io/ambience-mixer/" + h, text = `My focus soundscape: ${A.describeMix(mix)} 🎧`;
    try { if (navigator.share) { await navigator.share({ title: "Ambience Mixer", text, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text + "\n" + url); toast("Mix link copied!"); } catch { toast("Copy failed — copy the address bar."); }
  });
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2200); }

  // Timer
  let minutes = 25, endAt = 0, tick = null;
  document.querySelectorAll("[data-min]").forEach((b) => b.addEventListener("click", () => {
    minutes = +b.dataset.min; document.querySelectorAll("[data-min]").forEach((x) => x.classList.toggle("sel", x === b));
    if (!tick) $("clock").textContent = A.fmtTime(minutes * 60);
  }));
  document.querySelector('[data-min="25"]').classList.add("sel");
  $("timerBtn").addEventListener("click", () => {
    if (tick) { clearInterval(tick); tick = null; $("timerBtn").textContent = "Start"; $("clock").textContent = A.fmtTime(minutes * 60); document.title = "Ambience Mixer — mix rain, fire, waves & focus"; return; }
    endAt = Date.now() + minutes * 60000; $("timerBtn").textContent = "Stop"; if (!playing) play();
    tick = setInterval(() => {
      const left = (endAt - Date.now()) / 1000; $("clock").textContent = A.fmtTime(left); document.title = A.fmtTime(left) + " · Ambience Mixer";
      if (left <= 0) {
        clearInterval(tick); tick = null; $("timerBtn").textContent = "Start"; document.title = "Time's up! · Ambience Mixer";
        if ($("fadeOut").checked && ac) { master.gain.setTargetAtTime(0, ac.currentTime, 3); setTimeout(pause, 9000); }
        toast("Focus session done — nice work! 🎉");
      }
    }, 250);
  });
  ui();
})();
