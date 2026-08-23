export class CloudAlmTaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Cloud ALM task not found: ${taskId}`);
    this.name = "CloudAlmTaskNotFoundError";
  }
}

export class CloudAlmValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudAlmValidationError";
  }
}

export class CloudAlmOperationNotSupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudAlmOperationNotSupportedError";
  }
}
