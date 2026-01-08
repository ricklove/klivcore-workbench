import { observe } from '@legendapp/state';

export function observeBatched(
  compute: () => void,
  triggerKind: TriggerKind = `requestAnimationFrame`,
): () => void {
  let disposeObserver: (() => void) | undefined;
  let unsub: (() => void) | undefined;
  const trigger = createTrigger(triggerKind);

  const run = () => {
    // Create a new observer for this animation frame cycle
    disposeObserver = observe((e) => {
      if (e.num === 0) {
        // only the initial compute of the run will trigger an update
        compute();
        return;
      }

      // on update, schedule the next run via the trigger
      disposeObserver?.();
      disposeObserver = undefined;

      if (!unsub) {
        unsub = trigger(() => {
          unsub = undefined;
          run();
        });
      }
    });
  };

  // start
  run();

  // Return a dispose function for the caller to clean up everything
  return () => {
    disposeObserver?.();
    unsub?.();
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

// /**
//  * Runs a computed function immediately, then tracks its dependencies.
//  * On any change, it waits for trigger to run again before running the computed function.
//  * Only after the trigger fires does it run the computed function again.
//  * i.e. it computes at most once per trigger and only when the observed value changes.
//  */
// export function observableBatched<T>(
//   obs$: Observable<T>,
//   triggerKind: TriggerKind = `requestAnimationFrame`,
// ): Observable<T | undefined> {
//   let disposeObserver: (() => void) | undefined;
//   let unsub: (() => void) | undefined;
//   const trigger = createTrigger(triggerKind);

//   const result$ = observable<T>();

//   const run = () => {
//     // Create a new observer for this animation frame cycle
//     disposeObserver = observe((e) => {
//       if (e.num === 0) {
//         // only the initial compute of the run will trigger an update
//         result$.set(obs$.get());
//         return;
//       }

//       // on update, schedule the next run via the trigger
//       disposeObserver?.();
//       disposeObserver = undefined;

//       if (!unsub) {
//         unsub = trigger(() => {
//           unsub = undefined;
//           run();
//         });
//       }
//     });
//   };

//   // start
//   run();

//   // Return a dispose function for the caller to clean up everything
//   return observable<T | undefined>(() => result$.get());
// }
