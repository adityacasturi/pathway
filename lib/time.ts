export function currentUnixSeconds(date = new Date()): number {
  return Math.floor(date.getTime() / 1000);
}
