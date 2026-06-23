// ==UserScript==
// @name         Torn Gym Gains Predictor
// @namespace    mcc.torn.gym-gains
// @version      1.2.0
// @description  Predicts gym gains from your live stats, happy, energy and perks. Compares all gyms and simulates a full energy bar with happy decay.
// @author       Mat
// @homepageURL  https://github.com/mat-mcc-uk/torn-gym-gains
// @supportURL   https://github.com/mat-mcc-uk/torn-gym-gains/issues
// @updateURL    https://raw.githubusercontent.com/mat-mcc-uk/torn-gym-gains/main/torn-gym-gains.user.js
// @downloadURL  https://raw.githubusercontent.com/mat-mcc-uk/torn-gym-gains/main/torn-gym-gains.user.js
// @match        https://www.torn.com/*
// @connect      api.torn.com
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------

  const TORN_API_KEY = GM_getValue('gymApiKey', '');

  // Vladar / Darkkk gym gain formula (current, post stat-cap removal):
  //   gain = (dots*4) * (A*stat + B*happy + 0.55) * (1+perks) / 150 * energyPerTrain
  // Constants are stat-independent in this consolidated form; per-stat
  // differences live in the unpredictable random term, which we omit.
  const FORMULA_A = 0.00019106;
  const FORMULA_B = 0.00226263;
  const FORMULA_C = 0.55;
  const FORMULA_DIV = 150;

  // Happy lost per train ≈ 0.1 * energyPerTrain * randBetween(4,6). We use the
  // mean (5) so dH ≈ 0.5 * energyPerTrain.
  const HAPPY_LOSS_FACTOR = 0.5;

  const STATS = ['strength', 'speed', 'dexterity', 'defense'];
  const STAT_LABEL = {
    strength: 'Str',
    speed: 'Spe',
    dexterity: 'Dex',
    defense: 'Def',
  };

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------

  let live = {
    stats: { strength: 0, speed: 0, dexterity: 0, defense: 0 },
    happy: 0,
    maxHappy: 0,
    energy: 0,
    maxEnergy: 0,
    // perks[stat] = multiplier (e.g. 1.16 for +16% to that stat's gym gains),
    // already folded with general "gym gains" perks that apply to all stats.
    perks: { strength: 1, speed: 1, dexterity: 1, defense: 1 },
    activeGymId: null,
    loaded: false,
  };

  // Gym table. dots are on the 0-10 scale (API value / 10). energy is energy
  // per train. A gym with 0 dots for a stat can't train it. Specialist gyms
  // included; unlock requirements aren't enforced here, the comparison just
  // shows what each would give.
  // Source: Torn wiki gym dot chart.
  const GYMS = [
    { id: 1, name: 'Premier Fitness', energy: 5, dots: { strength: 2.0, speed: 2.0, dexterity: 2.0, defense: 2.0 } },
    { id: 2, name: 'Average Joes', energy: 5, dots: { strength: 2.4, speed: 2.4, dexterity: 2.8, defense: 2.8 } },
    { id: 3, name: 'Woodward', energy: 5, dots: { strength: 2.8, speed: 3.2, dexterity: 3.0, defense: 2.8 } },
    { id: 4, name: 'Beach Bods', energy: 5, dots: { strength: 3.2, speed: 3.2, dexterity: 0, defense: 3.0 } },
    { id: 5, name: 'Silver Gym', energy: 5, dots: { strength: 3.4, speed: 3.6, dexterity: 3.4, defense: 3.2 } },
    { id: 6, name: 'Pour Femme', energy: 5, dots: { strength: 3.4, speed: 3.6, dexterity: 3.6, defense: 3.8 } },
    { id: 7, name: 'Davies Den', energy: 5, dots: { strength: 3.7, speed: 0, dexterity: 3.7, defense: 3.7 } },
    { id: 8, name: 'Global Gym', energy: 5, dots: { strength: 4.0, speed: 4.0, dexterity: 4.0, defense: 4.0 } },
    { id: 9, name: 'Knuckle Heads', energy: 10, dots: { strength: 4.8, speed: 4.4, dexterity: 4.0, defense: 4.2 } },
    { id: 10, name: 'Pioneer Fitness', energy: 10, dots: { strength: 4.4, speed: 4.6, dexterity: 4.8, defense: 4.4 } },
    { id: 11, name: 'Anabolic Anomalies', energy: 10, dots: { strength: 5.0, speed: 4.6, dexterity: 4.8, defense: 5.0 } },
    { id: 12, name: 'Core', energy: 10, dots: { strength: 5.0, speed: 5.2, dexterity: 5.0, defense: 5.0 } },
    { id: 13, name: 'Racing Fitness', energy: 10, dots: { strength: 5.0, speed: 5.4, dexterity: 5.6, defense: 5.2 } },
    { id: 14, name: 'Complete Cardio', energy: 10, dots: { strength: 5.5, speed: 5.8, dexterity: 5.5, defense: 5.5 } },
    { id: 15, name: 'Legs Bums and Tums', energy: 10, dots: { strength: 0, speed: 5.6, dexterity: 5.6, defense: 5.8 } },
    { id: 16, name: 'Deep Burn', energy: 10, dots: { strength: 6.0, speed: 6.0, dexterity: 6.0, defense: 6.0 } },
    { id: 17, name: 'Apollo Gym', energy: 25, dots: { strength: 6.0, speed: 6.2, dexterity: 6.4, defense: 6.2 } },
    { id: 18, name: 'Gun Shop', energy: 25, dots: { strength: 6.6, speed: 6.4, dexterity: 6.2, defense: 6.2 } },
    { id: 19, name: 'Force Training', energy: 25, dots: { strength: 6.4, speed: 6.6, dexterity: 6.4, defense: 6.8 } },
    { id: 20, name: 'Cha Chas', energy: 25, dots: { strength: 6.4, speed: 6.4, dexterity: 7.0, defense: 6.6 } },
    { id: 21, name: 'Atlas', energy: 25, dots: { strength: 7.0, speed: 6.4, dexterity: 6.4, defense: 6.6 } },
    { id: 22, name: 'Last Round', energy: 25, dots: { strength: 6.8, speed: 6.6, dexterity: 6.8, defense: 7.0 } },
    { id: 23, name: 'The Edge', energy: 25, dots: { strength: 6.8, speed: 7.0, dexterity: 7.0, defense: 6.8 } },
    { id: 24, name: 'Georges', energy: 25, dots: { strength: 7.3, speed: 7.3, dexterity: 7.3, defense: 7.3 } },
    // Specialist gyms.
    { id: 25, name: 'Balboas (Def/Dex)', energy: 25, dots: { strength: 0, speed: 0, dexterity: 7.5, defense: 7.5 } },
    { id: 26, name: 'Frontline (Str/Spe)', energy: 25, dots: { strength: 7.5, speed: 7.5, dexterity: 0, defense: 0 } },
    { id: 27, name: 'Gym 3000 (Str)', energy: 50, dots: { strength: 8.0, speed: 0, dexterity: 0, defense: 0 } },
    { id: 28, name: 'Mr Isoyamas (Def)', energy: 50, dots: { strength: 0, speed: 0, dexterity: 0, defense: 8.0 } },
    { id: 29, name: 'Total Rebound (Spe)', energy: 50, dots: { strength: 0, speed: 8.0, dexterity: 0, defense: 0 } },
    { id: 30, name: 'Elites (Dex)', energy: 50, dots: { strength: 0, speed: 0, dexterity: 8.0, defense: 0 } },
    { id: 31, name: 'Sports Science Lab', energy: 25, dots: { strength: 9.0, speed: 9.0, dexterity: 9.0, defense: 9.0 } },
  ];

  let selectedGymId = GM_getValue('selectedGymId', 8); // default Global Gym

  // Calculator overrides. When calcMode is on, render uses these typed values
  // instead of the live API ones, so you can model scenarios without changing
  // your account. null inside a field means "use the live value for this".
  let calc = {
    on: GM_getValue('calcOn', false),
    energy: GM_getValue('calcEnergy', null),   // number or null
    happy: GM_getValue('calcHappy', null),     // number or null
    perkPct: GM_getValue('calcPerkPct', null), // total gym-gain perk %, or null
  };

  // Resolve the values render should use: overrides when calc mode is on and
  // the field is set, otherwise the live value. perkMult is per stat.
  function effectiveEnergy() {
    if (calc.on && calc.energy != null && calc.energy > 0) return calc.energy;
    const typed = parseInt((document.getElementById('tgg-energy') || {}).value, 10);
    if (typed > 0) return typed;
    return live.energy || 0;
  }
  function effectiveHappy() {
    if (calc.on && calc.happy != null) return calc.happy;
    return live.happy;
  }
  function effectivePerk(stat) {
    if (calc.on && calc.perkPct != null) return 1 + calc.perkPct / 100;
    return live.perks[stat];
  }

  // ---------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------

  function gmFetch(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        onload: (r) => {
          if (r.status >= 200 && r.status < 300) {
            try {
              resolve(JSON.parse(r.responseText));
            } catch {
              reject(new Error('Bad JSON'));
            }
          } else {
            reject(new Error('HTTP ' + r.status));
          }
        },
        onerror: () => reject(new Error('Network error')),
      });
    });
  }

  // Parse a perk string like "+ 2% gym gains" or "+ 15% defense gym gains" or
  // "+ 1% strength gym gains". Returns { stat|null, pct } or null. A null stat
  // means it applies to all stats.
  function parsePerk(text) {
    const t = text.toLowerCase();
    if (!t.includes('gym gain')) return null;
    const m = t.match(/([\d.]+)\s*%/);
    if (!m) return null;
    const pct = parseFloat(m[1]) / 100;
    let stat = null;
    for (const s of STATS) {
      if (t.includes(s)) {
        stat = s;
        break;
      }
    }
    return { stat, pct };
  }

  // Fold all perk lists into per-stat multipliers. General (no stat named)
  // perks apply to every stat; stat-specific ones only to that stat.
  function buildPerkMultipliers(perkData) {
    const mult = { strength: 1, speed: 1, dexterity: 1, defense: 1 };
    const lists = [
      perkData.faction_perks,
      perkData.property_perks,
      perkData.education_perks,
      perkData.enhancer_perks,
      perkData.book_perks,
      perkData.job_perks,
      perkData.merit_perks,
    ];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const line of list) {
        const p = parsePerk(line);
        if (!p) continue;
        if (p.stat) {
          mult[p.stat] *= 1 + p.pct;
        } else {
          for (const s of STATS) mult[s] *= 1 + p.pct;
        }
      }
    }
    return mult;
  }

  async function fetchAll() {
    if (!TORN_API_KEY) return;
    const data = await gmFetch(
      'https://api.torn.com/user/?selections=battlestats,bars,perks,gym&key=' + TORN_API_KEY
    );
    if (data.error) {
      throw new Error(data.error.error);
    }
    live.stats = {
      strength: data.strength || 0,
      speed: data.speed || 0,
      dexterity: data.dexterity || 0,
      defense: data.defense || 0,
    };
    if (data.happy) {
      live.happy = data.happy.current || 0;
      live.maxHappy = data.happy.maximum || 0;
    }
    if (data.energy) {
      live.energy = data.energy.current || 0;
      live.maxEnergy = data.energy.maximum || 0;
    }
    live.perks = buildPerkMultipliers(data);
    live.activeGymId = data.active_gym || null;
    live.loaded = true;
  }

  // ---------------------------------------------------------------------
  // Gain calculation
  // ---------------------------------------------------------------------

  // Single-train gain for one stat, given a happy value at the moment of
  // training. Returns the predicted gain (expected value, no randomness).
  // The formula clamps the stat at the 50m soft cap: above 50m the stat term
  // stops growing (Torn's recent change adds only marginal growth that matters
  // solely at multi-billion stats, and its exact form isn't public).
  const STAT_SOFT_CAP = 50000000;

  function singleTrainGain(stat, statTotal, happy, dots, energyPerTrain, perkMult) {
    if (dots <= 0) return 0;
    const s = Math.min(statTotal, STAT_SOFT_CAP);
    const base = dots * 4 * (FORMULA_A * s + FORMULA_B * happy + FORMULA_C);
    return (base * perkMult) / FORMULA_DIV * energyPerTrain;
  }

  // Simulate spending `energy` on one stat in one gym, train by train, letting
  // happy decay each train. Returns { totalGain, trains, endHappy }.
  function simulateBar(stat, gym, energy, startHappy, startStat, perkMult) {
    const ept = gym.energy;
    const dots = gym.dots[stat];
    if (dots <= 0 || ept <= 0) return { totalGain: 0, trains: 0, endHappy: startHappy };

    const trains = Math.floor(energy / ept);
    let happy = startHappy;
    let statTotal = startStat;
    let total = 0;
    const dH = Math.round(HAPPY_LOSS_FACTOR * ept);

    for (let i = 0; i < trains; i++) {
      const g = singleTrainGain(stat, statTotal, happy, dots, ept, perkMult);
      total += g;
      statTotal += g; // stat grows as you train, feeding back into the formula
      happy = Math.max(0, happy - dH);
    }
    return { totalGain: total, trains, endHappy: happy };
  }

  // ---------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------

  GM_addStyle(`
    #tgg-panel {
      position: fixed;
      top: 80px;
      right: 10px;
      width: 380px;
      max-width: calc(100vw - 20px);
      max-height: 80vh;
      overflow-y: auto;
      background: #1b1b1b;
      color: #f0f0f0;
      border: 1px solid #444;
      border-radius: 6px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.5);
    }
    #tgg-panel.tgg-collapsed .tgg-body { display: none; }
    #tgg-panel h3 {
      margin: 0; padding: 8px 10px; background: #2a2a2a;
      border-bottom: 1px solid #444; cursor: pointer;
      display: flex; justify-content: space-between; align-items: center;
      user-select: none;
    }
    #tgg-panel .tgg-body { padding: 8px 10px; }
    #tgg-panel table { width: 100%; border-collapse: collapse; }
    #tgg-panel th, #tgg-panel td {
      text-align: left; padding: 3px 4px; border-bottom: 1px solid #333;
      color: #f0f0f0;
    }
    #tgg-panel th { color: #c8c8c8; }
    #tgg-panel .tgg-num { text-align: right; }
    #tgg-panel input, #tgg-panel button, #tgg-panel select {
      font-size: 11px; padding: 2px 5px; margin: 2px 0;
    }
    #tgg-panel input, #tgg-panel select {
      background: #2b2b2b; color: #f0f0f0; border: 1px solid #555; border-radius: 3px;
    }
    #tgg-panel button {
      background: #3a3a3a; color: #f0f0f0; border: 1px solid #666; border-radius: 3px; cursor: pointer;
    }
    #tgg-panel button:hover { background: #4a4a4a; }
    #tgg-panel .tgg-toggle {
      cursor: pointer; background: none; border: none; color: #ccc; font-size: 14px;
    }
    #tgg-panel .tgg-status { color: #888; font-size: 11px; margin-bottom: 6px; }
    #tgg-panel .tgg-best { color: #9fe8b0; }
    #tgg-panel .tgg-settings { border-top: 1px solid #333; margin: 6px 0; padding-top: 6px; }
    #tgg-panel .tgg-settings.tgg-hidden { display: none; }
    #tgg-panel .tgg-hidden { display: none; }
    #tgg-panel .tgg-calc { border-top: 1px solid #333; padding-top: 6px; }
    #tgg-panel .tgg-calc input { width: auto; }
    #tgg-panel .tgg-live { font-size: 11px; color: #9fb8e8; margin-bottom: 6px; }
    @media (max-width: 784px) {
      #tgg-panel {
        top: auto; bottom: calc(64px + env(safe-area-inset-bottom, 0px));
        right: 0; left: 0; width: 100%; max-width: 100%; max-height: 50vh;
        border-radius: 6px 6px 0 0;
      }
      #tgg-panel input, #tgg-panel button, #tgg-panel select {
        font-size: 14px; padding: 6px 8px;
      }
      #tgg-panel select { width: 100% !important; box-sizing: border-box; }
    }
  `);

  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'tgg-panel';
    panel.innerHTML = `
      <h3>
        <span>Gym Gains Predictor</span>
        <span>
          <button class="tgg-toggle" id="tgg-gear" title="Settings">⚙</button>
          <button class="tgg-toggle" id="tgg-collapse">_</button>
        </span>
      </h3>
      <div class="tgg-body" id="tgg-body">
        <div class="tgg-status" id="tgg-status">Loading...</div>
        <div class="tgg-live" id="tgg-live"></div>

        <div class="tgg-settings tgg-hidden" id="tgg-settings">
          <div>
            API key:
            <input id="tgg-key" type="password" placeholder="Torn API key" style="width:150px"
                   autocomplete="off" value="${TORN_API_KEY}">
            <button id="tgg-key-show" type="button" title="Show/hide">👁</button>
            <button id="tgg-save-key">Save</button>
          </div>
          <div style="color:#888;margin-top:4px">
            Needs a key with battlestats, bars, perks and gym access.
          </div>
        </div>

        <div>
          Energy to spend:
          <input id="tgg-energy" type="number" min="0" style="width:70px" value="0">
          <button id="tgg-refresh">Refresh from API</button>
        </div>

        <div class="tgg-calc" id="tgg-calc" style="margin-top:8px">
          <label style="font-weight:bold">
            <input type="checkbox" id="tgg-calc-on"${calc.on ? ' checked' : ''}>
            What-if calculator
          </label>
          <div id="tgg-calc-fields" class="${calc.on ? '' : 'tgg-hidden'}" style="margin-top:4px">
            <div style="color:#888;margin-bottom:4px">
              Override the live values to model a scenario. Blank means use live.
            </div>
            <div>
              Energy:
              <input id="tgg-calc-energy" type="number" min="0" style="width:70px"
                     placeholder="live" value="${calc.energy != null ? calc.energy : ''}">
            </div>
            <div>
              Happy:
              <input id="tgg-calc-happy" type="number" min="0" style="width:80px"
                     placeholder="live" value="${calc.happy != null ? calc.happy : ''}">
            </div>
            <div>
              Total perk %:
              <input id="tgg-calc-perk" type="number" step="0.1" style="width:60px"
                     placeholder="live" value="${calc.perkPct != null ? calc.perkPct : ''}">
              <span style="color:#888">e.g. 16 for +16% gym gains</span>
            </div>
          </div>
        </div>

        <div style="margin-top:8px">
          <strong>Your gym</strong>
          <select id="tgg-gym">
            ${GYMS.map(
              (g) =>
                `<option value="${g.id}"${g.id === selectedGymId ? ' selected' : ''}>${g.name} (${g.energy}e)</option>`
            ).join('')}
          </select>
          <table style="margin-top:4px">
            <thead><tr><th>Stat</th><th class="tgg-num">Per train</th><th class="tgg-num">Full bar</th></tr></thead>
            <tbody id="tgg-selected"></tbody>
          </table>
        </div>

        <div style="margin-top:10px">
          <strong>Best gym per stat</strong> <span style="color:#888">(for your stats)</span>
          <table style="margin-top:4px">
            <thead><tr><th>Stat</th><th>Best gym</th><th class="tgg-num">Full bar</th></tr></thead>
            <tbody id="tgg-best"></tbody>
          </table>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    const isNarrow = window.matchMedia('(max-width: 784px)').matches;
    if (isNarrow) panel.classList.add('tgg-collapsed');
    if (!isNarrow) document.getElementById('tgg-settings').classList.remove('tgg-hidden');
    document.getElementById('tgg-collapse').textContent = isNarrow ? '+' : '_';

    panel.querySelector('h3').addEventListener('click', () => {
      panel.classList.toggle('tgg-collapsed');
      const c = panel.classList.contains('tgg-collapsed');
      document.getElementById('tgg-collapse').textContent = c ? '+' : '_';
    });

    document.getElementById('tgg-gear').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('tgg-settings').classList.toggle('tgg-hidden');
    });

    document.getElementById('tgg-save-key').addEventListener('click', () => {
      GM_setValue('gymApiKey', document.getElementById('tgg-key').value.trim());
      location.reload();
    });
    document.getElementById('tgg-key-show').addEventListener('click', () => {
      const i = document.getElementById('tgg-key');
      i.type = i.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('tgg-gym').addEventListener('change', (e) => {
      selectedGymId = parseInt(e.target.value, 10);
      GM_setValue('selectedGymId', selectedGymId);
      render();
    });

    document.getElementById('tgg-energy').addEventListener('input', render);
    document.getElementById('tgg-refresh').addEventListener('click', refresh);

    // Calculator: toggle on/off, and read the three override fields. A blank
    // field stores null so render falls back to the live value for it.
    document.getElementById('tgg-calc-on').addEventListener('change', (e) => {
      calc.on = e.target.checked;
      GM_setValue('calcOn', calc.on);
      document
        .getElementById('tgg-calc-fields')
        .classList.toggle('tgg-hidden', !calc.on);
      render();
    });

    const readCalcField = (id, key, storeKey) => {
      const raw = document.getElementById(id).value.trim();
      calc[key] = raw === '' ? null : parseFloat(raw);
      GM_setValue(storeKey, calc[key]);
      render();
    };
    document
      .getElementById('tgg-calc-energy')
      .addEventListener('input', () => readCalcField('tgg-calc-energy', 'energy', 'calcEnergy'));
    document
      .getElementById('tgg-calc-happy')
      .addEventListener('input', () => readCalcField('tgg-calc-happy', 'happy', 'calcHappy'));
    document
      .getElementById('tgg-calc-perk')
      .addEventListener('input', () => readCalcField('tgg-calc-perk', 'perkPct', 'calcPerkPct'));
  }

  function fmt(n) {
    if (!isFinite(n) || n <= 0) return '0';
    if (n >= 1000) return Math.round(n).toLocaleString();
    return n.toFixed(2);
  }

  function render() {
    if (!live.loaded) return;
    const energy = effectiveEnergy();
    const happy = effectiveHappy();
    const gym = GYMS.find((g) => g.id === selectedGymId);

    // Selected gym table: per-train (at the effective happy) and full-bar sim.
    const selBody = document.getElementById('tgg-selected');
    selBody.innerHTML = STATS.map((stat) => {
      const pm = effectivePerk(stat);
      const per = singleTrainGain(
        stat,
        live.stats[stat],
        happy,
        gym.dots[stat],
        gym.energy,
        pm
      );
      const sim = simulateBar(stat, gym, energy, happy, live.stats[stat], pm);
      return `<tr>
        <td>${STAT_LABEL[stat]}</td>
        <td class="tgg-num">${fmt(per)}</td>
        <td class="tgg-num">${fmt(sim.totalGain)}</td>
      </tr>`;
    }).join('');

    // Best gym per stat by full-bar gain.
    const bestBody = document.getElementById('tgg-best');
    bestBody.innerHTML = STATS.map((stat) => {
      const pm = effectivePerk(stat);
      let best = null;
      for (const g of GYMS) {
        if (g.dots[stat] <= 0) continue;
        const sim = simulateBar(stat, g, energy, happy, live.stats[stat], pm);
        if (!best || sim.totalGain > best.gain) {
          best = { name: g.name, gain: sim.totalGain };
        }
      }
      if (!best) return '';
      const isSelected = gym.dots[stat] > 0 && best.name === gym.name;
      return `<tr>
        <td>${STAT_LABEL[stat]}</td>
        <td class="${isSelected ? 'tgg-best' : ''}">${best.name}</td>
        <td class="tgg-num">${fmt(best.gain)}</td>
      </tr>`;
    }).join('');

    const liveEl = document.getElementById('tgg-live');
    const overCap = STATS.some((s) => live.stats[s] > STAT_SOFT_CAP);
    const usingCalc = calc.on;
    liveEl.innerHTML =
      `Happy ${happy.toLocaleString()}` +
      (usingCalc ? '' : `/${live.maxHappy.toLocaleString()}`) +
      ` · Energy ${live.energy}/${live.maxEnergy} · simulating ${energy}e` +
      (usingCalc ? ` · <span style="color:#e0a060">calc mode</span>` : '') +
      (overCap
        ? `<div style="color:#e0a060;margin-top:3px">A stat is above the 50m soft cap. Predictions under-read above 50m because Torn's post-cap growth isn't public. Treat high-stat numbers as a floor.</div>`
        : '');
  }

  async function refresh() {
    const status = document.getElementById('tgg-status');
    if (!TORN_API_KEY) {
      if (status) status.textContent = 'Add a Torn API key in settings to begin.';
      return;
    }
    try {
      if (status) status.textContent = 'Fetching...';
      await fetchAll();
      // Default the energy field to a full bar on first load if still 0.
      const eInput = document.getElementById('tgg-energy');
      if (eInput && (!eInput.value || eInput.value === '0')) {
        eInput.value = live.maxEnergy || live.energy || 0;
      }
      // Default selected gym to the one you're actually in, if known.
      if (live.activeGymId && GYMS.some((g) => g.id === live.activeGymId)) {
        selectedGymId = live.activeGymId;
        const sel = document.getElementById('tgg-gym');
        if (sel) sel.value = String(selectedGymId);
      }
      if (status) status.textContent = 'Updated ' + new Date().toLocaleTimeString();
      render();
    } catch (err) {
      if (status) status.textContent = 'Error: ' + err.message;
    }
  }

  // ---------------------------------------------------------------------
  // Injection (gym page only, PDA-safe)
  // ---------------------------------------------------------------------

  function onGymPage() {
    return /[?&#]sid=gym\b/.test(location.href);
  }

  function ensurePanel() {
    if (!onGymPage()) return;
    if (!document.body) return;
    if (document.getElementById('tgg-panel')) return;
    buildPanel();
    refresh();
  }

  function init() {
    ensurePanel();
    const start = () => {
      const target = document.body || document.documentElement;
      if (!target) {
        setTimeout(start, 200);
        return;
      }
      const obs = new MutationObserver(() => {
        if (onGymPage()) ensurePanel();
        else {
          const stale = document.getElementById('tgg-panel');
          if (stale) stale.remove();
        }
      });
      obs.observe(target, { childList: true, subtree: true });
    };
    start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
