// ========== CROSS-SAMPLE COMPARISON SYSTEM ==========
// A flagship feature for tracking taxa across multiple samples
import { state } from './state.js?v=83';
import { n, fmt, pct, cleanName, getStatus } from './utils.js?v=83';

// Global comparison basket (persists across sample switches)
if (!window.comparisonBasket) {
    window.comparisonBasket = [];
}

// Store tracking results for add button access
let currentTrackingResults = [];

// ==========================================
// TRACK TAXON ACROSS SAMPLES - The Hero Feature
// ==========================================
export async function trackTaxonAcrossSamples(taxonName, taxonLevel = 'species', filterSamples = null) {
    if (!state.conn) return;

    // Show loading state with dramatic animation
    showTrackingModal(taxonName);

    try {
        // Query all samples for this taxon
        // The database stores names with prefixes like s__, g__, f__ etc.
        // We need to match either the exact name or the prefixed version
        const levelColumn = taxonLevel === 'species' ? 'species' :
                           taxonLevel === 'genus' ? 'genus' :
                           taxonLevel === 'family' ? 'family' : 'species';

        const prefix = taxonLevel === 'species' ? 's__' :
                      taxonLevel === 'genus' ? 'g__' :
                      taxonLevel === 'family' ? 'f__' : 's__';

        // Escape single quotes in taxon name for SQL
        const escapedName = taxonName.replace(/'/g, "''");

        // Build sample filter clause if filterSamples provided
        let sampleFilter = '';
        if (filterSamples && filterSamples.length > 0) {
            const escapedSamples = filterSamples.map(s => `'${s.replace(/'/g, "''")}'`).join(',');
            sampleFilter = `AND m.sample IN (${escapedSamples})`;
        }

        const result = await state.conn.query(`
            SELECT m.*,
                f.fp1, f.fp2, f.fp3, f.fp4, f.fp5, f.fp6, f.fp7, f.fp8, f.fp9, f.fp10,
                f.fp11, f.fp12, f.fp13, f.fp14, f.fp15, f.fp16, f.fp17, f.fp18, f.fp19, f.fp20,
                f.fp21, f.fp22, f.fp23, f.fp24, f.fp25,
                f.fm1, f.fm2, f.fm3, f.fm4, f.fm5, f.fm6, f.fm7, f.fm8, f.fm9, f.fm10,
                f.fm11, f.fm12, f.fm13, f.fm14, f.fm15, f.fm16, f.fm17, f.fm18, f.fm19, f.fm20,
                f.fm21, f.fm22, f.fm23, f.fm24, f.fm25,
                f.dp1, f.dp2, f.dp3, f.dp4, f.dp5, f.dp6, f.dp7, f.dp8, f.dp9, f.dp10,
                f.dp11, f.dp12, f.dp13, f.dp14, f.dp15, f.dp16, f.dp17, f.dp18, f.dp19, f.dp20,
                f.dp21, f.dp22, f.dp23, f.dp24, f.dp25,
                f.dm1, f.dm2, f.dm3, f.dm4, f.dm5, f.dm6, f.dm7, f.dm8, f.dm9, f.dm10,
                f.dm11, f.dm12, f.dm13, f.dm14, f.dm15, f.dm16, f.dm17, f.dm18, f.dm19, f.dm20,
                f.dm21, f.dm22, f.dm23, f.dm24, f.dm25
            FROM meta m
            JOIN freq f ON m.id = f.id
            WHERE (m.${levelColumn} = '${escapedName}'
               OR m.${levelColumn} = '${prefix}${escapedName}'
               OR m.${levelColumn} LIKE '%__${escapedName}')
            ${sampleFilter}
            ORDER BY m.damage DESC
        `);

        const { convertResults } = await import('./utils.js?v=83');
        const matches = convertResults(result);

        renderTrackingResults(taxonName, taxonLevel, matches, filterSamples);
    } catch (err) {
        console.error('Track taxon error:', err);
        closeTrackingModal();
    }
}

function showTrackingModal(taxonName) {
    let modal = document.getElementById('tracking-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'tracking-modal';
        modal.className = 'tracking-modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="tracking-modal loading">
            <div class="tracking-loader">
                <div class="loader-dna">
                    <div class="helix"></div>
                    <div class="helix delayed"></div>
                </div>
                <h3>Tracking across samples...</h3>
                <p class="tracking-taxon">${cleanName(taxonName)}</p>
            </div>
        </div>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

// Track current filter state for the tracking modal
let trackingFilterStatus = 'all'; // 'all', 'damaged', 'non-damaged'
let trackingFocusedIdx = null; // Currently focused/expanded card index

// Navigation history for back button
let modalHistory = []; // Stack of previous modal states

function renderTrackingResults(taxonName, taxonLevel, matches, filterSamples = null) {
    const modal = document.getElementById('tracking-modal');
    if (!modal) return;

    // Store original index on each match for linking cards to table rows
    matches.forEach((m, idx) => m._origIdx = idx);

    // Store tracking results globally
    currentTrackingResults = matches;

    // Reset filter state
    trackingFilterStatus = 'all';
    trackingFocusedIdx = null;

    // Calculate stats
    const damagedCount = matches.filter(m => getStatus(m) === 'damaged').length;
    const nonDamagedCount = matches.length - damagedCount;
    const avgDamage = matches.length > 0
        ? matches.reduce((sum, m) => sum + n(m.damage), 0) / matches.length
        : 0;
    const totalReads = matches.reduce((sum, m) => sum + n(m.n_reads), 0);
    const totalAlns = matches.reduce((sum, m) => sum + n(m.n_alns), 0);

    // Subtitle text depends on whether we're filtering
    const subtitleText = filterSamples && filterSamples.length > 0
        ? `Across ${filterSamples.length} selected sample${filterSamples.length > 1 ? 's' : ''}`
        : 'Across all samples';

    // Check if we have navigation history (came from another modal)
    const hasHistory = modalHistory.length > 0;

    modal.innerHTML = `
        <div class="tracking-modal">
            <div class="tracking-header">
                ${hasHistory ? `
                <button class="tracking-back" onclick="goBackModal()" title="Go back">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Back
                </button>
                ` : ''}
                <div class="tracking-hero">
                    <div class="hero-badge">${taxonLevel.toUpperCase()}</div>
                    <h1>${cleanName(taxonName)}</h1>
                    <p class="hero-taxonomy">${subtitleText}</p>
                </div>
                <button class="tracking-close" onclick="closeTrackingModal()">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            <!-- Summary Stats + Filters -->
            <div class="tracking-toolbar">
                <div class="tracking-stats">
                    <div class="stat-chip">
                        <span class="stat-value">${matches.length}</span>
                        <span class="stat-label">hits</span>
                    </div>
                    <div class="stat-chip accent">
                        <span class="stat-value">${pct(avgDamage)}%</span>
                        <span class="stat-label">avg damage</span>
                    </div>
                    <div class="stat-chip">
                        <span class="stat-value">${fmt(totalReads)}</span>
                        <span class="stat-label">total reads</span>
                    </div>
                    <div class="stat-chip">
                        <span class="stat-value">${fmt(totalAlns)}</span>
                        <span class="stat-label">total alns</span>
                    </div>
                </div>
                <div class="tracking-filters">
                    <div class="filter-toggle" id="tracking-status-filter">
                        <button class="active" data-filter="all">All <span class="count">${matches.length}</span></button>
                        <button data-filter="damaged">Damaged <span class="count">${damagedCount}</span></button>
                        <button data-filter="non-damaged">Non-damaged <span class="count">${nonDamagedCount}</span></button>
                    </div>
                </div>
            </div>

            <!-- Scrollable Content -->
            <div class="tracking-content">
                <!-- Sample Gallery -->
                <div class="tracking-gallery" id="tracking-gallery">
                    ${matches.length === 0 ? `
                        <div class="no-matches">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M8 15s1.5-2 4-2 4 2 4 2"/>
                                <line x1="9" y1="9" x2="9.01" y2="9"/>
                                <line x1="15" y1="9" x2="15.01" y2="9"/>
                            </svg>
                            <h3>No matches found</h3>
                            <p>This taxon was not detected in any sample</p>
                        </div>
                    ` : matches.map((data, idx) => renderTrackingCard(data, idx)).join('')}
                </div>

            </div>

            <div class="tracking-footer">
                <div class="footer-left">
                    <span class="tracking-tip">${matches.length} sample${matches.length !== 1 ? 's' : ''} compared</span>
                </div>
                <div class="footer-actions">
                    ${matches.length > 0 ? `
                        <button class="btn btn-ghost" onclick="exportTrackingData()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Export CSV
                        </button>
                    ` : ''}
                    <button class="btn btn-primary" onclick="closeTrackingModal()">Done</button>
                </div>
            </div>
        </div>
    `;

    // Render smiley plots with staggered animation
    setTimeout(() => {
        matches.forEach((data, idx) => {
            setTimeout(() => renderTrackingSmile(data, idx), idx * 50);
        });
    }, 100);

    setupTrackingModalEvents();
    setupTrackingFilters();
}


function setupTrackingFilters() {
    const filterToggle = document.getElementById('tracking-status-filter');
    if (!filterToggle) return;

    filterToggle.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            trackingFilterStatus = btn.dataset.filter;
            applyTrackingFilter();
        });
    });
}

