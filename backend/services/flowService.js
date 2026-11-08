import * as fcl from '@onflow/fcl';
import { SHA3 } from 'sha3';
import EC from 'elliptic';

const ec = new EC.ec('p256');
fcl.config({ "accessNode.api": "https://rest-testnet.onflow.org", "flow.network": "testnet" });

const FLOW_ADDRESS = process.env.FLOW_ADDRESS;
const PRIVATE_KEY = process.env.FLOW_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.FLOW_CONTRACT_ADDRESS || FLOW_ADDRESS;

function requireFlowReadConfig() {
    if (!FLOW_ADDRESS || !CONTRACT_ADDRESS) {
        throw new Error("Missing FLOW_ADDRESS or FLOW_CONTRACT_ADDRESS configuration");
    }
}
function requireFlowCredentials() {
    requireFlowReadConfig();
    if (!PRIVATE_KEY) throw new Error("Missing FLOW_PRIVATE_KEY configuration");
}
function signWithKey(privateKey, message) {
    const key = ec.keyFromPrivate(Buffer.from(privateKey.replace(/^0x/, ""), "hex"));
    const hash = new SHA3(256).update(Buffer.from(message, "hex")).digest();
    const signature = key.sign(hash);
    return Buffer.concat([
        signature.r.toArrayLike(Buffer, "be", 32),
        signature.s.toArrayLike(Buffer, "be", 32),
    ]).toString("hex");
}
const authorizationFunction = async account => {
    requireFlowCredentials();
    return {
        ...account, tempId: `${FLOW_ADDRESS}-0`, addr: fcl.sansPrefix(FLOW_ADDRESS), keyId: 0,
        signingFunction: async signable => ({
            addr: fcl.withPrefix(FLOW_ADDRESS), keyId: 0,
            signature: signWithKey(PRIVATE_KEY, signable.message),
        }),
    };
};
function unwrap(value) {
    return value && typeof value === "object" && "value" in value ? value.value : value;
}
function payoutIdFrom(details) {
    const event = (details?.events || []).find(item => String(item.type || "").endsWith(".PayoutProposed"));
    const id = unwrap(event?.data?.id);
    return id == null ? null : String(id);
}
async function mutateAndSeal(cadence, args) {
    requireFlowCredentials();
    const transactionId = await fcl.mutate({
        cadence, args, payer: authorizationFunction, proposer: authorizationFunction,
        authorizations: [authorizationFunction], limit: 999,
    });
    const details = await fcl.tx(transactionId).onceSealed();
    if (details?.errorMessage) throw new Error(details.errorMessage);
    if (details?.statusString && details.statusString !== "SEALED") {
        throw new Error(`Flow transaction did not seal (status: ${details.statusString})`);
    }
    return { transactionId, details };
}

/** Submit a single-recipient payout proposal and return its on-chain payout ID. */
export async function proposePayout(contributorAddress, amountFlow) {
    requireFlowCredentials();
    if (!/^0x[0-9a-fA-F]{16}$/.test(String(contributorAddress))) {
        throw new TypeError("A valid Flow address is required");
    }
    const amount = Number(amountFlow);
    if (!Number.isFinite(amount) || amount <= 0) throw new TypeError("Payout amount must be positive");
    const cadence = `
        import KineticPayout from ${CONTRACT_ADDRESS}
        transaction(contributorArg: Address, amountArg: UFix64) {
            let treasury: &KineticPayout.OrgTreasury
            prepare(signer: auth(BorrowValue) &Account) {
                self.treasury = signer.storage.borrow<&KineticPayout.OrgTreasury>(from: /storage/OrgTreasury)
                    ?? panic("Signer does not have an OrgTreasury setup in their storage")
            }
            execute {
                let payouts: {Address: UFix64} = { contributorArg: amountArg }
                self.treasury.submitPayout(amounts: payouts)
            }
        }
    `;
    const { transactionId, details } = await mutateAndSeal(cadence, (arg, t) => [
        arg(contributorAddress, t.Address), arg(amount.toFixed(8), t.UFix64),
    ]);
    const payoutId = payoutIdFrom(details);
    if (!payoutId) throw new Error("Sealed proposal did not emit a PayoutProposed ID");
    return { success: true, payoutId, transactionId, details };
}

