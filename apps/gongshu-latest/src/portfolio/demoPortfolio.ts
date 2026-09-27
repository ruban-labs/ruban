export const DEMO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const DEMO_LABEL = 'Example portfolio';

export function isDemoAddress(address?: string): boolean {
  return address?.toLowerCase() === DEMO_ADDRESS;
}

export function hasSampleData(snapshot: {
  chains: ReadonlyArray<{ source: string }>;
}): boolean {
  return snapshot.chains.some(chain => chain.source === 'debank:mock');
}
