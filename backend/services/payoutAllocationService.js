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
    if (typeof units !== "bigint" || units < 0n) {
        throw new TypeError("FLOW units must be a non-negative bigint");
    }

    const whole = units / FLOW_SCALE;
    const fraction = (units % FLOW_SCALE).toString().padStart(8, "0");
    return `${whole}.${fraction}`;
}

function toScoreWeight(score) {
    const numeric = Number(score);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0n;
    if (numeric > Number.MAX_SAFE_INTEGER / Number(SCORE_SCALE)) {
        throw new RangeError("Contributor score is too large to allocate safely");
    }
    return BigInt(Math.round(numeric * Number(SCORE_SCALE)));
}

/**
 * Distribute a FLOW pool proportionally to contributor scores.
 * Uses integer UFix64 units and the largest-remainder method so the
 * returned allocations add up to the pool exactly without exceeding it.
 */
export function calculatePayoutAllocations(contributors, poolAmount) {
    if (!Array.isArray(contributors)) {
        throw new TypeError("Contributors must be an array");
    }

    const poolUnits = toFlowUnits(poolAmount);
    if (poolUnits <= 0n) {
        throw new RangeError("Available funding pool must be greater than zero");
    }

    const scoreByUsername = new Map();
    for (const contributor of contributors) {
        const username = String(contributor?.username || "").trim();
        if (!username) continue;

        const weight = toScoreWeight(contributor.totalScore);
        if (weight <= 0n) continue;

        scoreByUsername.set(username, (scoreByUsername.get(username) || 0n) + weight);
    }

    const weightedContributors = [...scoreByUsername.entries()]
        .map(([username, weight]) => ({ username, weight }))
        .sort((a, b) => a.username.localeCompare(b.username));

    if (weightedContributors.length === 0) {
        throw new RangeError("No contributors have a positive score");
    }

    const totalWeight = weightedContributors.reduce((sum, item) => sum + item.weight, 0n);
    const allocations = weightedContributors.map(item => {
        const numerator = poolUnits * item.weight;
        return {
            username: item.username,
            scoreWeight: item.weight,
            units: numerator / totalWeight,
            remainder: numerator % totalWeight,
        };
    });

    const allocatedUnits = allocations.reduce((sum, item) => sum + item.units, 0n);
    let remainingUnits = poolUnits - allocatedUnits;

    const remainderOrder = [...allocations].sort((a, b) => {
        if (a.remainder === b.remainder) return a.username.localeCompare(b.username);
        return a.remainder > b.remainder ? -1 : 1;
    });

    for (let index = 0; remainingUnits > 0n; index += 1) {
        remainderOrder[index % remainderOrder.length].units += 1n;
        remainingUnits -= 1n;
    }

    const recipientAllocations = allocations
        .map(item => ({
            username: item.username,
            amount: formatFlowUnits(item.units),
        }))
        .filter(item => toFlowUnits(item.amount) > 0n);

    const totalAllocatedUnits = recipientAllocations.reduce(
        (sum, item) => sum + toFlowUnits(item.amount),
        0n
    );

    if (totalAllocatedUnits > poolUnits) {
        throw new Error("Payout allocation exceeds the available funding pool");
    }

    return {
        totalPool: formatFlowUnits(poolUnits),
        totalAllocated: formatFlowUnits(totalAllocatedUnits),
        recipientAllocations,
    };
}

export function sumConfiguredBountyPools(repositories) {
    if (!Array.isArray(repositories)) {
        throw new TypeError("Repositories must be an array");
    }

    const totalUnits = repositories.reduce((sum, repository) => {
        const amount = repository?.bountyPool ?? 0;
        return sum + toFlowUnits(amount);
    }, 0n);

    return formatFlowUnits(totalUnits);
}
