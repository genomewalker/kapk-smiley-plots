// ========== TABLE RENDERING ==========
import { state, domainColors } from './state.js?v=49';
import { n, fmt, pct, cleanName, getStatus } from './utils.js?v=49';
import { renderSunburst, updateLegend } from './sunburst.js?v=49';

export function renderSampleList(samples) {
    const container = document.getElementById('sample-list');
    container.innerHTML = samples.map(s => {
        const filteredCount = n(s.filtered_taxa_count) || n(s.taxa_count);
        const damagedPct = filteredCount > 0 ? (n(s.damaged_count) / filteredCount * 100).toFixed(0) : 0;
        return `
            <div class="sample-item" data-sample="${s.sample}">
                <div class="sample-item-header">
                    <span class="sample-name">${s.sample}</span>
                    <div class="sample-damage-indicator" style="background: ${damagedPct > 0 ? 'var(--status-damaged)' : 'var(--status-non-damaged)'}"></div>
                </div>
                <div class="sample-stats">
                    <span>Taxa: <span class="value">${fmt(filteredCount)}</span></span>
                    <span>Damaged: <span class="value">${damagedPct}%</span></span>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.sample-item').forEach(item => {
        item.addEventListener('click', async () => {
            const { selectSample } = await import('./actions.js?v=49');
            selectSample(item.dataset.sample);
        });
    });
}

export function renderTable() {
    const tbody = document.getElementById('table-body');

    if (state.filteredData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;padding:40px;color:var(--text-tertiary);">
                    No references match the current filters
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = state.filteredData.map(d => {
        const status = getStatus(d);
        const isSelected = state.selectedRef === d.id;
        const isComparing = state.compareList.includes(d.id);

        return `
            <tr data-id="${d.id}" class="${isSelected ? 'selected' : ''}">
                <td>
                    <div class="compare-checkbox ${isComparing ? 'checked' : ''}" data-id="${d.id}"></div>
                </td>
                <td class="cell-taxonomy" title="${cleanName(d.species)}">${cleanName(d.species)}</td>
                <td class="cell-taxonomy" title="${cleanName(d.genus)}">${cleanName(d.genus)}</td>
                <td class="cell-taxonomy" title="${cleanName(d.family)}">${cleanName(d.family)}</td>
                <td>
                    <div class="cell-damage">
                        <span class="cell-mono">${pct(d.damage)}%</span>
                    </div>
                </td>
                <td class="cell-number">${n(d.significance).toFixed(1)}</td>
                <td class="cell-number">${fmt(d.n_reads)}</td>
                <td><span class="status-badge ${status}">${status}</span></td>
            </tr>
        `;
    }).join('');

    // Row click handlers
    tbody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', async (e) => {
            const { selectReference, toggleCompare } = await import('./actions.js?v=49');
            if (e.target.closest('.compare-checkbox')) {
                toggleCompare(Number(row.dataset.id));
            } else {
                selectReference(Number(row.dataset.id));
            }
        });

        // Right-click context menu
        row.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const rowId = Number(row.dataset.id);
            const data = state.filteredData.find(d => d.id === rowId);
            if (data) {
                showContextMenu(e.clientX, e.clientY, data);
            }
        });
    });
}

// Context menu for taxa actions
function showContextMenu(x, y, data) {
    // Remove any existing context menu
    const existing = document.getElementById('table-context-menu');
    if (existing) existing.remove();

    const speciesName = cleanName(data.species);
    const genusName = cleanName(data.genus);
    const familyName = cleanName(data.family);

    const menu = document.createElement('div');
    menu.id = 'table-context-menu';
    menu.className = 'context-menu';
    menu.innerHTML = `
        <div class="context-menu-header">Track Across Samples</div>
        ${speciesName ? `
            <div class="context-menu-item primary" data-action="track-species" data-taxon="${speciesName}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                Species: ${speciesName}
            </div>
        ` : ''}
        ${genusName ? `
            <div class="context-menu-item" data-action="track-genus" data-taxon="${genusName}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                Genus: ${genusName}
            </div>
        ` : ''}
        ${familyName ? `
            <div class="context-menu-item" data-action="track-family" data-taxon="${familyName}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                Family: ${familyName}
            </div>
        ` : ''}
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" data-action="add-compare">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
            </svg>
            Add to Comparison
        </div>
        <div class="context-menu-item" data-action="view-details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
            View Details
        </div>
    `;

    // Position the menu
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    document.body.appendChild(menu);

    // Adjust position if menu goes off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = (y - rect.height) + 'px';
    }

    // Event handlers
    menu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', async () => {
            const action = item.dataset.action;
            const taxon = item.dataset.taxon;

            if (action === 'track-species' || action === 'track-genus' || action === 'track-family') {
                const { trackTaxonAcrossSamples } = await import('./compare.js?v=49');
                const level = action.replace('track-', '');
                trackTaxonAcrossSamples(taxon, level);
            } else if (action === 'add-compare') {
                const { addToBasket } = await import('./compare.js?v=49');
                // Note: addToBasket is on window, but we can also use direct import
                if (window.addToBasket) {
                    window.addToBasket(data.id, state.currentSample);
                }
            } else if (action === 'view-details') {
                const { selectReference } = await import('./actions.js?v=49');
                selectReference(data.id);
            }

            removeContextMenu();
        });
    });

    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', removeContextMenu);
        document.addEventListener('contextmenu', removeContextMenu);
        document.addEventListener('scroll', removeContextMenu, true);
    }, 0);
}

function removeContextMenu() {
    const menu = document.getElementById('table-context-menu');
    if (menu) menu.remove();
    document.removeEventListener('click', removeContextMenu);
    document.removeEventListener('contextmenu', removeContextMenu);
    document.removeEventListener('scroll', removeContextMenu, true);
}

export function buildSunburst() {
    if (state.filteredData.length === 0) return;

    const hierarchy = { name: 'root', children: [] };

    state.filteredData.forEach(d => {
        const path = [d.domain, d.phylum, d.class_, d.order_, d.family, d.genus];
        let current = hierarchy;

        path.forEach((name, i) => {
            if (!name) return;
            let child = current.children.find(c => c.name === name);
            if (!child) {
                child = { name, children: [], data: null };
                current.children.push(child);
            }
            current = child;
        });

        if (!current.children.find(c => c.name === d.species)) {
            current.children.push({ name: d.species || d.reference, children: [], data: d });
        }
    });

    const root = d3.hierarchy(hierarchy)
        .sum(d => d.data ? Number(d.data.n_reads) || 0 : 0)
        .sort((a, b) => Number(b.value) - Number(a.value));

    renderSunburst(root);
    updateLegend();
}
