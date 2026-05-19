/**
 * Convert an ISO 3166-1 alpha-2 country code to its emoji flag.
 * Works for every country automatically — no hardcoded list needed.
 * e.g. 'US' → '🇺🇸', 'CA' → '🇨🇦', 'MX' → '🇲🇽', 'BZ' → '🇧🇿'
 */
export const isoToFlag = (iso: string | null | undefined): string => {
    if (!iso || iso.length < 2) return '🌍';
    return iso.toUpperCase().slice(0, 2).replace(/./g, ch =>
        String.fromCodePoint(0x1F1E6 + ch.charCodeAt(0) - 65)
    );
};
