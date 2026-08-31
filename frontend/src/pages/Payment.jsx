import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createWalletTopUp, getWalletGatewayStatus } from '../services/api';

const methods = ['UPI', 'Credit/Debit Card', 'Net Banking'];
const toCurrency = (value) => `₹${Number(value).toFixed(2)}`;

export default function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialAmount = useMemo(() => {
    const value = Number(location.state?.amount ?? '');
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [location.state]);

  const [method, setMethod] = useState('UPI');
  const [amount, setAmount] = useState(initialAmount || '');
  const [value, setValue] = useState('');
  const [card, setCard] = useState({ name: '', number: '', expiry: '', cvv: '' });
  const [error, setError] = useState('');
  const [state, setState] = useState('form');
  const [gatewayStatus, setGatewayStatus] = useState({ configured: false, provider: 'none', details: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadGatewayStatus = async () => {
      try {
        const status = await getWalletGatewayStatus();
        setGatewayStatus(status);
      } catch {
        setGatewayStatus({ configured: false, provider: 'none', details: 'Payment gateway status unavailable.' });
      }
    };

    void loadGatewayStatus();
  }, []);

  useEffect(() => {
    if (!initialAmount) {
      setError('Enter a valid amount greater than ₹0 to continue.');
    }
  }, [initialAmount]);

  const validateForm = () => {
    const numericAmount = Number(amount || initialAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error('Amount must be greater than ₹0.');
    }

    if (method === 'UPI' && !/^[\w.-]+@[\w.-]+$/.test(value.trim())) {
      throw new Error('Enter a valid UPI ID, for example name@bank.');
    }

    if (method === 'Credit/Debit Card') {
      const digits = card.number.replace(/\s/g, '');
      if (!card.name.trim() || !/^\d{16}$/.test(digits) || !/^\d{2}\/\d{2}$/.test(card.expiry) || !/^\d{3,4}$/.test(card.cvv)) {
        throw new Error('Complete the card details before continuing.');
      }
    }

    if (method === 'Net Banking' && !value.trim()) {
      throw new Error('Select a bank or enter your bank details to continue.');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      validateForm();
      setState('processing');
      setIsSubmitting(true);

      const numericAmount = Number(amount || initialAmount || 0);
      const paymentPayload = {
        amount: numericAmount,
        paymentMethod: method,
        upiId: method === 'UPI' ? value.trim() : '',
        bankName: method === 'Net Banking' ? value.trim() : '',
        cardDetails: method === 'Credit/Debit Card' ? {
          holderName: card.name.trim(),
          last4: card.number.replace(/\s/g, '').slice(-4)
        } : null
      };

      const response = await createWalletTopUp(paymentPayload);

      if (!response.success) {
        throw new Error(response.message || 'Payment could not be completed.');
      }

      setState('success');
      setIsSubmitting(false);
    } catch (submitError) {
      setIsSubmitting(false);
      setState('failure');
      setError(submitError.message || 'Payment could not be completed.');
    }
  };

  const handleCancel = () => {
    setState('form');
    setError('');
    navigate('/home');
  };

  if (state === 'success') {
    return (
      <div className="payment-shell">
        <section className="payment-result success-result">
          <span className="result-icon">✓</span>
          <p className="eyebrow">Wallet top-up</p>
          <h1>Payment request received</h1>
          <p>No real payment gateway is configured yet, so this step remains intentionally protected and no fake charge was completed.</p>
          <div className="receipt">
            <span>Amount</span>
            <strong>{toCurrency(amount || initialAmount || 0)}</strong>
            <span>Selected method</span>
            <strong>{method}</strong>
            <span>Gateway status</span>
            <strong>{gatewayStatus.configured ? gatewayStatus.provider : 'Not configured'}</strong>
          </div>
          <button className="btn btn-primary full-width" onClick={() => navigate('/home')}>Return to dashboard</button>
        </section>
      </div>
    );
  }

  if (state === 'failure') {
    return (
      <div className="payment-shell">
        <section className="payment-result">
          <span className="result-icon failure-icon">!</span>
          <p className="eyebrow">Payment not completed</p>
          <h1>Try again</h1>
          <p>{error}</p>
          <div className="payment-actions">
            <button className="btn btn-primary full-width" onClick={() => { setState('form'); setError(''); }}>Retry payment</button>
            <button type="button" className="btn btn-secondary full-width" onClick={handleCancel}>Cancel and return</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="payment-shell">
      <header className="payment-header">
        <Link to="/home" className="back-link">← Dashboard</Link>
        <span className="secure-label">🔒 {gatewayStatus.configured ? 'Secure checkout' : 'Gateway not configured'}</span>
      </header>
      <main className="payment-layout">
        <section className="payment-panel">
          <p className="eyebrow">VeloSync wallet</p>
          <h1>Add balance</h1>
          <p className="form-intro">Select a payment method and continue to the existing wallet top-up flow.</p>
          <div className="summary-row">
            <span>Amount</span>
            <strong>{toCurrency(amount || initialAmount || 0)}</strong>
          </div>
          <div className="summary-row muted-row">
            <span>Gateway</span>
            <span>{gatewayStatus.configured ? gatewayStatus.provider : 'Not configured'}</span>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <strong>{toCurrency(amount || initialAmount || 0)}</strong>
          </div>
        </section>

        <section className="payment-panel">
          <h2>Choose payment method</h2>
          <div className="method-tabs">
            {methods.map((item) => (
              <button
                type="button"
                key={item}
                className={method === item ? 'selected' : ''}
                onClick={() => { setMethod(item); setValue(''); setError(''); }}
              >
                {item}
              </button>
            ))}
          </div>

          <form onSubmit={submit} noValidate>
            <label htmlFor="amount-input">Amount</label>
            <input
              id="amount-input"
              value={amount || initialAmount || ''}
              onChange={(event) => {
                const raw = event.target.value.replace(/[^0-9.]/g, '');
                setAmount(raw);
                if (Number(raw) <= 0) setError('Amount must be greater than ₹0.');
                else setError('');
              }}
              placeholder="Enter amount"
              inputMode="decimal"
              aria-invalid={Boolean(error)}
            />

            {method === 'Credit/Debit Card' ? (
              <div className="card-fields">
                <label htmlFor="card-name">Cardholder name</label>
                <input id="card-name" value={card.name} onChange={(event) => setCard({ ...card, name: event.target.value })} placeholder="Name on card" autoComplete="off" />
                <label htmlFor="card-number">Card number</label>
                <input id="card-number" inputMode="numeric" value={card.number} onChange={(event) => setCard({ ...card, number: event.target.value.replace(/[^\d ]/g, '').slice(0, 19) })} placeholder="0000 0000 0000 0000" autoComplete="off" />
                <div className="card-row">
                  <div>
                    <label htmlFor="card-expiry">Expiry</label>
                    <input id="card-expiry" value={card.expiry} onChange={(event) => setCard({ ...card, expiry: event.target.value.slice(0, 5) })} placeholder="MM/YY" autoComplete="off" />
                  </div>
                  <div>
                    <label htmlFor="card-cvv">CVV</label>
                    <input id="card-cvv" inputMode="numeric" type="password" value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="123" autoComplete="off" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="input-group">
                <label htmlFor="payment-detail">{method === 'UPI' ? 'UPI ID' : 'Bank / account name'}</label>
                <input id="payment-detail" value={value} onChange={(event) => setValue(event.target.value)} placeholder={method === 'UPI' ? 'name@bank' : 'Bank or account name'} autoComplete="off" />
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            <button className="btn btn-primary full-width" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : gatewayStatus.configured ? 'Pay now' : 'Continue to gateway setup'}
            </button>
            <p className="demo-note">
              {gatewayStatus.configured
                ? 'Sensitive payment data is not stored in the app database.'
                : 'No real gateway is configured. The UI is ready to integrate with a provider, but no payment is completed until a real gateway is set up.'}
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
