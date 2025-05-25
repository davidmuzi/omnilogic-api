import { StatusResponse } from './TelemetryResponse';

function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export function parseTelemetryData({ STATUS: status }: { STATUS: any }): StatusResponse {
  return {
    version: status['@_version'],
    backyard: {
      systemId: parseInt(status.Backyard['@_systemId']),
      statusVersion: parseInt(status.Backyard['@_statusVersion']),
      airTemp: parseInt(status.Backyard['@_airTemp']),
      status: parseInt(status.Backyard['@_status']),
      state: parseInt(status.Backyard['@_state']),
      mspVersion: status.Backyard['@_mspVersion'],
      configUpdatedTime: status.Backyard['@_configUpdatedTime'],
      datetime: status.Backyard['@_datetime'],
      messageVersion: status.Backyard['@_messageVersion'],
    },
    bodiesOfWater: ensureArray(status.BodyOfWater).map(bow => ({
      systemId: parseInt(bow['@_systemId']),
      flow: parseInt(bow['@_flow']),
      waterTemp: parseInt(bow['@_waterTemp']),
    })),
    filters: ensureArray(status.Filter).map(filter => ({
      systemId: parseInt(filter['@_systemId']),
      valvePosition: parseInt(filter['@_valvePosition']),
      filterSpeed: parseInt(filter['@_filterSpeed']),
      filterState: parseInt(filter['@_filterState']),
      whyFilterIsOn: parseInt(filter['@_whyFilterIsOn']),
      fpOverride: parseInt(filter['@_fpOverride']),
      lastSpeed: parseInt(filter['@_lastSpeed']),
    })),
    virtualHeaters: ensureArray(status.VirtualHeater).map(vh => ({
      systemId: parseInt(vh['@_systemId']),
      currentSetPoint: parseInt(vh['@_Current-Set-Point']),
      enable: vh['@_enable']?.toLowerCase() === 'yes',
      solarSetPoint: parseInt(vh['@_SolarSetPoint']),
      mode: parseInt(vh['@_Mode']),
    })),
    heaters: ensureArray(status.Heater).map(heater => ({
      systemId: parseInt(heater['@_systemId']),
      heaterState: parseInt(heater['@_heaterState']),
      temp: parseInt(heater['@_temp']),
      enable: heater['@_enable']?.toLowerCase() === 'yes',
      priority: parseInt(heater['@_priority']),
      maintainFor: parseInt(heater['@_maintainFor']),
    })),
    chlorinators: ensureArray(status.Chlorinator).map(chlor => ({
      systemId: parseInt(chlor['@_systemId']),
      operatingMode: parseInt(chlor['@_operatingMode']),
      timedPercent: parseInt(chlor['@_Timed-Percent']),
      operatingState: parseInt(chlor['@_operatingState']),
      scMode: parseInt(chlor['@_scMode']),
      chlrError: parseInt(chlor['@_chlrError']),
      chlrAlert: parseInt(chlor['@_chlrAlert']),
      avgSaltLevel: parseInt(chlor['@_avgSaltLevel']),
      instantSaltLevel: parseInt(chlor['@_instantSaltLevel']),
      status: parseInt(chlor['@_status']),
      enable: chlor['@_enable'] === '1',
    })),
    colorLogicLights: ensureArray(status['ColorLogic-Light']).map(light => ({
      systemId: parseInt(light['@_systemId']),
      lightState: parseInt(light['@_lightState']),
      currentShow: parseInt(light['@_currentShow']),
      speed: parseInt(light['@_speed']),
      brightness: parseInt(light['@_brightness']),
      specialEffect: parseInt(light['@_specialEffect']),
    })),
    csads: ensureArray(status.CSAD).map(csad => ({
      systemId: parseInt(csad['@_systemId']),
      ph: csad['@_ph'] || null,
      orp: csad['@_orp'] || null,
      status: csad['@_status'] || null,
      mode: csad['@_mode'] || null,
    })),
    groups: ensureArray(status.Group).map(group => ({
      systemId: parseInt(group['@_systemId']),
      groupState: parseInt(group['@_groupState']),
    })),
  };
}
