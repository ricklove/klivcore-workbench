import { observe } from '@legendapp/state';

export function observeBatched(
  compute: () => void,
  triggerKind: TriggerKind = `requestAnimationFrame`,
): () => void {
  const trigger = createTrigger(triggerKind);
  let disposeTrigger: (() => void) | undefined;
  let disposeObserver: (() => void) | undefined;

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
          compute();
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

type TriggerKind = `requestAnimationFrame` | `setTimeout` | `MessageChannel`;
const createTrigger = (triggerKind: TriggerKind) => {
  if (triggerKind === `requestAnimationFrame`) {
    return (cb: () => void) => {
      const id = requestAnimationFrame(cb);
      return () => cancelAnimationFrame(id);
    };
  }
  if (triggerKind === `setTimeout`) {
    return (cb: () => void) => {
      const id = setTimeout(cb, 0);
      return () => clearTimeout(id);
    };
  }

  const channel = new MessageChannel();
  return (cb: () => void) => {
    channel.port1.onmessage = cb;
    channel.port2.postMessage(undefined);
    return () => {
      channel.port1.close();
      channel.port2.close();
    };
  };
};
