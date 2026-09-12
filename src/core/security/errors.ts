export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
    readonly expose = true,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Faça login para continuar.") {
    super(message, "AUTHENTICATION_REQUIRED", 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Você não possui permissão para esta operação.") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Registro não encontrado.") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

export function publicErrorMessage(error: unknown): string {
  if (error instanceof AppError && error.expose) return error.message;
  return "Não foi possível concluir a operação. Tente novamente ou informe o protocolo ao suporte.";
}
