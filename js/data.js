// ========== DATA LOADING ==========
import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm';
import { state } from './state.js?v=38';
import { convertResults, getStatus } from './utils.js?v=38';
import { renderSampleList, renderTable, buildSunburst } from './table.js?v=38';

export async function initDuckDB() {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
    );
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    state.db = new duckdb.AsyncDuckDB(logger, worker);
    await state.db.instantiate(bundle.mainModule);
    URL.revokeObjectURL(worker_url);
    state.conn = await state.db.connect();

    const baseUrl = new URL('/', window.location.href).href;
    const [metaResp, freqResp] = await Promise.all([
        fetch(baseUrl + 'meta.parquet'),
        fetch(baseUrl + 'freq.parquet')
    ]);
    const metaBuffer = new Uint8Array(await metaResp.arrayBuffer());
    const freqBuffer = new Uint8Array(await freqResp.arrayBuffer());

    await state.db.registerFileBuffer('meta.parquet', metaBuffer);
    await state.db.registerFileBuffer('freq.parquet', freqBuffer);

    await state.conn.query(`CREATE VIEW meta AS SELECT * FROM 'meta.parquet'`);
    await state.conn.query(`CREATE VIEW freq AS SELECT * FROM 'freq.parquet'`);
}

export async function loadSamples() {
    const result = await state.conn.query(`
        SELECT sample,
               COUNT(*) as taxa_count,
               SUM(n_reads) as total_reads,
               AVG(damage) as avg_damage,
               SUM(CASE WHEN damage >= 0.11 AND significance >= 2 AND n_reads >= 100 AND (domain = 'd__Bacteria' OR domain = 'd__Archaea') THEN 1 ELSE 0 END) as damaged_count,
               SUM(CASE WHEN (domain = 'd__Bacteria' OR domain = 'd__Archaea') THEN 1 ELSE 0 END) as filtered_taxa_count
        FROM meta
        GROUP BY sample
        ORDER BY sample
    `);

    const samples = convertResults(result);
    document.getElementById('sample-count').textContent = samples.length;
    renderSampleList(samples);

    if (samples.length > 0) {
        const { selectSample } = await import('./actions.js?v=38');

        // Try to restore from localStorage
        const savedSample = localStorage.getItem('kapk-selected-sample');
        if (savedSample && samples.find(s => s.sample === savedSample)) {
            selectSample(savedSample);
        } else {
            selectSample(samples[0].sample);
        }
    }
}

export async function loadSampleData() {
    if (!state.currentSample) return;

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
        WHERE m.sample = '${state.currentSample}'
    `);

    state.sampleData = convertResults(result);
    applyFilters();
}

export function applyFilters() {
    let data = [...state.sampleData];

    // Status filter
    if (state.filters.status !== 'all') {
        data = data.filter(d => {
            const status = getStatus(d);
            return status === state.filters.status;
        });
    }

    // Domain filter - only Bacteria and Archaea
    data = data.filter(d => d.domain === 'd__Bacteria' || d.domain === 'd__Archaea');

    // Numeric filters
    if (state.filters.minDamage > 0) {
        data = data.filter(d => d.damage >= state.filters.minDamage);
    }
    if (state.filters.minSignificance > 0) {
        data = data.filter(d => d.significance >= state.filters.minSignificance);
    }
    if (state.filters.minReads > 0) {
        data = data.filter(d => d.n_reads >= state.filters.minReads);
    }

    // Search filter
    if (state.filters.search) {
        const search = state.filters.search.toLowerCase();
        data = data.filter(d =>
            (d.domain && d.domain.toLowerCase().includes(search)) ||
            (d.phylum && d.phylum.toLowerCase().includes(search)) ||
            (d.class_ && d.class_.toLowerCase().includes(search)) ||
            (d.order_ && d.order_.toLowerCase().includes(search)) ||
            (d.family && d.family.toLowerCase().includes(search)) ||
            (d.genus && d.genus.toLowerCase().includes(search)) ||
            (d.species && d.species.toLowerCase().includes(search)) ||
            (d.reference && d.reference.toLowerCase().includes(search))
        );
    }

    // Sort
    data.sort((a, b) => {
        let aVal = a[state.sortColumn];
        let bVal = b[state.sortColumn];
        if (typeof aVal === 'string' || typeof bVal === 'string') {
            aVal = String(aVal || '');
            bVal = String(bVal || '');
            return state.sortDirection === 'asc'
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        }
        return state.sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });

    state.filteredData = data;

    // Update UI
    document.getElementById('status-total').textContent = state.sampleData.length.toLocaleString();
    document.getElementById('status-showing').textContent = data.length.toLocaleString();

    renderTable();
    if (state.showSunburst) {
        buildSunburst();
    }
}

export function exportData() {
    const headers = ['sample', 'reference', 'domain', 'phylum', 'class', 'order', 'family', 'genus', 'species', 'damage', 'significance', 'n_reads', 'status'];
    const rows = state.filteredData.map(d => [
        d.sample, d.reference, d.domain, d.phylum, d.class_, d.order_, d.family, d.genus, d.species,
        d.damage, d.significance, d.n_reads, getStatus(d)
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v || ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adna_damage_${state.currentSample || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
