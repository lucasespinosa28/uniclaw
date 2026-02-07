'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Image from 'next/image';

export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-black/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center gap-2.5">
        <Image
          src="/crabot.png"
          alt="Uniclaw"
          width={32}
          height={32}
          className="rounded-lg"
        />
        <span className="text-sm font-semibold text-zinc-300 tracking-tight">
          Uniclaw
        </span>
      </div>
      <ConnectButton />
    </header>
  );
}
