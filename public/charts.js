// D3.js visualizations for Mexican consumer debt data

const COLORS = {
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  purple: '#a855f7',
  cyan: '#06b6d4',
  pink: '#ec4899',
};

const fmt = {
  billions: d => `$${d3.format(',.0f')(d)}B`,
  pesos: d => `$${d3.format(',.0f')(d)}`,
  pct: d => `${d3.format('.1f')(d)}%`,
  millions: d => `${d3.format(',.1f')(d)}M`,
};

// Tooltip singleton
const tooltip = d3.select('body').append('div').attr('class', 'tooltip');

function showTooltip(event, html) {
  tooltip
    .html(html)
    .style('opacity', 1)
    .style('left', `${event.pageX + 12}px`)
    .style('top', `${event.pageY - 10}px`);
}

function hideTooltip() {
  tooltip.style('opacity', 0);
}

// Responsive width helper
function getChartDimensions(containerId, aspectRatio = 0.45) {
  const container = document.getElementById(containerId);
  const width = Math.min(container.clientWidth - 48, 1000);
  const height = Math.max(width * aspectRatio, 280);
  return { width, height };
}

async function loadData() {
  try {
    const data = await d3.json('./data.json');
    return data;
  } catch {
    console.error('No data found. Run `npm run scrape` first.');
    document.querySelector('main').innerHTML =
      '<p style="text-align:center;padding:4rem;color:#9ca3af;">No data found. Run <code>npm run scrape</code> first to generate data.</p>';
    return null;
  }
}

// ─── Chart 1: Consumer Credit Timeline (Stacked Area) ───
function renderTimeline(data) {
  const container = 'chart-timeline';
  const margin = { top: 20, right: 30, bottom: 40, left: 70 };
  const { width, height } = getChartDimensions(container);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const svg = d3.select(`#${container}`)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const parseDate = d3.timeParse('%Y-%m');
  const series = data.consumer_credit_timeline.map(d => ({
    ...d,
    dateObj: parseDate(d.date),
  }));

  const x = d3.scaleTime()
    .domain(d3.extent(series, d => d.dateObj))
    .range([0, w]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(series, d => d.total) * 1.1])
    .range([h, 0]);

  // Grid
  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-w).tickFormat(''));

  // Area for vigente
  svg.append('path')
    .datum(series)
    .attr('fill', COLORS.blue)
    .attr('fill-opacity', 0.3)
    .attr('d', d3.area()
      .x(d => x(d.dateObj))
      .y0(h)
      .y1(d => y(d.vigente))
      .curve(d3.curveMonotoneX));

  // Area for vencida (stacked on top)
  svg.append('path')
    .datum(series)
    .attr('fill', COLORS.red)
    .attr('fill-opacity', 0.4)
    .attr('d', d3.area()
      .x(d => x(d.dateObj))
      .y0(d => y(d.vigente))
      .y1(d => y(d.total))
      .curve(d3.curveMonotoneX));

  // Lines
  svg.append('path')
    .datum(series)
    .attr('fill', 'none')
    .attr('stroke', COLORS.blue)
    .attr('stroke-width', 2)
    .attr('d', d3.line().x(d => x(d.dateObj)).y(d => y(d.vigente)).curve(d3.curveMonotoneX));

  svg.append('path')
    .datum(series)
    .attr('fill', 'none')
    .attr('stroke', COLORS.red)
    .attr('stroke-width', 1.5)
    .attr('d', d3.line().x(d => x(d.dateObj)).y(d => y(d.total)).curve(d3.curveMonotoneX));

  // Axes
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat('%Y')));

  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).tickFormat(d => `$${d}`));

  // COVID annotation
  const covidX = x(parseDate('2020-04'));
  svg.append('line')
    .attr('x1', covidX).attr('x2', covidX)
    .attr('y1', 0).attr('y2', h)
    .attr('stroke', COLORS.yellow)
    .attr('stroke-dasharray', '4,4')
    .attr('stroke-opacity', 0.7);

  svg.append('text')
    .attr('x', covidX + 6).attr('y', 15)
    .attr('fill', COLORS.yellow)
    .attr('font-size', '11px')
    .text('COVID-19');

  // Hover overlay
  const bisect = d3.bisector(d => d.dateObj).left;
  svg.append('rect')
    .attr('width', w).attr('height', h)
    .attr('fill', 'transparent')
    .on('mousemove', function (event) {
      const [mx] = d3.pointer(event);
      const date = x.invert(mx);
      const i = bisect(series, date);
      const d = series[Math.min(i, series.length - 1)];
      showTooltip(event, `
        <div class="tt-title">${d.date}</div>
        <div class="tt-row"><span><span class="tt-color" style="background:${COLORS.blue}"></span>Vigente:</span> <b>${fmt.billions(d.vigente)}</b></div>
        <div class="tt-row"><span><span class="tt-color" style="background:${COLORS.red}"></span>Vencida:</span> <b>${fmt.billions(d.vencida)}</b></div>
        <div class="tt-row"><span>IMOR:</span> <b>${fmt.pct(d.imor)}</b></div>
      `);
    })
    .on('mouseleave', hideTooltip);

  // Legend
  addLegend(container, [
    { label: 'Cartera Vigente', color: COLORS.blue },
    { label: 'Cartera Vencida', color: COLORS.red },
  ]);
}

