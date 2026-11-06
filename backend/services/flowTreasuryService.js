import * as fcl from "@onflow/fcl";

const FLOW_ADDRESS = process.env.FLOW_ADDRESS;
const CONTRACT_ADDRESS = process.env.FLOW_CONTRACT_ADDRESS || FLOW_ADDRESS;

fcl.config({
    "accessNode.api": "https://rest-testnet.onflow.org",
    "flow.network": "testnet",
});

/**
 * Read the treasury's live FLOW balance through the public contract capability.
 */
export async function getTreasuryBalance() {
    if (!FLOW_ADDRESS || !CONTRACT_ADDRESS) {
        throw new Error("Missing FLOW_ADDRESS or FLOW_CONTRACT_ADDRESS configuration");
    }

    const value = await fcl.query({
        cadence: `
            import KineticPayout from ${CONTRACT_ADDRESS}
            access(all) fun main(treasuryAccount: Address): UFix64 {
                let treasury = getAccount(treasuryAccount)
                    .capabilities.get<&{KineticPayout.OrgTreasuryPublic}>(/public/OrgTreasuryPublic)
                    .borrow()
                    ?? panic("Could not borrow treasury reference")
                return treasury.getBalance()
            }
        `,
        args: (arg, t) => [arg(FLOW_ADDRESS, t.Address)],
    });
    return String(value?.value ?? value);
}
