export type Box<T> = {
  content: T;
};
export const box = <T>(content: T): Box<T> => ({ content });
export const unbox = <T>(box: Box<T> | undefined | null): T | undefined => box?.content;