function applyTrackingFilter() {
    const gallery = document.getElementById('tracking-gallery');

    // Filter cards
    gallery.querySelectorAll('.tracking-card').forEach(card => {
        const idx = parseInt(card.dataset.idx);
        const data = currentTrackingResults[idx];
        const status = getStatus(data);

        if (trackingFilterStatus === 'all' || status === trackingFilterStatus) {
            card.classList.remove('filtered-out');
        } else {
            card.classList.add('filtered-out');
        }
    });
}


function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderTrackingCard(data, idx) {
    const status = getStatus(data);
    const escapedSample = escapeHtml(data.sample);
    return `
        <div class="tracking-card"
             style="animation-delay: ${idx * 0.03}s"
             data-id="${data.id}"
             data-idx="${idx}"
             data-sample="${escapedSample}"
             data-status="${status}"
>
            <div class="card-header">
                <span class="card-idx">${idx + 1}</span>
                <span class="card-sample">${escapedSample}</span>
                <span class="status-indicator ${status}" title="${status}"></span>
            </div>
            <div class="card-plot">
                <canvas id="tracking-canvas-${idx}"></canvas>
            </div>
            <div class="card-footer">
                <span class="damage-label">Damage</span>
                <span class="damage-value">${pct(data.damage)}%</span>
            </div>
            <!-- Expanded detail panel (shown when focused) -->
            <div class="card-expanded-detail">
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Reads</span>
                        <span class="detail-value">${fmt(data.n_reads)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Alns</span>
                        <span class="detail-value">${fmt(data.n_alns)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Signif.</span>
                        <span class="detail-value">${n(data.significance).toFixed(1)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Coverage</span>
                        <span class="detail-value">${n(data.coverage_mean).toFixed(1)}x</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Breadth</span>
                        <span class="detail-value">${pct(data.breadth)}%</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">B/E Ratio</span>
                        <span class="detail-value">${n(data.breadth_exp_ratio).toFixed(2)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">ANI</span>
                        <span class="detail-value">${n(data.read_ani_mean).toFixed(1)}%</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Entropy</span>
                        <span class="detail-value">${n(data.norm_entropy).toFixed(3)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Gini</span>
                        <span class="detail-value">${n(data.norm_gini).toFixed(3)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">GC %</span>
                        <span class="detail-value">${n(data.gc_content).toFixed(1)}%</span>
                    </div>
                </div>
                <div class="model-params">
                    <span class="model-title">Model Parameters</span>
                    <div class="model-grid">
                        <span>A=${n(data.map_A).toFixed(3)}</span>
                        <span>q=${n(data.map_q).toFixed(3)}</span>
                        <span>φ=${n(data.map_phi).toFixed(1)}</span>
                        <span>c=${n(data.map_c).toFixed(3)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderTrackingSmile(data, idx) {
    const canvas = document.getElementById(`tracking-canvas-${idx}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const container = canvas.parentElement;
    const w = container.clientWidth;
    const h = 100;

    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 10, right: 10, bottom: 18, left: 10 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    // Light background (matching sidebar)
    ctx.fillStyle = '#f8f7f6';
    ctx.fillRect(0, 0, w, h);

    const fp = [], fm = [], dp = [], dm = [];
    for (let i = 1; i <= 25; i++) {
        fp.push(n(data[`fp${i}`]));
        fm.push(n(data[`fm${i}`]));
        dp.push(n(data[`dp${i}`]));
        dm.push(n(data[`dm${i}`]));
    }

    const maxY = Math.max(0.35, ...fp, ...fm, ...dp, ...dm);
    const positions = 25;
    const halfW = plotW / 2;
    const xScale = halfW / positions;
    const yScale = plotH / maxY;

    // Grid line
    ctx.strokeStyle = '#e5e3df';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + plotH / 2);
    ctx.lineTo(w - padding.right, padding.top + plotH / 2);
    ctx.stroke();

    // Center line (dashed)
    ctx.strokeStyle = '#d4d1cc';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padding.left + halfW, padding.top);
    ctx.lineTo(padding.left + halfW, h - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // X-axis labels
    ctx.fillStyle = '#8c867d';
    ctx.font = '8px Source Sans 3';
    ctx.textAlign = 'center';
    ctx.fillText("5'", padding.left + halfW * 0.5, h - 4);
    ctx.fillText("3'", padding.left + halfW * 1.5, h - 4);

    // ===== DRAW OBSERVED FIRST (underneath, with alpha) =====
    // 5' observed (red semi-transparent)
    ctx.strokeStyle = 'rgba(232, 93, 93, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    fp.forEach((v, i) => {
        const x = padding.left + (i * xScale);
        const y = h - padding.bottom - (v * yScale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points for 5' observed
    ctx.fillStyle = 'rgba(232, 93, 93, 0.4)';
    fp.slice(0, 8).forEach((v, i) => {
        const x = padding.left + (i * xScale);
        const y = h - padding.bottom - (v * yScale);
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
    });

    // 3' observed (blue semi-transparent)
    ctx.strokeStyle = 'rgba(93, 158, 232, 0.4)';
    ctx.beginPath();
    fm.forEach((v, i) => {
        const x = padding.left + halfW + ((positions - 1 - i) * xScale);
        const y = h - padding.bottom - (v * yScale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points for 3' observed
    ctx.fillStyle = 'rgba(93, 158, 232, 0.4)';
    fm.slice(0, 8).forEach((v, i) => {
        const x = padding.left + halfW + ((positions - 1 - i) * xScale);
        const y = h - padding.bottom - (v * yScale);
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
    });

    // ===== DRAW MODEL ON TOP (solid colors) =====
    // 5' model (red solid)
    ctx.strokeStyle = '#e85d5d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    dp.forEach((v, i) => {
        const x = padding.left + (i * xScale);
        const y = h - padding.bottom - (v * yScale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 3' model (blue solid)
    ctx.strokeStyle = '#5d9ee8';
    ctx.beginPath();
    dm.forEach((v, i) => {
        const x = padding.left + halfW + ((positions - 1 - i) * xScale);
        const y = h - padding.bottom - (v * yScale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

function setupTrackingModalEvents() {
    const modal = document.getElementById('tracking-modal');
    if (!modal) return;

    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeTrackingModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeTrackingModal();
        }
    });
}

window.closeTrackingModal = function(preserveHistory = false) {
    const modal = document.getElementById('tracking-modal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
    // Clear history unless we're navigating back
    if (!preserveHistory) {
        modalHistory = [];
    }
};

// Highlight functions for linking cards and table rows
window.highlightTrackingCard = function(idx) {
    const card = document.querySelector(`.tracking-card[data-idx="${idx}"]`);
    if (card) card.classList.add('highlight');
};

window.unhighlightTrackingCard = function(idx) {
    const card = document.querySelector(`.tracking-card[data-idx="${idx}"]`);
    if (card) card.classList.remove('highlight');
};

// Focus/expand a card to show details
window.focusTrackingCard = function(idx) {
    const allCards = document.querySelectorAll('.tracking-card');
    const targetCard = document.querySelector(`.tracking-card[data-idx="${idx}"]`);

    if (!targetCard) return;

    // Toggle focus - if already focused, unfocus
    if (targetCard.classList.contains('focused')) {
        targetCard.classList.remove('focused');
        trackingFocusedIdx = null;
        // Remove dim from other cards
        allCards.forEach(c => c.classList.remove('dimmed'));
    } else {
        // Remove focus from any other card
        allCards.forEach(c => c.classList.remove('focused', 'dimmed'));

        // Focus this card and dim others
        targetCard.classList.add('focused');
        allCards.forEach(c => {
            if (c !== targetCard && !c.classList.contains('filtered-out')) {
                c.classList.add('dimmed');
            }
        });

        trackingFocusedIdx = idx;

        // Scroll card into view
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
};

// Export tracking data to CSV
window.exportTrackingData = function() {
    if (!currentTrackingResults || currentTrackingResults.length === 0) {
        return;
    }

    // Apply current filter
    const dataToExport = trackingFilterStatus === 'all'
        ? currentTrackingResults
        : currentTrackingResults.filter(d => getStatus(d) === trackingFilterStatus);

    const headers = [
        'sample', 'reference', 'domain', 'phylum', 'class', 'order', 'family', 'genus', 'species',
        'damage', 'significance', 'n_reads', 'status',
        'model_A', 'model_q', 'model_phi', 'model_c',
        'coverage_mean', 'breadth', 'breadth_exp_ratio', 'norm_entropy', 'norm_gini', 'read_ani_mean', 'gc_content'
    ];

    const rows = dataToExport.map(d => [
        d.sample,
        d.reference,
        d.domain,
        d.phylum,
        d.class_,
        d.order_,
        d.family,
        d.genus,
        d.species,
        d.damage,
        d.significance,
        d.n_reads,
        getStatus(d),
        d.map_A,
        d.map_q,
        d.map_phi,
        d.map_c,
        d.coverage_mean,
        d.breadth,
        d.breadth_exp_ratio,
        d.norm_entropy,
        d.norm_gini,
        d.read_ani_mean,
        d.gc_content
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v || ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Use taxon name in filename
    const taxonName = currentTrackingResults[0]?.species || currentTrackingResults[0]?.genus || 'taxon';
    const cleanTaxonName = cleanName(taxonName).replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `${cleanTaxonName}_tracking_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`Exported ${dataToExport.length} records`);
};


// ==========================================
// COMPARISON BASKET - Multi-sample collection
// ==========================================
window.addToBasket = function(id, sample) {
    const exists = window.comparisonBasket.find(item => item.id === id && item.sample === sample);
    if (!exists) {
        // Need to get full data - check multiple sources
        const data = state.filteredData.find(d => d.id === id) ||
                     state.sampleData.find(d => d.id === id) ||
                     currentTrackingResults.find(d => d.id === id && d.sample === sample);
        if (data) {
            window.comparisonBasket.push({ ...data, sample: sample || data.sample });
            updateBasketIndicator();
            showToast(`Added to comparison basket`);

            // Update card visual state in tracking modal
            const card = document.querySelector(`.tracking-card[data-id="${id}"][data-sample="${sample}"]`);
            if (card) {
                card.classList.add('in-basket');
                const btn = card.querySelector('.card-add-btn');
                if (btn) {
                    btn.classList.add('added');
                    btn.title = 'Already in basket';
                }
            }
        } else {
            console.warn('Could not find data for id:', id, 'sample:', sample);
        }
    } else {
        showToast(`Already in basket`, 'info');
    }
};

window.addAllToBasket = function() {
    // Use the already-loaded tracking results instead of re-querying
    if (!currentTrackingResults || currentTrackingResults.length === 0) {
        showToast('No items to add', 'info');
        return;
    }

    let added = 0;
    currentTrackingResults.forEach(data => {
        const exists = window.comparisonBasket.find(item => item.id === data.id && item.sample === data.sample);
        if (!exists) {
            window.comparisonBasket.push({ ...data });
            added++;
        }
    });

    updateBasketIndicator();
    showToast(`Added ${added} items to comparison basket`);
    closeTrackingModal();
    openComparePanel();
};

function updateBasketIndicator() {
    const compareBtn = document.getElementById('compare-taxa-btn');
    if (compareBtn) {
        let badge = compareBtn.querySelector('.basket-badge');
        if (window.comparisonBasket.length > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'basket-badge';
                compareBtn.appendChild(badge);
            }
            badge.textContent = window.comparisonBasket.length;
        } else if (badge) {
            badge.remove();
        }
    }
}

function showToast(message, type = 'success') {
    let toast = document.getElementById('comparison-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'comparison-toast';
        toast.className = 'comparison-toast';
        document.body.appendChild(toast);
    }

    const icon = type === 'success'
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;color:#22c55e">
               <polyline points="20 6 9 17 4 12"/>
           </svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:#f59e0b">
               <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
           </svg>`;

    toast.innerHTML = icon + `<span>${message}</span>`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ==========================================
// COMPARISON PANEL - The unified view
// ==========================================
export function openComparePanel() {
    // Use basket if available, otherwise fall back to single-sample selection
    const compareData = window.comparisonBasket.length > 0
        ? window.comparisonBasket
        : state.compareList.map(id => state.filteredData.find(d => d.id === id)).filter(Boolean);

    if (compareData.length === 0) {
        showCompareEmptyState();
        return;
    }

    let modal = document.getElementById('compare-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'compare-modal';
        modal.className = 'compare-modal-overlay';
        document.body.appendChild(modal);
    }

    // Group by sample for display
    const bySample = {};
    compareData.forEach(d => {
        const sample = d.sample || state.currentSample;
        if (!bySample[sample]) bySample[sample] = [];
        bySample[sample].push(d);
    });

    const sampleNames = Object.keys(bySample);

    // Calculate aggregate stats
    const damagedCount = compareData.filter(d => getStatus(d) === 'damaged').length;
    const nonDamagedCount = compareData.length - damagedCount;
    const avgDamage = compareData.reduce((s, d) => s + n(d.damage), 0) / compareData.length;
    const avgSignif = compareData.reduce((s, d) => s + n(d.significance), 0) / compareData.length;
    const totalReads = compareData.reduce((s, d) => s + n(d.n_reads), 0);
    const totalAlns = compareData.reduce((s, d) => s + n(d.n_alns), 0);

    modal.innerHTML = `
        <div class="compare-modal flagship">
            <!-- Decorative background -->
            <div class="compare-bg-pattern"></div>

            <!-- Header with dramatic hero section -->
            <div class="compare-hero">
                <div class="hero-content">
                    <div class="hero-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                        </svg>
                        COMPARISON
                    </div>
                    <h1>${compareData.length} Taxa</h1>
                    <p class="hero-subtitle">across ${sampleNames.length} sample${sampleNames.length > 1 ? 's' : ''}</p>
                </div>
                <button class="compare-close-btn" onclick="closeCompareModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            <!-- Stats ribbon -->
            <div class="compare-stats-ribbon">
                <div class="ribbon-stat">
                    <div class="stat-icon damaged">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                    </div>
                    <div class="stat-content">
                        <span class="stat-num">${damagedCount}</span>
                        <span class="stat-label">Damaged</span>
                    </div>
                </div>
                <div class="ribbon-stat">
                    <div class="stat-icon non-damaged">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                    </div>
                    <div class="stat-content">
                        <span class="stat-num">${nonDamagedCount}</span>
                        <span class="stat-label">Non-damaged</span>
                    </div>
                </div>
                <div class="ribbon-divider"></div>
                <div class="ribbon-stat highlight">
                    <span class="stat-num">${pct(avgDamage)}%</span>
                    <span class="stat-label">Avg Damage</span>
                </div>
                <div class="ribbon-stat">
                    <span class="stat-num">${avgSignif.toFixed(1)}</span>
                    <span class="stat-label">Avg Signif.</span>
                </div>
                <div class="ribbon-stat">
                    <span class="stat-num">${fmt(totalReads)}</span>
                    <span class="stat-label">Total Reads</span>
                </div>
                <div class="ribbon-stat">
                    <span class="stat-num">${fmt(totalAlns)}</span>
                    <span class="stat-label">Total Alns</span>
                </div>
            </div>

            <!-- Main content: Smiley plot grid -->
            <div class="compare-grid-section">
                <div class="section-header">
                    <h2>Damage Profiles</h2>
                    <button class="btn btn-ghost btn-sm" onclick="clearBasket()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        Clear All
                    </button>
                </div>
                <div class="smiley-grid">
                    ${compareData.map((data, idx) => renderCompareCard(data, idx)).join('')}
                </div>
            </div>

            <!-- Detailed stats table -->
            <div class="compare-table-section">
                <div class="section-header">
                    <h2>Detailed Statistics</h2>
                    <div class="table-legend">
                        <span class="legend-item"><span class="legend-dot freq"></span>Freq</span>
                        <span class="legend-item"><span class="legend-dot model"></span>Model</span>
                    </div>
                </div>
                <div class="compare-table-wrapper">
                    <table class="compare-data-table">
                        <thead>
                            <tr>
                                <th>Taxon</th>
                                <th>Sample</th>
                                <th>Status</th>
                                <th class="col-group-start">Damage</th>
                                <th>Signif.</th>
                                <th class="col-group-start model-col">A</th>
                                <th class="model-col">q</th>
                                <th class="model-col">φ</th>
                                <th class="model-col">c</th>
                                <th class="col-group-start">Reads</th>
                                <th>Alns</th>
                                <th>Cov.</th>
                                <th>Breadth</th>
                                <th>B/E</th>
                                <th>Entropy</th>
                                <th>Gini</th>
                                <th>ANI</th>
                                <th>GC</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${compareData.map(d => {
                                const status = getStatus(d);
                                const taxonName = cleanName(d.species) || cleanName(d.genus) || 'Unknown';
                                return `
                                    <tr>
                                        <td class="taxon-cell">
                                            <span class="taxon-name">${taxonName}</span>
                                            <span class="taxon-family">${cleanName(d.family) || ''}</span>
                                        </td>
                                        <td class="sample-cell">${d.sample}</td>
                                        <td><span class="status-chip ${status}">${status}</span></td>
                                        <td class="mono damage-cell col-group-start">${pct(d.damage)}%</td>
                                        <td class="mono">${n(d.significance).toFixed(1)}</td>
                                        <td class="mono model-col col-group-start">${n(d.map_A).toFixed(4)}</td>
                                        <td class="mono model-col">${n(d.map_q).toFixed(4)}</td>
                                        <td class="mono model-col">${n(d.map_phi).toFixed(2)}</td>
                                        <td class="mono model-col">${n(d.map_c).toFixed(4)}</td>
                                        <td class="mono col-group-start">${fmt(d.n_reads)}</td>
                                        <td class="mono">${fmt(d.n_alns)}</td>
                                        <td class="mono">${n(d.coverage_mean).toFixed(1)}x</td>
                                        <td class="mono">${pct(d.breadth)}%</td>
                                        <td class="mono">${n(d.breadth_exp_ratio).toFixed(2)}</td>
                                        <td class="mono">${n(d.norm_entropy).toFixed(3)}</td>
                                        <td class="mono">${n(d.norm_gini).toFixed(3)}</td>
                                        <td class="mono">${n(d.read_ani_mean).toFixed(1)}%</td>
                                        <td class="mono">${n(d.gc_content).toFixed(1)}%</td>
                                        <td class="action-cell">
                                            <button class="row-action track" onclick="window.trackFromCompare('${escapeHtml(d.species || d.genus)}', '${d.species ? 'species' : 'genus'}')" title="Track across samples">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                                                </svg>
                                            </button>
                                            <button class="row-action remove" onclick="removeFromBasket(${d.id}, '${escapeHtml(d.sample)}')" title="Remove">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Footer -->
            <div class="compare-footer">
                <div class="footer-left">
                    <button class="btn btn-ghost" onclick="exportComparison()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Export CSV
                    </button>
                </div>
                <button class="btn btn-primary" onclick="closeCompareModal()">Done</button>
            </div>
        </div>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Render plots with staggered animation
    setTimeout(() => {
        compareData.forEach((data, idx) => {
            setTimeout(() => renderCompareGridSmile(data, idx), idx * 30);
        });
    }, 100);

    setupCompareModalEvents();
}

function renderCompareCard(data, idx) {
    const status = getStatus(data);
    const taxonName = cleanName(data.species) || cleanName(data.genus) || 'Unknown';
    return `
        <div class="smiley-card" style="animation-delay: ${idx * 0.03}s">
            <div class="card-header">
                <div class="card-info">
                    <span class="card-taxon">${taxonName}</span>
                    <span class="card-sample">${data.sample}</span>
                </div>
                <span class="status-dot-lg ${status}"></span>
            </div>
            <div class="card-canvas-wrapper">
                <canvas id="compare-grid-${idx}"></canvas>
            </div>
            <div class="card-footer">
                <span class="card-damage">${pct(data.damage)}%</span>
                <span class="card-reads">${fmt(data.n_reads)} / ${fmt(data.n_alns)}</span>
            </div>
        </div>
    `;
}

function renderCompareGridSmile(data, idx) {
    const canvas = document.getElementById(`compare-grid-${idx}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const container = canvas.parentElement;
    const w = container.clientWidth;
    const h = 100;

    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 10, right: 10, bottom: 18, left: 10 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    // Light background (matching sidebar)
    ctx.fillStyle = '#f8f7f6';
    ctx.fillRect(0, 0, w, h);

    const fp = [], fm = [], dp = [], dm = [];
    for (let i = 1; i <= 25; i++) {
        fp.push(n(data[`fp${i}`]));
        fm.push(n(data[`fm${i}`]));
        dp.push(n(data[`dp${i}`]));
        dm.push(n(data[`dm${i}`]));
    }

    const maxY = Math.max(0.35, ...fp, ...fm, ...dp, ...dm);
    const positions = 25;
    const halfW = plotW / 2;
    const xScale = halfW / positions;
    const yScale = plotH / maxY;

    // Grid line
    ctx.strokeStyle = '#e5e3df';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + plotH / 2);
    ctx.lineTo(w - padding.right, padding.top + plotH / 2);
    ctx.stroke();

    // Center line (dashed)
    ctx.strokeStyle = '#d4d1cc';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padding.left + halfW, padding.top);
    ctx.lineTo(padding.left + halfW, h - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // X-axis labels
    ctx.fillStyle = '#8c867d';
    ctx.font = '8px Source Sans 3';
    ctx.textAlign = 'center';
    ctx.fillText("5'", padding.left + halfW * 0.5, h - 4);
    ctx.fillText("3'", padding.left + halfW * 1.5, h - 4);

    // ===== DRAW OBSERVED FIRST (underneath, with alpha) =====
    // 5' observed
    ctx.strokeStyle = 'rgba(232, 93, 93, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    fp.forEach((v, i) => {
        const x = padding.left + (i * xScale);
        const y = h - padding.bottom - (v * yScale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points for 5' observed
    ctx.fillStyle = 'rgba(232, 93, 93, 0.4)';
    fp.slice(0, 8).forEach((v, i) => {
        const x = padding.left + (i * xScale);
        const y = h - padding.bottom - (v * yScale);
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
    });

    // 3' observed
    ctx.strokeStyle = 'rgba(93, 158, 232, 0.4)';
    ctx.beginPath();
    fm.forEach((v, i) => {
        const x = padding.left + halfW + ((positions - 1 - i) * xScale);
        const y = h - padding.bottom - (v * yScale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points for 3' observed
    ctx.fillStyle = 'rgba(93, 158, 232, 0.4)';
    fm.slice(0, 8).forEach((v, i) => {
        const x = padding.left + halfW + ((positions - 1 - i) * xScale);
        const y = h - padding.bottom - (v * yScale);
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
    });

    // ===== DRAW MODEL ON TOP (solid colors) =====
    // 5' model
    ctx.strokeStyle = '#e85d5d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    dp.forEach((v, i) => {
        const x = padding.left + (i * xScale);
        const y = h - padding.bottom - (v * yScale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 3' model
    ctx.strokeStyle = '#5d9ee8';
    ctx.beginPath();
    dm.forEach((v, i) => {
        const x = padding.left + halfW + ((positions - 1 - i) * xScale);
        const y = h - padding.bottom - (v * yScale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

function showCompareEmptyState() {
    let modal = document.getElementById('compare-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'compare-modal';
        modal.className = 'compare-modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="compare-modal v2 empty">
            <button class="compare-close" onclick="closeCompareModal()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <div class="empty-compare-state">
                <div class="empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                    </svg>
                </div>
                <h3>No items to compare</h3>
                <p>Select taxa using the checkboxes in the table, or use "Track Across Samples" to find a taxon in all samples.</p>
                <div class="empty-tips">
                    <div class="tip">
                        <span class="tip-number">1</span>
                        <span>Check boxes next to taxa in the table</span>
                    </div>
                    <div class="tip">
                        <span class="tip-number">2</span>
                        <span>Right-click any taxon to "Track Across Samples"</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setupCompareModalEvents();
}

function renderCompareItemV2(data, sampleIdx, itemIdx) {
    const status = getStatus(data);
    const uniqueId = `${sampleIdx}-${itemIdx}`;
    return `
        <div class="compare-item-v2">
            <div class="item-header">
                <div class="item-title">
                    <h4>${cleanName(data.species) || cleanName(data.genus) || 'Unknown'}</h4>
                    <span class="item-family">${cleanName(data.family) || ''}</span>
                </div>
                <button class="item-remove" onclick="removeFromBasket(${data.id}, '${data.sample || state.currentSample}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="item-plot">
                <canvas id="compare-v2-${uniqueId}"></canvas>
            </div>
            <div class="item-stats">
                <span class="status-indicator ${status}"></span>
                <span class="damage-stat">${pct(data.damage)}%</span>
                <span class="signif-stat">${n(data.significance).toFixed(1)}</span>
                <span class="reads-stat">${fmt(data.n_reads)} / ${fmt(data.n_alns)}</span>
            </div>
            <button class="track-btn" onclick="window.trackFromCompare('${escapeHtml(data.species || data.genus)}', '${data.species ? 'species' : 'genus'}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                Track
            </button>
        </div>
    `;
}

function renderCompareSummary(compareData) {
    return `
        <div class="compare-summary-v2">
            <h3>Summary Statistics</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="summary-label">Mean Damage</span>
                    <span class="summary-value">${pct(compareData.reduce((s, d) => s + n(d.damage), 0) / compareData.length)}%</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Mean Significance</span>
                    <span class="summary-value">${(compareData.reduce((s, d) => s + n(d.significance), 0) / compareData.length).toFixed(1)}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Total Reads</span>
                    <span class="summary-value">${fmt(compareData.reduce((s, d) => s + n(d.n_reads), 0))}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Total Alns</span>
                    <span class="summary-value">${fmt(compareData.reduce((s, d) => s + n(d.n_alns), 0))}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Damaged Taxa</span>
                    <span class="summary-value">${compareData.filter(d => getStatus(d) === 'damaged').length}</span>
                </div>
            </div>
        </div>
    `;
}

function renderCompareSmileV2(data, sampleIdx, itemIdx) {
    const canvas = document.getElementById(`compare-v2-${sampleIdx}-${itemIdx}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const container = canvas.parentElement;
    const w = container.clientWidth;
    const h = 80;

    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#fafaf9';
    ctx.fillRect(0, 0, w, h);

    const padding = { top: 6, right: 6, bottom: 6, left: 6 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    const fp = [], fm = [], dp = [], dm = [];
    for (let i = 1; i <= 25; i++) {
        fp.push(n(data[`fp${i}`]));
        fm.push(n(data[`fm${i}`]));
        dp.push(n(data[`dp${i}`]));
        dm.push(n(data[`dm${i}`]));
    }

    const maxY = Math.max(0.4, ...fp, ...fm, ...dp, ...dm);
    const positions = 25;
    const halfW = plotW / 2;
    const xScale = halfW / positions;
    const yScale = plotH / maxY;

    // Model lines
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#e85d5d';
    ctx.beginPath();
    dp.forEach((v, i) => {
        const x = padding.left + (i * xScale);
        const y = h - padding.bottom - (v * yScale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.strokeStyle = '#5d9ee8';
    ctx.beginPath();
    dm.forEach((v, i) => {
        const x = padding.left + halfW + ((positions - 1 - i) * xScale);
        const y = h - padding.bottom - (v * yScale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

function setupCompareModalEvents() {
    const modal = document.getElementById('compare-modal');
    if (!modal) return;

    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeCompareModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeCompareModal();
        }
    });
}

window.closeCompareModal = function(preserveHistory = false) {
    const modal = document.getElementById('compare-modal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
    // Clear history unless we're navigating back
    if (!preserveHistory) {
        modalHistory = [];
    }
};

window.clearBasket = function() {
    window.comparisonBasket = [];
    state.compareList = [];
    updateBasketIndicator();
    import('./table.js?v=83').then(({ renderTable }) => renderTable());
    closeCompareModal();
};

window.removeFromBasket = function(id, sample) {
    const idx = window.comparisonBasket.findIndex(item => item.id === id && item.sample === sample);
    if (idx !== -1) {
        window.comparisonBasket.splice(idx, 1);
        updateBasketIndicator();
        if (window.comparisonBasket.length > 0) {
            openComparePanel();
        } else {
            closeCompareModal();
        }
    }
};

window.trackFromCompare = function(taxonName, level) {
    // Unescape HTML entities for the SQL query
    const unescaped = taxonName
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');

    // Push current state to history before navigating
    modalHistory.push({ type: 'compare' });
    closeCompareModal(true); // Preserve history so back button works
    trackTaxonAcrossSamples(unescaped, level);
};

// Go back to previous modal
window.goBackModal = function() {
    if (modalHistory.length === 0) return;

    const prev = modalHistory.pop();
    if (prev.type === 'compare') {
        closeTrackingModal(true); // preserve remaining history
        openComparePanel();
    } else if (prev.type === 'tracking') {
        closeCompareModal(true); // preserve remaining history
        trackTaxonAcrossSamples(prev.taxonName, prev.taxonLevel, prev.filterSamples);
    }
};

window.exportComparison = function() {
    const compareData = window.comparisonBasket.length > 0
        ? window.comparisonBasket
        : state.compareList.map(id => state.filteredData.find(d => d.id === id)).filter(Boolean);

    if (compareData.length === 0) {
        showToast('No data to export', 'info');
        return;
    }

    const headers = [
        'sample', 'reference', 'domain', 'phylum', 'class', 'order', 'family', 'genus', 'species',
        'damage', 'significance', 'n_reads', 'status',
        'model_A', 'model_q', 'model_phi', 'model_c',
        'coverage_mean', 'breadth', 'breadth_exp_ratio', 'norm_entropy', 'norm_gini', 'read_ani_mean', 'gc_content'
    ];

    const rows = compareData.map(d => [
        d.sample,
        d.reference,
        d.domain,
        d.phylum,
        d.class_,
        d.order_,
        d.family,
        d.genus,
        d.species,
        d.damage,
        d.significance,
        d.n_reads,
        getStatus(d),
        d.map_A,
        d.map_q,
        d.map_phi,
        d.map_c,
        d.coverage_mean,
        d.breadth,
        d.breadth_exp_ratio,
        d.norm_entropy,
        d.norm_gini,
        d.read_ani_mean,
        d.gc_content
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v || ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adna_comparison_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`Exported ${compareData.length} taxa`);
};

// Export for use in context menu
window.trackTaxonAcrossSamples = trackTaxonAcrossSamples;
