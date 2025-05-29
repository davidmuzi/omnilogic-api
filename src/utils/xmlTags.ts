export function emptyTimerTag() {
  return [
    tag('IsCountDownTimer', false),
    tag('StartTimeHours', 0),
    tag('StartTimeMinutes', 0),
    tag('EndTimeHours', 0),
    tag('EndTimeMinutes', 0),
    tag('DaysActive', 0),
    tag('Recurring', false),
  ];
}

export function userTag(userID: number) {
  return tag('OwnerID', userID);
}

export function tokenTag(token: string) {
  return tag('token', token);
}

export function systemTag(systemID: number) {
  return tag('MspSystemID', systemID);
}

export function poolTag(poolID: number) {
  return tag('PoolID', poolID);
}

export function heaterTag(heaterID: number) {
  return tag('HeaterID', heaterID);
}

export function tempTag(temperature: number) {
  return tag('Temp', temperature);
}

export function enabledTag(enabled: string) {
  return tag('Enabled', enabled);
}

export function isOnTag(isOn: number) {
  return tag('IsOn', isOn);
}

export function equipmentIdTag(equipmentId: number) {
  return tag('EquipmentId', equipmentId);
}

function tag<T>(name: string, value: T) {
  let _dataType: string;

  if (typeof value === 'number') {
    _dataType = Number.isInteger(value as number) ? 'int' : 'float';
  } else if (typeof value === 'string') {
    _dataType = 'string';
  } else if (typeof value === 'boolean') {
    _dataType = 'bool';
  } else {
    throw new Error(`Unsupported data type: ${typeof value}`);
  }

  return { '@_name': name, '@_dataType': _dataType, '#text': value };
}
