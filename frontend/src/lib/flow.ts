"use client";
// @ts-ignore — @onflow/fcl does not ship TypeScript declarations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as fcl from "@onflow/fcl";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FLOW_ADDRESS!;

// Configure FCL for Flow Testnet
fcl.config({
  "accessNode.api": "https://rest-testnet.onflow.org",
  "discovery.wallet": "https://fcl-discovery.onflow.org/testnet/authn",
  "discovery.authn.endpoint":
    "https://fcl-discovery.onflow.org/api/testnet/authn",
  "app.detail.title": "Kinetic Payout Platform",
  "app.detail.icon": "https://kinetic.dev/icon.png",
  "flow.network": "testnet",
});

// ── Authentication ───────────────────────────────────────────────────────

export const connectWallet = () => fcl.authenticate();
export const disconnectWallet = () => fcl.unauthenticate();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getCurrentUser = (callback: (user: any) => void) => {
  return fcl.currentUser.subscribe(callback);
};

// ── Read: Treasury Balance ───────────────────────────────────────────────

export const getTreasuryBalance = async (
  treasuryAddress: string = CONTRACT_ADDRESS,
) => {
  try {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args: (arg: any, t: any) => [arg(treasuryAddress, t.Address)],
    });

    return balance;
  } catch (error: any) {
    console.error("Flow Query Error [getTreasuryBalance]:", error?.message || error);
    throw error;
  }
};

// ── Read: Payout Details ─────────────────────────────────────────────────

export const getPayoutById = async (payoutId: string) => {
  try {
    const result = await fcl.query({
      cadence: `
        import KineticPayout from ${CONTRACT_ADDRESS}

        access(all) fun main(id: UInt64): KineticPayout.PayoutRecord? {
          let treasuryRef = getAccount(${CONTRACT_ADDRESS})
            .capabilities.get<&{KineticPayout.OrgTreasuryPublic}>(/public/OrgTreasuryPublic)
            .borrow()
            ?? panic("Could not borrow treasury reference")

          return treasuryRef.getPayout(id: id)
        }
      `,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args: (arg: any, t: any) => [arg(parseInt(payoutId), t.UInt64)],
    });

    return result;
  } catch (error: any) {
    console.error("Flow Query Error [getPayoutById]:", error?.message || error);
    throw error;
  }
};

// ── Read: Authorized Signers ─────────────────────────────────────────────

export const getAuthorizedSigners = async () => {
  try {
    const signers = await fcl.query({
      cadence: `
        import KineticPayout from ${CONTRACT_ADDRESS}

        access(all) fun main(): [Address] {
          let treasuryRef = getAccount(${CONTRACT_ADDRESS})
            .capabilities.get<&{KineticPayout.OrgTreasuryPublic}>(/public/OrgTreasuryPublic)
            .borrow()
            ?? panic("Could not borrow treasury reference")

          return treasuryRef.getAuthorizedSigners()
        }
      `,
    });

    return signers;
  } catch (error: any) {
    console.error("Flow Query Error [getAuthorizedSigners]:", error?.message || error);
    throw error;
  }
};

// ── Read: Approval Threshold ─────────────────────────────────────────────

export const getApprovalThreshold = async () => {
  try {
    const threshold = await fcl.query({
      cadence: `
        import KineticPayout from ${CONTRACT_ADDRESS}

        access(all) fun main(): Int {
          let treasuryRef = getAccount(${CONTRACT_ADDRESS})
            .capabilities.get<&{KineticPayout.OrgTreasuryPublic}>(/public/OrgTreasuryPublic)
            .borrow()
            ?? panic("Could not borrow treasury reference")

          return treasuryRef.getThreshold()
        }
      `,
    });

    return threshold;
  } catch (error: any) {
    console.error("Flow Query Error [getApprovalThreshold]:", error?.message || error);
    throw error;
  }
};

// ── Mutate: Submit Payout ────────────────────────────────────────────────

