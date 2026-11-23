import * as fcl from '@onflow/fcl';

// Configure FCL for Flow Testnet
fcl.config()
  .put('accessNode.api', 'https://rest-testnet.onflow.org')
  .put('discovery.wallet', 'https://fcl-discovery.onflow.org/testnet/authn')
  .put('app.detail.title', 'Kinetic Meritocratic Payouts')
  .put('app.detail.icon', 'https://kinetic.protocol.labs/logo.png')
  .put('0xKineticPayout', process.env.NEXT_PUBLIC_FLOW_ADDRESS || '0x01cf0e2f2f715450');

/**
 * Fetch Flow Treasury Vault Balance
 */
export async function getTreasuryBalance() {
  try {
    const response = await fcl.query({
      cadence: `
        import KineticPayout from 0xKineticPayout

        pub fun main(): UFix64 {
            return KineticPayout.getTreasuryBalance()
        }
      `,
    });
    return response;
  } catch (err) {
    console.error('Failed to query Flow Treasury balance:', err);
    return '0.00';
  }
}

/**
 * Authenticate User Flow Wallet
 */
export async function authenticateWallet() {
  return fcl.authenticate();
}

/**
 * Log out Flow Wallet
 */
export async function unauthenticateWallet() {
  return fcl.unauthenticate();
}

/**
 * Subscribe to User Wallet State
 */
export function subscribeToUser(callback) {
  return fcl.currentUser.subscribe(callback);
}