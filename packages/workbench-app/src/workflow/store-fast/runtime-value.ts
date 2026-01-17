import { type WorkflowRuntimeValue } from '../types';
import { observable, ObservableHint, observe } from '@legendapp/state';

export const createRuntimeValue = <TBase = unknown>({
  data,
  // meta,
}: {
  data: TBase;
  // meta?: WorkflowRuntimeValue['meta'];
}): WorkflowRuntimeValue<TBase> => {
  let inner = data;
  let changeCount = 0;
  const subscribers = new Set<(v: TBase | undefined | null) => void>();
  const slowChangeCount = observable(changeCount);

  const SLOW_TIME = 250;

  let timeoutId = 0 as unknown as ReturnType<typeof setTimeout>;
  const triggerSlowUpdate = () => {
    if (timeoutId) {
      return;
    }
    timeoutId = setTimeout(() => {
      timeoutId = 0;
      slowChangeCount.set(changeCount);
    }, SLOW_TIME);
    // timeoutId = requestAnimationFrame(() => {
    //   timeoutId = 0;
    //   slowChangeCount.set(changeCount);
    // });
  };

  const updateDirectSubscribers = () => {
    if (!subscribers.size) {
      return;
    }
    const changeCountAtCall = changeCount;
    queueMicrotask(() => {
      if (changeCountAtCall !== changeCount) {
        return;
      }

      for (const cb of subscribers) {
        cb(inner);
      }
    });
  };

  const obj: WorkflowRuntimeValue<TBase> = ObservableHint.opaque({
    // get _inner() {
    //   return inner;
    // },
    getObservableBox: () => uiObservableBox$.content.inner,
    // box: linked({
    //   get: () => obj.getValue<TBase>(),
    //   set: (v) => {
    //     obj.setValue<TBase>(v as TBase);
    //   },
    // }),
    getValue: <T>() => {
      // console.log(`[createRuntimeValue.getValue]`, { obj, inner$ });

      // subscribe to slowChangeCount to trigger reactivity
      slowChangeCount.get();

      return inner as T | undefined;
    },
    setValue: <T>(value: T | null) => {
      // console.log(`[createRuntimeValue.setValue]`, { value, obj, inner$ });
      inner = (value ?? null) as TBase;
      changeCount++;
      triggerSlowUpdate();
      updateDirectSubscribers();
      uiObservableBox$.content.inner.set(inner as undefined | null | Record<string, unknown>);
    },
    clearValue: () => {
      if (inner === undefined) {
        return;
      }
      // console.log(`[createRuntimeValue.clearValue]`, { obj, inner$ });
      inner = undefined as TBase;
      changeCount++;
      triggerSlowUpdate();
      updateDirectSubscribers();
      uiObservableBox$.content.inner.set(undefined);
    },
    subscribeDirect: (callback: (v: TBase | undefined | null) => void) => {
      subscribers.add(callback);
      callback(inner);
      return () => {
        subscribers.delete(callback);
      };
    },
    get uiChangeCounter$() {
      return slowChangeCount;
    },
    getImmediateChangeCounter: () => {
      return changeCount;
    },
    // meta,
  });

  const uiObservableBox$ = observable({
    content: { inner: inner as undefined | null | Record<string, unknown> },
  });
  observe(() => {
    const value = uiObservableBox$.content.inner.get();
    inner = (value ?? null) as TBase;
    changeCount++;
    triggerSlowUpdate();
    updateDirectSubscribers();
  });

  return obj;
};
