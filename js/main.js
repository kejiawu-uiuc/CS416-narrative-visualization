/* main.js — orchestration: parameters, triggers, scene switching.
 *
 * Parameters (the state of the narrative visualization):
 *   currentScene: 0..3      which scene is active
 *   selectedState: string    which state to show in scene 4
 *   metric: "cases"|"deaths" which measure to show in scene 4
 *
 * Triggers (UI actions that mutate parameters and re-render):
 *   - Prev / Next buttons     -> currentScene
 *   - Scene dots               -> currentScene
 *   - State dropdown           -> selectedState (scene 4)
 *   - Metric toggle            -> metric (scene 4)
 *
 * The visualization re-renders any time a parameter changes.
 */

const APP = {
  currentScene: 0,
  selectedState: "United States",
  metric: "cases",
  nationalCases: [],
  nationalDeaths: [],
  byState: new Map(),   // state -> { cases: [], deaths: [] }
  stateList: [],
};

const SCENE_FNS = [
  (app) => SCENES.scene1(app),
  (app) => SCENES.scene2(app),
  (app) => SCENES.scene3(app),
  (app) => SCENES.scene4(app),
];
const SCENE_COUNT = SCENE_FNS.length;

// ---------- Data loading & preprocessing ----------

/**
 * Convert cumulative daily totals into daily new counts with a 7-day rolling avg.
 *
 * Input : sorted array of { date, cases, deaths }
 * Output: { cases: [{date, value}], deaths: [{date, value}] }
 */
function toDailyRolling(rows) {
  rows.sort((a, b) => a.date - b.date);
  const rawCases = [];
  const rawDeaths = [];
  for (let i = 0; i < rows.length; i++) {
    const prev = i === 0 ? { cases: 0, deaths: 0 } : rows[i - 1];
    rawCases.push({ date: rows[i].date, value: Math.max(0, rows[i].cases - prev.cases) });
    rawDeaths.push({ date: rows[i].date, value: Math.max(0, rows[i].deaths - prev.deaths) });
  }
  return {
    cases: rollingAvg(rawCases, 7),
    deaths: rollingAvg(rawDeaths, 7),
  };
}

function rollingAvg(arr, window) {
  const out = [];
  let sum = 0;
  const q = [];
  for (const d of arr) {
    q.push(d.value);
    sum += d.value;
    if (q.length > window) sum -= q.shift();
    out.push({ date: d.date, value: sum / q.length });
  }
  return out;
}

const parseDate = d3.timeParse("%Y-%m-%d");

async function loadData() {
  const [natRaw, stateRaw] = await Promise.all([
    d3.csv("data/us.csv", d => ({
      date: parseDate(d.date),
      cases: +d.cases,
      deaths: +d.deaths,
    })),
    d3.csv("data/us-states.csv", d => ({
      date: parseDate(d.date),
      state: d.state,
      cases: +d.cases,
      deaths: +d.deaths,
    })),
  ]);

  const nat = toDailyRolling(natRaw);
  APP.nationalCases = nat.cases;
  APP.nationalDeaths = nat.deaths;

  const byState = d3.group(stateRaw, d => d.state);
  const stateMap = new Map();
  for (const [state, rows] of byState) {
    stateMap.set(state, toDailyRolling(rows));
  }
  // Also add the national aggregate under "United States" for the dropdown.
  stateMap.set("United States", nat);
  APP.byState = stateMap;

  // Sort with "United States" first, then alphabetical.
  const states = Array.from(stateMap.keys()).filter(s => s !== "United States").sort();
  APP.stateList = ["United States", ...states];
}

// ---------- Rendering ----------

function render() {
  const sceneFn = SCENE_FNS[APP.currentScene];
  const meta = sceneFn(APP);

  document.getElementById("scene-title").textContent = meta.title;
  document.getElementById("scene-subtitle").textContent = meta.subtitle;
  document.getElementById("narrative").innerHTML = meta.narrative;
  document.getElementById("scene-counter").textContent =
    `Scene ${APP.currentScene + 1} of ${SCENE_COUNT}`;

  // Update dot indicators
  document.querySelectorAll("#scene-dots button").forEach((btn, i) => {
    btn.classList.toggle("active", i === APP.currentScene);
  });

  // Prev / Next enabled state
  document.getElementById("prev-btn").disabled = APP.currentScene === 0;
  document.getElementById("next-btn").disabled = APP.currentScene === SCENE_COUNT - 1;

  // Controls only visible on scene 4
  const showControls = APP.currentScene === SCENE_COUNT - 1;
  document.getElementById("scene-controls").hidden = !showControls;
}

// ---------- Triggers ----------

function setScene(i) {
  APP.currentScene = Math.max(0, Math.min(SCENE_COUNT - 1, i));
  render();
}

function setupTriggers() {
  document.getElementById("prev-btn").addEventListener("click",
    () => setScene(APP.currentScene - 1));
  document.getElementById("next-btn").addEventListener("click",
    () => setScene(APP.currentScene + 1));

  // Scene dots
  const dots = document.getElementById("scene-dots");
  for (let i = 0; i < SCENE_COUNT; i++) {
    const b = document.createElement("button");
    b.setAttribute("aria-label", `Go to scene ${i + 1}`);
    b.addEventListener("click", () => setScene(i));
    dots.appendChild(b);
  }

  // State dropdown
  const sel = document.getElementById("state-select");
  APP.stateList.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });
  sel.value = APP.selectedState;
  sel.addEventListener("change", () => {
    APP.selectedState = sel.value;
    render();
  });

  // Metric toggle
  document.querySelectorAll("#metric-toggle button").forEach(btn => {
    btn.addEventListener("click", () => {
      APP.metric = btn.dataset.value;
      document.querySelectorAll("#metric-toggle button").forEach(b => {
        const active = b.dataset.value === APP.metric;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", active ? "true" : "false");
      });
      render();
    });
  });

  // Keyboard nav
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") setScene(APP.currentScene + 1);
    else if (e.key === "ArrowLeft") setScene(APP.currentScene - 1);
  });

  // Re-render on resize (chart is responsive)
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });
}

// ---------- Bootstrap ----------

(async function init() {
  document.getElementById("scene-title").textContent = "Loading COVID-19 data…";
  document.getElementById("scene-subtitle").textContent = "";
  try {
    await loadData();
    setupTriggers();
    render();
  } catch (err) {
    console.error(err);
    document.getElementById("scene-title").textContent = "Failed to load data";
    document.getElementById("scene-subtitle").textContent = err.message;
  }
})();
