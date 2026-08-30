function crearErrorHttp(
  statusCode,
  message,
  extra = {}
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  error.publicData = {
    message,
    ...extra,
  };

  return error;
}


module.exports = {
  crearErrorHttp,
};