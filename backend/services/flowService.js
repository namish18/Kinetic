import * as fcl from "@onflow/fcl";
import { SHA3 } from "sha3";
import EC from "elliptic";

const ec = new EC.ec("p256");

fcl.config({
    "accessNode.api": "https://rest-testnet.onflow.org",
    "flow.network": "testnet",
});

const FLOW_ADDRESS = process.env.FLOW_ADDRESS;
const PRIVATE_KEY = process.env.FLOW_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.FLOW_CONTRACT_ADDRESS || FLOW_ADDRESS;

function requireFlowCredentials() {
    if (!FLOW_ADDRESS || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
        throw new Error("Missing FLOW_ADDRESS, FLOW_PRIVATE_KEY, or FLOW_CONTRACT_ADDRESS configuration");
    }
}

function signWithKey(privateKey, message) {
    const hexKey = privateKey.replace(/^0x/, "");
    const key = ec.keyFromPrivate(Buffer.from(hexKey, "hex"));
    const hash = new SHA3(256).update(Buffer.from(message, "hex")).digest();
    const signature = key.sign(hash);
    const size = 32;
    const r = signature.r.toArrayLike(Buffer, "be", size);
    const s = signature.s.toArrayLike(Buffer, "be", size);
    return Buffer.concat([r, s]).toString("hex");
}

const authorizationFunction = async account => {
    requireFlowCredentials();
    return {
        ...account,
        tempId: `${FLOW_ADDRESS}-0`,
        addr: fcl.sansPrefix(FLOW_ADDRESS),
        keyId: 0,
        signingFunction: async signable => ({
            addr: fcl.withPrefix(FLOW_ADDRESS),
            keyId: 0,
            signature: signWithKey(PRIVATE_KEY, signable.message),
        }),
    };
};

function unwrapCadenceValue(value) {
    return value && typeof value === "object" && "value" in value ? value.value : value;
}

function normalizePayoutRecord(record, executedState) {
    if (!record) return null;
    const approvals = Array.isArray(record.approvals)
        ? record.approvals.map(value => String(unwrapCadenceValue(value)))
        : [];

    return {
        id: String(unwrapCadenceValue(record.id)),
        amounts: record.amounts || {},
        totalAmount: String(unwrapCadenceValue(record.totalAmount)),
        approvals,
        executed: Boolean(executedState ?? unwrapCadenceValue(record.executed)),
    };
}

async function mutateAndWaitForSeal(cadence, args) {
    requireFlowCredentials();
    const transactionId = await fcl.mutate({
        cadence,
        args,
        payer: authorizationFunction,
        proposer: authorizationFunction,
        authorizations: [authorizationFunction],
        limit: 999,
    });

    const details = await fcl.tx(transactionId).onceSealed();
    if (details?.errorMessage) {
        throw new Error(details.errorMessage);
    }
    if (details?.statusString && details.statusString !== "SEALED") {
        throw new Error(`Flow transaction did not seal (status: ${details.statusString})`);
    }

    return { transactionId, details };
}

function extractPayoutId(details) {
    const event = (details?.events || []).find(item =>
        String(item.type || "").endsWith(".PayoutProposed")
    );
    const id = event?.data?.id;
    const value = unwrapCadenceValue(id);
    return value === undefined || value === null ? null : String(value);
}

/**
 * Read the treasury's available FLOW balance from the deployed contract.
 */
export async function getTreasuryBalance() {
    requireFlowCredentials();
    const balance = await fcl.query({
        cadence: `
            import KineticPayout from ${CONTRACT_ADDRESS}

            access(all) fun main(treasuryAccount: Address): UFix64 {
                let treasuryRef = getAccount(treasuryAccount)
                    .capabilities.get<&{KineticPayout.OrgTreasuryPublic}>(/public/OrgTreasuryPublic)
                    .borrow()
                    ?? panic("Could not borrow treasury reference")
                return treasuryRef.getBalance()
            }
        `,
        args: (arg, t) => [arg(FLOW_ADDRESS, t.Address)],
    });
    return String(unwrapCadenceValue(balance));
}

/**
 * Read the configured approval threshold from the deployed treasury.
 */
export async function getRequiredApprovals() {
    requireFlowCredentials();
    const threshold = await fcl.query({
        cadence: `
            import KineticPayout from ${CONTRACT_ADDRESS}

            access(all) fun main(treasuryAccount: Address): Int {
                let treasuryRef = getAccount(treasuryAccount)
                    .capabilities.get<&{KineticPayout.OrgTreasuryPublic}>(/public/OrgTreasuryPublic)
                    .borrow()
                    ?? panic("Could not borrow treasury reference")
                return treasuryRef.getThreshold()
            }
        `,
        args: (arg, t) => [arg(FLOW_ADDRESS, t.Address)],
    });
    const value = Number(unwrapCadenceValue(threshold));
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new Error("The Flow treasury returned an invalid approval threshold");
    }
    return value;
}

/**
 * Retrieve a payout record from the treasury contract.
 */
