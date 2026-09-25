import * as d3 from 'd3';
import { FunnelData } from '../types';

export function renderFunnel(container: HTMLElement, funnelData: FunnelData) {
  container.innerHTML = '';

  const stages: Array<{ key: keyof FunnelData; label: string; colorVar: string }> = [
    { key: 'applied', label: 'Applied', colorVar: '--color-stage-applied' },
    { key: 'screening', label: 'Screening', colorVar: '--color-stage-screening' },
    { key: 'interview', label: 'Interview', colorVar: '--color-stage-interview' },
    { key: 'offer', label: 'Offer', colorVar: '--color-stage-offer' },
    { key: 'hired', label: 'Hired', colorVar: '--color-stage-hired' }
  ];

  const totalReached = stages.reduce((acc, s) => acc + (funnelData[s.key]?.reached || 0), 0);

  if (totalReached === 0) {
    const emptyWrapper = document.createElement('div');
    emptyWrapper.className = 'funnel-empty-state';
    emptyWrapper.setAttribute('role', 'region');
    emptyWrapper.setAttribute('aria-label', 'Pipeline Funnel');
    emptyWrapper.innerHTML = `
      <div class="empty-state-icon" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      </div>
      <div class="empty-state-text">
        <strong>No Candidates in Pipeline</strong>
        <p>This vacancy currently has no active or historical applicants. Adding a candidate will populate the pipeline funnel.</p>
      </div>
      <div class="funnel-empty-grid">
        ${stages.map(s => `
          <div class="funnel-empty-stage">
            <span class="empty-stage-name">${s.label}</span>
            <span class="empty-stage-val">0</span>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(emptyWrapper);
    return;
  }

  // Wrapper for responsive SVG
  const wrapper = d3.select(container)
    .append('div')
    .attr('class', 'funnel-chart-wrapper');

  const width = Math.min(800, container.clientWidth || 800);
  const height = 260;
  const margin = { top: 20, right: 20, bottom: 40, left: 30 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = wrapper.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('class', 'funnel-svg')
    .attr('role', 'img')
    .attr('aria-label', 'Pipeline stage funnel chart');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const maxVal = Math.max(1, d3.max(stages, d => funnelData[d.key]?.reached || 0) || 1);

  const xScale = d3.scaleBand()
    .domain(stages.map(d => d.label))
    .range([0, innerWidth])
    .padding(0.25);

  const yScale = d3.scaleLinear()
    .domain([0, maxVal])
    .range([innerHeight, 0])
    .nice();

  // Grid lines
  g.append('g')
    .attr('class', 'grid-lines')
    .call(
      d3.axisLeft(yScale)
        .ticks(Math.min(5, maxVal))
        .tickSize(-innerWidth)
        .tickFormat(() => '')
    )
    .call(g => g.select('.domain').remove());

  // Bars and labels
  stages.forEach((st) => {
    const data = funnelData[st.key] || { reached: 0, remain: 0, lost: 0 };
    const x = xScale(st.label) || 0;
    const barWidth = xScale.bandwidth();
    const barHeight = innerHeight - yScale(data.reached);
    const y = yScale(data.reached);

    const barGroup = g.append('g')
      .attr('class', `funnel-bar-group stage-${st.key}`);

    // Main reached bar
    barGroup.append('rect')
      .attr('class', 'funnel-bar-reached')
      .attr('x', x)
      .attr('y', y)
      .attr('width', barWidth)
      .attr('height', Math.max(2, barHeight))
      .attr('rx', 4)
      .attr('ry', 4);

    // Value on top of bar
    barGroup.append('text')
      .attr('class', 'funnel-val-label')
      .attr('x', x + barWidth / 2)
      .attr('y', Math.max(12, y - 6))
      .attr('text-anchor', 'middle')
      .text(data.reached);

    // Breakdown pills below/inside
    const remainRatio = data.reached > 0 ? data.remain / data.reached : 0;
    const lostRatio = data.reached > 0 ? data.lost / data.reached : 0;

    if (data.remain > 0 && barHeight > 20) {
      barGroup.append('rect')
        .attr('class', 'funnel-bar-remain')
        .attr('x', x + 2)
        .attr('y', y + barHeight - (barHeight * remainRatio))
        .attr('width', Math.max(0, barWidth - 4))
        .attr('height', Math.max(2, barHeight * remainRatio - 2))
        .attr('rx', 2);
    }
  });

  // X Axis (Stage names)
  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale).tickSize(0))
    .call(g => g.select('.domain').remove());

  // Summary Metrics legend below chart
  const metricsGrid = wrapper.append('div').attr('class', 'funnel-metrics-row');

  stages.forEach(st => {
    const d = funnelData[st.key] || { reached: 0, remain: 0, lost: 0 };
    metricsGrid.append('div')
      .attr('class', 'funnel-stage-card')
      .html(`
        <div class="stage-card-header">
          <span class="stage-dot ${st.key}"></span>
          <span class="stage-card-name">${st.label}</span>
        </div>
        <div class="stage-card-stats">
          <div class="stat-item" title="Unique candidates who reached this stage">
            <span class="stat-num">${d.reached}</span>
            <span class="stat-lbl">Reached</span>
          </div>
          <div class="stat-item" title="Candidates currently active in this stage">
            <span class="stat-num active-val">${d.remain}</span>
            <span class="stat-lbl">Active</span>
          </div>
          <div class="stat-item" title="Candidates who dropped out or were rejected after this stage">
            <span class="stat-num lost-val">${d.lost}</span>
            <span class="stat-lbl">Lost</span>
          </div>
        </div>
      `);
  });
}
