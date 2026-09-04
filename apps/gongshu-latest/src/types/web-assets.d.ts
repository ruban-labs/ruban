declare module '@ruban-labs/web-assets/supported-chains.json' {
  const chains: readonly {
    id: string;
    community_id: number;
    name: string;
    native_token: {
      id: string;
      symbol: string;
      logo: string;
      decimals: number;
    };
    logo_url: string;
    white_logo_url: string;
    eip_1559: boolean;
    is_disabled: boolean;
    explorer_host: string;
    need_estimate_gas: boolean;
    severity: number;
    block_interval: number;
  }[];

  export default chains;
}
