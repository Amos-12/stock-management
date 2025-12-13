import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Calculate unified total from multi-currency items
export function calculateUnifiedTotal(
  items: Array<{ subtotal: number; currency?: string | null }>,
  usdHtgRate: number
): { htg: number; usd: number; unified: number } {
  let htgTotal = 0;
  let usdTotal = 0;
  
  items.forEach(item => {
    if (item.currency === 'USD') {
      usdTotal += item.subtotal;
    } else {
      htgTotal += item.subtotal;
    }
  });
  
  return {
    htg: htgTotal,
    usd: usdTotal,
    unified: htgTotal + (usdTotal * usdHtgRate)
  };
}

// Calculate unified profit from multi-currency items
export function calculateUnifiedProfit(
  items: Array<{ profit_amount?: number | null; currency?: string | null }>,
  usdHtgRate: number
): number {
  let htgProfit = 0;
  let usdProfit = 0;
  
  items.forEach(item => {
    const profit = item.profit_amount || 0;
    if (item.currency === 'USD') {
      usdProfit += profit;
    } else {
      htgProfit += profit;
    }
  });
  
  return htgProfit + (usdProfit * usdHtgRate);
}
