// ========== SUNBURST VISUALIZATION ==========
import { state, domainColors } from './state.js?v=83';
import { fmt } from './utils.js?v=83';
import { updateFilterBar, closeTaxonomyOverlay } from './ui.js?v=83';

export function updateFilterIndicator() {
    const centerBackBtn = document.getElementById('center-back-btn');
    const bc = document.getElementById('sunburst-breadcrumb');

    if (state.filterPath.length === 0) {
        if (centerBackBtn) centerBackBtn.classList.remove('visible');
        // Reset breadcrumb to default
        bc.innerHTML = '<span style="color: var(--text-tertiary)">Hover to explore</span>';
    } else {
        if (centerBackBtn) centerBackBtn.classList.add('visible');

        // Update breadcrumb to show filter path with clickable crumbs
        bc.innerHTML = state.filterPath.map((taxon, i) =>
            `<span class="crumb" data-taxon="${taxon}" data-index="${i}">${taxon.replace(/^[dpcofgs]__/, '')}</span>`
        ).join('<span class="sep">›</span>');

        // Add click handlers for breadcrumb navigation
        bc.querySelectorAll('.crumb').forEach(crumb => {
            crumb.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(crumb.dataset.index);
                navigateToFilterLevel(index);
            });
        });
    }

    // Update the table filter bar
    updateFilterBar();
}

export async function navigateToFilterLevel(index) {
    // Navigate to a specific level in the filter path
    state.filterPath = state.filterPath.slice(0, index + 1);
    if (state.filterPath.length > 0) {
        state.filters.search = state.filterPath[state.filterPath.length - 1];
    } else {
        state.filters.search = '';
    }

    const { applyFilters } = await import('./data.js?v=83');
    const { renderTable } = await import('./table.js?v=83');

    updateFilterIndicator();
    applyFilters();
    renderTable();
    updateCenterForCurrentFilter();
}

export async function goBackOneLevel() {
    if (state.filterPath.length > 0) {
        state.filterPath.pop();
        if (state.filterPath.length > 0) {
            state.filters.search = state.filterPath[state.filterPath.length - 1];
        } else {
            state.filters.search = '';
        }

        const { applyFilters } = await import('./data.js?v=83');
        const { renderTable } = await import('./table.js?v=83');

        updateFilterIndicator();
        applyFilters();
        renderTable();
        updateCenterForCurrentFilter();
    }
}

export async function clearAllFilters() {
    state.filterPath = [];
    state.filters.search = '';

    const { applyFilters } = await import('./data.js?v=83');
    const { renderTable } = await import('./table.js?v=83');

    // Reset zoom to root
    currentFocus = currentRoot;

    updateFilterIndicator();
    applyFilters();
    renderTable();
    resetSunburstCenter();
}

export function updateCenterForCurrentFilter() {
    // Update sunburst center to reflect current filter level
    const center = document.getElementById('sunburst-center');
    const backBtnVisible = state.filterPath.length > 0 ? 'visible' : '';

    if (state.filterPath.length === 0) {
        resetSunburstCenter();
    } else {
        const currentFilter = state.filterPath[state.filterPath.length - 1];
        const name = currentFilter.replace(/^[dpcofgs]__/, '');
        // Calculate total reads for current filter
        const totalReads = state.filteredData.reduce((sum, d) => sum + (Number(d.n_reads) || 0), 0);

        center.innerHTML = `
            <button class="center-back-btn ${backBtnVisible}" id="center-back-btn" title="Go back" onclick="window.goBackOneLevel()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h4>${name}</h4>
            <p>${totalReads.toLocaleString()} reads</p>
        `;
    }
}

export function resetSunburstCenter() {
    const center = document.getElementById('sunburst-center');
    center.innerHTML = `
        <button class="center-back-btn" id="center-back-btn" title="Go back" onclick="window.goBackOneLevel()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h4>Taxonomy</h4>
        <p>Click to filter</p>
    `;
}

// Store current view state for zooming
let currentRoot = null;
let currentFocus = null;

