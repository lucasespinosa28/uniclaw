/** Shared types for the Uniclaw application */

/** EIP-1193 compatible provider (e.g. walletClient.transport) */
export interface Eip1193Provider {
  request: (args: { method: string; params?: readonly unknown[] | object }) => Promise<unknown>;
}

export interface SafeDeploymentResult {
  safeAddress: string;
  owners: string[];
  threshold: number;
}

export interface RolesModifierDeployment {
  /** Address of the deployed Roles Modifier proxy */
  rolesModifierAddress: string;
  /** The Safe this modifier is attached to */
  safeAddress: string;
}

export interface RoleConfig {
  roleId: number;
  /** The member (User B) who receives this role */
  member: string;
  /** Target contract the role can call */
  targetAddress: string;
  /** Allowed function selectors on the target */
  allowedSelectors: `0x${string}`[];
}

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  fee: number;
  recipient: string;
  amountIn: bigint;
  amountOutMinimum: bigint;
  sqrtPriceLimitX96: bigint;
}

export type TxStatus = 'idle' | 'pending' | 'success' | 'error';

export interface StatusState {
  status: TxStatus;
  message: string;
  txHash?: string;
}
