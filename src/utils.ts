/**
 * Formats a currency value according to Indian standards (e.g., ₹1,23,45,678)
 * Can handle raw rupees, or convert from crores or lakhs with options.
 */
export function formatIndianCurrency(
  value: number | null | undefined,
  options?: {
    isCrores?: boolean;
    isLakhs?: boolean;
    showSymbol?: boolean;
    fractionDigits?: number;
  }
): string {
  if (value === null || value === undefined) return "N/A";

  let rupees = value;
  if (options?.isCrores) {
    rupees = value * 10000000;
  } else if (options?.isLakhs) {
    rupees = value * 100000;
  }

  const formatter = new Intl.NumberFormat("en-IN", {
    style: options?.showSymbol !== false ? "currency" : "decimal",
    currency: "INR",
    maximumFractionDigits: options?.fractionDigits !== undefined ? options.fractionDigits : 0,
    minimumFractionDigits: options?.fractionDigits !== undefined ? options.fractionDigits : 0,
  });

  return formatter.format(rupees);
}

/**
 * Formats a number to Indian currency format (e.g., ₹1,23,45,678)
 * @param value value in Crores INR
 */
export function formatToLakhCrore(value: number | null): string {
  return formatIndianCurrency(value, { isCrores: true });
}

/**
 * Formats an EMD amount in Lakhs
 */
export function formatEMD(lakhs: number | null): string {
  return formatIndianCurrency(lakhs, { isLakhs: true });
}

/**
 * Formats dates into DD-MMM-YYYY format (e.g., 15-Jun-2026)
 */
export function formatDate(isoString: string | null): string {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

/**
 * Calculates countdown remaining days and returns structured info
 */
export interface CountdownInfo {
  text: string;
  daysRemaining: number;
  colorClass: string; // Red if < 3, amber if 3-7, green if > 7
}

export function getCountdown(deadlineStr: string): CountdownInfo {
  const deadline = new Date(deadlineStr);
  const now = new Date();
  
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return {
      text: "Closed",
      daysRemaining: diffDays,
      colorClass: "bg-red-100 text-red-800 border-red-200",
    };
  }

  if (diffDays === 0) {
    return {
      text: "Ends today",
      daysRemaining: 0,
      colorClass: "bg-red-500 text-white border-red-600 animate-pulse",
    };
  }

  let colorClass = "bg-green-100 text-green-800 border-green-200";
  if (diffDays < 3) {
    colorClass = "bg-red-100 text-red-800 border-red-200";
  } else if (diffDays <= 7) {
    colorClass = "bg-amber-100 text-amber-800 border-amber-200";
  }

  return {
    text: `${diffDays} days left`,
    daysRemaining: diffDays,
    colorClass,
  };
}

/**
 * Resolves standard authorization headers containing the stored JWT token.
 */
export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem("tender_jwt");
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}
