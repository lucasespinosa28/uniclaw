/**
 * Extract a human-readable message from any error shape.
 *
 * Wallet providers (MetaMask, WalletConnect, etc.) reject with objects like
 * `{ code: 4001, message: "User rejected the request." }` instead of
 * standard `Error` instances. JSON-RPC errors may also carry a `data.message`.
 */
export function formatError(err: unknown, fallback = 'Something went wrong'): string {
  if (!err) return fallback;

  // Standard Error
  if (err instanceof Error) {
    return err.message || fallback;
  }

  // Object with .message (wallet provider rejections, JSON-RPC errors)
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>;

    // Common shapes: { message: "..." }, { error: { message: "..." } }
    if (typeof e.message === 'string' && e.message) return e.message;
    if (typeof e.reason === 'string' && e.reason) return e.reason;
    const errorObj = e.error as Record<string, unknown> | undefined;
    if (errorObj && typeof errorObj.message === 'string') return errorObj.message;
    const dataObj = e.data as Record<string, unknown> | undefined;
    if (dataObj && typeof dataObj.message === 'string') return dataObj.message;
    if (typeof e.shortMessage === 'string') return e.shortMessage;

    // EIP-1193 user rejection (code 4001)
    if (e.code === 4001) return 'Transaction rejected by user';
    if (e.code === -32000) return 'Transaction failed (insufficient funds or gas)';
    if (e.code === -32603) return 'Internal JSON-RPC error';

    // Last resort: try to stringify
    try {
      const s = JSON.stringify(err);
      if (s && s !== '{}') return s;
    } catch {
      // ignore
    }
  }

  if (typeof err === 'string' && err) return err;

  return fallback;
}
