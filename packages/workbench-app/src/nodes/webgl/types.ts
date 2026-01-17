export type Box<T> = {
  content: T;
};

const disableBoxing = false;

export const box = <T>(content: T): Box<T> => (disableBoxing ? (content as Box<T>) : { content });
export const unbox = <T>(box: Box<T> | undefined | null): T | undefined =>
  disableBoxing ? (box as T) : box?.content;
