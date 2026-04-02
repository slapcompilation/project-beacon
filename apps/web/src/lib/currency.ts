const SYMBOLS: Record<string, string> = {
  // G10 + majors
  USD: '$',    EUR: '€',    GBP: '£',    JPY: '¥',    CHF: 'CHF',
  AUD: 'A$',   CAD: 'C$',   NZD: 'NZ$',  SEK: 'kr',   NOK: 'kr',   DKK: 'kr',
  // Asia-Pacific
  CNY: '¥',    HKD: 'HK$',  SGD: 'S$',   KRW: '₩',    TWD: 'NT$',
  THB: '฿',    MYR: 'RM',   IDR: 'Rp',   PHP: '₱',    VND: '₫',
  INR: '₹',    PKR: '₨',    BDT: '৳',
  // Middle East
  AED: 'AED',  SAR: 'SAR',  QAR: 'QAR',  KWD: 'KD',   BHD: 'BD',
  OMR: 'OMR',  JOD: 'JD',   ILS: '₪',
  // Europe non-EUR
  PLN: 'zł',   CZK: 'Kč',   HUF: 'Ft',   RON: 'lei',
  TRY: '₺',    RUB: '₽',    UAH: '₴',
  // Americas
  MXN: 'MX$',  BRL: 'R$',   COP: 'COP',  PEN: 'S/',
  CLP: 'CLP',  ARS: 'ARS',
  // Africa
  ZAR: 'R',    EGP: 'E£',   NGN: '₦',    KES: 'KSh',  GHS: 'GH₵',  MAD: 'MAD',
}

export function getCurrencySymbol(code: string): string {
  return SYMBOLS[code.toUpperCase()] ?? code
}

export function formatCurrency(amount: number, code: string): string {
  return `${getCurrencySymbol(code)}${amount.toFixed(2)}`
}
