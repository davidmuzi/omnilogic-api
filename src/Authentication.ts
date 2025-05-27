export type Token = {
  token: string;
  refreshToken: string;
};

export type Session = Token & {
  userID: number;
  email: string;
  firstName: string;
  lastName: string;
};

export class OmniLogicAuth {
  private static baseURL = 'https://services-gamma.haywardcloud.net/auth-service/v2/';
  private static jsonHeader = { 'Content-Type': 'application/json' };
  private static apiHeader = { 'X-Hayward-App-Id': '6jf6n7jt9fqqe9qkbutaqajl2i' };

  async login(email: string, password: string): Promise<Session | Error> {
    const method = 'POST';
    const headers = {
      ...OmniLogicAuth.jsonHeader,
      ...OmniLogicAuth.apiHeader,
    };

    const body = JSON.stringify({ email: email, password: password });
    const options = { method, body, headers };
    const request = new Request(OmniLogicAuth.baseURL + 'login', options);
    return this.sendRequest(request);
  }

  async refreshToken(token: Token): Promise<Token | Error> {
    if (token.refreshToken == null || token.token == null) {
      return new Error('Attempted to refresh without refresh token');
    }

    const method = 'POST';
    const headers = {
      ...OmniLogicAuth.jsonHeader,
      ...OmniLogicAuth.apiHeader,
      Authorization: `Bearer ${token.token}`,
    };

    const body = JSON.stringify({ refreshToken: token.refreshToken });
    const options = { method, body, headers };
    const request = new Request(OmniLogicAuth.baseURL + 'refresh', options);
    return this.sendRequest(request);
  }

  protected async sendRequest<T>(request: Request): Promise<T | Error> {
    try {
      const response = await fetch(request);
      if (!response.ok) {
        return new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error: unknown) {
      if (typeof error === 'string') {
        return new Error(error);
      } else if (error instanceof Error) {
        return error;
      } else {
        return new Error('unknown error');
      }
    }
  }
}
