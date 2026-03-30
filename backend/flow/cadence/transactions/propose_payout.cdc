import KineticPayout from "../contracts/KineticPayout.cdc"

transaction(contributorArg: Address, amountArg: UFix64) {
    let treasury: &KineticPayout.OrgTreasury
    
    prepare(signer: auth(BorrowValue) &Account) {
        self.treasury = signer.storage.borrow<&KineticPayout.OrgTreasury>(from: /storage/OrgTreasury)
            ?? panic("Signer does not have an OrgTreasury")
    }

    execute {
        let payouts: {Address: UFix64} = {
            contributorArg: amountArg
        }
        let id = self.treasury.submitPayout(amounts: payouts)
        log("Payout proposed with ID: ".concat(id.toString()))
    }
}
