import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


//-------------------------------------// Utility function to calculate xirr

export interface CashFlow {
  amount: number; // Negative for investment, positive for redemption
  date: Date;
}

/**
 * Calculates XIRR for a series of cash flows.
 * @param cashFlows Array of { amount, date }
 * @param guess Initial guess for the rate (default 0.1 = 10%)
 * @returns XIRR as a decimal (e.g., 0.12 for 12%)
 */
export function calculateXIRR(cashFlows: CashFlow[], guess = 0.1): number {
  const maxIterations = 100;
  const tolerance = 1e-6;

  // Ensure at least one positive and one negative cash flow
  const hasPositive = cashFlows.some(cf => cf.amount > 0);
  const hasNegative = cashFlows.some(cf => cf.amount < 0);
  if (!hasPositive || !hasNegative) return 0;

  // Sort by date
  cashFlows = cashFlows.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
  const t0 = cashFlows[0].date;

  // NPV function
  function npv(rate: number) {
    return cashFlows.reduce((sum, cf) => {
      const days = (cf.date.getTime() - t0.getTime()) / (1000 * 60 * 60 * 24);
      return sum + cf.amount / Math.pow(1 + rate, days / 365.25);
    }, 0);
  }

  // Derivative of NPV
  function dNpv(rate: number) {
    return cashFlows.reduce((sum, cf) => {
      const days = (cf.date.getTime() - t0.getTime()) / (1000 * 60 * 60 * 24);
      const frac = days / 365.25;
      return sum - (frac * cf.amount) / Math.pow(1 + rate, frac + 1);
    }, 0);
  }

  let rate = guess;
  for (let i = 0; i < maxIterations; i++) {
    const value = npv(rate);
    const deriv = dNpv(rate);
    if (Math.abs(value) < tolerance) return rate;
    if (deriv === 0) break;
    rate = rate - value / deriv;
  }
  return rate;
}