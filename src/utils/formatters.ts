/**
 * Transforms numbers into the standard Indian currency format (e.g., 12345678 becomes ₹1,23,45,678)
 * @param amount the numeric amount in raw rupees
 */
export function formatIndianCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}
