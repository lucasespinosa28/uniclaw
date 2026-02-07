'use client';

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import Image from 'next/image';
import { DeploySafe } from './components/DeploySafe';
import { ConfigureRoles } from './components/ConfigureRoles';
import { SafeInfo } from './components/SafeInfo';
import { ApproveRouter } from './components/ApproveRouter';
import { PoolFinder } from './components/PoolFinder';

export default function Home() {
  const { isConnected } = useAccount();

  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const [knownRolesAddress, setKnownRolesAddress] = useState<string | null>(null);
  const [poolRefreshKey, setPoolRefreshKey] = useState(0);

  const handleSafeDeployed = useCallback((addr: string) => {
    setSafeAddress(addr);
  }, []);

  const handleRolesAddressKnown = useCallback((addr: string) => {
    setKnownRolesAddress(addr);
  }, []);

  const handlePoolAdded = useCallback(() => {
    setPoolRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-black">
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/30 via-black to-blue-950/20" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
            <div className="shrink-0">
              <Image
                src="/crabot.png"
                alt="Uniclaw mascot"
                width={140}
                height={140}
                className="drop-shadow-[0_0_30px_rgba(168,85,247,0.4)]"
                priority
              />
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Uniclaw
              </h1>
              <p className="mt-3 text-lg text-zinc-300">
                Delegate scoped Uniswap swap permissions without sharing your private keys.
              </p>ß
              <p className="mt-2 text-sm text-zinc-500">
                Safe Smart Account &bull; Zodiac Roles Modifier &bull; Uniswap &bull; Sepolia Testnet
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {/* ── What is Uniclaw ── */}
        <section className="mb-12">
          <div className="grid gap-6 md:grid-cols-3">
            {/* DApp Card */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-900/50 text-xl">
                🏛️
              </div>
              <h3 className="text-sm font-semibold text-white mb-2">The DApp</h3>
              <p className="text-xs leading-relaxed text-zinc-400">
                Uniclaw lets an <strong className="text-zinc-300">Admin (User A)</strong> deploy a Safe
                smart account and attach a Zodiac Roles Modifier. The admin then creates a
                tightly scoped role that permits <em>only</em> the{' '}
                <code className="rounded bg-zinc-800 px-1 text-blue-400">exactInputSingle</code>{' '}
                function on the Uniswap SwapRouter. A{' '}
                <strong className="text-zinc-300">Delegate (User B)</strong> can then execute swaps on
                behalf of the Safe — without ever touching any other funds or contracts.
              </p>
            </div>

            {/* OpenClaw Skill Card */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-900/50 text-xl">
                🦄
              </div>
              <h3 className="text-sm font-semibold text-white mb-2">OpenClaw Skill</h3>
              <p className="text-xs leading-relaxed text-zinc-400">
                The <strong className="text-zinc-300">uniclaw</strong> agent skill is a lightweight
                Node.js CLI that an AI agent can invoke autonomously. On first run it creates a
                wallet, then accepts configuration for the Safe and Roles Modifier addresses.
                The agent can save Uniswap pools and execute swaps — all through the Roles
                Modifier so it can <em>never</em> exceed the permissions the admin defined.
                The agent operates as User B with the scoped swap role.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <a
                  href="https://openclaw.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded bg-blue-800/60 border border-blue-700 px-2.5 py-1 text-xs font-medium text-blue-300 hover:bg-blue-700/60 transition-colors"
                >
                  openclaw.ai ↗
                </a>
                <a
                  href="/uniclaw.zip"
                  download
                  className="inline-flex items-center gap-1 rounded bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  ⬇ Download Skill
                </a>
              </div>
            </div>

            {/* Security Card */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-900/50 text-xl">
                🔒
              </div>
              <h3 className="text-sm font-semibold text-white mb-2">Security Model</h3>
              <p className="text-xs leading-relaxed text-zinc-400">
                All assets live in the <strong className="text-zinc-300">Safe multisig</strong> — never
                in any delegate wallet. The Zodiac Roles Modifier enforces{' '}
                <strong className="text-zinc-300">on-chain</strong> that User B can only call one
                specific function on one specific contract. Even a compromised delegate key cannot
                drain funds, call other contracts, or change configuration. Only the Safe owner
                can modify roles, revoke access, or withdraw assets.
              </p>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">How it works</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: '1', title: 'Deploy Safe', desc: 'Admin creates a Safe smart account that holds all assets.' },
              { step: '2', title: 'Attach Roles', desc: 'A Zodiac Roles Modifier is deployed and enabled as a Safe module.' },
              { step: '3', title: 'Scope Permissions', desc: 'Admin scopes the SwapRouter target and allows only exactInputSingle.' },
              { step: '4', title: 'Delegate Swaps', desc: 'User B (or an agent) executes swaps through the Roles Modifier.' },
            ].map((item) => (
              <div key={item.step} className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Connect prompt ── */}
        {!isConnected && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-10 text-center">
            <Image
              src="/crabot.png"
              alt="Uniclaw mascot"
              width={64}
              height={64}
              className="mx-auto mb-4 opacity-60"
            />
            <p className="text-zinc-400 text-sm">
              Connect your wallet to start deploying your Safe and configuring permissions.
            </p>
          </div>
        )}

        {/* ── Main DApp Controls ── */}
        {isConnected && (
          <div className="space-y-8">
            {/* Step 1: Deploy Safe */}
            <DeploySafe onDeployed={handleSafeDeployed} />

            {/* Safe Info (shown after deploy) */}
            {safeAddress && <SafeInfo safeAddress={safeAddress} />}

            {/* Token Approvals (shown after deploy) */}
            {safeAddress && <ApproveRouter safeAddress={safeAddress} />}

            {/* Pool Finder (shown after Roles Modifier address is known) */}
            {safeAddress && knownRolesAddress && (
              <PoolFinder
                rolesModifierAddress={knownRolesAddress}
                onPoolAdded={handlePoolAdded}
              />
            )}

            {/* Configure Roles Modifier (shown after Safe deploy) */}
            {safeAddress && (
              <ConfigureRoles
                safeAddress={safeAddress}
                onConfigured={() => {}}
                onRolesAddressKnown={handleRolesAddressKnown}
                poolRefreshKey={poolRefreshKey}
              />
            )}
          </div>
        )}

        {/* ── Architecture Details ── */}
        <section className="mt-16">
          <h2 className="text-lg font-semibold text-white mb-4">Architecture</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🏦</span>
                <p className="text-sm font-medium text-zinc-300">Safe Protocol Kit</p>
              </div>
              <p className="text-xs text-zinc-500">
                Deploys &amp; manages the Safe smart account. All assets are held by the
                Safe — a battle-tested multisig with over $100B in total value secured.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">⚙️</span>
                <p className="text-sm font-medium text-zinc-300">Zodiac Roles Modifier</p>
              </div>
              <p className="text-xs text-zinc-500">
                An audited Gnosis Guild module. Attached to the Safe, it defines granular
                roles that scope which contracts and functions a delegate can call — enforced
                entirely on-chain.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">👤</span>
                <p className="text-sm font-medium text-zinc-300">User A — Admin</p>
              </div>
              <p className="text-xs text-zinc-500">
                The Safe owner. Deploys the Safe, attaches the Roles Modifier, scopes
                permissions, assigns roles, and manages token approvals. Full control at all times.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🤖</span>
                <p className="text-sm font-medium text-zinc-300">User B — Delegate / Agent</p>
              </div>
              <p className="text-xs text-zinc-500">
                Assigned a scoped role. Can <strong className="text-zinc-400">only</strong> call{' '}
                <code className="text-blue-400">exactInputSingle</code> on the Uniswap
                SwapRouter. Cannot transfer tokens, change config, or access any other function.
              </p>
            </div>
          </div>
        </section>

        {/* ── Security Guarantees ── */}
        <section className="mt-12 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Security Guarantees</h2>
          <div className="rounded-xl border border-green-900/50 bg-green-950/20 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: '🔐',
                  title: 'No Key Sharing',
                  desc: 'The delegate never has access to the Safe owner key. They use their own wallet with a scoped role.',
                },
                {
                  icon: '🛡️',
                  title: 'On-Chain Enforcement',
                  desc: 'Permission checks happen in the Roles Modifier smart contract. No off-chain trust assumptions.',
                },
                {
                  icon: '🚫',
                  title: 'Function-Level Scoping',
                  desc: 'Only exactInputSingle is allowed. Any other call — transfers, approvals, admin functions — is rejected by the contract.',
                },
                {
                  icon: '🔄',
                  title: 'Instant Revocation',
                  desc: 'The admin can revoke a delegate\'s role in one transaction. No waiting period, no coordination needed.',
                },
                {
                  icon: '💰',
                  title: 'Assets Stay in Safe',
                  desc: 'Swapped tokens are returned to the Safe. The delegate wallet only pays gas — it never holds protocol assets.',
                },
                {
                  icon: '🔍',
                  title: 'Fully Auditable',
                  desc: 'Every swap is an on-chain transaction through the Roles Modifier. Complete transparency and traceability.',
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-3">
                  <span className="text-lg shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-green-300">{item.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="mt-16 border-t border-zinc-800 pt-6 pb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Image
              src="/crabot.png"
              alt="Uniclaw"
              width={24}
              height={24}
              className="opacity-50"
            />
            <span className="text-sm text-zinc-600 font-medium">Uniclaw</span>
          </div>
          <p className="text-xs text-zinc-600">
            Built with Safe Protocol Kit, Zodiac Roles Modifier &amp; Uniswap on Sepolia.
          </p>
        </footer>
      </main>
    </div>
  );
}