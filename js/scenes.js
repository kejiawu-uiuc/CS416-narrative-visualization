/* scenes.js — defines the four scenes of the narrative.
 *
 * Each scene function receives the shared APP state and prepares:
 *   - series data
 *   - annotations (dates + labels for key wave peaks)
 *   - narrative text (rendered in the sidebar)
 *   - title / subtitle
 * Then hands off to CHART.renderChart() for consistent rendering.
 */

const SCENES = (() => {

  // Approximate wave centers used to search for local peaks in the data.
  // We don't hardcode the peak value — we find the max within each window.
  const CASE_WAVE_WINDOWS = [
    { key: "wave1", label: "First wave",        centerMonth: "2020-04", start: "2020-03-15", end: "2020-05-15" },
    { key: "wave2", label: "Sun Belt summer",   centerMonth: "2020-07", start: "2020-06-15", end: "2020-08-31" },
    { key: "wave3", label: "Winter surge",      centerMonth: "2021-01", start: "2020-11-01", end: "2021-02-15" },
    { key: "wave4", label: "Delta variant",     centerMonth: "2021-09", start: "2021-07-01", end: "2021-10-31" },
    { key: "wave5", label: "Omicron variant",   centerMonth: "2022-01", start: "2021-12-01", end: "2022-03-01" },
  ];

  const DEATH_WAVE_WINDOWS = [
    { key: "wave1", label: "First wave",       start: "2020-03-15", end: "2020-05-15" },
    { key: "wave3", label: "Winter surge",     start: "2020-11-01", end: "2021-02-28" },
    { key: "wave4", label: "Delta variant",    start: "2021-07-15", end: "2021-11-15" },
    { key: "wave5", label: "Omicron variant",  start: "2021-12-15", end: "2022-03-15" },
  ];

  function findPeakInWindow(data, startISO, endISO) {
    const s = new Date(startISO), e = new Date(endISO);
    let peak = null;
    for (const d of data) {
      if (d.date >= s && d.date <= e) {
        if (!peak || d.value > peak.value) peak = d;
      }
    }
    return peak;
  }

  function buildWaveAnnotations(data, windows, seriesKey, labelOffsets) {
    return windows.map(w => {
      const peak = findPeakInWindow(data, w.start, w.end);
      if (!peak) return null;
      const off = labelOffsets[w.key] || { dx: 0, dy: -50 };
      return {
        date: peak.date,
        value: peak.value,
        seriesKey,
        label: w.label,
        sublabel: `${d3.timeFormat("%b %Y")(peak.date)} • ${d3.format(",")(Math.round(peak.value))}/day`,
        dx: off.dx,
        dy: off.dy,
      };
    }).filter(Boolean);
  }

  // ---------- Scene 1: cases ----------
  function scene1(app) {
    const data = app.nationalCases;
    const annotations = buildWaveAnnotations(data, CASE_WAVE_WINDOWS, "cases", {
      wave1: { dx: 70,  dy: -30 },
      wave2: { dx: 20,  dy: -70 },
      wave3: { dx: -100, dy: -70 },
      wave4: { dx: 30,  dy: -55 },
      wave5: { dx: -130, dy: -20 },
    });

    CHART.renderChart({
      series: [{ key: "cases", label: "New cases (7-day avg)", color: "#b03a2e", data }],
      annotations,
      yLabel: "New cases per day (7-day average)",
      showLegend: false,
    });

    return {
      title: "The Waves of the Pandemic — Cases",
      subtitle: "From 2020 through 2023, the U.S. experienced five distinct waves of COVID-19 infections. Each was driven by a different variant, region, or season.",
      narrative: `
        <h2>What you're seeing</h2>
        <p>This is the daily count of new COVID-19 cases in the United States,
        smoothed with a 7-day rolling average.</p>
        <p>Five clear peaks stand out. The <strong>first wave</strong> in spring 2020
        looks small on this chart, but at the time it overwhelmed hospitals in
        New York and New Jersey.</p>
        <p>Notice how each successive wave is <strong>larger than the last</strong>,
        culminating in <strong>Omicron</strong> — the tallest peak — which reported
        roughly ten times more daily cases than the first wave.</p>
        <p style="color:#888;font-style:italic">Hover over the chart to see exact values for any day.</p>
      `,
    };
  }

  // ---------- Scene 2: deaths ----------
  function scene2(app) {
    const data = app.nationalDeaths;
    const annotations = buildWaveAnnotations(data, DEATH_WAVE_WINDOWS, "deaths", {
      wave1: { dx: 80,   dy: -20 },
      wave3: { dx: -110, dy: -30 },
      wave4: { dx: 20,   dy: -60 },
      wave5: { dx: 40,   dy: -50 },
    });

    CHART.renderChart({
      series: [{ key: "deaths", label: "New deaths (7-day avg)", color: "#2c3e50", data }],
      annotations,
      yLabel: "New deaths per day (7-day average)",
      showLegend: false,
    });

    return {
      title: "But Deaths Tell a Different Story",
      subtitle: "The same five waves — but their heights don't match. The winter of 2020–21 was the deadliest, not the Omicron surge.",
      narrative: `
        <h2>Same waves, different heights</h2>
        <p>Now we're plotting <strong>new deaths per day</strong> on the same timeline.
        The shape looks similar — five peaks — but the <em>proportions</em> are different.</p>
        <p>The <strong>winter 2020–21 surge</strong> is the tallest here, peaking at
        roughly 3,400 deaths a day. That's when vaccines were just beginning to roll out.</p>
        <p>Omicron, which produced the largest case wave by far, produced a
        <strong>smaller death wave</strong> than the winter surge.</p>
        <p>The next scene lays these two curves side by side to make the
        divergence unmistakable.</p>
      `,
    };
  }

  // ---------- Scene 3: decoupling ----------
  function scene3(app) {
    const cases = app.nationalCases;
    const deaths = app.nationalDeaths;

    const annotations = [];
    // Highlight two key moments where the two curves diverge.
    const omicronCases = findPeakInWindow(cases, "2021-12-01", "2022-03-01");
    const omicronDeaths = findPeakInWindow(deaths, "2021-12-15", "2022-03-15");
    const winterDeaths = findPeakInWindow(deaths, "2020-11-01", "2021-02-28");

    if (omicronCases) annotations.push({
      date: omicronCases.date,
      value: omicronCases.value,
      seriesKey: "cases",
      label: "Omicron: record cases",
      sublabel: "Cases spiked to an all-time high",
      dx: -180, dy: 25,
    });
    if (omicronDeaths) annotations.push({
      date: omicronDeaths.date,
      value: omicronDeaths.value,
      seriesKey: "deaths",
      label: "…but fewer deaths",
      sublabel: "Vaccines + milder variant",
      dx: 25, dy: 40,
    });
    if (winterDeaths) annotations.push({
      date: winterDeaths.date,
      value: winterDeaths.value,
      seriesKey: "deaths",
      label: "Deadliest wave",
      sublabel: "Pre-vaccine winter surge",
      dx: 30, dy: 25,
    });

    CHART.renderChart({
      series: [
        { key: "cases",  label: "New cases",  color: "#b03a2e", data: cases },
        { key: "deaths", label: "New deaths", color: "#2c3e50", data: deaths },
      ],
      annotations,
      yLabel: "Share of each series' peak (normalized 0–100%)",
      showLegend: true,
      normalize: true,
    });

    return {
      title: "The Decoupling of Cases and Deaths",
      subtitle: "Each curve is normalized to its own peak so their shapes can be compared directly. If cases and deaths moved together, the curves would overlap.",
      narrative: `
        <h2>Cases and deaths pulled apart</h2>
        <p>To see the divergence, we normalize each series so its highest point
        equals 100%. That lets us compare the <em>shape</em> of the curves
        without one dwarfing the other.</p>
        <p>Notice: the <strong>winter 2020–21 death peak</strong> reaches 100%,
        but the case peak at that time is only around 30% of its eventual maximum.</p>
        <p>Conversely, at the <strong>Omicron case peak</strong>, deaths only reach
        about 75% of their own peak — a striking decoupling made possible by
        <strong>vaccines</strong>, <strong>prior infection</strong>, and the
        <strong>milder Omicron variant</strong>.</p>
        <p>In the next scene, you can explore this story in your own state.</p>
      `,
    };
  }

  // ---------- Scene 4: state explorer ----------
  function scene4(app) {
    const stateData = app.byState.get(app.selectedState);
    const rawData = stateData ? stateData[app.metric] : [];
    const seriesKey = app.metric;
    const color = app.metric === "cases" ? "#b03a2e" : "#2c3e50";
    const label = app.metric === "cases" ? "New cases (7-day avg)" : "New deaths (7-day avg)";
    const yLabel = app.metric === "cases"
      ? "New cases per day (7-day average)"
      : "New deaths per day (7-day average)";

    // Build state-specific annotations by finding local peaks in that state's data.
    const windows = app.metric === "cases" ? CASE_WAVE_WINDOWS : DEATH_WAVE_WINDOWS;
    // Stagger vertical offsets aggressively so labels don't collide when a
    // state has several small peaks close together (e.g. New York's cases).
    const offsetMap = app.metric === "cases"
      ? { wave1: { dx: 30,   dy: -50 },
          wave2: { dx: 50,   dy: -100 },
          wave3: { dx: -100, dy: -60 },
          wave4: { dx: 30,   dy: -45 },
          wave5: { dx: -140, dy: -20 } }
      : { wave1: { dx: 60,   dy: -30 },
          wave3: { dx: -110, dy: -30 },
          wave4: { dx: 30,   dy: -70 },
          wave5: { dx: 40,   dy: -45 } };
    const annotations = buildWaveAnnotations(rawData, windows, seriesKey, offsetMap);

    CHART.renderChart({
      series: [{ key: seriesKey, label, color, data: rawData }],
      annotations,
      yLabel,
      showLegend: false,
    });

    return {
      title: `Explore: ${app.selectedState}`,
      subtitle: `The wave labels are placed at each local peak in ${app.selectedState}'s data. Use the controls to switch between cases, deaths, or a different state.`,
      narrative: `
        <h2>Your turn to explore</h2>
        <p>Every state had its own version of the pandemic. Use the dropdown
        below the chart to see how <strong>${app.selectedState}</strong>'s
        timeline compares to the national story.</p>
        <p>Some states — like the <strong>Dakotas</strong> — were hit hardest by the
        <strong>fall 2020</strong> wave. Others, like the <strong>Northeast</strong>,
        had a devastating first wave that never returned to the same scale.</p>
        <p>Toggle <strong>New cases</strong> and <strong>New deaths</strong> to see
        the decoupling in your own state.</p>
        <p style="color:#888;font-style:italic">Hover over the chart for exact daily values.</p>
      `,
    };
  }

  return { scene1, scene2, scene3, scene4 };
})();
