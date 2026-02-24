import { clsx, type ClassValue } from 'clsx';
// TODO: Install tailwind-merge for better handling of conflicting classes
// import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return clsx(inputs);
    // return twMerge(clsx(inputs));
}
