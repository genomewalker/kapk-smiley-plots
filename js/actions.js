// ========== USER ACTIONS ==========
import { state } from './state.js?v=83';
import { loadSampleData } from './data.js?v=83';
import { renderTable } from './table.js?v=83';
import { renderDetailPanel } from './detail-panel.js?v=83';
import { openDetailPanel, closeDetailPanel } from './ui.js?v=83';

export function selectSample(sample) {
    state.currentSample = sample;
    state.selectedRef = null;

    // Save to localStorage for persistence on refresh
    localStorage.setItem('kapk-selected-sample', sample);

    document.querySelectorAll('.sample-item').forEach(item => {
        item.classList.toggle('active', item.dataset.sample === sample);
    });

    document.getElementById('status-sample').textContent = sample;

    // Close detail panel when switching samples
    closeDetailPanel();

    // Reset detail section
    document.getElementById('detail-species').textContent = 'Select a taxon';
    document.getElementById('detail-content').innerHTML = `
        <div class="empty-state small">
            <p>Click a row to view damage profile</p>
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
    openDetailPanel();
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
