import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia, base } from 'wagmi/chains';

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

export const config = getDefaultConfig({
  appName: 'Cyber Air Hockey',
  projectId,
  chains: [baseSepolia, base],
  ssr: true,
});

export { projectId };
