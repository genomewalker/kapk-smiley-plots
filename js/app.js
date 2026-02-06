// ========== MAIN APPLICATION ENTRY POINT ==========
import { initDuckDB, loadSamples } from './data.js?v=83';
import { setupEventListeners } from './ui.js?v=83';
import { goBackOneLevel, clearAllFilters, navigateToFilterLevel } from './sunburst.js?v=83';
import { state, domainColors } from './state.js?v=83';
import { convertResults, cleanName, getStatus, pct, fmt } from './utils.js?v=83';

// Make navigation functions globally accessible for onclick handlers
window.goBackOneLevel = goBackOneLevel;
window.clearAllFilters = clearAllFilters;
window.navigateToFilterLevel = navigateToFilterLevel;

// ========== RESIZE HANDLE FUNCTIONALITY ==========
function setupResizeHandle() {
    const handle = document.getElementById('resize-handle');
    const sunburstPanel = document.getElementById('sunburst-panel');
    const contentArea = document.querySelector('.content-area');

    if (!handle || !sunburstPanel || !contentArea) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = sunburstPanel.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const delta = e.clientX - startX;
        const newWidth = Math.min(Math.max(280, startWidth + delta), contentArea.offsetWidth * 0.5);
        sunburstPanel.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// ========== COMPARE SAMPLES OVERLAY ==========
function setupCompareSamplesOverlay() {
    const compareBtn = document.getElementById('compare-samples-btn');
    const compareTaxaBtn = document.getElementById('compare-taxa-btn');
    const overlay = document.getElementById('compare-overlay');
    const closeBtn = document.getElementById('compare-close');

    if (!compareBtn || !overlay) return;

    compareBtn.addEventListener('click', openCompareSamplesOverlay);

    if (compareTaxaBtn) {
        compareTaxaBtn.addEventListener('click', async () => {
            const { openComparePanel } = await import('./compare.js?v=84');
            openComparePanel();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeCompareOverlay);
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeCompareOverlay();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('open')) {
            closeCompareOverlay();
        }
    });
}

function closeCompareOverlay() {
    const overlay = document.getElementById('compare-overlay');
    if (overlay) {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }
}

