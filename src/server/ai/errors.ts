export class AiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}
