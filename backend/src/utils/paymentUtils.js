const PAYMENT_METHODS = ['UPI', 'Credit/Debit Card', 'Net Banking'];

const normalizePaymentMethod = (value = '') => {
  const input = String(value || '').trim().toLowerCase();
  if (!input) return '';

  if (['upi', 'upi id', 'upi-id'].includes(input)) return 'UPI';
  if (['credit card', 'debit card', 'card', 'credit/debit card', 'credit-debit card'].includes(input)) return 'Credit/Debit Card';
  if (['net banking', 'netbanking', 'internet banking'].includes(input)) return 'Net Banking';

  return PAYMENT_METHODS.find((method) => method.toLowerCase() === input) || '';
};

const validateTopupAmount = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return false;
  return true;
};

const getPaymentGatewayStatus = () => {
  const provider = process.env.PAYMENT_PROVIDER || process.env.PAYMENT_GATEWAY || process.env.RAZORPAY_KEY_ID || '';
  const configured = Boolean(provider);

  return {
    configured,
    provider: configured ? (process.env.PAYMENT_PROVIDER || process.env.PAYMENT_GATEWAY || 'razorpay') : 'none',
    details: configured ? 'Payment gateway configured' : 'No payment gateway configured; using guarded UI and backend structure.'
  };
};

module.exports = {
  PAYMENT_METHODS,
  normalizePaymentMethod,
  validateTopupAmount,
  getPaymentGatewayStatus
};