function openCompareSamplesOverlay() {
    const overlay = document.getElementById('compare-overlay');
    const grid = document.getElementById('compare-sunburst-grid');
    const subtitle = document.getElementById('compare-subtitle');
    const filterInfo = document.getElementById('compare-filter-info');

    if (!overlay || !grid) return;

    // Reset filtered state when opening fresh
    currentFilteredDataMap = null;
    isCompareFiltered = false;
    currentFilteredTaxonName = '';
    compareTaxaFilterMode = 'all';

    const selectedSamples = state.selectedSamples || [];

    // Reset filter info with taxa filter buttons
    if (filterInfo) {
        filterInfo.innerHTML = `
            <div class="compare-taxa-filter" id="compare-taxa-filter">
                <span class="filter-label">Show taxa:</span>
                <button class="taxa-filter-btn active" data-filter="all">All</button>
                <button class="taxa-filter-btn" data-filter="shared">
                    <span class="filter-dot shared"></span>Shared
                    <span class="filter-count" id="shared-count">0</span>
                </button>
                <button class="taxa-filter-btn" data-filter="unique">
                    <span class="filter-dot unique"></span>Unique
                    <span class="filter-count" id="unique-count">0</span>
                </button>
            </div>
            <span class="compare-hint">Click sunburst to filter by taxonomy</span>
        `;
        setupTaxaFilterButtons();
    }

    if (selectedSamples.length === 0) {
        subtitle.textContent = 'Select samples in the sidebar first';
        grid.innerHTML = `
            <div class="compare-empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--text-tertiary)">
                    <circle cx="6" cy="12" r="4"/>
                    <circle cx="18" cy="12" r="4"/>
                    <path d="M10 12h4" stroke-dasharray="2 2"/>
                </svg>
                <h3>No samples selected</h3>
                <p>Use the checkboxes in the sidebar to select samples for comparison</p>
            </div>
        `;
    } else {
        subtitle.textContent = `Comparing ${selectedSamples.length} sample${selectedSamples.length > 1 ? 's' : ''}`;
        renderCompareSunbursts(selectedSamples);
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

// Store all compare sunbursts for linked interactions
const compareSunbursts = [];

// Toggle taxa list expansion
window.toggleTaxaList = function(header) {
    const toggle = header.querySelector('.taxa-list-toggle');
    const content = header.nextElementSibling;
    if (toggle && content) {
        toggle.classList.toggle('expanded');
        content.classList.toggle('expanded');
    }
};

// Calculate which taxa appear in multiple samples
// Can pass filteredDataMap to use filtered data instead of full data
function getCommonTaxaAcrossSamples(filteredDataMap = null) {
    const taxonCounts = new Map();

    compareSunbursts.forEach(sb => {
        // Use filtered data if provided, otherwise use full data
        const dataToUse = filteredDataMap ? filteredDataMap.get(sb.sample) : sb.data;
        if (!dataToUse) return;

        const seen = new Set(); // Prevent counting same taxon twice in one sample
        dataToUse.forEach(d => {
            const taxonName = cleanName(d.species) || cleanName(d.genus);
            if (taxonName && !seen.has(taxonName)) {
                seen.add(taxonName);
                taxonCounts.set(taxonName, (taxonCounts.get(taxonName) || 0) + 1);
            }
        });
    });

    // Return set of taxa present in more than one sample
    const commonTaxa = new Set();
    taxonCounts.forEach((count, taxon) => {
        if (count > 1) commonTaxa.add(taxon);
    });
    return commonTaxa;
}

// Store current filtered data for common taxa calculation
let currentFilteredDataMap = null;

// Track if compare view is in filtered state
let isCompareFiltered = false;
let currentFilteredTaxonName = '';

// Track taxa filter mode: 'all', 'shared', 'unique'
let compareTaxaFilterMode = 'all';

// Setup taxa filter buttons event listeners
function setupTaxaFilterButtons() {
    const container = document.getElementById('compare-taxa-filter');
    if (!container) return;

    container.querySelectorAll('.taxa-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            container.querySelectorAll('.taxa-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            compareTaxaFilterMode = btn.dataset.filter;
            refreshAllTaxaLists();
        });
    });
}

// Update shared/unique counts in the filter buttons
function updateTaxaCounts() {
    const commonTaxa = getCommonTaxaAcrossSamples(currentFilteredDataMap);
    let totalUnique = 0;
    let totalShared = commonTaxa.size;

    // Count all unique taxa (those in only one sample)
    const allTaxa = new Set();
    compareSunbursts.forEach(sb => {
        const dataToUse = currentFilteredDataMap ? currentFilteredDataMap.get(sb.sample) : sb.data;
        if (!dataToUse) return;
        dataToUse.forEach(d => {
            const taxonName = cleanName(d.species) || cleanName(d.genus);
            if (taxonName) allTaxa.add(taxonName);
        });
    });
    totalUnique = allTaxa.size - commonTaxa.size;

    const sharedCountEl = document.getElementById('shared-count');
    const uniqueCountEl = document.getElementById('unique-count');
    if (sharedCountEl) sharedCountEl.textContent = totalShared;
    if (uniqueCountEl) uniqueCountEl.textContent = totalUnique;
}

// Refresh all taxa lists with current filter mode
function refreshAllTaxaLists() {
    compareSunbursts.forEach(sb => {
        const taxaListEl = document.getElementById(`compare-taxa-${sb.index}`);
        if (taxaListEl && sb.data) {
            const dataToUse = currentFilteredDataMap ? currentFilteredDataMap.get(sb.sample) : sb.data;
            const sortedData = [...(dataToUse || sb.data)].sort((a, b) => (b.damage || 0) - (a.damage || 0));
            // Pass more data when filtering so we can find enough matching taxa
            const passCount = compareTaxaFilterMode === 'all' ? 8 : sortedData.length;
            renderTaxaList(taxaListEl, sortedData.slice(0, passCount), sortedData.length, sb.sample, isCompareFiltered);
        }
    });
}