// ─── Chart 2: Credit Type Breakdown (Horizontal Bar) ───
function renderBreakdown(data) {
  const container = 'chart-breakdown';
  const margin = { top: 10, right: 30, bottom: 40, left: 160 };
  const { width } = getChartDimensions(container);
  const cats = data.credit_breakdown.categories;
  const barHeight = 40;
  const height = cats.length * (barHeight + 12) + margin.top + margin.bottom;
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const svg = d3.select(`#${container}`)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(cats, d => d.total) * 1.15])
    .range([0, w]);

  const y = d3.scaleBand()
    .domain(cats.map(d => d.type))
    .range([0, h])
    .padding(0.25);

  // Grid
  svg.append('g').attr('class', 'grid')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).tickSize(-h).tickFormat(''));

  // Vigente bars
  svg.selectAll('.bar-vigente')
    .data(cats)
    .join('rect')
    .attr('class', 'bar-vigente')
    .attr('y', d => y(d.type))
    .attr('height', y.bandwidth())
    .attr('x', 0)
    .attr('width', d => x(d.vigente))
    .attr('fill', COLORS.blue)
    .attr('rx', 4);

  // Vencida bars (stacked)
  svg.selectAll('.bar-vencida')
    .data(cats)
    .join('rect')
    .attr('class', 'bar-vencida')
    .attr('y', d => y(d.type))
    .attr('height', y.bandwidth())
    .attr('x', d => x(d.vigente))
    .attr('width', d => x(d.vencida))
    .attr('fill', COLORS.red)
    .attr('rx', 0);

  // Value labels
  svg.selectAll('.label')
    .data(cats)
    .join('text')
    .attr('x', d => x(d.total) + 8)
    .attr('y', d => y(d.type) + y.bandwidth() / 2)
    .attr('dy', '0.35em')
    .attr('fill', '#9ca3af')
    .attr('font-size', '12px')
    .text(d => fmt.billions(d.total));

  // Axes
  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y));

  svg.append('g').attr('class', 'axis')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => `$${d}B`));

  // Tooltips
  svg.selectAll('.bar-vigente, .bar-vencida')
    .on('mousemove', function (event) {
      const d = d3.select(this).datum();
      showTooltip(event, `
        <div class="tt-title">${d.type}</div>
        <div class="tt-row"><span>Vigente:</span> <b>${fmt.billions(d.vigente)}</b></div>
        <div class="tt-row"><span>Vencida:</span> <b>${fmt.billions(d.vencida)}</b></div>
        <div class="tt-row"><span>Total:</span> <b>${fmt.billions(d.total)}</b></div>
        <div class="tt-row"><span>Morosidad:</span> <b>${fmt.pct(d.vencida / d.total * 100)}</b></div>
      `);
    })
    .on('mouseleave', hideTooltip);

  addLegend(container, [
    { label: 'Vigente', color: COLORS.blue },
    { label: 'Vencida', color: COLORS.red },
  ]);
}

