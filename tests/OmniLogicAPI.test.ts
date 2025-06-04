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
  beforeEach(async () => {
    const token = {
      token: process.env.OMNILOGIC_TOKEN!,
      refreshToken: "1234567890"
    }
    const userID = parseInt(process.env.OMNILOGIC_USERID!);

    omniLogic = OmniLogic.withToken(token, userID);
  });

  afterEach(() => {
    omniLogic.clearTokenRefresh();
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

    it('should successfully get pump speed', async () => {
        const result = await omniLogic.getPumpSpeed(mockPump);
        expect(result).toBeGreaterThanOrEqual(50);
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
}); 