function renderCompareSunbursts(samples) {
    const grid = document.getElementById('compare-sunburst-grid');
    if (!grid) return;

    grid.innerHTML = '';
    compareSunbursts.length = 0; // Clear previous

    // Adjust grid columns
    if (samples.length <= 2) {
        grid.style.gridTemplateColumns = samples.length === 1 ? '1fr' : 'repeat(2, 1fr)';
    } else {
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    }

    samples.forEach((sample, i) => {
        const item = document.createElement('div');
        item.className = 'compare-sunburst-item';
        item.innerHTML = `
            <div class="compare-sunburst-header">
                <h4>${sample}</h4>
                <span class="compare-sample-stats" id="compare-stats-${i}">Loading...</span>
            </div>
            <div class="compare-sunburst-content">
                <div class="compare-sunburst-svg" id="compare-svg-container-${i}"></div>
                <div class="compare-sunburst-center" id="compare-center-${i}">
                    <h5>...</h5>
                    <span>loading</span>
                </div>
            </div>
            <div class="compare-taxa-list" id="compare-taxa-${i}">
                <div class="taxa-loading">Loading taxa...</div>
            </div>
        `;
        grid.appendChild(item);

        // Load data for this sample
        loadSampleData(sample, i);
    });
}

async function loadSampleData(sample, index) {
    if (!state.conn) return;

    try {
        const result = await state.conn.query(`
            SELECT * FROM meta
            WHERE sample = '${sample.replace(/'/g, "''")}'
              AND (domain = 'd__Bacteria' OR domain = 'd__Archaea')
            ORDER BY damage DESC
        `);

        const data = convertResults(result);

        const statsEl = document.getElementById(`compare-stats-${index}`);
        const taxaListEl = document.getElementById(`compare-taxa-${index}`);
        const centerEl = document.getElementById(`compare-center-${index}`);
        const svgContainer = document.getElementById(`compare-svg-container-${index}`);

        if (data.length === 0) {
            if (statsEl) statsEl.textContent = 'No data';
            if (taxaListEl) taxaListEl.innerHTML = '<div class="taxa-empty">No taxa found</div>';
            if (centerEl) centerEl.innerHTML = '<h5>0</h5><span>taxa</span>';
            return;
        }

        // Stats
        const damagedCount = data.filter(d => d.damage >= 0.11 && d.significance >= 2 && d.n_reads >= 100).length;

        if (statsEl) {
            statsEl.innerHTML = `<span class="stat-damaged">${damagedCount}</span> / ${data.length}`;
        }

        if (centerEl) {
            centerEl.innerHTML = `<h5>${data.length}</h5><span>taxa</span>`;
        }

        // Render sunburst
        if (svgContainer) {
            renderMiniSunburst(svgContainer, data, index, sample, centerEl);
        }

        // Render taxa list
        if (taxaListEl) {
            renderTaxaList(taxaListEl, data.slice(0, 8), data.length, sample);
        }

        // Update shared/unique counts after each sample loads
        updateTaxaCounts();

    } catch (err) {
        console.error('Error loading sample data:', err);
    }
}

