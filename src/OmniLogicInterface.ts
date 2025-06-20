import type {
  ColorLogicLightStatus as Light,
  FilterStatus as Pump,
  VirtualHeaterStatus as Heater,
} from './Response.js';

export interface OmniLogicAPI {

  getWaterTemperature(): Promise<WaterTemperature>;

  // Pumps
  getPumps(): Promise<Pump[]>;
  getPumpSpeed(pump: Pump): Promise<Percentage>;
  getPumpSpeed(systemId: number): Promise<Percentage>;

  setPumpOn(pump: Pump): Promise<boolean>;
  setPumpSpeed(pump: Pump, speed: Percentage): Promise<boolean>;
  setPumpSpeed(systemId: number, speed: Percentage): Promise<boolean>;

  // Heaters
  getHeaters(): Promise<Heater[]>;
  setHeaterTemperature(heater: Heater, targetTemperature: Farhenheit): Promise<boolean>;
  setHeaterTemperature(systemId: number, targetTemperature: Farhenheit): Promise<boolean>;
  
  setHeaterState(heater: Heater, on: boolean): Promise<boolean>;
  setHeaterState(systemId: number, on: boolean): Promise<boolean>;

  // Lights
  getLights(): Promise<Light[]>;
  getLightState(light: Light): Promise<boolean>;
  getLightState(systemId: number): Promise<boolean>;

  setLightState(light: Light, on: boolean): Promise<boolean>
  setLightState(systemId: number, on: boolean): Promise<boolean>
}

export type Farhenheit = number;
export type Percentage = number;

export type WaterTemperature = {
  current: Farhenheit;
  target: Farhenheit;
  heaterOn: boolean;
};
