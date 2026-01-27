// ========== DETAIL PANEL & SMILEY PLOT ==========
import { n, fmt, pct, cleanName, getStatus } from './utils.js?v=50';

// Store current data for modal
let currentDetailData = null;

export function renderDetailPanel(data) {
    currentDetailData = data;
    const content = document.getElementById('detail-content');
    const status = getStatus(data);

    // Update header with species name
    const speciesName = cleanName(data.species) || cleanName(data.genus) || data.reference;
    document.getElementById('detail-species').textContent = speciesName;

    content.innerHTML = `
        <!-- Compact Smiley Plot -->
        <div class="smiley-compact">
            <canvas id="smiley-canvas" width="280" height="140"></canvas>
            <div class="smiley-legend-inline">
                <span class="legend-5p">5' C→T</span>
                <span class="legend-3p">3' G→A</span>
            </div>
        </div>

        <!-- Key Metrics Row -->
        <div class="metrics-row">
            <div class="metric-badge ${status}">${status}</div>
            <div class="metric"><span class="val">${pct(data.damage)}%</span><span class="lbl">damage</span></div>
            <div class="metric"><span class="val">${n(data.significance).toFixed(1)}</span><span class="lbl">signif</span></div>
            <div class="metric"><span class="val">${fmt(data.n_reads)}</span><span class="lbl">reads</span></div>
        </div>

        <!-- Taxonomy Path -->
        <div class="taxonomy-compact">
            ${[data.phylum, data.class_, data.order_, data.family, data.genus].filter(Boolean).map(cleanName).join(' › ')}
        </div>

        <!-- Actions -->
        <div class="detail-actions-compact">
            <button class="action-btn-sm" onclick="window.trackCurrentTaxon()" title="Track across samples">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                Track
            </button>
            <button class="action-btn-sm" onclick="window.openDetailModal()" title="Full details">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
                Details
            </button>
        </div>

        <!-- Collapsible Sections -->
        <div class="accordion-container">
            <!-- Damage Analysis -->
            <div class="accordion-section" data-section="damage">
                <button class="accordion-header" onclick="toggleAccordion('damage')">
                    <div class="accordion-title">
                        <svg class="accordion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                        </svg>
                        Damage Analysis
                    </div>
                    <svg class="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </button>
                <div class="accordion-content">
                    <div class="mini-stats-row">
                        <div class="mini-stat"><span class="label" data-tooltip="Observed C→T damage at 5' end">Observed</span><span class="value">${pct(data.damage)}%</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Model-fitted damage estimate">Model</span><span class="value">${pct(data.map_damage)}%</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Sigmas from zero - statistical confidence">Signif.</span><span class="value">${n(data.significance).toFixed(2)}</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Model significance estimate">Mod. Sig.</span><span class="value">${n(data.map_significance).toFixed(2)}</span></div>
                    </div>
                    <div class="mini-stats-row">
                        <div class="mini-stat"><span class="label" data-tooltip="Amplitude - background-independent damage level">A</span><span class="value mono">${n(data.map_A).toFixed(4)}</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Decay rate - how fast damage decreases from ends">q</span><span class="value mono">${n(data.map_q).toFixed(4)}</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Concentration parameter for beta-binomial distribution">φ</span><span class="value mono">${n(data.map_phi).toFixed(2)}</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Background - baseline substitution rate from sequencing errors">c</span><span class="value mono">${n(data.map_c).toFixed(4)}</span></div>
                    </div>
                </div>
            </div>

            <!-- Read Statistics -->
            <div class="accordion-section" data-section="reads">
                <button class="accordion-header" onclick="toggleAccordion('reads')">
                    <div class="accordion-title">
                        <svg class="accordion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                        Read Statistics
                    </div>
                    <svg class="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </button>
                <div class="accordion-content">
                    <div class="mini-stats-row">
                        <div class="mini-stat"><span class="label" data-tooltip="Number of reads aligned to reference">Reads</span><span class="value">${fmt(data.n_reads)}</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Total number of alignments">Aligns</span><span class="value">${fmt(data.n_alns)}</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Mean read length ± std deviation">Length</span><span class="value">${n(data.read_length_mean).toFixed(0)}±${n(data.read_length_std).toFixed(0)}</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Average GC content of aligned reads">GC</span><span class="value">${n(data.gc_content).toFixed(1)}%</span></div>
                    </div>
                </div>
            </div>

            <!-- Mapping Quality -->
            <div class="accordion-section" data-section="mapping">
                <button class="accordion-header" onclick="toggleAccordion('mapping')">
                    <div class="accordion-title">
                        <svg class="accordion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        Mapping Quality
                    </div>
                    <svg class="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </button>
                <div class="accordion-content">
                    <div class="mini-stats-row">
                        <div class="mini-stat"><span class="label" data-tooltip="Average alignment score">Score</span><span class="value">${n(data.read_aln_score).toFixed(1)}</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Average edit distance (mismatches + indels)">Edit</span><span class="value">${n(data.edit_distances).toFixed(2)}</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Average Nucleotide Identity of aligned reads">ANI</span><span class="value">${n(data.read_ani_mean).toFixed(1)}%</span></div>
                    </div>
                </div>
            </div>

            <!-- Coverage -->
            <div class="accordion-section" data-section="coverage">
                <button class="accordion-header" onclick="toggleAccordion('coverage')">
                    <div class="accordion-title">
                        <svg class="accordion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
                        </svg>
                        Coverage
                    </div>
                    <svg class="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </button>
                <div class="accordion-content">
                    <div class="mini-stats-row">
                        <div class="mini-stat"><span class="label" data-tooltip="Average sequencing depth across reference">Mean</span><span class="value">${n(data.coverage_mean).toFixed(2)}x</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="% of reference covered by ≥1 read">Breadth</span><span class="value">${pct(data.breadth)}%</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Expected breadth given coverage (1-e^-cov)">Exp.</span><span class="value">${pct(data.exp_breadth)}%</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Breadth/Expected ratio - near 1.0 = good">Ratio</span><span class="value">${n(data.breadth_exp_ratio).toFixed(2)}</span></div>
                    </div>
                    <div class="mini-stats-row">
                        <div class="mini-stat"><span class="label" data-tooltip="Number of reference bases with coverage">Bases</span><span class="value">${fmt(data.bases_covered)}</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Total reference genome length">Ref Len</span><span class="value">${fmt(data.reference_length)}</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Coverage uniformity - higher = more even">Evenness</span><span class="value">${n(data.cov_evenness).toFixed(3)}</span></div>
                        <div class="mini-stat"><span class="label" data-tooltip="Normalized Gini - higher = more uneven/clumped">Gini</span><span class="value">${n(data.norm_gini).toFixed(3)}</span></div>
                    </div>
                </div>
            </div>

            <!-- Taxonomy -->
            <div class="accordion-section" data-section="taxonomy">
                <button class="accordion-header" onclick="toggleAccordion('taxonomy')">
                    <div class="accordion-title">
                        <svg class="accordion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                        Taxonomy
                    </div>
                    <svg class="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </button>
                <div class="accordion-content">
                    <div class="taxonomy-compact">
                        <div class="tax-row"><span class="rank">D</span><span class="name">${cleanName(data.domain)}</span></div>
                        <div class="tax-row"><span class="rank">P</span><span class="name">${cleanName(data.phylum)}</span></div>
                        <div class="tax-row"><span class="rank">C</span><span class="name">${cleanName(data.class_)}</span></div>
                        <div class="tax-row"><span class="rank">O</span><span class="name">${cleanName(data.order_)}</span></div>
                        <div class="tax-row"><span class="rank">F</span><span class="name">${cleanName(data.family)}</span></div>
                        <div class="tax-row"><span class="rank">G</span><span class="name">${cleanName(data.genus)}</span></div>
                        <div class="tax-row"><span class="rank">S</span><span class="name">${cleanName(data.species)}</span></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Reference ID at bottom -->
        <div class="reference-footer">
            <span class="ref-label">Reference:</span>
            <span class="ref-value">${data.reference}</span>
        </div>
    `;

    renderSmileyPlot(data);
    initAccordion();
}