function renderMiniSunburst(container, data, index, sample, centerEl) {
    // Build hierarchy
    const hierarchy = { name: 'root', children: [] };
    data.forEach(d => {
        const path = [d.domain, d.phylum, d.class_, d.order_, d.family, d.genus];
        let current = hierarchy;
        path.forEach(name => {
            if (!name) return;
            let child = current.children.find(c => c.name === name);
            if (!child) {
                child = { name, children: [] };
                current.children.push(child);
            }
            current = child;
        });
        current.children.push({ name: d.species || d.reference, children: [], data: d });
    });

    const width = 220;
    const height = 220;
    const radius = width / 2;
    const centerPadding = 30; // Space for center text
    const usableRadius = radius - centerPadding;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [-width/2, -height/2, width, height]);

    const g = svg.append('g');

    const root = d3.hierarchy(hierarchy)
        .sum(d => d.data ? Number(d.data.n_reads) || 1 : 0)
        .sort((a, b) => b.value - a.value);

    const partition = d3.partition().size([2 * Math.PI, root.height + 1]);
    partition(root);

    // Store original coordinates
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

    const arc = d3.arc()
        .startAngle(d => d.current.x0)
        .endAngle(d => d.current.x1)
        .padAngle(0.003)
        .padRadius(radius * 1.5)
        .innerRadius(d => centerPadding + d.current.y0 * usableRadius / (root.height + 1))
        .outerRadius(d => Math.max(centerPadding + d.current.y0 * usableRadius / (root.height + 1), centerPadding + d.current.y1 * usableRadius / (root.height + 1) - 1));

    function arcVisible(d) {
        return d.y1 <= (root.height + 1) && d.y0 >= 1 && d.x1 > d.x0;
    }

    const paths = g.append('g')
        .selectAll('path')
        .data(root.descendants().slice(1))
        .join('path')
        .attr('fill', d => {
            const base = getColor(d);
            return d3.color(base).darker((d.depth - 1) * 0.15);
        })
        .attr('fill-opacity', d => arcVisible(d.current) ? 0.85 : 0)
        .attr('pointer-events', d => arcVisible(d.current) ? 'auto' : 'none')
        .attr('d', d => arc(d))
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            if (!arcVisible(d.current)) return;
            // Highlight in ALL sunbursts
            highlightTaxonInAllSunbursts(d.data.name);

            if (centerEl) {
                const name = d.data.name ? d.data.name.replace(/^[dpcofgs]__/, '') : '';
                centerEl.innerHTML = `
                    <h5 title="${name}">${name.length > 10 ? name.slice(0, 8) + '..' : name}</h5>
                    <span>${fmt(d.value)} reads</span>
                `;
            }
        })
        .on('mouseout', function() {
            resetAllSunburstHighlights();
            if (centerEl) {
                if (isCompareFiltered) {
                    // Restore filtered text
                    const displayName = currentFilteredTaxonName.length > 8
                        ? currentFilteredTaxonName.slice(0, 6) + '..'
                        : currentFilteredTaxonName;
                    centerEl.innerHTML = `<h5>${displayName}</h5><span>filtered</span>`;
                } else {
                    // Reset to total count
                    centerEl.innerHTML = `<h5>${data.length}</h5><span>taxa</span>`;
                }
            }
        })
        .on('click', function(event, p) {
            event.stopPropagation();

            // If leaf, filter by species
            if (p.data && p.data.data) {
                filterByTaxon(p.data.name);
                return;
            }

            // Zoom all sunbursts together
            zoomAllSunbursts(p);
        });

    // Center circle for zoom out
    const parent = g.append('circle')
        .datum(root)
        .attr('r', centerPadding)
        .attr('fill', 'none')
        .attr('pointer-events', 'all')
        .style('cursor', 'pointer')
        .on('click', function(event, p) {
            zoomAllSunbursts(p);
        });

    // Store this sunburst for linked interactions
    compareSunbursts.push({
        index,
        sample,
        paths,
        root,
        data,
        centerEl,
        arc,
        g,
        parent,
        radius,
        centerPadding,
        arcVisible
    });
}

// Zoom all compare sunbursts together
function zoomAllSunbursts(targetNode) {
    compareSunbursts.forEach(sb => {
        // Find equivalent node in this sunburst's hierarchy
        const targetName = targetNode.data.name;
        let p = sb.root;

        if (targetName !== 'root') {
            // Find node with same name
            sb.root.each(d => {
                if (d.data.name === targetName) p = d;
            });
        }

        sb.root.each(d => d.target = {
            x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            y0: Math.max(0, d.y0 - p.depth),
            y1: Math.max(0, d.y1 - p.depth)
        });

        const t = sb.g.transition().duration(750);

        sb.paths.transition(t)
            .tween('data', d => {
                const i = d3.interpolate(d.current, d.target);
                return t => d.current = i(t);
            })
            .filter(function(d) {
                return +this.getAttribute('fill-opacity') || sb.arcVisible(d.target);
            })
            .attr('fill-opacity', d => sb.arcVisible(d.target) ? 0.85 : 0)
            .attr('pointer-events', d => sb.arcVisible(d.target) ? 'auto' : 'none')
            .attrTween('d', d => () => sb.arc(d));

        sb.parent.datum(p.parent || sb.root);
        sb.parent.transition(t)
            .attr('r', p.depth === 0 ? 0 : sb.centerPadding);

        // Update center
        if (sb.centerEl) {
            const name = p.data.name === 'root' ? sb.data.length : p.data.name.replace(/^[dpcofgs]__/, '');
            sb.centerEl.innerHTML = `<h5>${typeof name === 'number' ? name : (name.length > 8 ? name.slice(0, 6) + '..' : name)}</h5><span>${typeof name === 'number' ? 'taxa' : 'click center'}</span>`;
        }
    });

    // Update filter
    if (targetNode.data.name !== 'root') {
        filterByTaxon(targetNode.data.name);
    } else {
        window.clearCompareFilter();
    }
}

