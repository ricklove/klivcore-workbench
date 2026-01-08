import { observable, observe, when, type Observable, type ObserveEvent } from '@legendapp/state';

export function observeBatched(
  compute: (e: { num: number; eInner: ObserveEvent<unknown> }) => void,
  triggerKind: BatchedTriggerKind = `requestAnimationFrame`,
): () => void {
  const trigger = createTrigger(triggerKind);
  let disposeTrigger: (() => void) | undefined;
  let disposeObserver: (() => void) | undefined;

  let count = 0;

  const stop = () => {
    disposeTrigger?.();
    disposeTrigger = undefined;
    disposeObserver?.();
    disposeObserver = undefined;
  };

  const start = () => {
    if (disposeTrigger) {
      return;
    }

    disposeTrigger = trigger(() => {
      disposeObserver = observe((e) => {
        if (e.num === 0) {
          compute({ eInner: e, num: count++ });
          return;
        }

        stop();
        start();
      });
    });
  };

  start();

  return () => {
    stop();
  };
}

export type BatchedTriggerKind =
  | number
  | `requestAnimationFrame`
  | `MessageChannel`
  | Observable<boolean>;
const createTrigger = (triggerKind: BatchedTriggerKind) => {
  if (triggerKind === `requestAnimationFrame`) {
    return (cb: () => void) => {
      const id = requestAnimationFrame(cb);
      return () => cancelAnimationFrame(id);
    };
  }
  if (triggerKind === `MessageChannel`) {
    let channel = undefined as undefined | MessageChannel;

    return (cb: () => void) => {
      channel = channel ?? new MessageChannel();

      channel.port1.onmessage = cb;
      channel.port2.postMessage(null);

      return () => {
        channel?.port1.close();
        channel?.port2.close();
        channel = undefined;
      };
    };
  }
  if (typeof triggerKind === `number`) {
    return (cb: () => void) => {
      const id = setTimeout(cb, triggerKind);
      return () => clearTimeout(id);
    };
  }

  return (cb: () => void) => {
    let disposed = false;
    when(triggerKind, () => {
      if (disposed) return;
      cb();
    });
    return () => {
      disposed = true;
    };
  };
};

// example usage:
export const demo_observeBatched = () => {
  const count = observable(0);
  const message = observable(``);

  const stopObserving = observeBatched(() => {
    // The expensive computation
    console.log(`${message.get()}`);
  }, 100);

  let sleeping = false;
  const intervalId = setInterval(() => {
    if (sleeping) return;

    // The fast updates
    const CHANGE_COUNT = 1000;
    for (let i = 0; i < CHANGE_COUNT + 1; i++) {
      count.set(count.get() + 1);
    }
    message.set(`Update #${count.get()} at ${new Date()}`);

    if (count.get() % 250 === 0) {
      sleeping = true;
      message.set(`No updates!!! Sleeping for 3 seconds... Last Update #${count.get()}`);

      setTimeout(() => {
        sleeping = false;
      }, 3000);
    }
  }, 1);

  return () => {
    stopObserving();
    clearInterval(intervalId);
  };
};
