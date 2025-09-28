import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number) {
  const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (hours > 0 || minutes > 0) {
    const paddedMinutes = hours > 0 ? minutes.toString().padStart(2, '0') : minutes.toString();
    parts.push(`${paddedMinutes}m`);
  }

  if (hours > 0 || minutes > 0) {
    parts.push(`${remainingSeconds.toString().padStart(2, '0')}s`);
  } else {
    parts.push(`${remainingSeconds}s`);
  }

  return parts.join(' ');
}