// Highlight a taxon across all compare sunbursts
function highlightTaxonInAllSunbursts(taxonName) {
    compareSunbursts.forEach(sb => {
        sb.paths.attr('fill-opacity', d => {
            if (!sb.arcVisible(d.current)) return 0;
            // Check if this node or any ancestor matches
            let node = d;
            while (node) {
                if (node.data.name === taxonName) return 1;
                node = node.parent;
            }
            const ancestors = d.ancestors().map(a => a.data.name);
            if (ancestors.includes(taxonName)) return 1;
            return 0.3;
        });
    });
}

// Reset all sunburst highlights
function resetAllSunburstHighlights() {
    compareSunbursts.forEach(sb => {
        sb.paths.attr('fill-opacity', d => sb.arcVisible(d.current) ? 0.85 : 0);
    });
}

function renderTaxaList(container, taxa, totalCount, sample, isExpanded = false) {
    // Calculate which taxa are common across samples (use filtered data if available)
    const commonTaxa = getCommonTaxaAcrossSamples(currentFilteredDataMap);

    // Filter taxa based on current filter mode
    let filteredTaxa = taxa;
    if (compareTaxaFilterMode === 'shared') {
        filteredTaxa = taxa.filter(t => {
            const taxonName = cleanName(t.species) || cleanName(t.genus);
            return taxonName && commonTaxa.has(taxonName);
        });
    } else if (compareTaxaFilterMode === 'unique') {
        filteredTaxa = taxa.filter(t => {
            const taxonName = cleanName(t.species) || cleanName(t.genus);
            return !taxonName || !commonTaxa.has(taxonName);
        });
    }

    const displayCount = compareTaxaFilterMode === 'all' ? totalCount : filteredTaxa.length;
    const filterLabel = compareTaxaFilterMode === 'all' ? 'Top by Damage' :
                        compareTaxaFilterMode === 'shared' ? 'Shared Taxa' : 'Unique Taxa';

    container.innerHTML = `
        <div class="taxa-list-header" onclick="toggleTaxaList(this)">
            <span class="taxa-list-toggle ${isExpanded ? 'expanded' : ''}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </span>
            <span>${filterLabel}</span>
            <span class="taxa-list-count">${displayCount}</span>
        </div>
        <div class="taxa-list-content ${isExpanded ? 'expanded' : ''}">
            <div class="taxa-list-items">
                ${filteredTaxa.length === 0 ? '<div class="taxa-empty-filter">No taxa match filter</div>' : filteredTaxa.sort((a, b) => (b.damage || 0) - (a.damage || 0)).slice(0, 8).map(t => {
                    const status = getStatus(t);
                    const speciesName = cleanName(t.species);
                    const genusName = cleanName(t.genus);
                    const displayName = speciesName || genusName || t.reference;
                    const taxonName = speciesName || genusName || '';
                    const taxonLevel = speciesName ? 'species' : (genusName ? 'genus' : 'reference');

                    // Check if this taxon is common (in multiple samples) or unique
                    const isCommon = taxonName && commonTaxa.has(taxonName);
                    const commonClass = isCommon ? 'common-taxon' : 'unique-taxon';

                    return `
                        <div class="taxa-list-item ${status} ${commonClass}" data-id="${t.id}" data-sample="${sample}" data-taxon="${taxonName}" data-level="${taxonLevel}">
                            <span class="taxa-name" title="${displayName}">${displayName}</span>
                            ${isCommon ? '<span class="common-badge" title="Present in multiple samples">●</span>' : ''}
                            <span class="taxa-damage">${pct(t.damage)}%</span>
                        </div>
                    `;
                }).join('')}
            </div>
            ${displayCount > 8 ? `<div class="taxa-list-more">+${displayCount - 8} more</div>` : ''}
        </div>
    `;

    // Click handlers - open Compare Taxa view for that taxon
    container.querySelectorAll('.taxa-list-item').forEach(item => {
        item.addEventListener('click', async () => {
            const taxonName = item.dataset.taxon;
            const taxonLevel = item.dataset.level;

            if (!taxonName || taxonLevel === 'reference') {
                // If no taxon name, fall back to selecting the reference
                const id = Number(item.dataset.id);
                const sampleName = item.dataset.sample;
                closeCompareOverlay();
                const { selectSample, selectReference } = await import('./actions.js?v=83');
                if (state.currentSample !== sampleName) {
                    selectSample(sampleName);
                    setTimeout(() => selectReference(id), 500);
                } else {
                    selectReference(id);
                }
                return;
            }

            // Get the selected samples from the compare sunbursts
            const selectedSamples = compareSunbursts.map(sb => sb.sample);

            // Close compare samples overlay and open Compare Taxa view
            closeCompareOverlay();
            const { trackTaxonAcrossSamples } = await import('./compare.js?v=84');
            trackTaxonAcrossSamples(taxonName, taxonLevel, selectedSamples);
        });
    });
}