export async function getPayout(payoutId) {
    requireFlowReadConfig();
    const id = String(payoutId);
    if (!/^\d+$/.test(id) || BigInt(id) < 1n) throw new TypeError("Payout ID must be a positive integer");
    const [record, executed] = await Promise.all([
        fcl.query({
            cadence: `
                import KineticPayout from ${CONTRACT_ADDRESS}
                access(all) fun main(treasuryAccount: Address, id: UInt64): KineticPayout.PayoutRecord? {
                    let treasury = getAccount(treasuryAccount).capabilities.get<&{KineticPayout.OrgTreasuryPublic}>(/public/OrgTreasuryPublic).borrow()
                        ?? panic("Could not borrow treasury reference")
                    return treasury.getPayout(id: id)
                }
            `,
            args: (arg, t) => [arg(FLOW_ADDRESS, t.Address), arg(id, t.UInt64)],
        }),
        fcl.query({
            cadence: `
                import KineticPayout from ${CONTRACT_ADDRESS}
                access(all) fun main(treasuryAccount: Address, id: UInt64): Bool {
                    let treasury = getAccount(treasuryAccount).capabilities.get<&{KineticPayout.OrgTreasuryPublic}>(/public/OrgTreasuryPublic).borrow()
                        ?? panic("Could not borrow treasury reference")
                    let payout = treasury.getPayout(id: id)
                    if payout == nil { return false }
                    return payout!.isExecuted()
                }
            `,
            args: (arg, t) => [arg(FLOW_ADDRESS, t.Address), arg(id, t.UInt64)],
        }),
    ]);
    if (!record) return null;
    return {
        id: String(unwrap(record.id)),
        amounts: record.amounts || {},
        totalAmount: String(unwrap(record.totalAmount)),
        approvals: Array.isArray(record.approvals) ? record.approvals.map(value => String(unwrap(value))) : [],
        executed: Boolean(unwrap(executed)),
    };
}

export async function getRequiredApprovals() {
    requireFlowReadConfig();
    const result = await fcl.query({
        cadence: `
            import KineticPayout from ${CONTRACT_ADDRESS}
            access(all) fun main(treasuryAccount: Address): Int {
                let treasury = getAccount(treasuryAccount).capabilities.get<&{KineticPayout.OrgTreasuryPublic}>(/public/OrgTreasuryPublic).borrow()
                    ?? panic("Could not borrow treasury reference")
                return treasury.getThreshold()
            }
        `,
        args: (arg, t) => [arg(FLOW_ADDRESS, t.Address)],
    });
    const threshold = Number(unwrap(result));
    if (!Number.isSafeInteger(threshold) || threshold < 1) throw new Error("Invalid Flow approval threshold");
    return threshold;
}

export async function approvePayout(payoutId) {
    requireFlowCredentials();
    const id = String(payoutId);
    if (!/^\d+$/.test(id) || BigInt(id) < 1n) throw new TypeError("Payout ID must be a positive integer");
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
            execute { self.treasury.approvePayout(id: id, signer: self.signerAddress) }
        }
    `;
    return mutateAndSeal(cadence, (arg, t) => [arg(id, t.UInt64)]);
}
export async function executePayout(payoutId) {
    requireFlowCredentials();
    const id = String(payoutId);
    if (!/^\d+$/.test(id) || BigInt(id) < 1n) throw new TypeError("Payout ID must be a positive integer");
    const cadence = `
        import KineticPayout from ${CONTRACT_ADDRESS}
        transaction(id: UInt64) {
            let treasury: &KineticPayout.OrgTreasury
            prepare(signer: auth(BorrowValue) &Account) {
                self.treasury = signer.storage.borrow<&KineticPayout.OrgTreasury>(from: /storage/OrgTreasury)
                    ?? panic("Signer does not have an OrgTreasury setup in their storage")
            }
            execute { self.treasury.executePayout(id: id) }
        }
    `;
    return mutateAndSeal(cadence, (arg, t) => [arg(id, t.UInt64)]);
}
