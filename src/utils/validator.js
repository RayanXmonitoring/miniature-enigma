function validateGroupId(groupId) {
  const id = parseInt(groupId);
  if (isNaN(id)) {
    throw new Error('Invalid group ID format');
  }
  return id;
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

module.exports = {
  validateGroupId,
  validatePhoneNumber,
  validateApiKey,
};
