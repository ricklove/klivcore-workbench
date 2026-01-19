/* eslint-disable react-refresh/only-export-components */
import { NodeTypeWrapComponentWithNodeWrapper } from '../../workflow/node-types-wrapper';
import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentProps_Obs,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { useValue } from '@legendapp/state/react';
import { clsx } from '../../utils/clsx';

// --- TYPE DEFINITIONS ---

type ValueGateData = {
  autoSend: boolean;
  sendOnce: boolean;
};

interface ValueGateInputs {
  value: unknown;
}

interface ValueGateOutputs {
  value: unknown;
}

// --- LOGIC: Node Definition ---

export const valueGateNodeType: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName('valueGate'),
  getComponent: () => ({
    Component: NodeTypeWrapComponentWithNodeWrapper(ValueGateComponent),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName('value'),
      type: WorkflowBrandedTypes.valueType('unknown'),
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName('value'),
      type: WorkflowBrandedTypes.valueType('unknown'),
    },
  ],
  execute: async ({ inputs, data }) => {
    const safeData = (data as ValueGateData | undefined) ?? {
      autoSend: false,
      sendOnce: false,
    };

    // Determine if we should send the value
    const shouldSend = safeData.autoSend || safeData.sendOnce;

    if (!shouldSend) {
      // Don't output anything when conditions aren't met
      return {
        outputs: {
          value: undefined,
        },
      };
    }

    // Auto-reset sendOnce after execution
    const updatedData = {
      ...safeData,
      sendOnce: false,
    };

    return {
      outputs: {
        value: inputs.value, // Pass through the input value
      },
      data: updatedData,
    };
  },
};

// --- COMPONENTS ---

export const ValueGateComponent = (
  props: WorkflowComponentProps_Obs<ValueGateData, ValueGateInputs, ValueGateOutputs>,
) => {
  const { data$ } = props.data;

  const autoSend = useValue(() => data$.autoSend.get() ?? false);
  const sendOnce = useValue(() => data$.sendOnce.get() ?? false);

  const handleAutoSendToggle = () => {
    data$.autoSend.set(!autoSend);
  };

  const handleSend = () => {
    data$.sendOnce.set(true); // Trigger single send
  };

  return (
    <WorkflowNodeWrapperSimple {...props}>
      <div className="w-full h-full bg-neutral-950 p-3 rounded-md shadow-sm flex flex-col gap-3 nowheel nodrag nopan">
        {/* Controls */}
        <div className="flex flex-col gap-3">
          {/* Auto Send Checkbox */}
          <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={autoSend}
              onChange={handleAutoSendToggle}
              className="rounded border-neutral-600 bg-neutral-800"
            />
            Auto send
          </label>

          {/* Send Button (only when auto-send is off) */}
          {!autoSend && (
            <button
              onClick={handleSend}
              disabled={sendOnce}
              className={clsx(
                'w-full py-2 px-3 rounded text-xs font-medium transition-colors',
                sendOnce
                  ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white active:bg-blue-800',
              )}
            >
              {sendOnce ? 'Sent ✓' : 'Send'}
            </button>
          )}

          {/* Status Display */}
          <div className="text-[10px] text-neutral-400 text-center">
            Status: {autoSend ? 'Auto-sending' : sendOnce ? 'Sent once' : 'Ready to send'}
          </div>
        </div>
      </div>
    </WorkflowNodeWrapperSimple>
  );
};

export const valueGateNodeTypes = { valueGate: valueGateNodeType };
