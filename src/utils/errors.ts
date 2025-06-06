export class OmniLogicError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, OmniLogicError.prototype);
  }
}

export class ConnectionError extends OmniLogicError {
  constructor(message: string = 'System ID not set, did you call `connect()`?') {
    super(message);
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

export class AuthenticationError extends OmniLogicError {
  constructor(message: string = 'Authentication failed') {
    super(message);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class EquipmentError extends OmniLogicError {
  constructor(message: string = `Could not find equipment`) {
    super(message);
    Object.setPrototypeOf(this, EquipmentError.prototype);
  }
}

export class ValidationError extends OmniLogicError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
