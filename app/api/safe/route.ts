import { NextRequest, NextResponse } from 'next/server';

/**
 * API route for Safe-related server operations.
 *
 * GET /api/safe?address=0x...&chainId=11155111
 *   → Returns Safe info from the Safe Transaction Service
 *
 * POST /api/safe
 *   → Proposes a transaction to the Safe Transaction Service
 */

const SAFE_TX_SERVICE_URLS: Record<number, string> = {
  11155111: 'https://safe-transaction-sepolia.safe.global',
  1: 'https://safe-transaction-mainnet.safe.global',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const safeAddress = searchParams.get('address');
  const chainId = Number(searchParams.get('chainId') ?? 11155111);

  if (!safeAddress) {
    return NextResponse.json(
      { error: 'Missing address parameter' },
      { status: 400 },
    );
  }

  const baseUrl = SAFE_TX_SERVICE_URLS[chainId];
  if (!baseUrl) {
    return NextResponse.json(
      { error: `Unsupported chainId: ${chainId}` },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/safes/${safeAddress}/`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 10 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Safe TX Service returned ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Safe info';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { safeAddress, chainId = 11155111, ...txData } = body;

  if (!safeAddress) {
    return NextResponse.json(
      { error: 'Missing safeAddress' },
      { status: 400 },
    );
  }

  const baseUrl = SAFE_TX_SERVICE_URLS[chainId];
  if (!baseUrl) {
    return NextResponse.json(
      { error: `Unsupported chainId: ${chainId}` },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `${baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(txData),
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json(
        { error: `Safe TX Service returned ${res.status}: ${errBody}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to propose transaction';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
