import { observable } from '@legendapp/state';

export const optimizationStore = (() => {
  const isMultiSelection$ = observable(false);

  return {
    isMultiSelection$,
  };
})();
