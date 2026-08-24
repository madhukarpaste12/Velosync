const Joi = require('joi');

const signupSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).pattern(new RegExp('(?=.*[0-9])')).required()
    .messages({ 'string.pattern.base': 'Password must contain at least one number.' })
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required()
});

const validateSignup = (req, res, next) => {
  const { error } = signupSchema.validate(req.body);
  if (error) return res.status(422).json({ success: false, message: error.details[0].message });
  next();
};

const validateLogin = (req, res, next) => {
  const { error } = loginSchema.validate(req.body);
  if (error) return res.status(422).json({ success: false, message: error.details[0].message });
  next();
};

module.exports = { validateSignup, validateLogin };