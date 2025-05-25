import OmniLogic from '../src/index.js';

describe('OmniLogic', () => {
  let omniLogic: OmniLogic;

  beforeEach(() => {
    omniLogic = new OmniLogic();
  });

  describe('status', () => {
    it('should successfully get pump speed', async () => {
        const result = await omniLogic.getPumpSpeed();
        expect(result).toBeGreaterThanOrEqual(50);
        expect(result).toBeLessThanOrEqual(100);
      }, 30000);

    it('should successfully get water temperature', async () => {
        const result = await omniLogic.getWaterTemperature();
        expect(result).toBeGreaterThanOrEqual(55);
        expect(result).toBeLessThanOrEqual(90);
    }, 30000);

    it('should successfully get light state', async () => {
        const result = await omniLogic.getLightState();
        expect(result).toEqual(false);
      }, 30000);

    it('should successfully set light state', async () => {
        const result = await omniLogic.setLightState(false);
        expect(result).toEqual(true);
      }, 30000);
  });
}); 