async function filterByTaxon(taxonName) {
    if (!taxonName || taxonName === 'root') return;

    // Mark as filtered so mouseout restores filtered text
    isCompareFiltered = true;
    currentFilteredTaxonName = taxonName.replace(/^[dpcofgs]__/, '');

    const { applyFilters } = await import('./data.js?v=83');
    const { renderTable } = await import('./table.js?v=83');
    const { updateFilterIndicator } = await import('./sunburst.js?v=83');

    state.filterPath = [taxonName];
    state.filters.search = taxonName;

    updateFilterIndicator();
    applyFilters();
    renderTable();

    // Update UI in compare view
    const cleanedName = taxonName.replace(/^[dpcofgs]__/, '');
    const searchLower = taxonName.toLowerCase();

    // First, build filtered data map for all samples (needed for common taxa calculation)
    currentFilteredDataMap = new Map();
    compareSunbursts.forEach(sb => {
        if (sb.data) {
            const filteredData = sb.data.filter(d =>
                (d.domain && d.domain.toLowerCase().includes(searchLower)) ||
                (d.phylum && d.phylum.toLowerCase().includes(searchLower)) ||
                (d.class_ && d.class_.toLowerCase().includes(searchLower)) ||
                (d.order_ && d.order_.toLowerCase().includes(searchLower)) ||
                (d.family && d.family.toLowerCase().includes(searchLower)) ||
                (d.genus && d.genus.toLowerCase().includes(searchLower)) ||
                (d.species && d.species.toLowerCase().includes(searchLower))
            );
            filteredData.sort((a, b) => (b.damage || 0) - (a.damage || 0));
            currentFilteredDataMap.set(sb.sample, filteredData);
        }
    });

    // Now render taxa lists with filtered data (common taxa will be calculated from filtered data)
    compareSunbursts.forEach(sb => {
        const taxaListEl = document.getElementById(`compare-taxa-${sb.index}`);
        const filteredData = currentFilteredDataMap.get(sb.sample) || [];

        if (taxaListEl) {
            // Pass more data when taxa filter mode is active so we can find enough matching taxa
            const passCount = compareTaxaFilterMode === 'all' ? 8 : filteredData.length;
            // Render with expanded state since user is actively filtering
            renderTaxaList(taxaListEl, filteredData.slice(0, passCount), filteredData.length, sb.sample, true);

            // Update stats
            const statsEl = document.getElementById(`compare-stats-${sb.index}`);
            if (statsEl) {
                const damagedCount = filteredData.filter(d => d.damage >= 0.11 && d.significance >= 2 && d.n_reads >= 100).length;
                statsEl.innerHTML = `<span class="stat-damaged">${damagedCount}</span> / ${filteredData.length} <span style="color:var(--text-tertiary)">(filtered)</span>`;
            }
        }

        // Update center text
        if (sb.centerEl) {
            sb.centerEl.innerHTML = `<h5>${cleanedName.length > 8 ? cleanedName.slice(0, 6) + '..' : cleanedName}</h5><span>filtered</span>`;
        }
    });

    const filterInfo = document.getElementById('compare-filter-info');
    if (filterInfo) {
        filterInfo.innerHTML = `
            <span>Filtered: <strong>${cleanedName}</strong></span>
            <button class="btn-clear-filter" onclick="window.clearCompareFilter()">Clear</button>
        `;
    }

    // Update shared/unique counts for filtered data
    updateTaxaCounts();
}

