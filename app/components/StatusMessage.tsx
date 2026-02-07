'use client';

interface StatusMessageProps {
  status: 'idle' | 'pending' | 'success' | 'error';
  message: string;
  txHash?: string;
}

export function StatusMessage({ status, message, txHash }: StatusMessageProps) {
  if (status === 'idle') return null;

  const colors = {
    pending: 'bg-yellow-900/30 border-yellow-600 text-yellow-300',
    success: 'bg-green-900/30 border-green-600 text-green-300',
    error: 'bg-red-900/30 border-red-600 text-red-300',
  };

  return (
    <div className={`mt-4 rounded-lg border p-4 ${colors[status]}`}>
      <div className="flex items-center gap-2">
        {status === 'pending' && (
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        <p className="text-sm font-medium">{message}</p>
      </div>
      {txHash && (
        <a
          href={`https://sepolia.etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs underline opacity-80 hover:opacity-100"
        >
          View on Etherscan →
        </a>
      )}
    </div>
  );
}
