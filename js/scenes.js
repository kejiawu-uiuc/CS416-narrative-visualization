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
    { key: "wave2", label: "Second wave",       centerMonth: "2020-07", start: "2020-06-15", end: "2020-08-31" },
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
      title: "Five Waves of COVID Cases",
      subtitle: "From 2020 to 2023, the U.S. had five big waves of COVID cases. Each wave hit at a different time and was caused by a different variant or season.",
      narrative: `
        <h2>What the chart shows</h2>
        <p>This is the number of new COVID cases each day in the United States,
        smoothed with a 7-day average so the shape is easier to see.</p>
        <p>You can spot five clear peaks. The <strong>First wave</strong>
        in spring 2020 looks small here, but at the time it filled hospitals
        in New York and New Jersey.</p>
        <p>Each wave was bigger than the one before.
        The tallest, <strong>Omicron variant</strong>, had about ten times more
        daily cases than the first wave.</p>
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
      title: "But Deaths Look Different",
      subtitle: "The waves came at the same times, but their sizes don't match. The winter of 2020–21 was the deadliest — not Omicron.",
      narrative: `
        <h2>Same waves, different sizes</h2>
        <p>This chart shows new deaths per day in the U.S.
        The waves come at the same times as the case waves, but the
        tallest peak is not the same one.</p>
        <p>The <strong>Winter surge (2020-21)</strong> is the tallest here,
        with about 3,400 deaths a day. Vaccines had just started to roll out.</p>
        <p>Omicron had the most cases by far, but it caused
        fewer deaths than the winter wave.</p>
        <p>The next scene puts both curves on the same chart to make the
        gap easy to see.</p>
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
      label: "Omicron: most cases ever",
      sublabel: "Cases hit an all-time high",
      dx: -180, dy: 25,
    });
    if (omicronDeaths) annotations.push({
      date: omicronDeaths.date,
      value: omicronDeaths.value,
      seriesKey: "deaths",
      label: "…but fewer deaths",
      sublabel: "Vaccines and a milder variant",
      dx: 25, dy: 40,
    });
    if (winterDeaths) annotations.push({
      date: winterDeaths.date,
      value: winterDeaths.value,
      seriesKey: "deaths",
      label: "Deadliest wave",
      sublabel: "Before vaccines were widely available",
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
      title: "Cases and Deaths Split Apart",
      subtitle: "Each line is scaled so its own highest point is 100%. If cases and deaths moved together, the two lines would match.",
      narrative: `
        <h2>Why the two lines don't match</h2>
        <p>To compare the <em>shape</em> of the two curves, we scale each one
        so its highest point is 100%. Now the peaks are the same height and
        we can look at the timing.</p>
        <p>During the <strong>Winter surge (2020-21)</strong>, deaths hit 100%,
        but cases only reached about 30% of their later peak.</p>
        <p>At the <strong>Omicron variant peak</strong>, it's the opposite: cases hit
        100%, but deaths only reach about 75%. Thanks to
        vaccines, past infections, and a
        milder variant, far fewer people died.</p>
        <p>In the next scene, you can look at your own state.</p>
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
      subtitle: `The labels sit on each peak in ${app.selectedState}. Use the controls below to pick a different state or switch between cases and deaths.`,
      narrative: `
        <h2>Your turn to explore</h2>
        <p>Every state had its own pandemic. Pick a state from the dropdown
        to see how <strong>${app.selectedState}</strong> compares to the
        national story.</p>
        <br>
        <p>Switch between New cases and
        New deaths to see how they compare in your state.</p>
        <p style="color:#888;font-style:italic">Hover over the chart to see the number for any day.</p>
      `,
    };
  }

  return { scene1, scene2, scene3, scene4 };
})();