export function renderSunburst(root) {
    const svg = d3.select('#sunburst');
    const width = 480;
    const height = 480;
    const radius = width / 2;

    svg.attr('viewBox', [-width / 2, -height / 2, width, height]);
    svg.selectAll('*').remove();

    // Store root for zoom operations
    currentRoot = root;
    currentFocus = root;

    const partition = d3.partition().size([2 * Math.PI, root.height + 1]);
    partition(root);

    // Store original coordinates for arc interpolation
    root.each(d => d.current = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 });

    function getColor(d) {
        let node = d;
        while (node) {
            if (node.data.name && node.data.name.startsWith('d__')) {
                return domainColors[node.data.name] || '#6b7280';
            }
            node = node.parent;
        }
        return '#6b7280';
    }

    // Arc generator using current coordinates
    // Add center padding to prevent overlap with center text
    const centerPadding = 45;
    const usableRadius = radius - centerPadding;

    const arc = d3.arc()
        .startAngle(d => d.current.x0)
        .endAngle(d => d.current.x1)
        .padAngle(d => Math.min((d.current.x1 - d.current.x0) / 2, 0.005))
        .padRadius(radius * 1.5)
        .innerRadius(d => centerPadding + d.current.y0 * usableRadius / (root.height + 1))
        .outerRadius(d => Math.max(centerPadding + d.current.y0 * usableRadius / (root.height + 1), centerPadding + d.current.y1 * usableRadius / (root.height + 1) - 1));

    // Create a group for all paths
    const g = svg.append('g');

    const path = g.append('g')
        .selectAll('path')
        .data(root.descendants().slice(1))
        .join('path')
        .attr('fill', d => {
            const base = getColor(d);
            return d3.color(base).darker((d.depth - 1) * 0.15);
        })
        .attr('fill-opacity', d => arcVisible(d.current) ? (d.children ? 0.85 : 1) : 0)
        .attr('pointer-events', d => arcVisible(d.current) ? 'auto' : 'none')
        .attr('d', d => arc(d))
        .style('cursor', 'pointer');

    path.on('mouseover', function(event, d) {
            if (!arcVisible(d.current)) return;
            const sequence = d.ancestors().reverse().slice(1);
            path.attr('fill-opacity', node =>
                arcVisible(node.current) ? (sequence.includes(node) ? 1 : 0.4) : 0
            );
            updateSunburstCenter(d);
            updateBreadcrumb(d);
        })
        .on('mouseout', function() {
            path.attr('fill-opacity', d => arcVisible(d.current) ? (d.children ? 0.85 : 1) : 0);
        })
        .on('click', clicked);

    // Invisible center circle for clicking to zoom out
    const parent = g.append('circle')
        .datum(root)
        .attr('r', centerPadding)
        .attr('fill', 'none')
        .attr('pointer-events', 'all')
        .style('cursor', 'pointer')
        .on('click', clicked);

    // Check if arc is visible
    function arcVisible(d) {
        return d.y1 <= (root.height + 1) && d.y0 >= 1 && d.x1 > d.x0;
    }

    // Click handler with zoom animation
    async function clicked(event, p) {
        // Build ancestry path
        const ancestors = [];
        let node = p;
        while (node && node.data.name !== 'root') {
            ancestors.unshift(node.data.name);
            node = node.parent;
        }

        // If clicking a leaf, select reference instead of zooming
        if (p.data && p.data.data) {
            const { selectReference } = await import('./actions.js?v=83');
            selectReference(p.data.data.id);
            closeTaxonomyOverlay();
            return;
        }

        currentFocus = p;
        parent.datum(p.parent || root);

        root.each(d => d.target = {
            x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            y0: Math.max(0, d.y0 - p.depth),
            y1: Math.max(0, d.y1 - p.depth)
        });

        const t = g.transition().duration(750);

        // Transition arcs
        path.transition(t)
            .tween('data', d => {
                const i = d3.interpolate(d.current, d.target);
                return t => d.current = i(t);
            })
            .filter(function(d) {
                return +this.getAttribute('fill-opacity') || arcVisible(d.target);
            })
            .attr('fill-opacity', d => arcVisible(d.target) ? (d.children ? 0.85 : 1) : 0)
            .attr('pointer-events', d => arcVisible(d.target) ? 'auto' : 'none')
            .attrTween('d', d => () => arc(d));

        // Transition center circle
        parent.transition(t)
            .attr('r', p.depth === 0 ? 0 : centerPadding);

        // Update filter state
        const { applyFilters } = await import('./data.js?v=83');
        const { renderTable } = await import('./table.js?v=83');

        if (p === root || p.data.name === 'root') {
            state.filterPath = [];
            state.filters.search = '';
        } else {
            state.filterPath = ancestors;
            state.filters.search = p.data.name;
        }

        updateFilterIndicator();
        applyFilters();
        renderTable();

        // Update center display
        setTimeout(() => {
            const name = p.data.name === 'root' ? 'Taxonomy' : p.data.name.replace(/^[dpcofgs]__/, '');
            const centerEl = document.getElementById('sunburst-center');
            if (centerEl) {
                const totalReads = p.value || 0;
                const backBtnVisible = p !== root && p.data.name !== 'root' ? 'visible' : '';
                centerEl.innerHTML = `
                    <button class="center-back-btn ${backBtnVisible}" id="center-back-btn" title="Go back" onclick="window.goBackOneLevel()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <h4>${name}</h4>
                    <p>${fmt(totalReads)} reads</p>
                `;
            }
        }, 100);
    }
}

