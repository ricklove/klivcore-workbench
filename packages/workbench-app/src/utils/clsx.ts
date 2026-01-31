type ClassValue = string | number | boolean | undefined | null;

export function clsx(...args: ClassValue[]) {
  let i = 0;
  const len = args.length;
  let str = '';
  for (; i < len; i++) {
    const tmp = args[i];
    if (tmp) {
      if (typeof tmp === 'string') {
        str += (str && ' ') + tmp;
      }
    }
  }
  return str;
}
