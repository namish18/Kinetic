import * as fcl from '@onflow/fcl';
import { SHA3 } from 'sha3';
import EC from 'elliptic';

const ec = new EC.ec('p256');

// Setup FCL config for Testnet
fcl.config({
    "accessNode.api": "https://rest-testnet.onflow.org",
    "flow.network": "testnet"
});

const FLOW_ADDRESS = process.env.FLOW_ADDRESS;
const PRIVATE_KEY = process.env.FLOW_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.FLOW_CONTRACT_ADDRESS || FLOW_ADDRESS;

/**
 * Signer function for FCL authorizations
 */
const signWithKey = (privateKey, msg) => {
    const hexKey = privateKey.replace(/^0x/, '');
    const key = ec.keyFromPrivate(Buffer.from(hexKey, 'hex'));
    const hash = new SHA3(256).update(Buffer.from(msg, 'hex')).digest();
    const sig = key.sign(hash);
    const n = 32;
    const r = sig.r.toArrayLike(Buffer, 'be', n);
    const s = sig.s.toArrayLike(Buffer, 'be', n);
    return Buffer.concat([r, s]).toString('hex');
};

const authorizationFunction = async (account) => {
    return {
        ...account,
        tempId: `${FLOW_ADDRESS}-0`,
        addr: fcl.sansPrefix(FLOW_ADDRESS),
        keyId: 0,
        signingFunction: async (signable) => {
            return {
                addr: fcl.withPrefix(FLOW_ADDRESS),
                keyId: 0,
                signature: signWithKey(PRIVATE_KEY, signable.message)
            };
        }
    };
};

/**
 * Proposes a new payout on the KineticPayout contract
 */
export async function proposePayout(contributorAddress, amountFlow) {
    if (!FLOW_ADDRESS || !PRIVATE_KEY) {
        throw new Error("Missing Flow credentials in .env");
    }

    const transaction = `
        import KineticPayout from ${CONTRACT_ADDRESS}
        
        transaction(contributorArg: Address, amountArg: UFix64) {
            let treasury: &KineticPayout.OrgTreasury
            
            prepare(signer: auth(BorrowValue) &Account) {
                self.treasury = signer.storage.borrow<&KineticPayout.OrgTreasury>(from: /storage/OrgTreasury)
                    ?? panic("Signer does not have an OrgTreasury setup in their storage")
            }
        
            execute {
                let payouts: {Address: UFix64} = {
                    contributorArg: amountArg
                }
                let id = self.treasury.submitPayout(amounts: payouts)
            }
        }
    `;

    try {
        const transactionId = await fcl.mutate({
            cadence: transaction,
            args: (arg, t) => [
                arg(contributorAddress, t.Address),
                arg(amountFlow.toFixed(8), t.UFix64) // Formatting correctly for UFix64
            ],
            payer: authorizationFunction,
            proposer: authorizationFunction,
            authorizations: [authorizationFunction],
            limit: 999
        });

        console.log(`⏱️  Transaction submitted to Flow Testnet! Waiting for confirmation...`);
        const transactionDetails = await fcl.tx(transactionId).onceSealed();
        return {
            success: true,
            transactionId: transactionId,
            details: transactionDetails
        };
    } catch (error) {
        console.error("❌ Flow Transaction Failed:", error.message);
        return { success: false, error: error.message };
    }
}
