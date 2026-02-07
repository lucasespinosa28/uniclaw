'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import {
  deployRolesModifier,
  configureSwapRole,
  scopeSwapTarget,
  revokeSwapRole,
  changeSwapRoleMember,
  assignSwapRoleMember,
  detectRolesModifierState,
  loadRoleMembers,
} from '../lib/roles';
import { enableModuleOnSafe } from '../lib/safe';
import { loadAllowedPools, removeAllowedPool } from '../lib/pools';
import { StatusMessage } from './StatusMessage';
import { formatError } from '../lib/errors';
import type { StatusState } from '../lib/types';

interface ConfigureRolesProps {
  safeAddress: string;
  onConfigured: (rolesModifierAddress: string) => void;
  onRolesAddressKnown?: (rolesModifierAddress: string) => void;
  /** Increment to trigger allowed-pools refresh from localStorage */
  poolRefreshKey?: number;
}

export function ConfigureRoles({ safeAddress, onConfigured, onRolesAddressKnown, poolRefreshKey }: ConfigureRolesProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [userB, setUserB] = useState('');
  const [rolesAddress, setRolesAddress] = useState<string | null>(null);
  const [membersRefreshKey, setMembersRefreshKey] = useState(0);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [newMemberAddress, setNewMemberAddress] = useState('');
  const [poolsRefreshKey, setPoolsRefreshKey] = useState(0);
  const [isTargetScoped, setIsTargetScoped] = useState(false);
  const [step, setStep] = useState<'checking' | 'deploy' | 'enable' | 'configure' | 'done'>('checking');
  const [status, setStatus] = useState<StatusState>({
    status: 'idle',
    message: '',
  });

  // Derive members and pools from localStorage (re-computed via refresh keys)
  const assignedMembers = useMemo(
    () => (rolesAddress ? loadRoleMembers(rolesAddress) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rolesAddress, membersRefreshKey],
  );
  const allowedPools = useMemo(
    () => (rolesAddress ? loadAllowedPools(rolesAddress) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rolesAddress, poolsRefreshKey, poolRefreshKey],
  );

  // Auto-detect existing Roles Modifier state on mount
  useEffect(() => {
    if (!walletClient || !address) return;

    let cancelled = false;

    async function detect() {
      try {
        const state = await detectRolesModifierState(
          walletClient!.transport,
          address!,
          safeAddress,
        );

        if (cancelled) return;

        console.log('[ConfigureRoles] Detected state:', state);

        if (state.rolesModifierAddress) {
          setRolesAddress(state.rolesModifierAddress);
          setIsTargetScoped(state.isTargetScoped);
          onRolesAddressKnown?.(state.rolesModifierAddress);
        }

        setStep(state.currentStep);

        if (state.currentStep === 'done' && state.rolesModifierAddress) {
          setStatus({
            status: 'success',
            message: `Roles Modifier already configured at ${state.rolesModifierAddress}`,
          });
          onConfigured(state.rolesModifierAddress);
        } else if (state.isEnabled && state.rolesModifierAddress) {
          setStatus({
            status: 'success',
            message: `Roles Modifier already enabled at ${state.rolesModifierAddress}. Proceed to role assignment.`,
          });
        } else if (state.isDeployed && state.rolesModifierAddress) {
          setStatus({
            status: 'success',
            message: `Roles Modifier found at ${state.rolesModifierAddress}. Enable it on the Safe.`,
          });
        }
      } catch (err) {
        console.error('[ConfigureRoles] detect error:', err);
        if (!cancelled) setStep('deploy');
      }
    }

    detect();
    return () => { cancelled = true; };
  }, [walletClient, address, safeAddress, onConfigured, onRolesAddressKnown]);

  // Step 1: Deploy the Roles Modifier proxy
  const handleDeployRoles = useCallback(async () => {
    if (!walletClient || !address) return;

    setStatus({ status: 'pending', message: 'Deploying Roles Modifier...' });

    try {
      const provider = walletClient.transport;
      const result = await deployRolesModifier(provider, address, safeAddress);
      setRolesAddress(result.rolesModifierAddress);
      onRolesAddressKnown?.(result.rolesModifierAddress);
      setStep('enable');
      setStatus({
        status: 'success',
        message: `Roles Modifier deployed at ${result.rolesModifierAddress}`,
      });
    } catch (err: unknown) {
      console.error('[ConfigureRoles] deploy', err);
      setStatus({ status: 'error', message: formatError(err, 'Deploy failed') });
    }
  }, [walletClient, address, safeAddress, onRolesAddressKnown]);

  // Step 2: Enable the Roles Modifier as a module on the Safe
  const handleEnableModule = useCallback(async () => {
    if (!walletClient || !address || !rolesAddress) return;

    setStatus({ status: 'pending', message: 'Enabling module on Safe...' });

    try {
      const provider = walletClient.transport;
      await enableModuleOnSafe(provider, address, safeAddress, rolesAddress);
      setStep('configure');
      setStatus({
        status: 'success',
        message: 'Roles Modifier enabled as a module on the Safe.',
      });
    } catch (err: unknown) {
      console.error('[ConfigureRoles] enable', err);
      setStatus({ status: 'error', message: formatError(err, 'Enable failed') });
    }
  }, [walletClient, address, safeAddress, rolesAddress]);

  // Step 3: Configure the swap-only role for the agent
  const handleConfigureRole = useCallback(async () => {
    if (!walletClient || !address || !rolesAddress || !userB.trim()) return;

    setStatus({
      status: 'pending',
      message: 'Configuring swap-only role for agent...',
    });

    try {
      const provider = walletClient.transport;
      await configureSwapRole(provider, address, safeAddress, rolesAddress, userB.trim());
      setMembersRefreshKey((k) => k + 1);
      setIsTargetScoped(true);
      setStep('done');
      setStatus({
        status: 'success',
        message: `Agent (${userB.slice(0, 10)}...) assigned the swap-only role.`,
      });
      setUserB('');
      onConfigured(rolesAddress);
    } catch (err: unknown) {
      console.error('[ConfigureRoles] configure', err);
      setStatus({ status: 'error', message: formatError(err, 'Configure failed') });
    }
  }, [walletClient, address, safeAddress, rolesAddress, userB, onConfigured]);

  // Scope the SwapRouter target (fix TargetAddressNotAllowed)
  const handleScopeTarget = useCallback(async () => {
    if (!walletClient || !address || !rolesAddress) return;

    setStatus({
      status: 'pending',
      message: 'Allowing SwapRouter as target on the Roles Modifier...',
    });

    try {
      const provider = walletClient.transport;
      await scopeSwapTarget(provider, address, safeAddress, rolesAddress);
      setIsTargetScoped(true);
      setStatus({
        status: 'success',
        message: 'SwapRouter allowed as target. You can now assign members.',
      });
    } catch (err: unknown) {
      console.error('[ConfigureRoles] scopeTarget', err);
      setStatus({ status: 'error', message: formatError(err, 'Scope target failed') });
    }
  }, [walletClient, address, safeAddress, rolesAddress]);

  // Revoke role from a member
  const handleRevoke = useCallback(async (member: string) => {
    if (!walletClient || !address || !rolesAddress) return;

    setStatus({
      status: 'pending',
      message: `Revoking role from ${member.slice(0, 10)}...`,
    });

    try {
      const provider = walletClient.transport;
      await revokeSwapRole(provider, address, safeAddress, rolesAddress, member);
      const updated = loadRoleMembers(rolesAddress);
      setMembersRefreshKey((k) => k + 1);
      setStatus({
        status: 'success',
        message: `Role revoked from ${member.slice(0, 10)}...`,
      });
      if (updated.length === 0) {
        setStep('configure');
      }
    } catch (err: unknown) {
      console.error('[ConfigureRoles] revoke', err);
      setStatus({ status: 'error', message: formatError(err, 'Revoke failed') });
    }
  }, [walletClient, address, safeAddress, rolesAddress]);

  // Change member address
  const handleChangeMember = useCallback(async () => {
    if (!walletClient || !address || !rolesAddress || !editingMember || !newMemberAddress.trim()) return;

    setStatus({
      status: 'pending',
      message: `Changing role assignment...`,
    });

    try {
      const provider = walletClient.transport;
      await changeSwapRoleMember(provider, address, safeAddress, rolesAddress, editingMember, newMemberAddress.trim());
      setMembersRefreshKey((k) => k + 1);
      setEditingMember(null);
      setNewMemberAddress('');
      setStatus({
        status: 'success',
        message: `Role transferred to ${newMemberAddress.slice(0, 10)}...`,
      });
    } catch (err: unknown) {
      console.error('[ConfigureRoles] change', err);
      setStatus({ status: 'error', message: formatError(err, 'Change failed') });
    }
  }, [walletClient, address, safeAddress, rolesAddress, editingMember, newMemberAddress]);

  // Add another member (from done state)
  const handleAddAnother = useCallback(async () => {
    if (!walletClient || !address || !rolesAddress || !userB.trim()) return;

    setStatus({
      status: 'pending',
      message: 'Assigning role to new member...',
    });

    try {
      const provider = walletClient.transport;
      await assignSwapRoleMember(provider, address, safeAddress, rolesAddress, userB.trim());
      setMembersRefreshKey((k) => k + 1);
      setUserB('');
      setStatus({
        status: 'success',
        message: `Role assigned to ${userB.slice(0, 10)}...`,
      });
    } catch (err: unknown) {
      console.error('[ConfigureRoles] addAnother', err);
      setStatus({ status: 'error', message: formatError(err, 'Assignment failed') });
    }
  }, [walletClient, address, safeAddress, rolesAddress, userB]);

  const steps = [
    { key: 'deploy', label: 'Deploy Modifier', active: step === 'deploy' },
    { key: 'enable', label: 'Enable Module', active: step === 'enable' },
    { key: 'configure', label: 'Assign Role', active: step === 'configure' },
    { key: 'done', label: 'Done', active: step === 'done' },
  ];

  const stepIndex = steps.findIndex((x) => x.key === step);
  const isPending = status.status === 'pending';

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        2. Configure Zodiac Roles Modifier
      </h2>

      {/* Loading state */}
      {step === 'checking' && (
        <p className="text-sm text-zinc-400 animate-pulse mb-4">
          Checking existing Roles Modifier state...
        </p>
      )}

      {/* Progress Steps */}
      {step !== 'checking' && (
        <div className="mb-6 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  s.active
                    ? 'bg-blue-600 text-white'
                    : step === 'done' || stepIndex > i
                    ? 'bg-green-600 text-white'
                    : 'bg-zinc-700 text-zinc-400'
                }`}
              >
                {stepIndex > i || step === 'done'
                  ? '✓'
                  : i + 1}
              </div>
              <span className="text-xs text-zinc-400 hidden sm:inline">
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className="h-px w-4 bg-zinc-600" />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">
            Safe Address
          </label>
          <p className="font-mono text-sm text-zinc-300 truncate">
            {safeAddress}
          </p>
        </div>

        {/* Step 1: Deploy */}
        {step === 'deploy' && (
          <button
            onClick={handleDeployRoles}
            disabled={isPending}
            className="w-full rounded-lg bg-purple-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            {isPending ? 'Deploying...' : 'Deploy Roles Modifier'}
          </button>
        )}

        {/* Step 2: Enable Module */}
        {step === 'enable' && (
          <button
            onClick={handleEnableModule}
            disabled={isPending}
            className="w-full rounded-lg bg-purple-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            {isPending ? 'Enabling...' : 'Enable Module on Safe'}
          </button>
        )}

        {/* Step 3: Configure Role */}
        {step === 'configure' && (
          <>
            {/* Target scoping status */}
            <div className={`rounded-lg border p-4 ${
              isTargetScoped
                ? 'border-green-700 bg-green-900/20'
                : 'border-yellow-700 bg-yellow-900/20'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                  isTargetScoped
                    ? 'bg-green-900/50 text-green-400 border border-green-700'
                    : 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
                }`}>
                  {isTargetScoped ? '✓' : '!'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isTargetScoped ? 'text-green-300' : 'text-yellow-300'}`}>
                    {isTargetScoped ? 'SwapRouter target allowed' : 'SwapRouter target not allowed'}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {isTargetScoped
                      ? 'The SwapRouter is scoped as an allowed target. The exactInputSingle function is permitted.'
                      : 'The Uniswap SwapRouter must be allowed as a target on the Roles Modifier before swaps can execute (TargetAddressNotAllowed).'}
                  </p>
                  <p className="mt-1 font-mono text-xs text-zinc-500 truncate">
                    SwapRouter: 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
                  </p>
                </div>
              </div>
              {!isTargetScoped && (
                <button
                  onClick={handleScopeTarget}
                  disabled={isPending}
                  className="mt-3 w-full rounded-lg bg-yellow-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-yellow-700 disabled:opacity-50"
                >
                  {isPending ? 'Allowing...' : 'Allow SwapRouter Target'}
                </button>
              )}
            </div>

            {/* Member assignment */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Agent Address (swap-only permissions)
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                placeholder="0x..."
                value={userB}
                onChange={(e) => setUserB(e.target.value)}
              />
              <p className="mt-1 text-xs text-zinc-500">
                {isTargetScoped
                  ? 'Enter the OpenClaw agent address and assign the swap role.'
                  : 'This will also allow the SwapRouter target automatically.'}
              </p>
            </div>
            <button
              onClick={handleConfigureRole}
              disabled={!userB.trim() || isPending}
              className="w-full rounded-lg bg-purple-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
            >
              {isPending ? 'Configuring...' : 'Assign Swap-Only Role'}
            </button>
          </>
        )}

        {/* Step 4: Done — show assigned members with manage options */}
        {step === 'done' && rolesAddress && (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-700 bg-green-900/20 p-4">
              <p className="text-sm text-green-300 font-medium">
                Roles Modifier configured
              </p>
              <p className="mt-1 text-xs text-green-400 font-mono truncate">
                Modifier: {rolesAddress}
              </p>
            </div>

            {/* Target scoping status */}
            <div className={`rounded-lg border p-3 ${
              isTargetScoped
                ? 'border-green-700/50 bg-green-900/10'
                : 'border-yellow-700 bg-yellow-900/20'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                  isTargetScoped
                    ? 'bg-green-900/50 text-green-400 border border-green-700'
                    : 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
                }`}>
                  {isTargetScoped ? '✓' : '!'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${isTargetScoped ? 'text-green-400' : 'text-yellow-300'}`}>
                    {isTargetScoped ? 'SwapRouter target allowed' : 'SwapRouter target NOT allowed'}
                  </p>
                  {!isTargetScoped && (
                    <p className="text-xs text-yellow-400/70 mt-0.5">
                      Swaps will fail with TargetAddressNotAllowed until the target is scoped.
                    </p>
                  )}
                </div>
                {!isTargetScoped && (
                  <button
                    onClick={handleScopeTarget}
                    disabled={isPending}
                    className="shrink-0 rounded bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
                  >
                    {isPending ? 'Allowing...' : 'Allow Target'}
                  </button>
                )}
              </div>
            </div>

            {/* Assigned Members List */}
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-2">
                Assigned Members (Swap Role)
              </h3>

              {assignedMembers.length === 0 && (
                <p className="text-xs text-zinc-500">No members assigned.</p>
              )}

              <div className="space-y-2">
                {assignedMembers.map((member) => (
                  <div
                    key={member}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-800 p-3"
                  >
                    {editingMember === member ? (
                      /* Editing mode */
                      <div className="flex-1 space-y-2">
                        <p className="text-xs text-zinc-500">
                          Current: <span className="font-mono text-zinc-400">{member}</span>
                        </p>
                        <input
                          type="text"
                          className="w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                          placeholder="New address 0x..."
                          value={newMemberAddress}
                          onChange={(e) => setNewMemberAddress(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleChangeMember}
                            disabled={!newMemberAddress.trim() || isPending}
                            className="rounded bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                          >
                            {isPending ? 'Changing...' : 'Confirm Change'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingMember(null);
                              setNewMemberAddress('');
                            }}
                            className="rounded border border-zinc-600 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display mode */
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm text-zinc-200 truncate">
                            {member}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Role: Swap Only (exactInputSingle)
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              setEditingMember(member);
                              setNewMemberAddress('');
                            }}
                            disabled={isPending}
                            className="rounded border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-50"
                            title="Change address"
                          >
                            Change
                          </button>
                          <button
                            onClick={() => handleRevoke(member)}
                            disabled={isPending}
                            className="rounded border border-red-800 px-2.5 py-1 text-xs text-red-400 hover:bg-red-900/30 hover:text-red-300 disabled:opacity-50"
                            title="Revoke role"
                          >
                            Remove
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add another member */}
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
              <label className="block text-xs text-zinc-400 mb-2">
                Add another member to the Swap Role
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                  placeholder="0x..."
                  value={userB}
                  onChange={(e) => setUserB(e.target.value)}
                />
                <button
                  onClick={handleAddAnother}
                  disabled={!userB.trim() || isPending}
                  className="shrink-0 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {isPending ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>

            {/* Allowed Pools */}
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-2">
                Allowed Pools
              </h3>

              {allowedPools.length === 0 && (
                <p className="text-xs text-zinc-500">
                  No pools added yet. Use the Pool Finder below to discover and add pools.
                </p>
              )}

              <div className="space-y-2">
                {allowedPools.map((pool) => (
                  <div
                    key={pool.poolAddress}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-800 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-block rounded bg-blue-900/50 border border-blue-700 px-2 py-0.5 text-xs font-medium text-blue-300">
                          Fee: {pool.feeLabel}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-zinc-400 truncate" title={pool.poolAddress}>
                        Pool: {pool.poolAddress}
                      </p>
                      <p className="font-mono text-xs text-zinc-500 truncate">
                        {pool.tokenA.slice(0, 10)}… ↔ {pool.tokenB.slice(0, 10)}…
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (!rolesAddress) return;
                        removeAllowedPool(rolesAddress, pool.poolAddress);
                        setPoolsRefreshKey((k) => k + 1);
                      }}
                      className="shrink-0 rounded border border-red-800 px-2.5 py-1 text-xs text-red-400 hover:bg-red-900/30 hover:text-red-300"
                      title="Remove pool"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <StatusMessage {...status} />
    </div>
  );
}
