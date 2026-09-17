import type { Tables } from "@/integrations/supabase/types";

export type FixedDeposit = Tables<"fixed_deposits">;
export type InterestType = "simple" | "compound";
export type PayoutFrequency = "monthly" | "quarterly" | "at_maturity";
export type FDStatus = "Active" | "Maturing soon" | "Matured" | "Closed";

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365.2425;
const MONTHS_PER_YEAR = 12;

const parseDate = (date: string) => new Date(`${date}T00:00:00+05:30`);

export const getISTDateString = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export const daysBetween = (start: string, end: string) =>
  Math.max(0, (parseDate(end).getTime() - parseDate(start).getTime()) / MS_PER_DAY);

export const calculateTenureMonths = (start: string, end: string) =>
  (() => {
    if (!start || !end || end <= start) return 0;
    const startDate = parseDate(start);
    const endDate = parseDate(end);
    const wholeMonths =
      (endDate.getFullYear() - startDate.getFullYear()) * MONTHS_PER_YEAR +
      endDate.getMonth() - startDate.getMonth();
    const anchor = new Date(startDate);
    anchor.setMonth(anchor.getMonth() + wholeMonths);
    const adjustedMonths = anchor > endDate ? wholeMonths - 1 : wholeMonths;
    const adjustedAnchor = new Date(startDate);
    adjustedAnchor.setMonth(adjustedAnchor.getMonth() + adjustedMonths);
    const nextAnchor = new Date(adjustedAnchor);
    nextAnchor.setMonth(nextAnchor.getMonth() + 1);
    const monthLength = Math.max(1, (nextAnchor.getTime() - adjustedAnchor.getTime()) / MS_PER_DAY);
    const remainingDays = Math.max(0, (endDate.getTime() - adjustedAnchor.getTime()) / MS_PER_DAY);
    return adjustedMonths + remainingDays / monthLength;
  })();

const periodsPerYear = (frequency: PayoutFrequency) => {
  if (frequency === "monthly") return 12;
  if (frequency === "quarterly") return 4;
  return 1;
};

export const calculateFDValue = (
  principal: number,
  annualRate: number,
  startDate: string,
  endDate: string,
  interestType: InterestType,
  payoutFrequency: PayoutFrequency,
  completedPeriodsOnly = true,
) => {
  if (principal <= 0 || annualRate <= 0 || !startDate || !endDate || endDate <= startDate) {
    return principal > 0 ? principal : 0;
  }

  const tenureMonths = calculateTenureMonths(startDate, endDate);
  const years = (completedPeriodsOnly ? Math.floor(tenureMonths) : tenureMonths) / MONTHS_PER_YEAR;
  const rate = annualRate / 100;
  if (interestType === "simple") return principal * (1 + rate * years);

  const frequency = periodsPerYear(payoutFrequency);
  const periods = completedPeriodsOnly ? Math.floor(years * frequency) : years * frequency;
  return principal * Math.pow(1 + rate / frequency, periods);
};

export const calculateMaturityAmount = (
  principal: number,
  annualRate: number,
  startDate: string,
  maturityDate: string,
  interestType: InterestType,
  payoutFrequency: PayoutFrequency,
) => calculateFDValue(
  principal,
  annualRate,
  startDate,
  maturityDate,
  interestType,
  payoutFrequency,
  false,
);

export const getFDStatus = (fd: Pick<FixedDeposit, "closed_at" | "maturity_date">, date = getISTDateString()): FDStatus => {
  if (fd.closed_at) return "Closed";
  if (date >= fd.maturity_date) return "Matured";
  return daysBetween(date, fd.maturity_date) <= 30 ? "Maturing soon" : "Active";
};

export const getFDValueOnDate = (fd: FixedDeposit, date = getISTDateString()) => {
  if (date < fd.start_date) return 0;
  const capDate = fd.closed_at && fd.closed_at < fd.maturity_date ? fd.closed_at : fd.maturity_date;
  const valuationDate = date < capDate ? date : capDate;
  return calculateFDValue(
    Number(fd.principal),
    Number(fd.interest_rate),
    fd.start_date,
    valuationDate,
    fd.interest_type as InterestType,
    fd.payout_frequency as PayoutFrequency,
    true,
  );
};

export const formatINR = (value: number, decimals = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(value) ? value : 0);

export const formatFDDate = (date: string) =>
  parseDate(date).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