export async function getPayout(payoutId) {
    requireFlowCredentials();
    const id = String(payoutId);
    if (!/^\d+$/.test(id) || BigInt(id) < 1n) {
        throw new TypeError("Payout ID must be a positive integer");
    }

    const [record, executed] = await Promise.all([
        fcl.query({
            cadence: `
                import KineticPayout from ${CONTRACT_ADDRESS}

                access(all) fun main(treasuryAccount: Address, id: UInt64): KineticPayout.PayoutRecord? {
                    let treasuryRef = getAccount(treasuryAccount)
                        .capabilities.get<&{KineticPayout.OrgTreasuryPublic}>(/public/OrgTreasuryPublic)
                        .borrow()
                        ?? panic("Could not borrow treasury reference")
                    return treasuryRef.getPayout(id: id)
                }
            `,
            args: (arg, t) => [
                arg(FLOW_ADDRESS, t.Address),
                arg(id, t.UInt64),
            ],
        }),
        fcl.query({
            cadence: `
                import KineticPayout from ${CONTRACT_ADDRESS}

                access(all) fun main(treasuryAccount: Address, id: UInt64): Bool {
                    let treasuryRef = getAccount(treasuryAccount)
                        .capabilities.get<&{KineticPayout.OrgTreasuryPublic}>(/public/OrgTreasuryPublic)
                        .borrow()
                        ?? panic("Could not borrow treasury reference")
                    let payout = treasuryRef.getPayout(id: id)
                    if payout == nil {
                        return false
                    }
                    return payout!.isExecuted()
                }
            `,
            args: (arg, t) => [
                arg(FLOW_ADDRESS, t.Address),
                arg(id, t.UInt64),
            ],
        }),
    ]);

    return normalizePayoutRecord(record, unwrapCadenceValue(executed));
}

/**
 * Submit a single funding-pool proposal containing all recipient allocations.
 * amounts must be an object mapping Flow addresses to decimal UFix64 strings.
 */
export async function proposePayouts(amounts) {
    if (!amounts || typeof amounts !== "object" || Array.isArray(amounts)) {
        throw new TypeError("Payout amounts must be an address-to-amount object");
    }

    const entries = Object.entries(amounts);
    if (entries.length === 0) {
        throw new RangeError("At least one payout recipient is required");
    }

    for (const [address, amount] of entries) {
        if (!/^0x[0-9a-fA-F]{16}$/.test(address)) {
            throw new TypeError(`Invalid Flow recipient address: ${address}`);
        }
        if (typeof amount !== "string" || !/^\d+(?:\.\d{1,8})?$/.test(amount) || Number(amount) <= 0) {
            throw new TypeError(`Invalid UFix64 payout amount for ${address}`);
        }
    }

    const cadence = `
        import KineticPayout from ${CONTRACT_ADDRESS}

        transaction(payouts: {Address: UFix64}) {
            let treasury: &KineticPayout.OrgTreasury

            prepare(signer: auth(BorrowValue) &Account) {
                self.treasury = signer.storage.borrow<&KineticPayout.OrgTreasury>(from: /storage/OrgTreasury)
                    ?? panic("Signer does not have an OrgTreasury setup in their storage")
            }

            execute {
                self.treasury.submitPayout(amounts: payouts)
            }
        }
    `;

    const { transactionId, details } = await mutateAndWaitForSeal(
        cadence,
        (arg, t) => [
            arg(entries.map(([key, value]) => ({ key, value })), t.Dictionary({ key: t.Address, value: t.UFix64 })),
        ]
    );

    const payoutId = extractPayoutId(details);
    if (!payoutId) {
        throw new Error(`Payout proposal transaction ${transactionId} sealed, but the PayoutProposed event did not contain an ID`);
    }

    return { success: true, payoutId, transactionId, details };
}

/**
 * Backward-compatible single-recipient wrapper. New funding-pool code should
 * call proposePayouts once with the complete allocation map.
 */
export async function proposePayout(contributorAddress, amountFlow) {
    const amount = Number(amountFlow);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new TypeError("Payout amount must be a positive finite number");
    }
    return proposePayouts({ [contributorAddress]: amount.toFixed(8) });
}

/**
 * Record the current transaction signer's approval on an existing proposal.
 */
export async function approvePayout(payoutId) {
    const id = String(payoutId);
    if (!/^\d+$/.test(id) || BigInt(id) < 1n) {
        throw new TypeError("Payout ID must be a positive integer");
    }

    const cadence = `
        import KineticPayout from ${CONTRACT_ADDRESS}

        transaction(id: UInt64) {
            let treasury: &KineticPayout.OrgTreasury
            let signerAddress: Address

            prepare(signer: auth(BorrowValue) &Account) {
                self.treasury = signer.storage.borrow<&KineticPayout.OrgTreasury>(from: /storage/OrgTreasury)
                    ?? panic("Signer does not have an OrgTreasury setup in their storage")
                self.signerAddress = signer.address
            }

            execute {
                self.treasury.approvePayout(id: id, signer: self.signerAddress)
            }
        }
    `;

    return mutateAndWaitForSeal(cadence, (arg, t) => [arg(id, t.UInt64)]);
}

/**
 * Execute a proposal only after the contract's configured approval threshold.
 * The contract performs the final threshold, balance, and replay checks too.
 */
export async function executePayout(payoutId) {
    const id = String(payoutId);
    if (!/^\d+$/.test(id) || BigInt(id) < 1n) {
        throw new TypeError("Payout ID must be a positive integer");
    }

    const cadence = `
        import KineticPayout from ${CONTRACT_ADDRESS}

        transaction(id: UInt64) {
            let treasury: &KineticPayout.OrgTreasury

            prepare(signer: auth(BorrowValue) &Account) {
                self.treasury = signer.storage.borrow<&KineticPayout.OrgTreasury>(from: /storage/OrgTreasury)
                    ?? panic("Signer does not have an OrgTreasury setup in their storage")
            }

            execute {
                self.treasury.executePayout(id: id)
            }
        }
    `;

    return mutateAndWaitForSeal(cadence, (arg, t) => [arg(id, t.UInt64)]);
}
