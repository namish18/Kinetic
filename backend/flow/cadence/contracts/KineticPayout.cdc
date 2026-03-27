import FungibleToken from 0x9a0766d93b6608b7
import FlowToken from 0x7e60df042a9c0868

access(all) contract KineticPayout {

    access(all) event DepositReceived(amount: UFix64)
    access(all) event PayoutProposed(id: UInt64, totalAmount: UFix64)
    access(all) event PayoutApproved(id: UInt64, signer: Address)
    access(all) event PayoutExecuted(id: UInt64)

    access(all) struct PayoutRecord {
        access(all) let id: UInt64
        access(all) let amounts: {Address: UFix64}
        access(all) let totalAmount: UFix64
        access(all) var approvals: [Address]
        access(contract) var executed: Bool

        init(id: UInt64, amounts: {Address: UFix64}) {
            self.id = id
            self.amounts = amounts
            var total: UFix64 = 0.0
            for addr in amounts.keys {
                total = total + amounts[addr]!
            }
            self.totalAmount = total
            self.approvals = []
            self.executed = false
        }

        access(contract) fun setExecuted() {
            self.executed = true
        }

        access(all) view fun isExecuted(): Bool {
            return self.executed
        }
    }
    
    access(all) resource interface OrgTreasuryPublic {
        access(all) view fun getBalance(): UFix64
        access(all) fun deposit(from: @{FungibleToken.Vault})
        access(all) view fun getAuthorizedSigners(): [Address]
        access(all) view fun getPayout(id: UInt64): KineticPayout.PayoutRecord?
        access(all) view fun getThreshold(): Int
    }

    access(all) resource OrgTreasury: OrgTreasuryPublic {
        access(all) var vault: @{FungibleToken.Vault}
        access(all) var payouts: {UInt64: PayoutRecord}
        access(all) var nextPayoutId: UInt64
        access(all) var authorizedSigners: [Address]
        access(all) var requiredApprovals: Int
        
        init(signers: [Address]) {
            self.vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
            self.payouts = {}
            self.nextPayoutId = 1
            self.authorizedSigners = signers
            self.requiredApprovals = 1
        }

        access(all) fun deposit(from: @{FungibleToken.Vault}) {
            let amount = from.balance
            self.vault.deposit(from: <-from)
            emit DepositReceived(amount: amount)
        }

        access(all) fun addAuthorizedSigner(signer: Address) {
            if !self.authorizedSigners.contains(signer) {
                self.authorizedSigners.append(signer)
            }
        }

        access(all) fun setRequiredApprovals(count: Int) {
            self.requiredApprovals = count
        }

        access(all) view fun getBalance(): UFix64 {
            return self.vault.balance
        }

        access(all) view fun getAuthorizedSigners(): [Address] {
            return self.authorizedSigners
        }

        access(all) view fun getPayout(id: UInt64): KineticPayout.PayoutRecord? {
            return self.payouts[id]
        }

        access(all) view fun getThreshold(): Int {
            return self.requiredApprovals
        }

        access(all) fun submitPayout(amounts: {Address: UFix64}): UInt64 {
            let record = PayoutRecord(id: self.nextPayoutId, amounts: amounts)
            self.payouts[self.nextPayoutId] = record
            emit PayoutProposed(id: self.nextPayoutId, totalAmount: record.totalAmount)
            self.nextPayoutId = self.nextPayoutId + 1
            return record.id
        }

        access(all) fun approvePayout(id: UInt64, signer: Address) {
            pre {
                self.payouts[id] != nil: "Payout ID not found"
                !self.payouts[id]!.isExecuted(): "Already executed"
                self.authorizedSigners.contains(signer): "Not an authorized signer"
            }
            
            let record = self.payouts[id]!
            if !record.approvals.contains(signer) {
                record.approvals.append(signer)
                self.payouts[id] = record
                emit PayoutApproved(id: id, signer: signer)
            }
        }

        access(all) fun executePayout(id: UInt64) {
            pre {
                self.payouts[id] != nil: "Payout ID not found"
                !self.payouts[id]!.isExecuted(): "Already executed"
                self.payouts[id]!.approvals.length >= self.requiredApprovals: "Not enough approvals"
                self.vault.balance >= self.payouts[id]!.totalAmount: "Insufficient balance"
            }
            
            let record = self.payouts[id]!
            for address in record.amounts.keys {
                let amount = record.amounts[address]!
                let receiver = getAccount(address).capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
                    .borrow()
                    ?? panic("Could not borrow receiver capability for address")
                
                let payment <- self.vault.withdraw(amount: amount)
                receiver.deposit(from: <-payment)
            }

            let updatedRecord = self.payouts[id]!
            updatedRecord.setExecuted()
            self.payouts[id] = updatedRecord
            
            emit PayoutExecuted(id: id)
        }
    }

    init() {
        let signers: [Address] = [self.account.address]
        let treasury <- create OrgTreasury(signers: signers)
        
        self.account.storage.save(<-treasury, to: /storage/OrgTreasury)
        
        let cap = self.account.capabilities.storage.issue<&{OrgTreasuryPublic}>(/storage/OrgTreasury)
        self.account.capabilities.publish(cap, at: /public/OrgTreasuryPublic)
    }
}