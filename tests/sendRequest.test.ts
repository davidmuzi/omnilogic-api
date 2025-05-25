import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { sendRequest } from '../src/sendRequest.js';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('sendRequest', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should convert payload to XML and handle successful response', async () => {
    const mockXmlResponse = `
      <Response>
        <Parameters>
          <Parameter name="Status" dataType="string">Success</Parameter>
          <Parameter name="Message" dataType="string">Operation completed</Parameter>
        </Parameters>
      </Response>
    `;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockXmlResponse)
    } as Response);

    const payload = {
      Request: {
        Name: 'TestOperation',
        Parameters: {
          Parameter: [
            { '@_name': 'token', '@_dataType': 'string', '#text': 'test-token' },
            { '@_name': 'systemId', '@_dataType': 'string', '#text': 'test-system' }
          ]
        }
      }
    };

    const result = await sendRequest(payload);

    // Verify the request
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [request] = mockFetch.mock.calls[0] as [Request];
    expect(request.url).toBe('https://www.haywardomnilogic.com/MobileInterface/MobileInterface.ashx');
    expect(request.method).toBe('POST');

    // Verify the response parsing
    expect(result).toEqual({
      Response: {
        Parameters: {
          Parameter: [
            { '@_name': 'Status', '@_dataType': 'string', '#text': 'Success' },
            { '@_name': 'Message', '@_dataType': 'string', '#text': 'Operation completed' }
          ]
        }
      }
    });
  });

  it('should handle network errors', async () => {
    const mockError = new Error('Network error');
    mockFetch.mockRejectedValueOnce(mockError);

    const payload = {
      Request: {
        Name: 'TestOperation'
      }
    };

    await expect(sendRequest(payload)).rejects.toThrow('Network error');
  });

  it('should handle string errors', async () => {
    mockFetch.mockRejectedValueOnce('String error message');

    const payload = {
      Request: {
        Name: 'TestOperation'
      }
    };

    await expect(sendRequest(payload)).rejects.toThrow('String error message');
  });

  it('should handle unknown errors', async () => {
    mockFetch.mockRejectedValueOnce(null);

    const payload = {
      Request: {
        Name: 'TestOperation'
      }
    };

    await expect(sendRequest(payload)).rejects.toThrow('unknown error');
  });

  it('should handle malformed XML response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('invalid xml <<<')
    } as Response);

    const payload = {
      Request: {
        Name: 'TestOperation'
      }
    };

    await expect(sendRequest(payload)).rejects.toThrow();
  });
}); 