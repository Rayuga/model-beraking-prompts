export class AppError extends Error {
  constructor(message, { status = 400, code = 'BAD_REQUEST', details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message, details) {
  return new AppError(message, { status: 400, code: 'BAD_REQUEST', details });
}
export function forbidden(message = 'Forbidden', details) {
  return new AppError(message, { status: 403, code: 'FORBIDDEN', details });
}
export function unauthorized(message = 'Unauthorized', details) {
  return new AppError(message, { status: 401, code: 'UNAUTHORIZED', details });
}
export function notFound(message = 'Not found', details) {
  return new AppError(message, { status: 404, code: 'NOT_FOUND', details });
}
export function conflict(message = 'Conflict', details) {
  return new AppError(message, { status: 409, code: 'CONFLICT', details });
}

export function handleError(res, error) {
  const status = error?.status || 500;
  const code = error?.code || 'INTERNAL_ERROR';
  const message = error?.message || 'Internal server error';
  return res.status(status).json({ error: message, code, details: error?.details || undefined });
}
