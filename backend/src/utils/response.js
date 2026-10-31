function sendSuccess(res, { statusCode = 200, message = 'Thành công', data, ...extras } = {}) {
  const body = { success: true, message, ...extras };
  if (data !== undefined) {
    body.data = data;
  }
  return res.status(statusCode).json(body);
}

module.exports = { sendSuccess };

