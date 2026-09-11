export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || 'ERROR';
  }
}

export function badRequest(message, code = 'BAD_REQUEST') {
  return new HttpError(400, message, code);
}

export function unauthorized(message = 'Unknown demo user') {
  return new HttpError(401, message, 'UNAUTHORIZED');
}

export function forbidden(message = 'Not permitted', code = 'FORBIDDEN') {
  return new HttpError(403, message, code);
}

export function notFound(message = 'Not found') {
  return new HttpError(404, message, 'NOT_FOUND');
}

export function conflict(message, code = 'CONFLICT') {
  return new HttpError(409, message, code);
}

export function handleError(res, error) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  console.error(error);
  return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' });
}
