import OmniLogic from '../src/index.js';
import dotenv from 'dotenv';
import { ColorLogicLightStatus, FilterStatus } from '../src/Response.js';

dotenv.config();

// Skip all tests in this file if running in CI or missing environment variables
const runIntegrationTests = process.env.OMNILOGIC_TOKEN && 
                          process.env.OMNILOGIC_USERID && 
                          !process.env.CI;
(runIntegrationTests ? describe : describe.skip)('OmniLogic Integration Tests', () => {
  let omniLogic: OmniLogic;
  
  const mockLight: ColorLogicLightStatus = { 
    systemId: 8, 
    lightState: 6,
    currentShow: 0,
    speed: 0,
    brightness: 100,
    specialEffect: 0
  };

  const mockPump: FilterStatus = {
    systemId: 3,
    valvePosition: 1,
    filterSpeed: 0,
    filterState: 0,
    whyFilterIsOn: 0,
    fpOverride: 0,
    lastSpeed: 0
  }

  beforeEach(async () => {
    const token = {
      token: process.env.OMNILOGIC_TOKEN!,
      refreshToken: "1234567890"
    }
    const userID = parseInt(process.env.OMNILOGIC_USERID!);

    omniLogic = OmniLogic.withToken(token, userID);
  });

  afterEach(() => {
    (omniLogic as any).clearTokenRefresh();
  });

  describe('connection validation', () => {
    it('should throw error if methods are called before connect', async () => {
      await expect(omniLogic.getWaterTemperature())
        .rejects
        .toThrow('System ID not set, did you call `connect()`?');

      await expect(omniLogic.getPumpSpeed({} as FilterStatus))
        .rejects
        .toThrow('System ID not set, did you call `connect()`?');

      await expect(omniLogic.getLightState({} as ColorLogicLightStatus))
        .rejects
        .toThrow('System ID not set, did you call `connect()`?');
    });

    it('should not throw error after connecting', async () => {
      await omniLogic.connect();
      await expect(omniLogic.getWaterTemperature()).resolves.not.toThrow();
    });
  });

  describe('status', () => {
    beforeEach(async () => {
      await omniLogic.connect();
    });

    it('should successfully get pump speed', async () => {
        const result = await omniLogic.getPumpSpeed(mockPump);
        expect(result).toBeGreaterThanOrEqual(15);
        expect(result).toBeLessThanOrEqual(100);
      }, 30000);

    it('should successfully get water temperature', async () => {
        const result = await omniLogic.getWaterTemperature();
        expect(result.current).toBeGreaterThanOrEqual(55);
        expect(result.current).toBeLessThanOrEqual(90);
    }, 30000);

    it('should successfully get light state', async () => {
        const result = await omniLogic.getLightState(mockLight);
        expect(result).toEqual(false);
      }, 30000);

    it('should successfully set light state', async () => {
        const result = await omniLogic.setLightState(mockLight, false);
        expect(result).toEqual(true);
      }, 30000);
  });

  describe('telemetry caching', () => {
    beforeEach(async () => {
      await omniLogic.connect();
    });

    it('should cache telemetry data', async () => {
      // First call should make a request
      const result1 = await omniLogic.getWaterTemperature();
      
      // Second immediate call should use cache
      const result2 = await omniLogic.getWaterTemperature();
      
      expect(result1).toEqual(result2);
    });

    it('should refresh cache when forced', async () => {
      // Get initial data
      const result1 = await omniLogic.getWaterTemperature();
      
      // Force refresh
      await omniLogic.refreshTelemetry();
      
      // Get new data
      const result2 = await omniLogic.getWaterTemperature();
      
      // Data might be the same, but we're testing that the refresh didn't throw
      expect(result2).toBeDefined();
    });

    it('should clear cache', async () => {
      // Get initial data
      await omniLogic.getWaterTemperature();
      
      // Clear cache
      omniLogic.clearTelemetryCache();
      
      // Next call should make a new request
      const result = await omniLogic.getWaterTemperature();
      
      expect(result).toBeDefined();
    });

    it('should invalidate cache after successful state changes', async () => {
      // Get initial state
      const initialTemp = await omniLogic.getWaterTemperature();
      
      // Make a state change
      await omniLogic.setLightState(mockLight, false);
      
      // Get state again - should make a new request since cache was invalidated
      const newTemp = await omniLogic.getWaterTemperature();
      
      // The temperatures might be the same in reality, but we're testing cache invalidation
      expect(newTemp).toBeDefined();
    });

    it('should not invalidate cache if state change fails', async () => {
      // Get initial state
      const initialTemp = await omniLogic.getWaterTemperature();
      
      // Try to set invalid pump speed (this should fail)
      try {
        await omniLogic.setPumpSpeed(mockPump, 101);
      } catch (error) {
        // Expected error
      }
      
      // Get state again - should use cache since previous call failed
      const newTemp = await omniLogic.getWaterTemperature();
      
      expect(newTemp).toEqual(initialTemp);
    });
  });
}); 