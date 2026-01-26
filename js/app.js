// ========== MAIN APPLICATION ENTRY POINT ==========
import { initDuckDB, loadSamples } from './data.js?v=38';
import { setupEventListeners } from './ui.js?v=38';
import { goBackOneLevel, clearAllFilters, navigateToFilterLevel } from './sunburst.js?v=38';

// Make navigation functions globally accessible for onclick handlers
window.goBackOneLevel = goBackOneLevel;
window.clearAllFilters = clearAllFilters;
window.navigateToFilterLevel = navigateToFilterLevel;

// Initialize application
async function init() {
    try {
        await initDuckDB();
        await loadSamples();
        setupEventListeners();
    } catch (e) {
        console.error('Init error:', e);
        showError(e.message);
    }
}

function showError(message) {
    document.getElementById('sample-list').innerHTML = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <h4>Error loading data</h4>
            <p>${message}</p>
        </div>
    `;
}

// Start the application
init();
