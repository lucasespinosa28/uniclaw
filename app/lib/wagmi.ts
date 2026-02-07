'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  sepolia,
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Uniclaw',
  projectId: 'YOUR_PROJECT_ID', // Replace with your WalletConnect project ID
  chains: [
    sepolia,
  ],
  ssr: true,
});
