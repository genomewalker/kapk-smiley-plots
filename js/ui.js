// ========== UI EVENT LISTENERS ==========
import { state } from './state.js?v=37';
import { applyFilters, exportData } from './data.js?v=37';
import { cleanName, getStatus, pct, fmt, convertResults } from './utils.js?v=37';

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getDefaultCommandResults() {
    return `
        <div class="command-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <p>Search for taxa across all samples</p>
            <span class="hint-example">e.g. "Streptococcus", "Lactobacillus"</span>
        </div>
    `;
}

async function performCrossSampleSearch(query) {
    if (!state.conn) return;

    const resultsContainer = document.getElementById('command-results');
    resultsContainer.innerHTML = `
        <div class="command-loading">
            <div class="loading-spinner small"></div>
            <span>Searching across all samples...</span>
        </div>
    `;

    try {
        const escapedQuery = query.replace(/'/g, "''").toLowerCase();

        // Search across all samples - aggregate to get correct counts
        const result = await state.conn.query(`
            SELECT
                COALESCE(species, genus, family) as taxon_name,
                CASE
                    WHEN species IS NOT NULL THEN 'species'
                    WHEN genus IS NOT NULL THEN 'genus'
                    ELSE 'family'
                END as taxon_level,
                COUNT(DISTINCT sample) as sample_count,
                MAX(damage) as max_damage,
                SUM(n_reads) as total_reads,
                SUM(CASE WHEN damage >= 0.11 AND significance >= 2 AND n_reads >= 100 THEN 1 ELSE 0 END) as damaged_count
            FROM meta
            WHERE (domain = 'd__Bacteria' OR domain = 'd__Archaea')
              AND (
                LOWER(species) LIKE '%${escapedQuery}%'
                OR LOWER(genus) LIKE '%${escapedQuery}%'
                OR LOWER(family) LIKE '%${escapedQuery}%'
                OR LOWER(phylum) LIKE '%${escapedQuery}%'
              )
            GROUP BY COALESCE(species, genus, family),
                     CASE
                         WHEN species IS NOT NULL THEN 'species'
                         WHEN genus IS NOT NULL THEN 'genus'
                         ELSE 'family'
                     END
            ORDER BY sample_count DESC, max_damage DESC
            LIMIT 15
        `);

        const uniqueTaxa = convertResults(result);

        if (uniqueTaxa.length === 0) {
            resultsContainer.innerHTML = `
                <div class="command-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <p>No matches found for "${escapeHtml(query)}"</p>
                </div>
            `;
            return;
        }

        resultsContainer.innerHTML = `
            <div class="command-group">
                <div class="command-group-title">Taxa across samples</div>
                ${uniqueTaxa.map(t => `
                    <div class="command-item taxon-result"
                         onclick="searchSelectTaxon('${escapeHtml(t.taxon_name)}', '${t.taxon_level}')">
                        <div class="command-item-icon taxon-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                            </svg>
                        </div>
                        <div class="command-item-content">
                            <div class="command-item-title">${cleanName(t.taxon_name)}</div>
                            <div class="command-item-desc">
                                <span class="sample-count">${t.sample_count} sample${t.sample_count > 1 ? 's' : ''}</span>
                                ${t.damaged_count > 0 ? `<span class="status-badge damaged">${t.damaged_count} damaged</span>` : ''}
                            </div>
                        </div>
                        <div class="command-item-action">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        console.error('Search error:', err);
        resultsContainer.innerHTML = `
            <div class="command-empty">
                <p>Search error. Try again.</p>
            </div>
        `;
    }
}

// Global function for search result clicks
window.searchSelectTaxon = function(taxonName, level) {
    // Close command palette
    document.getElementById('command-overlay').classList.remove('open');
    document.getElementById('command-input').value = '';

    // Unescape HTML entities for the SQL query
    const unescaped = taxonName
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');

    // Open tracking modal for this taxon
    import('./compare.js?v=37').then(({ trackTaxonAcrossSamples }) => {
        trackTaxonAcrossSamples(unescaped, level);
    });
};

export function setupEventListeners() {
    // Status filter
    document.querySelectorAll('#status-filter button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#status-filter button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.filters.status = btn.dataset.status;
            applyFilters();
        });
    });

    // Numeric filters
    ['filter-damage', 'filter-significance', 'filter-reads'].forEach(id => {
        document.getElementById(id).addEventListener('change', (e) => {
            const key = id.replace('filter-', '');
            state.filters[key === 'damage' ? 'minDamage' : key === 'significance' ? 'minSignificance' : 'minReads'] =
                parseFloat(e.target.value) || 0;
            applyFilters();
        });
    });

    // Table sorting
    document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (state.sortColumn === col) {
                state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortColumn = col;
                state.sortDirection = 'desc';
            }

            // Update header styles
            document.querySelectorAll('.data-table th').forEach(h => {
                h.classList.remove('sorted');
                const icon = h.querySelector('.sort-icon');
                if (icon) icon.textContent = '↕';
            });
            th.classList.add('sorted');
            th.querySelector('.sort-icon').textContent = state.sortDirection === 'asc' ? '↑' : '↓';

            applyFilters();
        });
    });

    // View toggle
    document.querySelectorAll('.view-toggle button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-toggle button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.showSunburst = btn.dataset.view === 'sunburst';
            document.getElementById('sunburst-container').classList.toggle('collapsed', !state.showSunburst);
        });
    });

    // Sunburst toggle
    document.getElementById('sunburst-toggle').addEventListener('click', () => {
        state.showSunburst = !state.showSunburst;
        document.getElementById('sunburst-container').classList.toggle('collapsed', !state.showSunburst);
    });

    // Detail close
    document.getElementById('detail-close').addEventListener('click', () => {
        state.selectedRef = null;
        document.querySelectorAll('#table-body tr').forEach(row => row.classList.remove('selected'));
        document.getElementById('status-selected').textContent = '0';
        document.getElementById('detail-content').innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                <h4>No reference selected</h4>
                <p>Click a row in the table to view damage details</p>
            </div>
        `;
        // Hide detail panel (for overlay mode on smaller screens)
        document.getElementById('detail-panel').classList.remove('open');
        document.getElementById('workspace').classList.add('detail-closed');
    });

    // Command palette
    const overlay = document.getElementById('command-overlay');
    const input = document.getElementById('command-input');

    document.getElementById('search-trigger').addEventListener('click', () => {
        overlay.classList.add('open');
        input.focus();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('open');
        }
    });

    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            overlay.classList.toggle('open');
            if (overlay.classList.contains('open')) {
                input.focus();
            }
        }
        if (e.key === 'Escape') {
            overlay.classList.remove('open');
        }
    });

    // Debounce for cross-sample search
    let searchTimeout = null;
    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        // Clear previous timeout
        if (searchTimeout) clearTimeout(searchTimeout);

        if (query.length < 2) {
            // Clear results and show default actions
            document.getElementById('command-results').innerHTML = getDefaultCommandResults();
            return;
        }

        // Debounce the search
        searchTimeout = setTimeout(() => {
            performCrossSampleSearch(query);
        }, 200);
    });

    // Export
    document.getElementById('export-btn').addEventListener('click', exportData);

    // Compare button
    document.getElementById('compare-btn').addEventListener('click', () => {
        import('./compare.js?v=37').then(({ openComparePanel }) => {
            openComparePanel();
        });
    });

    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (mobileMenuBtn && sidebar && sidebarOverlay) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('open');
            mobileMenuBtn.classList.toggle('open');
        });

        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('open');
            mobileMenuBtn.classList.remove('open');
        });
    }

    // Close mobile sidebar when a sample is selected
    document.getElementById('sample-list').addEventListener('click', (e) => {
        const sampleItem = e.target.closest('.sample-item');
        if (sampleItem && window.innerWidth <= 768) {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('open');
            mobileMenuBtn.classList.remove('open');
        }
    });
}