// ─── Chart 3: Delinquency Rates (Multi-line) ───
function renderDelinquency(data) {
  const container = 'chart-delinquency';
  const margin = { top: 20, right: 30, bottom: 40, left: 50 };
  const { width, height } = getChartDimensions(container);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const svg = d3.select(`#${container}`)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const series = data.delinquency_rates;
  const categories = [
    { key: 'tarjeta_credito', label: 'Tarjeta de Crédito', color: COLORS.red },
    { key: 'consumo', label: 'Consumo Total', color: COLORS.blue },
    { key: 'personal', label: 'Personal', color: COLORS.purple },
    { key: 'hipotecario', label: 'Hipotecario', color: COLORS.green },
    { key: 'automotriz', label: 'Automotriz', color: COLORS.cyan },
  ];

  const x = d3.scalePoint()
    .domain(series.map(d => d.date))
    .range([0, w]);

  const allValues = series.flatMap(d => categories.map(c => d[c.key]));
  const y = d3.scaleLinear()
    .domain([0, d3.max(allValues) * 1.15])
    .range([h, 0]);

  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-w).tickFormat(''));

  for (const cat of categories) {
    svg.append('path')
      .datum(series)
      .attr('fill', 'none')
      .attr('stroke', cat.color)
      .attr('stroke-width', 2)
      .attr('d', d3.line()
        .x(d => x(d.date))
        .y(d => y(d[cat.key]))
        .curve(d3.curveMonotoneX));

    svg.selectAll(`.dot-${cat.key}`)
      .data(series)
      .join('circle')
      .attr('cx', d => x(d.date))
      .attr('cy', d => y(d[cat.key]))
      .attr('r', 3)
      .attr('fill', cat.color)
      .on('mousemove', (event, d) => {
        showTooltip(event, `
          <div class="tt-title">${d.date}</div>
          ${categories.map(c => `
            <div class="tt-row">
              <span><span class="tt-color" style="background:${c.color}"></span>${c.label}:</span>
              <b>${fmt.pct(d[c.key])}</b>
            </div>
          `).join('')}
        `);
      })
      .on('mouseleave', hideTooltip);
  }

  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).tickValues(series.filter((_, i) => i % 4 === 0).map(d => d.date)))
    .selectAll('text').attr('transform', 'rotate(-45)').style('text-anchor', 'end');

  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).tickFormat(d => `${d}%`));

  addLegend(container, categories.map(c => ({ label: c.label, color: c.color })));
}

// ─── Chart 4: Debt Per Capita (Grouped Bar) ───
function renderPerCapita(data) {
  const container = 'chart-percapita';
  const margin = { top: 20, right: 30, bottom: 40, left: 80 };
  const { width, height } = getChartDimensions(container);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const svg = d3.select(`#${container}`)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const series = data.debt_per_capita;
  const groups = [
    { key: 'consumer_debt_per_capita', label: 'Deuda consumo / habitante', color: COLORS.blue },
    { key: 'consumer_debt_per_eap', label: 'Deuda consumo / PEA', color: COLORS.orange },
    { key: 'total_debt_per_capita', label: 'Deuda total / habitante', color: COLORS.cyan },
  ];

  const x = d3.scaleBand()
    .domain(series.map(d => d.year))
    .range([0, w])
    .padding(0.2);

  const x1 = d3.scaleBand()
    .domain(groups.map(g => g.key))
    .range([0, x.bandwidth()])
    .padding(0.05);

  const y = d3.scaleLinear()
    .domain([0, d3.max(series, d => d3.max(groups, g => d[g.key])) * 1.1])
    .range([h, 0]);

  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-w).tickFormat(''));

  const yearGroups = svg.selectAll('.year-group')
    .data(series)
    .join('g')
    .attr('transform', d => `translate(${x(d.year)},0)`);

  for (const g of groups) {
    yearGroups.append('rect')
      .attr('x', x1(g.key))
      .attr('y', d => y(d[g.key]))
      .attr('width', x1.bandwidth())
      .attr('height', d => h - y(d[g.key]))
      .attr('fill', g.color)
      .attr('rx', 2)
      .on('mousemove', (event, d) => {
        showTooltip(event, `
          <div class="tt-title">${d.year}</div>
          ${groups.map(gg => `
            <div class="tt-row">
              <span><span class="tt-color" style="background:${gg.color}"></span>${gg.label}:</span>
              <b>${fmt.pesos(d[gg.key])}</b>
            </div>
          `).join('')}
        `);
      })
      .on('mouseleave', hideTooltip);
  }

  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).tickFormat(d => d));

  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).tickFormat(d => `$${d3.format(',')(d)}`));

  addLegend(container, groups.map(g => ({ label: g.label, color: g.color })));
}

