const globalErrorHandler = (err, req, res, next) => {
  // Handle CORS errors
  if (err.message && err.message.includes("CORS: Origin")) {
    return res.status(403).json({
      success: false,
      message: "CORS Error: This origin is not allowed."
    });
  }
  
  // Handle rate limit errors
  if (err.code === 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR') {
    console.warn("Rate limit proxy warning (handled):", err.message);
    return next();
  }
  
  // Generic error handler
  console.error("Server Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
};

module.exports = { globalErrorHandler };