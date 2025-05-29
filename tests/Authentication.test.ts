import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { OmniLogicAuth } from '../src/utils/Authentication.js';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('OmniLogicAuth', () => {
  const mockEmail = 'test@example.com';
  const mockPassword = 'password123';
  let auth: OmniLogicAuth;

  beforeEach(() => {
    auth = new OmniLogicAuth();
    mockFetch.mockClear();
  });

  describe('login', () => {
    const mockLoginResponse = {
      userID: 123,
      token: 'mock-token',
      refreshToken: 'mock-refresh-token',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User'
    };

    it('should successfully login with valid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLoginResponse)
      } as Response);

      const result = await auth.login(mockEmail, mockPassword);
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [request] = mockFetch.mock.calls[0] as [Request];
      
      // Check URL
      expect(request.url).toBe('https://services-gamma.haywardcloud.net/auth-service/v2/login');
      
      // Check request options
      expect(request.method).toBe('POST');
      expect(request.headers.get('Content-Type')).toBe('application/json');
      expect(request.headers.get('X-Hayward-App-Id')).toBe('6jf6n7jt9fqqe9qkbutaqajl2i');
      
      // Check body
      const body = await request.json();
      expect(body).toEqual({ email: mockEmail, password: mockPassword });
      
      expect(result).toEqual(mockLoginResponse);
    });

    it('should handle network errors during login', async () => {
      const mockError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(mockError);

      const result = await auth.login(mockEmail, mockPassword);
      
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Network error');
    });
  });

  describe('refreshToken', () => {
    const mockToken = {
      token: 'current-token',
      refreshToken: 'current-refresh-token'
    };

    const mockRefreshResponse = {
      token: 'new-token',
      refreshToken: 'new-refresh-token'
    };

    it('should successfully refresh token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRefreshResponse)
      } as Response);

      const result = await auth.refreshToken(mockToken);
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [request] = mockFetch.mock.calls[0] as [Request];
      
      // Check URL
      expect(request.url).toBe('https://services-gamma.haywardcloud.net/auth-service/v2/refresh');
      
      // Check request options
      expect(request.method).toBe('POST');
      expect(request.headers.get('Content-Type')).toBe('application/json');
      expect(request.headers.get('X-Hayward-App-Id')).toBe('6jf6n7jt9fqqe9qkbutaqajl2i');
      expect(request.headers.get('Authorization')).toBe(`Bearer ${mockToken.token}`);
      
      // Check body
      const body = await request.json();
      expect(body).toEqual({ refreshToken: mockToken.refreshToken });
      
      expect(result).toEqual(mockRefreshResponse);
    });

    it('should handle missing refresh token', async () => {
      const result = await auth.refreshToken({ token: 'token', refreshToken: null as any });
      
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Attempted to refresh without refresh token');
    });

    it('should handle network errors during refresh', async () => {
      const mockError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(mockError);

      const result = await auth.refreshToken(mockToken);
      
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Network error');
    });
  });

  describe('sendRequest', () => {
    it('should handle string errors', async () => {
      mockFetch.mockRejectedValueOnce('String error message');

      const request = new Request('https://example.com');
      const result = await auth['sendRequest'](request);
      
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('String error message');
    });

    it('should handle unknown errors', async () => {
      mockFetch.mockRejectedValueOnce(null);

      const request = new Request('https://example.com');
      const result = await auth['sendRequest'](request);
      
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('unknown error');
    });
  });
}); 