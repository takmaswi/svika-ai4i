// Pure code entry logic for the fat finger keypad: 4 digits, no surprises.
export const CODE_LENGTH = 4;

export function appendDigit(code: string, digit: string): string {
  if (!/^[0-9]$/.test(digit)) return code;
  if (code.length >= CODE_LENGTH) return code;
  return code + digit;
}

export function eraseDigit(code: string): string {
  return code.slice(0, -1);
}

export function isComplete(code: string): boolean {
  return new RegExp(`^[0-9]{${CODE_LENGTH}}$`).test(code);
}