// Accordion toggle function
window.toggleAccordion = function(sectionId) {
    const section = document.querySelector(`.accordion-section[data-section="${sectionId}"]`);
    if (section) {
        section.classList.toggle('open');
    }
};

// Initialize accordion - open first section by default
function initAccordion() {
    const firstSection = document.querySelector('.accordion-section');
    if (firstSection) {
        firstSection.classList.add('open');
    }
}

// Track current taxon across all samples
window.trackCurrentTaxon = async function() {
    if (!currentDetailData) return;

    // Determine what to track (species if available, otherwise genus)
    const taxonName = cleanName(currentDetailData.species) || cleanName(currentDetailData.genus);
    const taxonLevel = currentDetailData.species ? 'species' : 'genus';

    if (taxonName) {
        // Dynamically import compare.js to get the tracking function
        const { trackTaxonAcrossSamples } = await import('./compare.js?v=50');
        trackTaxonAcrossSamples(taxonName, taxonLevel);
    }
};

// Modal functions
window.openDetailModal = function() {
    if (!currentDetailData) return;

    // Create modal if it doesn't exist
    let modal = document.getElementById('detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'detail-modal';
        modal.className = 'detail-modal-overlay';
        document.body.appendChild(modal);
    }

    const data = currentDetailData;
    const status = getStatus(data);

    modal.innerHTML = `
        <div class="detail-modal">
            <div class="modal-header">
                <div class="modal-title-section">
                    <h2>${cleanName(data.species) || cleanName(data.genus) || data.reference}</h2>
                    <p class="modal-taxonomy">${[data.domain, data.phylum, data.class_, data.order_, data.family, data.genus].filter(Boolean).map(cleanName).join(' › ')}</p>
                </div>
                <button class="modal-close" onclick="closeDetailModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            <div class="modal-body">
                <!-- Left: Large Smiley Plot -->
                <div class="modal-plot-section">
                    <div class="modal-smiley-container">
                        <canvas id="modal-smiley-canvas"></canvas>
                    </div>
                    <div class="modal-smiley-legend">
                        <div class="legend-item"><div class="legend-line model-5p"></div><span>5' C→T (model)</span></div>
                        <div class="legend-item"><div class="legend-line model-3p"></div><span>3' G→A (model)</span></div>
                        <div class="legend-item"><div class="legend-line observed"></div><span>Observed data</span></div>
                    </div>
                </div>

                <!-- Right: All Statistics -->
                <div class="modal-stats-section">
                    <!-- Status Hero -->
                    <div class="modal-status-hero ${status}">
                        <div class="status-label">${status.charAt(0).toUpperCase() + status.slice(1)}</div>
                        <div class="status-detail">Damage ${pct(data.damage)}% | Significance ${n(data.significance).toFixed(1)}</div>
                    </div>

                    <!-- Stats Grid -->
                    <div class="modal-stats-grid">
                        <div class="modal-stat-group">
                            <h4>Damage Metrics</h4>
                            <div class="stat-rows">
                                <div class="stat-row"><span>Observed</span><span>${pct(data.damage)}%</span></div>
                                <div class="stat-row"><span>Model Damage</span><span>${pct(data.map_damage)}%</span></div>
                                <div class="stat-row"><span>Significance</span><span>${n(data.significance).toFixed(2)}</span></div>
                                <div class="stat-row"><span>Model Significance</span><span>${n(data.map_significance).toFixed(2)}</span></div>
                            </div>
                        </div>

                        <div class="modal-stat-group">
                            <h4>Model Parameters</h4>
                            <div class="stat-rows">
                                <div class="stat-row"><span>A (amplitude)</span><span>${n(data.map_A).toFixed(4)}</span></div>
                                <div class="stat-row"><span>q (rate)</span><span>${n(data.map_q).toFixed(4)}</span></div>
                                <div class="stat-row"><span>φ (phase)</span><span>${n(data.map_phi).toFixed(4)}</span></div>
                                <div class="stat-row"><span>c (offset)</span><span>${n(data.map_c).toFixed(4)}</span></div>
                            </div>
                        </div>

                        <div class="modal-stat-group">
                            <h4>Read Statistics</h4>
                            <div class="stat-rows">
                                <div class="stat-row"><span>N Reads</span><span>${fmt(data.n_reads)}</span></div>
                                <div class="stat-row"><span>N Alignments</span><span>${fmt(data.n_alns)}</span></div>
                                <div class="stat-row"><span>Read Length (mean)</span><span>${n(data.read_length_mean).toFixed(1)}</span></div>
                                <div class="stat-row"><span>Read Length (std)</span><span>${n(data.read_length_std).toFixed(1)}</span></div>
                                <div class="stat-row"><span>Aligned Length</span><span>${n(data.read_aligned_length).toFixed(1)}</span></div>
                                <div class="stat-row"><span>GC Content</span><span>${n(data.gc_content).toFixed(1)}%</span></div>
                            </div>
                        </div>

                        <div class="modal-stat-group">
                            <h4>Alignment Quality</h4>
                            <div class="stat-rows">
                                <div class="stat-row"><span>Alignment Score</span><span>${n(data.read_aln_score).toFixed(1)}</span></div>
                                <div class="stat-row"><span>Edit Distance</span><span>${n(data.edit_distances).toFixed(2)}</span></div>
                                <div class="stat-row"><span>ANI (mean)</span><span>${n(data.read_ani_mean).toFixed(1)}%</span></div>
                                <div class="stat-row"><span>ANI (std)</span><span>${n(data.read_ani_std).toFixed(4)}</span></div>
                            </div>
                        </div>

                        <div class="modal-stat-group">
                            <h4>Coverage</h4>
                            <div class="stat-rows">
                                <div class="stat-row"><span>Mean Coverage</span><span>${n(data.coverage_mean).toFixed(2)}x</span></div>
                                <div class="stat-row"><span>Truncated</span><span>${n(data.coverage_mean_trunc).toFixed(2)}x</span></div>
                                <div class="stat-row"><span>Covered Mean</span><span>${n(data.coverage_covered_mean).toFixed(2)}x</span></div>
                                <div class="stat-row"><span>Bases Covered</span><span>${fmt(data.bases_covered)}</span></div>
                                <div class="stat-row"><span>Max Covered</span><span>${fmt(data.max_covered_bases)}</span></div>
                            </div>
                        </div>

                        <div class="modal-stat-group">
                            <h4>Reference & Breadth</h4>
                            <div class="stat-rows">
                                <div class="stat-row"><span>Reference Length</span><span>${fmt(data.reference_length)}</span></div>
                                <div class="stat-row"><span>Breadth</span><span>${pct(data.breadth)}%</span></div>
                                <div class="stat-row"><span>Expected Breadth</span><span>${pct(data.exp_breadth)}%</span></div>
                                <div class="stat-row"><span>Breadth/Exp Ratio</span><span>${n(data.breadth_exp_ratio).toFixed(2)}</span></div>
                                <div class="stat-row"><span>Norm Entropy</span><span>${n(data.norm_entropy).toFixed(4)}</span></div>
                                <div class="stat-row"><span>Norm Gini</span><span>${n(data.norm_gini).toFixed(4)}</span></div>
                                <div class="stat-row"><span>Cov Evenness</span><span>${n(data.cov_evenness).toFixed(4)}</span></div>
                            </div>
                        </div>
                    </div>

                    <!-- Full Taxonomy -->
                    <div class="modal-taxonomy-section">
                        <h4>Full Taxonomy</h4>
                        <div class="taxonomy-grid">
                            <div class="tax-item"><span class="rank">Domain</span><span class="name">${cleanName(data.domain)}</span></div>
                            <div class="tax-item"><span class="rank">Phylum</span><span class="name">${cleanName(data.phylum)}</span></div>
                            <div class="tax-item"><span class="rank">Class</span><span class="name">${cleanName(data.class_)}</span></div>
                            <div class="tax-item"><span class="rank">Order</span><span class="name">${cleanName(data.order_)}</span></div>
                            <div class="tax-item"><span class="rank">Family</span><span class="name">${cleanName(data.family)}</span></div>
                            <div class="tax-item"><span class="rank">Genus</span><span class="name">${cleanName(data.genus)}</span></div>
                            <div class="tax-item full-width"><span class="rank">Species</span><span class="name">${cleanName(data.species)}</span></div>
                        </div>
                    </div>

                    <!-- Reference -->
                    <div class="modal-reference">
                        <span class="ref-label">Reference ID:</span>
                        <code>${data.reference}</code>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Render the modal smiley plot
    setTimeout(() => renderModalSmileyPlot(data), 50);

    // Close on escape key
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeDetailModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeDetailModal();
        }
    });
};

window.closeDetailModal = function() {
    const modal = document.getElementById('detail-modal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
};

function renderModalSmileyPlot(data) {
    const canvas = document.getElementById('modal-smiley-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;

    const dpr = window.devicePixelRatio || 1;
    const w = Math.min(container.clientWidth - 32, 500);
    const h = 320;

    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 30, right: 30, bottom: 50, left: 60 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

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

    // Grid
    ctx.strokeStyle = '#e5e3df';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (plotH * i / 4);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = '#8c867d';
    ctx.font = '11px JetBrains Mono';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const val = maxY * (4 - i) / 4;
        const y = padding.top + (plotH * i / 4);
        ctx.fillText((val * 100).toFixed(0) + '%', padding.left - 12, y + 4);
    }

    // X-axis
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5c5752';
    ctx.font = '12px Source Sans 3';
    ctx.fillText("5' end", padding.left + plotW * 0.25, h - 15);
    ctx.fillText("3' end", padding.left + plotW * 0.75, h - 15);

    // Center line
    ctx.strokeStyle = '#d4d1cc';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left + plotW / 2, padding.top);
    ctx.lineTo(padding.left + plotW / 2, h - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    const halfW = plotW / 2;
    const xScale = halfW / positions;
    const yScale = plotH / maxY;

    // Draw observed (underneath)
    ctx.strokeStyle = 'rgba(232, 93, 93, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    fp.forEach((v, i) => {
        const x = padding.left + (i * xScale);
        const y = h - padding.bottom - (v * yScale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = 'rgba(232, 93, 93, 0.4)';
    fp.slice(0, 15).forEach((v, i) => {
        const x = padding.left + (i * xScale);
        const y = h - padding.bottom - (v * yScale);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.strokeStyle = 'rgba(93, 158, 232, 0.4)';
    ctx.beginPath();
    fm.forEach((v, i) => {
        const x = padding.left + halfW + ((positions - 1 - i) * xScale);
        const y = h - padding.bottom - (v * yScale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = 'rgba(93, 158, 232, 0.4)';
    fm.slice(0, 15).forEach((v, i) => {
        const x = padding.left + halfW + ((positions - 1 - i) * xScale);
        const y = h - padding.bottom - (v * yScale);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw model (on top)
    ctx.strokeStyle = '#e85d5d';
    ctx.lineWidth = 3;
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

export function renderSmileyPlot(data) {
    const canvas = document.getElementById('smiley-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth - 16;
    const h = 160; // Compact height for sidebar

    // Set display size
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    // Set actual size in memory (scaled for retina)
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    // Scale context to match
    ctx.scale(dpr, dpr);

    const padding = { top: 15, right: 15, bottom: 25, left: 35 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    // Clear with light background
    ctx.fillStyle = '#f8f7f6';
    ctx.fillRect(0, 0, w, h);

    // Extract observed frequencies
    const fp = [], fm = [];
    for (let i = 1; i <= 25; i++) {
        fp.push(n(data[`fp${i}`]));
        fm.push(n(data[`fm${i}`]));
    }

    // Extract model predictions from data (pre-computed in parquet)
    const dp = [], dm = [];
    for (let i = 1; i <= 25; i++) {
        dp.push(n(data[`dp${i}`]));
        dm.push(n(data[`dm${i}`]));
    }

    const maxY = Math.max(0.35, ...fp, ...fm, ...dp, ...dm);
    const positions = 25;

    // Grid lines (fewer for compact)
    ctx.strokeStyle = '#e5e3df';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 2; i++) {
        const y = padding.top + (plotH * i / 2);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
    }

    // Y-axis labels (fewer for compact)
    ctx.fillStyle = '#8c867d';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 2; i++) {
        const val = maxY * (2 - i) / 2;
        const y = padding.top + (plotH * i / 2);
        ctx.fillText((val * 100).toFixed(0) + '%', padding.left - 6, y + 3);
    }

    // X-axis labels (simplified)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5c5752';
    ctx.font = '9px Source Sans 3';
    ctx.fillText("5'", padding.left + plotW * 0.25, h - 6);
    ctx.fillText("3'", padding.left + plotW * 0.75, h - 6);

    // Center line
    ctx.strokeStyle = '#d4d1cc';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left + plotW / 2, padding.top);
    ctx.lineTo(padding.left + plotW / 2, h - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    const halfW = plotW / 2;
    const xScale = halfW / positions;
    const yScale = plotH / maxY;

    // ===== DRAW OBSERVED FIRST (underneath, with alpha) =====

    // Draw 5' OBSERVED (red, semi-transparent)
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

    // Points for 5' observed (semi-transparent) - smaller for compact
    ctx.fillStyle = 'rgba(232, 93, 93, 0.4)';
    fp.slice(0, 10).forEach((v, i) => {
        const x = padding.left + (i * xScale);
        const y = h - padding.bottom - (v * yScale);
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw 3' OBSERVED (blue, semi-transparent)
    ctx.strokeStyle = 'rgba(93, 158, 232, 0.4)';
    ctx.beginPath();
    fm.forEach((v, i) => {
        const x = padding.left + halfW + ((positions - 1 - i) * xScale);
        const y = h - padding.bottom - (v * yScale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points for 3' observed (semi-transparent) - smaller for compact
    ctx.fillStyle = 'rgba(93, 158, 232, 0.4)';
    fm.slice(0, 10).forEach((v, i) => {
        const x = padding.left + halfW + ((positions - 1 - i) * xScale);
        const y = h - padding.bottom - (v * yScale);
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
    });

    // ===== DRAW MODEL ON TOP (solid colors) =====

    // Draw 5' MODEL (red solid)
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

    // Draw 3' MODEL (blue solid)
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
