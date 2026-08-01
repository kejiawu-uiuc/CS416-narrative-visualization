/* chart.js — shared visualization template used by every scene.
 *
 * This module defines a single renderChart() function that all four scenes
 * call, guaranteeing identical margins, scales, axis styling, and annotation
 * placement rules from scene to scene. Only the data, y-domain, series set,
 * annotations, and titles differ between scenes.
 */

const CHART = (() => {
  const MARGIN = { top: 30, right: 40, bottom: 50, left: 70 };

  /**
   * Render (or re-render) the main chart into #chart.
   *
   * @param {Object}  cfg
   * @param {Array}   cfg.series      Array of { key, label, color, data: [{date, value}] }.
   * @param {Array}   cfg.annotations Array of { date, value, seriesKey, label, sublabel, dx, dy }.
   * @param {String}  cfg.yLabel      Y-axis label.
   * @param {Boolean} cfg.showLegend  Whether to draw a legend (used when >1 series).
   * @param {Boolean} cfg.normalize   If true, normalize each series to its own max (0–1 scale).
   * @param {Function} cfg.tooltipFmt Function(d, seriesKey) => HTML string for tooltip.
   */
  function renderChart(cfg) {
    const svgEl = document.getElementById("chart");
    const rect = svgEl.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // --- Scales ---
    const allDates = cfg.series.flatMap(s => s.data.map(d => d.date));
    const xDomain = d3.extent(allDates);

    const x = d3.scaleTime().domain(xDomain).range([0, innerW]);

    let yMax;
    if (cfg.normalize) {
      // Each series will be scaled independently; the plotting y-domain is 0..1.
      yMax = 1;
    } else {
      yMax = d3.max(cfg.series.flatMap(s => s.data.map(d => d.value)));
    }
    const y = d3.scaleLinear().domain([0, yMax * 1.08]).range([innerH, 0]).nice();

    // --- Gridlines ---
    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(y).tickSize(-innerW).tickFormat(""));

    // --- Axes ---
    const xAxis = d3.axisBottom(x)
      .ticks(d3.timeMonth.every(3))
      .tickFormat(d3.timeFormat("%b %Y"));
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(xAxis)
      .selectAll("text")
        .attr("transform", "rotate(-25)")
        .style("text-anchor", "end");

    const yFmt = cfg.normalize
      ? d3.format(".0%")
      : (v => d3.format(",")(Math.round(v)));
    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(6).tickFormat(yFmt));

    // Y-axis label
    g.append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -50)
      .attr("text-anchor", "middle")
      .text(cfg.yLabel);

    // --- Draw each series ---
    const yFor = (s, v) => cfg.normalize ? y(v / s._max) : y(v);

    cfg.series.forEach(s => {
      s._max = d3.max(s.data, d => d.value) || 1;

      const area = d3.area()
        .x(d => x(d.date))
        .y0(innerH)
        .y1(d => yFor(s, d.value))
        .curve(d3.curveMonotoneX);

      const line = d3.line()
        .x(d => x(d.date))
        .y(d => yFor(s, d.value))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(s.data)
        .attr("class", `series-area ${s.key}`)
        .attr("fill", s.color)
        .attr("d", area);

      g.append("path")
        .datum(s.data)
        .attr("class", `series-line ${s.key}`)
        .attr("stroke", s.color)
        .attr("d", line);
    });

    // --- Legend ---
    if (cfg.showLegend) {
      const legend = g.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${innerW - 180}, 4)`);
      cfg.series.forEach((s, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
        row.append("rect")
          .attr("width", 14).attr("height", 3)
          .attr("y", 6)
          .attr("fill", s.color);
        row.append("text")
          .attr("x", 22).attr("y", 10)
          .text(s.label);
      });
    }

    // --- Annotations (visual template: dashed line, dot, label box) ---
    const annGroup = g.append("g").attr("class", "annotations");

    (cfg.annotations || []).forEach(a => {
      const series = cfg.series.find(s => s.key === a.seriesKey) || cfg.series[0];
      const point = series.data.find(d => +d.date === +a.date)
                 || nearestPoint(series.data, a.date);
      if (!point) return;

      const px = x(point.date);
      const py = yFor(series, point.value);

      const dx = a.dx != null ? a.dx : 0;
      const dy = a.dy != null ? a.dy : -60;

      // Connector line
      annGroup.append("line")
        .attr("class", "annotation-line")
        .attr("x1", px).attr("y1", py)
        .attr("x2", px + dx).attr("y2", py + dy);

      // Point dot
      annGroup.append("circle")
        .attr("class", "annotation-dot")
        .attr("cx", px).attr("cy", py)
        .attr("r", 4);

      // Label box
      const labelG = annGroup.append("g")
        .attr("transform", `translate(${px + dx}, ${py + dy})`);

      const labelText = labelG.append("text")
        .attr("class", "annotation-label")
        .attr("text-anchor", a.dx < 0 ? "end" : "start")
        .attr("x", a.dx < 0 ? -6 : 6)
        .attr("y", 0)
        .text(a.label);

      const subText = labelG.append("text")
        .attr("class", "annotation-sublabel")
        .attr("text-anchor", a.dx < 0 ? "end" : "start")
        .attr("x", a.dx < 0 ? -6 : 6)
        .attr("y", 14)
        .text(a.sublabel || "");

      // Insert background rect sized to text bbox
      const bbox1 = labelText.node().getBBox();
      const bbox2 = subText.node().getBBox();
      const padX = 6, padY = 4;
      const bx = Math.min(bbox1.x, bbox2.x) - padX;
      const by = Math.min(bbox1.y, bbox2.y) - padY;
      const bw = Math.max(bbox1.width, bbox2.width) + padX * 2;
      const bh = (bbox2.y + bbox2.height) - Math.min(bbox1.y, bbox2.y) + padY * 2;

      labelG.insert("rect", "text")
        .attr("class", "annotation-bg")
        .attr("x", bx).attr("y", by)
        .attr("width", bw).attr("height", bh);
    });

    // --- Hover tooltip (free-form interaction) ---
    setupHover(g, cfg, x, y, yFor, innerW, innerH);
  }

  function nearestPoint(data, targetDate) {
    const t = +targetDate;
    let best = null, bestDiff = Infinity;
    for (const d of data) {
      const diff = Math.abs(+d.date - t);
      if (diff < bestDiff) { bestDiff = diff; best = d; }
    }
    return best;
  }

  function setupHover(g, cfg, x, y, yFor, innerW, innerH) {
    const tooltip = document.getElementById("tooltip");
    const hoverLine = g.append("line")
      .attr("class", "hover-line")
      .attr("y1", 0).attr("y2", innerH)
      .style("opacity", 0);

    const hoverDots = cfg.series.map(s => g.append("circle")
      .attr("class", "hover-dot")
      .style("fill", s.color)
      .attr("r", 4)
      .style("opacity", 0));

    const bisect = d3.bisector(d => d.date).left;
    const primary = cfg.series[0];

    g.append("rect")
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .on("mouseleave", () => {
        hoverLine.style("opacity", 0);
        hoverDots.forEach(d => d.style("opacity", 0));
        tooltip.hidden = true;
      })
      .on("mousemove", function (event) {
        const [mx] = d3.pointer(event, this);
        const date = x.invert(mx);
        const idx = bisect(primary.data, date);
        const d0 = primary.data[Math.max(0, idx - 1)];
        const d1 = primary.data[Math.min(primary.data.length - 1, idx)];
        const target = !d0 ? d1 : !d1 ? d0
          : (date - d0.date > d1.date - date ? d1 : d0);
        if (!target) return;

        const tx = x(target.date);
        hoverLine.attr("x1", tx).attr("x2", tx).style("opacity", 1);

        // Build tooltip content across all series
        const dateStr = d3.timeFormat("%b %-d, %Y")(target.date);
        let html = `<div class="tt-date">${dateStr}</div>`;
        cfg.series.forEach((s, i) => {
          const match = s.data.find(d => +d.date === +target.date);
          if (match) {
            hoverDots[i]
              .attr("cx", x(match.date))
              .attr("cy", yFor(s, match.value))
              .style("opacity", 1);
            const val = d3.format(",")(Math.round(match.value));
            html += `<div class="tt-metric" style="color:${s.color}">
                      ${s.label}: ${val}
                    </div>`;
          } else {
            hoverDots[i].style("opacity", 0);
          }
        });

        tooltip.innerHTML = html;
        tooltip.hidden = false;

        // Position tooltip relative to chart-wrap
        const chartWrap = document.querySelector(".chart-wrap");
        const wrapRect = chartWrap.getBoundingClientRect();
        const svgRect = document.getElementById("chart").getBoundingClientRect();
        const offsetX = (svgRect.left - wrapRect.left) + MARGIN.left + tx;
        const offsetY = (svgRect.top - wrapRect.top) + MARGIN.top + yFor(primary, target.value);
        tooltip.style.left = offsetX + "px";
        tooltip.style.top  = offsetY + "px";
      });
  }

  return { renderChart };
})();
