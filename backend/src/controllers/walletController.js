const pool = require('../config/db');
const { PAYMENT_METHODS, normalizePaymentMethod, validateTopupAmount, getPaymentGatewayStatus } = require('../utils/paymentUtils');

const getWalletStatus = async (req, res, next) => {
  try {
    const gatewayStatus = getPaymentGatewayStatus();
    res.json({
      success: true,
      configured: gatewayStatus.configured,
      provider: gatewayStatus.provider,
      details: gatewayStatus.details,
      methods: PAYMENT_METHODS
    });
  } catch (error) {
    next(error);
  }
};

const createTopUp = async (req, res, next) => {
  try {
    const { amount, paymentMethod, providerReference } = req.body || {};

    if (!validateTopupAmount(amount)) {
      return res.status(422).json({
        success: false,
        message: 'Amount must be greater than ₹0.'
      });
    }

    const normalizedMethod = normalizePaymentMethod(paymentMethod);
    if (!normalizedMethod) {
      return res.status(422).json({
        success: false,
        message: 'Please select a valid payment method.'
      });
    }

    const amountValue = Number(amount);
    const gatewayStatus = getPaymentGatewayStatus();
    const paymentRecord = {
      userId: req.user.id,
      amount: amountValue,
      paymentMethod: normalizedMethod,
      providerReference: providerReference || `velosync-${Date.now()}`
    };

    if (!gatewayStatus.configured) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          "INSERT INTO payments (user_id, amount, currency, status, payment_method, provider_reference) VALUES ($1, $2, 'INR', 'FAILED', $3, $4)",
          [paymentRecord.userId, paymentRecord.amount, paymentRecord.paymentMethod, paymentRecord.providerReference]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      return res.status(402).json({
        success: false,
        message: 'No payment gateway is currently configured. Add a real gateway before enabling live wallet top-ups.',
        requiresGateway: true,
        paymentMethod: normalizedMethod,
        amount: amountValue,
        provider: gatewayStatus.provider
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const walletResult = await client.query(
        'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2 RETURNING wallet_balance',
        [amountValue, req.user.id]
      );

      const paymentResult = await client.query(
        "INSERT INTO payments (user_id, amount, currency, status, payment_method, provider_reference) VALUES ($1, $2, 'INR', 'SUCCEEDED', $3, $4) RETURNING id, amount, status, created_at",
        [paymentRecord.userId, paymentRecord.amount, paymentRecord.paymentMethod, paymentRecord.providerReference]
      );

      await client.query('COMMIT');

      res.status(200).json({
        success: true,
        message: 'Wallet balance updated successfully.',
        amount: amountValue,
        paymentMethod: normalizedMethod,
        walletBalance: Number(walletResult.rows[0].wallet_balance),
        payment: paymentResult.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { createTopUp, getWalletStatus };