export const submitPayoutTransaction = async (
  addresses: string[],
  amounts: string[],
) => {
  try {
    const transactionId = await fcl.mutate({
      cadence: `
        import KineticPayout from ${CONTRACT_ADDRESS}

        transaction(addresses: [Address], payAmounts: [UFix64]) {
          let treasuryRef: &KineticPayout.OrgTreasury

          prepare(signer: &Account) {
            self.treasuryRef = signer.storage.borrow<&KineticPayout.OrgTreasury>(from: /storage/OrgTreasury)
              ?? panic("Could not borrow OrgTreasury")
          }

          execute {
            let amountMap: {Address: UFix64} = {}
            var i = 0
            while i < addresses.length {
              amountMap[addresses[i]] = payAmounts[i]
              i = i + 1
            }
            self.treasuryRef.submitPayout(amounts: amountMap)
          }
        }
      `,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args: (arg: any, t: any) => [
        arg(addresses, t.Array(t.Address)),
        arg(amounts, t.Array(t.UFix64)),
      ],
      limit: 999,
    });

    console.log("Submit Payout TX ID:", transactionId);
    return await fcl.tx(transactionId).onceSealed();
  } catch (error: any) {
    console.error("Flow TX Error [submitPayout]:", error?.message || error);
    throw error;
  }
};

// ── Mutate: Approve Payout ───────────────────────────────────────────────

export const approvePayoutTransaction = async (payoutId: string) => {
  try {
    const transactionId = await fcl.mutate({
      cadence: `
        import KineticPayout from ${CONTRACT_ADDRESS}

        transaction(id: UInt64) {
          let treasuryRef: &KineticPayout.OrgTreasury
          let signerAddress: Address

          prepare(signer: &Account) {
            self.treasuryRef = signer.storage.borrow<&KineticPayout.OrgTreasury>(from: /storage/OrgTreasury)
              ?? panic("Could not borrow OrgTreasury")
            self.signerAddress = signer.address
          }

          execute {
            self.treasuryRef.approvePayout(id: id, signer: self.signerAddress)
          }
        }
      `,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args: (arg: any, t: any) => [arg(parseInt(payoutId), t.UInt64)],
      limit: 999,
    });

    console.log("Approve Payout TX ID:", transactionId);
    return await fcl.tx(transactionId).onceSealed();
  } catch (error: any) {
    console.error("Flow TX Error [approvePayout]:", error?.message || error);
    throw error;
  }
};

// ── Mutate: Execute Payout ───────────────────────────────────────────────

export const executePayoutTransaction = async (payoutId: string) => {
  try {
    const transactionId = await fcl.mutate({
      cadence: `
        import KineticPayout from ${CONTRACT_ADDRESS}

        transaction(payoutId: UInt64) {
          let treasuryRef: &KineticPayout.OrgTreasury

          prepare(signer: &Account) {
            self.treasuryRef = signer.storage.borrow<&KineticPayout.OrgTreasury>(from: /storage/OrgTreasury)
              ?? panic("Could not borrow OrgTreasury")
          }

          execute {
            self.treasuryRef.executePayout(id: payoutId)
          }
        }
      `,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args: (arg: any, t: any) => [arg(parseInt(payoutId), t.UInt64)],
      limit: 999,
    });

    console.log("Execute Payout TX ID:", transactionId);
    return await fcl.tx(transactionId).onceSealed();
  } catch (error: any) {
    console.error("Flow TX Error [executePayout]:", error?.message || error);
    throw error;
  }
};

// ── Mutate: Deposit to Treasury ──────────────────────────────────────────

export const depositToTreasury = async (amount: string) => {
  try {
    const transactionId = await fcl.mutate({
      cadence: `
        import FungibleToken from 0x9a0766d93b6608b7
        import FlowToken from 0x7e60df042a9c0868
        import KineticPayout from ${CONTRACT_ADDRESS}

        transaction(amount: UFix64) {
          prepare(signer: &Account) {
            let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
              from: /storage/flowTokenVault
            ) ?? panic("Could not borrow Flow vault")

            let payment <- vaultRef.withdraw(amount: amount)

            let treasuryRef = getAccount(${CONTRACT_ADDRESS})
              .capabilities.get<&{KineticPayout.OrgTreasuryPublic}>(/public/OrgTreasuryPublic)
              .borrow()
              ?? panic("Could not borrow treasury reference")

            treasuryRef.deposit(from: <-payment)
          }
        }
      `,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args: (arg: any, t: any) => [arg(amount, t.UFix64)],
      limit: 999,
    });

    console.log("Deposit TX ID:", transactionId);
    return await fcl.tx(transactionId).onceSealed();
  } catch (error: any) {
    console.error("Flow TX Error [depositToTreasury]:", error?.message || error);
    throw error;
  }
};
