export interface HourlySlot {
    time: string; temp: number; wind: number;
    precip_prob: number; cloud: number; code?: number;
}

export const weatherCodeLabel = (code?: number): string => {
    if (code === undefined || code === null) return 'Unknown';
    if (code === 0) return 'Clear Sky';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 9) return 'Fog / Mist';
    if (code <= 29) return 'Drizzle';
    if (code <= 39) return 'Rain';
    if (code <= 49) return 'Snow';
    if (code <= 59) return 'Drizzle';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 84) return 'Rain Showers';
    if (code <= 86) return 'Snow Showers';
    if (code <= 94) return 'Thunderstorm';
    return 'Severe Storm';
};

export const weatherCodeEmoji = (code?: number): string => {
    if (code === undefined || code === null) return '🌡️';
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 9) return '🌫️';
    if (code <= 29) return '🌦️';
    if (code <= 39) return '🌧️';
    if (code <= 49) return '❄️';
    if (code <= 59) return '🌦️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 84) return '🌦️';
    if (code <= 86) return '🌨️';
    if (code <= 94) return '⛈️';
    return '🌪️';
};

export const uvLabel = (uv: number) => {
    if (uv < 3) return { label: 'Low', color: 'text-emerald-600' };
    if (uv < 6) return { label: 'Moderate', color: 'text-yellow-600' };
    if (uv < 8) return { label: 'High', color: 'text-orange-600' };
    if (uv < 11) return { label: 'Very High', color: 'text-red-600' };
    return { label: 'Extreme', color: 'text-purple-600' };
};

export const STATUS_COLORS: Record<string, string> = {
    assigned: 'bg-blue-50 text-blue-700 border-blue-200',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    on_hold: 'bg-slate-100 text-slate-500 border-slate-200',
};