function updateSunburstCenter(d) {
    const center = document.getElementById('sunburst-center');
    const name = d.data.name ? d.data.name.replace(/^[dpcofgs]__/, '') : 'Taxonomy';
    const backBtnVisible = state.filterPath.length > 0 ? 'visible' : '';
    const reads = d.value ? fmt(d.value) + ' reads' : 'Click to filter';

    center.innerHTML = `
        <button class="center-back-btn ${backBtnVisible}" id="center-back-btn" title="Go back" onclick="window.goBackOneLevel()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h4>${name}</h4>
        <p>${reads}</p>
    `;
}

function updateBreadcrumb(d) {
    // Don't update breadcrumb on hover if there's an active filter
    // The filter breadcrumb is managed by updateFilterIndicator
    if (state.filterPath.length > 0) {
        return;
    }

    const ancestors = [];
    let node = d;
    while (node && node.data.name !== 'root') {
        ancestors.unshift(node.data.name);
        node = node.parent;
    }

    const bc = document.getElementById('sunburst-breadcrumb');
    if (ancestors.length === 0) {
        bc.innerHTML = '<span style="color: var(--text-tertiary)">Hover to explore taxonomy</span>';
    } else {
        bc.innerHTML = ancestors.map((a, i) =>
            `<span class="crumb" data-taxon="${a}" data-index="${i}">${a.replace(/^[dpcofgs]__/, '')}</span>`
        ).join('<span class="sep">›</span>');

        // Add click handlers for breadcrumb navigation (for hover mode without active filter)
        bc.querySelectorAll('.crumb').forEach(crumb => {
            crumb.addEventListener('click', async (e) => {
                e.stopPropagation();
                const taxon = crumb.dataset.taxon;
                const index = parseInt(crumb.dataset.index);
                // Update filterPath to contain only ancestors up to clicked level
                state.filterPath = ancestors.slice(0, index + 1);
                state.filters.search = taxon;

                const { applyFilters } = await import('./data.js?v=83');
                const { renderTable } = await import('./table.js?v=83');

                updateFilterIndicator();
                applyFilters();
                renderTable();
                closeTaxonomyOverlay();
            });
        });
    }
}

export function updateLegend() {
    document.getElementById('sunburst-legend').innerHTML = Object.entries(domainColors).map(([k, v]) => `
        <div class="legend-item">
            <div class="legend-dot" style="background:${v}"></div>
            <span class="legend-label">${k.replace('d__', '')}</span>
        </div>
    `).join('');
}
