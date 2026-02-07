/**
 * Contract addresses and ABIs for Sepolia testnet.
 *
 * - Zodiac Module Proxy Factory: canonical cross-chain deployment
 * - Roles Modifier v1: scoped permission enforcement
 * - uniswap SwapRouter02: the target we scope permissions for
 */

// ──────────────────────────────────────────────
// Addresses (Sepolia)
// ──────────────────────────────────────────────

/** Zodiac Module Proxy Factory – canonical deployment across all EVM chains */
export const MODULE_PROXY_FACTORY_ADDRESS =
  '0x00000000000DC7F163742Eb4aBEf650037b1f588' as const;

/**
 * Roles Modifier v1 mastercopy (Sepolia).
 * Deployed via the Zodiac canonical infrastructure.
 * Source: https://github.com/gnosis-guild/zodiac-modifier-roles
 */
export const ROLES_MODIFIER_MASTERCOPY =
  '0xD8DfC1d938D7D163C5231688341e9635E9011889' as const;

/** uniswap SwapRouter02 on Sepolia */
export const UNISWAP_SWAP_ROUTER =
  '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E' as const;

/** uniswap Factory on Sepolia */
export const UNISWAP_V3_FACTORY =
  '0x0227628f3F023bb0B980b67D528571c95c6DaC1c' as const;

/** Standard uniswap fee tiers (in hundredths of a bip) */
export const FEE_TIERS = [100, 500, 3000, 10000] as const;

/** Human-readable fee tier labels */
export const FEE_TIER_LABELS: Record<number, string> = {
  100: '0.01%',
  500: '0.05%',
  3000: '0.3%',
  10000: '1%',
};

/** WETH on Sepolia */
export const WETH_SEPOLIA =
  '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as const;

/** USDC on Sepolia */
export const USDC_SEPOLIA =
  '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238' as const;

/** UNI on Sepolia */
export const UNI_SEPOLIA =
  '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' as const;

// ──────────────────────────────────────────────
// ABIs (minimal, only the functions we call)
// ──────────────────────────────────────────────

/** Module Proxy Factory – deploy a minimal proxy of a mastercopy */
export const MODULE_PROXY_FACTORY_ABI = [
  {
    name: 'deployModule',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'mastercopy', type: 'address' },
      { name: 'initializer', type: 'bytes' },
      { name: 'saltNonce', type: 'uint256' },
    ],
    outputs: [{ name: 'proxy', type: 'address' }],
  },
  {
    name: 'ModuleProxyCreation',
    type: 'event',
    inputs: [
      { name: 'proxy', type: 'address', indexed: true },
      { name: 'mastercopy', type: 'address', indexed: true },
    ],
  },
] as const;

/**
 * Roles Modifier v1 – ABI for setup, role assignment, scope configuration,
 * and Transaction execution.
 */
export const ROLES_MODIFIER_ABI = [
  // Initializer (called via proxy)
  {
    name: 'setUp',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'initParams', type: 'bytes' }],
    outputs: [],
  },
  // Owner / avatar / target management
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'avatar',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'target',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  // Role assignment
  {
    name: 'assignRoles',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'module', type: 'address' },
      { name: 'roles', type: 'uint16[]' },
      { name: 'memberOf', type: 'bool[]' },
    ],
    outputs: [],
  },
  // Target scoping
  {
    name: 'scopeTarget',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'role', type: 'uint16' },
      { name: 'targetAddress', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'allowTarget',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'role', type: 'uint16' },
      { name: 'targetAddress', type: 'address' },
      { name: 'options', type: 'uint8' }, // 0=none, 1=send, 2=delegatecall, 3=both
    ],
    outputs: [],
  },
  // Function scoping
  {
    name: 'scopeFunction',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'role', type: 'uint16' },
      { name: 'targetAddress', type: 'address' },
      { name: 'functionSig', type: 'bytes4' },
      { name: 'isParamScoped', type: 'bool[]' },
      { name: 'paramType', type: 'uint8[]' },
      { name: 'compType', type: 'uint8[]' },
      { name: 'compValue', type: 'bytes[]' },
      { name: 'options', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    name: 'scopeAllowFunction',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'role', type: 'uint16' },
      { name: 'targetAddress', type: 'address' },
      { name: 'functionSig', type: 'bytes4' },
      { name: 'options', type: 'uint8' },
    ],
    outputs: [],
  },
  // Execute transaction with role
  {
    name: 'execTransactionWithRole',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' }, // 0=call, 1=delegatecall
      { name: 'role', type: 'uint16' },
      { name: 'shouldRevert', type: 'bool' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const;

/**
 * uniswap SwapRouter02 – exactInputSingle is the function we allow.
 */
export const SWAP_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

/** The 4-byte selector for exactInputSingle(ExactInputSingleParams) */
export const EXACT_INPUT_SINGLE_SELECTOR = '0x04e45aaf' as const;

/** Default role ID we assign to the agent */
export const SWAP_ROLE_ID = 1;

/** Sepolia chain ID */
export const SEPOLIA_CHAIN_ID = 11155111;

/** uniswap Factory – getPool */
export const UNISWAP_V3_FACTORY_ABI = [
  {
    name: 'getPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },
] as const;

/** uniswap Pool – read-only queries */
export const UNISWAP_V3_POOL_ABI = [
  {
    name: 'liquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint128' }],
  },
  {
    name: 'token0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'token1',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'fee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint24' }],
  },
  {
    name: 'slot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
] as const;

//161003658199338306
//31763906196714848
//11430585984292699
//475429702247598