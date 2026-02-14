export function classNames(...xs: Array<string | undefined | false>) {
  return xs.filter(Boolean).join(' ');
}
