// Simple client-side validation helpers
export function isRequired(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

const validation = {
  isRequired,
  isEmail,
  isPhone,
  minLength,
  isNumber,
};

export default validation;

export function isEmail(value) {
  if (!isRequired(value)) return false;
  // simple email regex
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).toLowerCase());
}

export function isPhone(value) {
  if (!isRequired(value)) return false;
  // allow digits, +, -, spaces, parentheses; require 6-15 digits
  const digits = String(value).replace(/[^0-9]/g, "");
  return digits.length >= 6 && digits.length <= 15;
}

export function minLength(value, len) {
  if (!isRequired(value)) return false;
  return String(value).trim().length >= len;
}

export function isNumber(value) {
  if (!isRequired(value)) return false;
  return !isNaN(Number(value));
}
