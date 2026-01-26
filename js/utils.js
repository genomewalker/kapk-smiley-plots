// ========== UTILITY FUNCTIONS ==========

// Safe number formatting
export const n = (v) => Number(v) || 0;
export const fmt = (v) => n(v).toLocaleString();
export const pct = (v) => (n(v) * 100).toFixed(1);

// Clean taxonomy name by removing prefix
export const cleanName = (name) => name ? name.replace(/^[dpcofgs]__/, '') : '-';

// Get damage status based on significance, damage, and read count
export function getStatus(d) {
    const sig = Number(d.significance) || 0;
    const dmg = Number(d.damage) || 0;
    const reads = Number(d.n_reads) || 0;
    if (dmg >= 0.11 && sig >= 2 && reads >= 100) return 'damaged';
    return 'non-damaged';
}

// Convert DuckDB result to plain objects with BigInt handling
export function convertResults(result) {
    const rows = result.toArray();
    const schema = result.schema;
    const fields = schema.fields.map(f => f.name);

    return rows.map((row, idx) => {
        const obj = {};

        for (const field of fields) {
            let val = row[field];

            // Handle BigInt
            if (typeof val === 'bigint') {
                val = Number(val);
            }
            // Handle Vector/Array aggregates (DuckDB returns these as objects with numeric indices)
            else if (val && typeof val === 'object' && '0' in val) {
                val = typeof val[0] === 'bigint' ? Number(val[0]) : val[0];
            }

            obj[field] = val;
        }

        return obj;
    });
}
