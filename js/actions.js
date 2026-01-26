// ========== USER ACTIONS ==========
import { state } from './state.js?v=31';
import { loadSampleData } from './data.js?v=31';
import { renderTable } from './table.js?v=31';
import { renderDetailPanel } from './detail-panel.js?v=31';

export function selectSample(sample) {
    state.currentSample = sample;
    state.selectedRef = null;

    // Save to localStorage for persistence on refresh
    localStorage.setItem('kapk-selected-sample', sample);


    document.querySelectorAll('.sample-item').forEach(item => {
        item.classList.toggle('active', item.dataset.sample === sample);
    });

    document.getElementById('status-sample').textContent = sample;

    // Reset detail panel
    document.getElementById('detail-content').innerHTML = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            <h4>No reference selected</h4>
            <p>Click a row in the table to view damage details</p>
        </div>
    `;

    loadSampleData();
}

export function selectReference(id) {
    state.selectedRef = id;
    const data = state.filteredData.find(d => d.id === id);
    if (!data) return;

    // Update table selection
    document.querySelectorAll('#table-body tr').forEach(row => {
        row.classList.toggle('selected', Number(row.dataset.id) === id);
    });

    renderDetailPanel(data);
    document.getElementById('status-selected').textContent = '1';
}

export function toggleCompare(id) {
    const idx = state.compareList.indexOf(id);
    if (idx === -1) {
        state.compareList.push(id);
    } else {
        state.compareList.splice(idx, 1);
    }
    renderTable();
}
