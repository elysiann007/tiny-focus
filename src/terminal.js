export function terminalText(value) {
  return String(value).replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, ' ');
}

export function jsonText(value) {
  // Preserve values on JSON.parse while preventing bidirectional terminal controls.
  return JSON.stringify(value, null, 2).replace(/[\u202a-\u202e\u2066-\u2069]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`) + '\n';
}
