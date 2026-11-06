const FLOW_SCALE = 100_000_000n;
const SCORE_SCALE = 1_000_000n;

export function toFlowUnits(value) {
    if (typeof value !== "string" && typeof value !== "number") {
        throw new TypeError("FLOW amount must be a string or number");
    }
    const raw = typeof value === "number" ? value.toFixed(8) : value.trim();
    if (!/^\d+(?:\.\d{1,8})?$/.test(raw)) {
        throw new RangeError("FLOW amount must be a non-negative decimal with at most 8 places");
    }
    const [whole, fraction = ""] = raw.split(".");
    return BigInt(whole) * FLOW_SCALE + BigInt(fraction.padEnd(8, "0"));
}

export function formatFlowUnits(units) {
    if (typeof units !== "bigint" || units < 0n) throw new TypeError("FLOW units must be non-negative");
    return `${units / FLOW_SCALE}.${(units % FLOW_SCALE).toString().padStart(8, "0")}`;
}

function scoreWeight(score) {
    const value = Number(score);
    if (!Number.isFinite(value) || value <= 0) return 0n;
    if (value > Number.MAX_SAFE_INTEGER / Number(SCORE_SCALE)) {
        throw new RangeError("Contributor score is too large to allocate safely");
    }
    return BigInt(Math.round(value * Number(SCORE_SCALE)));
}

/**
 * Split a pool proportionally to contributor score using integer UFix64 units.
 * Largest-remainder rounding makes the sum exact and deterministic.
 */
export function calculatePayoutAllocations(contributors, poolAmount) {
    if (!Array.isArray(contributors)) throw new TypeError("Contributors must be an array");
    const poolUnits = toFlowUnits(poolAmount);
    if (poolUnits <= 0n) throw new RangeError("Available funding pool must be greater than zero");

    const byUsername = new Map();
    for (const contributor of contributors) {
        const username = String(contributor?.username || "").trim();
        if (!username) continue;
        const weight = scoreWeight(contributor.totalScore);
        if (weight > 0n) byUsername.set(username, (byUsername.get(username) || 0n) + weight);
    }
    const weighted = [...byUsername.entries()]
        .map(([username, weight]) => ({ username, weight }))
        .sort((a, b) => a.username.localeCompare(b.username));
    if (weighted.length === 0) throw new RangeError("No contributors have a positive score");

    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0n);
    const rows = weighted.map(item => {
        const numerator = poolUnits * item.weight;
        return { username: item.username, units: numerator / totalWeight, remainder: numerator % totalWeight };
    });
    let remaining = poolUnits - rows.reduce((sum, item) => sum + item.units, 0n);
    const remainderOrder = [...rows].sort((a, b) => {
        if (a.remainder === b.remainder) return a.username.localeCompare(b.username);
        return a.remainder > b.remainder ? -1 : 1;
    });
    for (let index = 0; remaining > 0n; index += 1) {
        remainderOrder[index % remainderOrder.length].units += 1n;
        remaining -= 1n;
    }

    const recipientAllocations = rows
        .map(item => ({ username: item.username, amount: formatFlowUnits(item.units) }))
        .filter(item => toFlowUnits(item.amount) > 0n);
    const totalAllocatedUnits = recipientAllocations.reduce((sum, item) => sum + toFlowUnits(item.amount), 0n);
    if (totalAllocatedUnits > poolUnits) throw new Error("Payout allocation exceeds the available funding pool");
    return {
        totalPool: formatFlowUnits(poolUnits),
        totalAllocated: formatFlowUnits(totalAllocatedUnits),
        recipientAllocations,
    };
}

export function sumConfiguredBountyPools(repositories) {
    if (!Array.isArray(repositories)) throw new TypeError("Repositories must be an array");
    return formatFlowUnits(repositories.reduce(
        (sum, repository) => sum + toFlowUnits(repository?.bountyPool ?? 0),
        0n
    ));
}
