let cachedExchangeRates = null;
let ratesFetchTime = 0;
const RATES_CACHE_DURATION = 3600000; // 1 hour

// Fetch real currency rates from API (base = INR)
export async function fetchExchangeRates() {
  const now = Date.now();
  if (cachedExchangeRates && (now - ratesFetchTime) < RATES_CACHE_DURATION) {
    return cachedExchangeRates;
  }
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/INR');
    if (!res.ok) throw new Error('Failed to fetch rates');
    const data = await res.json();
    cachedExchangeRates = data.rates || {};
    ratesFetchTime = now;
    return cachedExchangeRates;
  } catch (err) {
    // Fallback conservative rates (1 INR => x currency)
    console.warn('fetchExchangeRates fallback', err);
    cachedExchangeRates = {
      INR: 1,
      USD: 0.012,
      EUR: 0.011,
      GBP: 0.0095,
      AUD: 0.018,
      CAD: 0.016,
      SGD: 0.016,
      AED: 0.044,
    };
    ratesFetchTime = now;
    return cachedExchangeRates;
  }
}

export const currencySymbols = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  AED: 'د.إ',
};

export function getCurrencySymbol(currency) {
  return currencySymbols[currency] || '₹';
}

export function cleanCurrencyValue(value) {
  if (!value) return 'INR';
  const validCurrencies = Object.keys(currencySymbols);
  const str = String(value).trim().toUpperCase();
  for (const cur of validCurrencies) {
    if (str.includes(cur)) return cur;
  }
  const firstThree = str.substring(0, 3);
  return validCurrencies.includes(firstThree) ? firstThree : 'INR';
}

// Convert amount between any two currencies using INR as pivot.
// rates[c] = value of 1 INR in that currency (e.g. rates['USD'] = 0.012)
export async function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  if (amount === null || amount === undefined || isNaN(Number(amount))) return amount;
  const rates = await fetchExchangeRates();
  // Convert fromCurrency -> INR -> toCurrency
  const fromRate = rates[fromCurrency] || (fromCurrency === 'INR' ? 1 : undefined);
  const toRate = rates[toCurrency] || (toCurrency === 'INR' ? 1 : undefined);
  // If fromRate undefined treat as INR
  const amountInINR = fromCurrency === 'INR' ? Number(amount) : (Number(amount) / (fromRate || 1));
  const converted = toCurrency === 'INR' ? amountInINR : amountInINR * (toRate || 1);
  return Math.round(converted * 100) / 100;
}

export function round2(v) {
  const n = Number(v) || 0;
  return Math.round(n * 100) / 100;
}

export function getINRValueFromDeal(deal) {
  if (!deal) return 0;
  const candidates = [
    deal.DealValueInINR,
    deal.dealValueInINR,
    deal.dealValueInBaseCurrency,
    deal.DealValueInBaseCurrency,
    deal.dealValueInBaseCurrencyAmount,
    deal.DealValueInBaseCurrencyAmount,
    deal.dealValue,
    deal.totalPrice,
    deal.DealValue,
  ];
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const n = Number(c);
    if (!isNaN(n)) return n;
  }
  return 0;
}
