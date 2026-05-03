export const isoToFlag = (isoCode?: string | null): string => {
    if (!isoCode) return '';
    const code = isoCode.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return '';
    return code
        .split('')
        .map(char => String.fromCodePoint(127397 + char.charCodeAt(0)))
        .join('');
};
