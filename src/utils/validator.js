function validateUsername(username) {
  if (!username) {
    throw new Error('Username is required');
  }
  
  // Hapus @ jika ada
  const clean = username.replace('@', '');
  
  // Validasi format username Telegram
  const usernameRegex = /^[a-zA-Z0-9_]{5,32}$/;
  if (!usernameRegex.test(clean)) {
    throw new Error('Invalid username format. Must be 5-32 characters (letters, numbers, underscore)');
  }
  
  return clean;
}

function validateGroupUsername(username) {
  const clean = username.replace('@', '');
  if (clean.length < 5) {
    throw new Error('Group username too short (minimum 5 characters)');
  }
  return clean;
}

function validatePhoneNumber(phone) {
  const phoneRegex = /^\+?\d{10,15}$/;
  if (!phoneRegex.test(phone)) {
    throw new Error('Invalid phone number format');
  }
  return phone;
}

function validateApiKey(key) {
  if (!key || key.length < 10) {
    throw new Error('Invalid API key');
  }
  return key;
}

function validateBatchOptions(options) {
  const { batchSize, delay, limit } = options;
  
  if (batchSize && (batchSize < 1 || batchSize > 200)) {
    throw new Error('batchSize must be between 1 and 200');
  }
  
  if (delay && delay < 500) {
    throw new Error('delay must be at least 500ms');
  }
  
  if (limit && limit < 0) {
    throw new Error('limit must be positive');
  }
  
  return true;
}

module.exports = {
  validateUsername,
  validateGroupUsername,
  validatePhoneNumber,
  validateApiKey,
  validateBatchOptions,
};