// ─── Chart 5: Credit Cards (Dual Axis) ───
function renderCreditCards(data) {
  const container = 'chart-cards';
  const margin = { top: 20, right: 60, bottom: 40, left: 60 };
  const { width, height } = getChartDimensions(container);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const svg = d3.select(`#${container}`)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const series = data.credit_cards;

  const x = d3.scaleBand()
    .domain(series.map(d => d.year))
    .range([0, w])
    .padding(0.3);

  const yLeft = d3.scaleLinear()
    .domain([0, d3.max(series, d => d.total_cards_millions) * 1.15])
    .range([h, 0]);

  const yRight = d3.scaleLinear()
    .domain([0, d3.max(series, d => d.utilization_pct) * 1.3])
    .range([h, 0]);

  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(yLeft).tickSize(-w).tickFormat(''));

  // Bars for cards
  svg.selectAll('.bar')
    .data(series)
    .join('rect')
    .attr('x', d => x(d.year))
    .attr('y', d => yLeft(d.total_cards_millions))
    .attr('width', x.bandwidth())
    .attr('height', d => h - yLeft(d.total_cards_millions))
    .attr('fill', COLORS.blue)
    .attr('fill-opacity', 0.7)
    .attr('rx', 3)
    .on('mousemove', (event, d) => {
      showTooltip(event, `
        <div class="tt-title">${d.year}</div>
        <div class="tt-row"><span>Tarjetas:</span> <b>${fmt.millions(d.total_cards_millions)}</b></div>
        <div class="tt-row"><span>Saldo prom.:</span> <b>${fmt.pesos(d.avg_balance_pesos)}</b></div>
        <div class="tt-row"><span>Límite prom.:</span> <b>${fmt.pesos(d.avg_credit_limit_pesos)}</b></div>
        <div class="tt-row"><span>Utilización:</span> <b>${fmt.pct(d.utilization_pct)}</b></div>
      `);
    })
    .on('mouseleave', hideTooltip);

  // Line for utilization
  svg.append('path')
    .datum(series)
    .attr('fill', 'none')
    .attr('stroke', COLORS.orange)
    .attr('stroke-width', 2.5)
    .attr('d', d3.line()
      .x(d => x(d.year) + x.bandwidth() / 2)
      .y(d => yRight(d.utilization_pct))
      .curve(d3.curveMonotoneX));

  svg.selectAll('.dot-util')
    .data(series)
    .join('circle')
    .attr('cx', d => x(d.year) + x.bandwidth() / 2)
    .attr('cy', d => yRight(d.utilization_pct))
    .attr('r', 4)
    .attr('fill', COLORS.orange);

  // Axes
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x));

  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yLeft).tickFormat(d => `${d}M`));

  svg.append('g').attr('class', 'axis').attr('transform', `translate(${w},0)`)
    .call(d3.axisRight(yRight).tickFormat(d => `${d}%`));

  addLegend(container, [
    { label: 'Tarjetas (millones)', color: COLORS.blue },
    { label: 'Utilización (%)', color: COLORS.orange },
  ]);
}

