import { NextResponse } from 'next/server';

// TODO: Generate icon.png and splash.png from SVG assets in /public.
// Farcaster requires PNG format for iconUrl and splashImageUrl.

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://air-hockey-base.vercel.app';

  return NextResponse.json({
    accountAssociation: {
      header: "eyJmaWQiOjAsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwIn0",
      payload: "eyJkb21haW4iOiJhaXItaG9ja2V5LWJhc2UudmVyY2VsLmFwcCJ9",
      signature: "PLACEHOLDER_GENERATE_VIA_WARPCAST_DEV_TOOLS",
    },
    frame: {
      version: "1",
      name: "Cyber Air Hockey",
      homeUrl: appUrl,
      iconUrl: `${appUrl}/icon.png`,
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#0a0a0f",
      webhookUrl: `${appUrl}/api/farcaster/webhook`,
    },
  });
}
