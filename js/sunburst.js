// ========== SUNBURST VISUALIZATION ==========
import { state, domainColors } from './state.js?v=33';
import { fmt } from './utils.js?v=33';
import { applyFilters } from './data.js?v=33';
import { renderTable } from './table.js?v=33';

export function updateFilterIndicator() {
    const filterBadge = document.getElementById('sunburst-filter-badge');
    const filterPathText = document.getElementById('filter-path-text');
    const centerBackBtn = document.getElementById('center-back-btn');
    const bc = document.getElementById('sunburst-breadcrumb');

    if (state.filterPath.length === 0) {
        filterBadge.classList.remove('visible');
        if (centerBackBtn) centerBackBtn.classList.remove('visible');
        // Reset breadcrumb to default
        bc.innerHTML = '<span style="color: var(--text-tertiary)">Hover to explore</span>';
    } else {
        // Show only the current (deepest) filter level in badge
        const currentFilter = state.filterPath[state.filterPath.length - 1].replace(/^[dpcofgs]__/, '');
        filterPathText.textContent = currentFilter;
        filterBadge.classList.add('visible');
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
}

export function navigateToFilterLevel(index) {
    // Navigate to a specific level in the filter path
    state.filterPath = state.filterPath.slice(0, index + 1);
    if (state.filterPath.length > 0) {
        state.filters.search = state.filterPath[state.filterPath.length - 1];
    } else {
        state.filters.search = '';
    }
    updateFilterIndicator();
    applyFilters();
    renderTable();
    updateCenterForCurrentFilter();
}

export function goBackOneLevel() {
    if (state.filterPath.length > 0) {
        state.filterPath.pop();
        if (state.filterPath.length > 0) {
            state.filters.search = state.filterPath[state.filterPath.length - 1];
        } else {
            state.filters.search = '';
        }
        updateFilterIndicator();
        applyFilters();
        renderTable();
        updateCenterForCurrentFilter();
    }
}

export function clearAllFilters() {
    state.filterPath = [];
    state.filters.search = '';
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
        <p>Hover to explore</p>
    `;
}

export function renderSunburst(root) {
    const svg = d3.select('#sunburst');
    const width = 480;
    const height = 480;
    const radius = Math.min(width, height) / 2;

    svg.attr('viewBox', [-width / 2, -height / 2, width, height]);
    svg.selectAll('*').remove();

    const partition = d3.partition().size([2 * Math.PI, radius]);
    partition(root);

    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius / 2)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1 - 1);

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

    svg.selectAll('path')
        .data(root.descendants().filter(d => d.depth))
        .join('path')
        .attr('fill', d => {
            const base = getColor(d);
            return d3.color(base).darker(d.depth * 0.15);
        })
        .attr('fill-opacity', d => d.children ? 0.9 : 1)
        .attr('d', arc)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            // Highlight current segment and fade others
            svg.selectAll('path')
                .transition()
                .duration(150)
                .attr('fill-opacity', p => {
                    // Check if p is an ancestor or the hovered node
                    let node = d;
                    while (node) {
                        if (node === p) return 1;
                        node = node.parent;
                    }
                    return p === d ? 1 : 0.4;
                });

            updateSunburstCenter(d);
            updateBreadcrumb(d);
        })
        .on('mouseout', function(event, d) {
            // Restore all segments
            svg.selectAll('path')
                .transition()
                .duration(200)
                .attr('fill-opacity', p => p.children ? 0.9 : 1);
        })
        .on('click', async function(event, d) {
            // Build full ancestry path from root to clicked node
            const ancestors = [];
            let node = d;
            while (node && node.data.name !== 'root') {
                ancestors.unshift(node.data.name);
                node = node.parent;
            }

            if (d.data.data) {
                // Leaf node (species with reference data) - filter by species to show all assemblies
                const speciesName = d.data.name;
                if (speciesName && speciesName.startsWith('s__')) {
                    state.filterPath = ancestors;
                    state.filters.search = speciesName;
                    updateFilterIndicator();
                    applyFilters();
                    renderTable();
                    updateCenterForCurrentFilter();
                } else {
                    // Fallback to selecting that reference
                    const { selectReference } = await import('./actions.js?v=33');
                    selectReference(d.data.data.id);
                }
            } else if (d.data.name && d.data.name !== 'root') {
                // Non-leaf - filter table by this taxonomy level
                state.filterPath = ancestors;
                state.filters.search = d.data.name;
                updateFilterIndicator();
                applyFilters();
                renderTable();
                updateCenterForCurrentFilter();
            }
        });
}

function updateSunburstCenter(d) {
    const center = document.getElementById('sunburst-center');
    const name = d.data.name ? d.data.name.replace(/^[dpcofgs]__/, '') : 'Taxonomy';
    const backBtnVisible = state.filterPath.length > 0 ? 'visible' : '';
    const reads = d.value ? fmt(d.value) + ' reads' : 'Hover to explore';

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
            crumb.addEventListener('click', (e) => {
                e.stopPropagation();
                const taxon = crumb.dataset.taxon;
                const index = parseInt(crumb.dataset.index);
                // Update filterPath to contain only ancestors up to clicked level
                state.filterPath = ancestors.slice(0, index + 1);
                state.filters.search = taxon;
                updateFilterIndicator();
                applyFilters();
                renderTable();
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
