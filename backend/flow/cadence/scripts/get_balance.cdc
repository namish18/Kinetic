import KineticPayout from "../contracts/KineticPayout.cdc"

access(all) fun main(address: Address): UFix64 {
    let treasuryCap = getAccount(address).capabilities.get<&{KineticPayout.OrgTreasuryPublic}>(/public/OrgTreasuryPublic)
    let treasury = treasuryCap.borrow() ?? panic("Could not borrow OrgTreasury capability")
    return treasury.getBalance()
}
