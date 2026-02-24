
export interface BankEntry {
    name: string;
    routingPrefix: string;  // First few digits of routing/clabe
    countryId: 'US' | 'MX';
    branches?: { city: string; suffix: string }[];
}

export const BANK_DIRECTORY: BankEntry[] = [
    // USA
    { name: 'Chase', routingPrefix: '02100002', countryId: 'US' },
    { name: 'Bank of America', routingPrefix: '02600959', countryId: 'US' },
    { name: 'Wells Fargo', routingPrefix: '12100024', countryId: 'US' },
    { name: 'Citibank', routingPrefix: '02100008', countryId: 'US' },

    // Mexico (CLABE: 3 digit bank code + 3 digit plaza + 11 acc + 1 checksum)
    // We will simulate the "routing" part as the first 6 digits (Bank + Plaza)
    {
        name: 'BBVA México',
        routingPrefix: '012',
        countryId: 'MX',
        branches: [
            { city: 'Mexico City', suffix: '180' },
            { city: 'Guadalajara', suffix: '320' },
            { city: 'Monterrey', suffix: '580' }
        ]
    },
    {
        name: 'Banamex',
        routingPrefix: '002',
        countryId: 'MX',
        branches: [
            { city: 'Mexico City', suffix: '180' }
        ]
    },
    { name: 'Santander', routingPrefix: '014', countryId: 'MX' },
    { name: 'HSBC México', routingPrefix: '021', countryId: 'MX' }
];

export const getBanksByCountry = (countryId: string) => {
    // Map full UUIDs to codes if necessary, or just use ISO codes if consistent
    // For now assuming we might receive 'MX' or 'US' or the UUIDs. 
    // Let's assume the frontend passes the ISO code or we Map it.
    // In our DB seed: US=..., MX=...
    // simpler: Filter by loose match or pass ISO code.
    return BANK_DIRECTORY.filter(b => b.countryId === countryId || (countryId === 'United States' && b.countryId === 'US') || (countryId === 'Mexico' && b.countryId === 'MX'));
};
