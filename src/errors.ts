export class OmniLogicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OmniLogicError';
    Object.setPrototypeOf(this, OmniLogicError.prototype);
  }
}

export class ConnectionError extends OmniLogicError {
  constructor(message: string = 'System ID not set, did you call `connect()`?') {
    super(message);
    this.name = 'ConnectionError';
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

export class AuthenticationError extends OmniLogicError {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class EquipmentError extends OmniLogicError {
  constructor(
    public equipmentId: number,
    message: string = `Could not find body of water for equipment ${equipmentId}`
  ) {
    super(message);
    this.name = 'EquipmentError';
    Object.setPrototypeOf(this, EquipmentError.prototype);
  }
}

export class ValidationError extends OmniLogicError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class APIError extends OmniLogicError {
  constructor(
    public statusCode: number,
    public statusMessage: string
  ) {
    super(`API request failed: ${statusMessage} (${statusCode})`);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}
