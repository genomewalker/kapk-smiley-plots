// ========== APPLICATION STATE ==========
export const state = {
    db: null,
    conn: null,
    currentSample: null,
    sampleData: [],
    filteredData: [],
    selectedRef: null,
    compareList: [],
    sortColumn: 'damage',
    sortDirection: 'desc',
    filters: {
        status: 'all',
        minDamage: 0,
        minSignificance: 0,
        minReads: 0,
        search: ''
    },
    filterPath: [], // Track taxonomy filter hierarchy
    showSunburst: true
};

// Domain colors - only Bacteria and Archaea
export const domainColors = {
    'd__Bacteria': '#22c55e',
    'd__Archaea': '#a855f7',
};
