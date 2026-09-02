const errorHandler = (err, req, res, next) => {
  console.error(`[Error] ${err.message}`);
  
  const statusCode = err.statusCode || 500;
  let message = err.isOperational ? err.message : 'Internal Server Error';
  
  // Handle database connection errors with helpful message
  if (err.message && err.message.includes('ECONNREFUSED')) {
    message = 'Database connection failed. Please ensure PostgreSQL is running on localhost:5432.';
  }

  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : message
  });
};

module.exports = errorHandler;