// ─── Chart 6: Mortgages (Vigente + Vencida bars with IMOR line) ───
function renderMortgage(data) {
  const container = 'chart-mortgage';
  const margin = { top: 20, right: 60, bottom: 40, left: 80 };
  const { width, height } = getChartDimensions(container);
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const svg = d3.select(`#${container}`)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const series = data.mortgages;

  const x = d3.scaleBand()
    .domain(series.map(d => d.year))
    .range([0, w])
    .padding(0.3);

  const yLeft = d3.scaleLinear()
    .domain([0, d3.max(series, d => d.portfolio_billions) * 1.1])
    .range([h, 0]);

  const maxImor = d3.max(series, d => d.imor_pct);
  const yRight = d3.scaleLinear()
    .domain([0, Math.ceil(maxImor + 1)])
    .range([h, 0]);

  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(yLeft).tickSize(-w).tickFormat(''));

  // Stacked bars: vigente + vencida
  svg.selectAll('.bar-vig')
    .data(series)
    .join('rect')
    .attr('x', d => x(d.year))
    .attr('y', d => yLeft(d.vigente))
    .attr('width', x.bandwidth())
    .attr('height', d => h - yLeft(d.vigente))
    .attr('fill', COLORS.cyan)
    .attr('fill-opacity', 0.7)
    .attr('rx', 3);

  svg.selectAll('.bar-ven')
    .data(series)
    .join('rect')
    .attr('x', d => x(d.year))
    .attr('y', d => yLeft(d.portfolio_billions))
    .attr('width', x.bandwidth())
    .attr('height', d => yLeft(d.vigente) - yLeft(d.portfolio_billions))
    .attr('fill', COLORS.red)
    .attr('fill-opacity', 0.8);

  // Tooltip on bars
  svg.selectAll('.bar-overlay')
    .data(series)
    .join('rect')
    .attr('x', d => x(d.year))
    .attr('y', d => yLeft(d.portfolio_billions))
    .attr('width', x.bandwidth())
    .attr('height', d => h - yLeft(d.portfolio_billions))
    .attr('fill', 'transparent')
    .on('mousemove', (event, d) => {
      showTooltip(event, `
        <div class="tt-title">${d.year}</div>
        <div class="tt-row"><span><span class="tt-color" style="background:${COLORS.cyan}"></span>Vigente:</span> <b>${fmt.billions(d.vigente)}</b></div>
        <div class="tt-row"><span><span class="tt-color" style="background:${COLORS.red}"></span>Vencida:</span> <b>${fmt.billions(d.vencida)}</b></div>
        <div class="tt-row"><span>Total:</span> <b>${fmt.billions(d.portfolio_billions)}</b></div>
        <div class="tt-row"><span><span class="tt-color" style="background:${COLORS.yellow}"></span>IMOR:</span> <b>${fmt.pct(d.imor_pct)}</b></div>
      `);
    })
    .on('mouseleave', hideTooltip);

  // Line for IMOR
  svg.append('path')
    .datum(series)
    .attr('fill', 'none')
    .attr('stroke', COLORS.yellow)
    .attr('stroke-width', 2.5)
    .attr('d', d3.line()
      .x(d => x(d.year) + x.bandwidth() / 2)
      .y(d => yRight(d.imor_pct))
      .curve(d3.curveMonotoneX));

  svg.selectAll('.dot-imor')
    .data(series)
    .join('circle')
    .attr('cx', d => x(d.year) + x.bandwidth() / 2)
    .attr('cy', d => yRight(d.imor_pct))
    .attr('r', 4)
    .attr('fill', COLORS.yellow);

  // Axes
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x));

  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yLeft).tickFormat(d => `$${d3.format(',')(d)}`));

  svg.append('g').attr('class', 'axis').attr('transform', `translate(${w},0)`)
    .call(d3.axisRight(yRight).tickFormat(d => `${d}%`));

  addLegend(container, [
    { label: 'Cartera Vigente (MdP)', color: COLORS.cyan },
    { label: 'Cartera Vencida (MdP)', color: COLORS.red },
    { label: 'IMOR (%)', color: COLORS.yellow },
  ]);
}

// ─── Key Metrics ───
function renderMetrics(data) {
  const latest = data.consumer_credit_timeline.at(-1);
  const latestCards = data.credit_cards.at(-1);
  const latestPerCapita = data.debt_per_capita.at(-1);
  const latestMortgage = data.mortgages.at(-1);

  const metrics = [
    {
      value: fmt.billions(latest.total),
      label: 'Deuda al consumo total',
    },
    {
      value: fmt.pct(latest.imor),
      label: 'Índice de morosidad',
      warning: latest.imor > 5,
    },
    {
      value: fmt.pesos(latestPerCapita.consumer_debt_per_eap),
      label: 'Deuda por persona (PEA)',
    },
    {
      value: fmt.millions(latestCards.total_cards_millions),
      label: 'Tarjetas en circulación',
    },
    {
      value: fmt.pct(latestCards.utilization_pct),
      label: 'Utilización de tarjetas',
      warning: latestCards.utilization_pct > 45,
    },
    {
      value: fmt.billions(latestMortgage.portfolio_billions),
      label: 'Cartera hipotecaria',
    },
  ];

  const container = d3.select('#metrics');
  for (const m of metrics) {
    const card = container.append('div')
      .attr('class', `metric-card${m.warning ? ' warning' : ''}`);
    card.append('div').attr('class', 'value').text(m.value);
    card.append('div').attr('class', 'label').text(m.label);
  }
}

// ─── Legend helper ───
function addLegend(containerId, items) {
  const legend = d3.select(`#${containerId}`)
    .append('div')
    .attr('class', 'legend');

  for (const item of items) {
    const el = legend.append('div').attr('class', 'legend-item');
    el.append('div')
      .attr('class', 'legend-swatch')
      .style('background', item.color);
    el.append('span').text(item.label);
  }
}

// ─── Init ───
async function init() {
  const data = await loadData();
  if (!data) return;

  renderMetrics(data);
  renderTimeline(data);
  renderBreakdown(data);
  renderDelinquency(data);
  renderPerCapita(data);
  renderCreditCards(data);
  renderMortgage(data);
}

init();