window.clearCompareFilter = async function() {
    const { applyFilters } = await import('./data.js?v=83');
    const { renderTable } = await import('./table.js?v=83');
    const { updateFilterIndicator } = await import('./sunburst.js?v=83');

    state.filterPath = [];
    state.filters.search = '';

    // Clear filtered state
    isCompareFiltered = false;
    currentFilteredTaxonName = '';
    currentFilteredDataMap = null;

    updateFilterIndicator();
    applyFilters();
    renderTable();

    // Reset sunburst zoom to root
    if (compareSunbursts.length > 0) {
        zoomAllSunbursts(compareSunbursts[0].root);
    }

    // Restore original taxa lists in compare view
    compareSunbursts.forEach(sb => {
        const taxaListEl = document.getElementById(`compare-taxa-${sb.index}`);
        if (taxaListEl && sb.data) {
            // Sort by damage and render original data
            const sortedData = [...sb.data].sort((a, b) => (b.damage || 0) - (a.damage || 0));
            renderTaxaList(taxaListEl, sortedData.slice(0, 8), sb.data.length, sb.sample);

            // Restore stats
            const statsEl = document.getElementById(`compare-stats-${sb.index}`);
            if (statsEl) {
                const damagedCount = sb.data.filter(d => d.damage >= 0.11 && d.significance >= 2 && d.n_reads >= 100).length;
                statsEl.innerHTML = `<span class="stat-damaged">${damagedCount}</span> / ${sb.data.length}`;
            }
        }

        // Restore center text
        if (sb.centerEl) {
            sb.centerEl.innerHTML = `<h5>${sb.data.length}</h5><span>taxa</span>`;
        }
    });

    const filterInfo = document.getElementById('compare-filter-info');
    if (filterInfo) {
        // Reset taxa filter mode
        compareTaxaFilterMode = 'all';

        // Restore taxa filter buttons
        filterInfo.innerHTML = `
            <div class="compare-taxa-filter" id="compare-taxa-filter">
                <span class="filter-label">Show taxa:</span>
                <button class="taxa-filter-btn active" data-filter="all">All</button>
                <button class="taxa-filter-btn" data-filter="shared">
                    <span class="filter-dot shared"></span>Shared
                    <span class="filter-count" id="shared-count">0</span>
                </button>
                <button class="taxa-filter-btn" data-filter="unique">
                    <span class="filter-dot unique"></span>Unique
                    <span class="filter-count" id="unique-count">0</span>
                </button>
            </div>
            <span class="compare-hint">Click sunburst to filter by taxonomy</span>
        `;
        setupTaxaFilterButtons();
        updateTaxaCounts();
    }
};

// Initialize
async function init() {
    try {
        await initDuckDB();
        await loadSamples();
        setupEventListeners();
        setupResizeHandle();
        setupCompareSamplesOverlay();
    } catch (e) {
        console.error('Init error:', e);
        document.getElementById('sample-list').innerHTML = `
            <div class="empty-state">
                <h4>Error loading data</h4>
                <p>${e.message}</p>
            </div>
        `;
    }
}

init();
