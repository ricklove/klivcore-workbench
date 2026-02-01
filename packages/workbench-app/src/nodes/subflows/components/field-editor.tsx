import type { Observable } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import { useEffect, useState } from 'react';
import {
  parseObjectTypeDefinition,
  verifyTypescriptSyntax,
} from '../../../code-tools/swc-tools';

interface Field {
  name: string;
  type: string;
}

interface FieldEditorProps {
  fields$: Observable<Field[]>;
}

export const FieldEditor = ({ fields$ }: FieldEditorProps) => {
  const fields = useValue(fields$) ?? [];
  const [tab, setTab] = useState<'form' | 'type'>('type');
  const [typeText, setTypeText] = useState(
    `{\n${fields.map((field) => `  ${field.name}: ${field.type}`).join(';\n')}\n}`,
  );
  const [validationErrors, setValidationErrors] = useState<Map<number, string>>(
    new Map(),
  );
  const [typeValidationResult, setTypeValidationResult] = useState<string>('');
  const [isTypeValidating, setIsTypeValidating] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (tab !== 'type') {
      setTypeText(formatFieldTypeText(fields));
    }
  }, [fields, tab]);

  const validateFieldName = (name: string): undefined | string => {
    if (!name.trim()) {
      return 'Name cannot be empty';
    }

    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
      return 'Name must be a valid JavaScript identifier';
    }

    const isDuplicate = fields.some(
      (field: Field, index: number) =>
        field && field.name === name && fields.indexOf(field) !== index,
    );

    if (isDuplicate) {
      return 'Name must be unique';
    }

    return undefined;
  };

  const validateFieldType = async (
    type: string,
  ): Promise<undefined | string> => {
    if (!type.trim()) {
      return 'Type cannot be empty';
    }

    const result = await verifyTypescriptSyntax(`const test: ${type} = null;`);
    return result.isValid ? undefined : result.error;
  };

  const validateAllFields = async (fieldsToValidate: Field[]) => {
    const errors = new Map<number, string>();

    for (let i = 0; i < fieldsToValidate.length; i++) {
      const field = fieldsToValidate[i];
      if (!field) {
        continue;
      }
      const nameError = validateFieldName(field.name);
      if (nameError) {
        errors.set(i, `Name: ${nameError}`);
        continue;
      }

      const typeError = await validateFieldType(field.type);
      if (typeError) {
        errors.set(i, `Type: ${typeError}`);
      }
    }

    setValidationErrors(errors);
    return errors.size === 0;
  };

  const validateFieldsAsType = async (fieldsToValidate: Field[]) => {
    const typeDefinition = `export type TestFields = {
      ${fieldsToValidate.map((field) => `${field.name}: ${field.type}`).join(';\n')}
    }`;

    const result = await verifyTypescriptSyntax(typeDefinition);
    return result.isValid ? undefined : result.error;
  };

  const addField = () => {
    const newField: Field = { name: '', type: 'string' };
    const currentFields = fields$.peek() ?? [];
    const newFields = [...currentFields, newField];
    fields$.set(newFields);
  };

  const removeField = (index: number) => {
    const currentFields = fields$.peek() ?? [];
    const newFields = currentFields.filter(
      (_: Field, i: number) => i !== index,
    );
    fields$.set(newFields);
  };

  const updateField = (index: number, updates: Partial<Field>) => {
    const currentFields = fields$.peek() ?? [];
    const newFields = currentFields.map((field: Field, i: number) =>
      i === index ? { ...field, ...updates } : field,
    );
    fields$.set(newFields);
  };

  const moveField = (dragIndex: number, dropIndex: number) => {
    if (dragIndex === dropIndex) {
      return;
    }

    const currentFields = fields$.peek() ?? [];
    const newFields = [...currentFields];
    const removed = newFields[dragIndex];
    if (!removed) {
      return;
    }
    newFields.splice(dragIndex, 1);
    newFields.splice(dropIndex, 0, removed);
    fields$.set(newFields);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDropIndicatorIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null) {
      moveField(draggedIndex, dropIndex);
      setDraggedIndex(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropIndicatorIndex(null);
  };

  const handleTypeChange = (newType: string) => {
    setTypeText(newType);
    // Don't auto-parse - user must click validate button
  };

  const handleFormTabSwitch = async () => {
    setTab('form');
    await validateAllFields(fields);
  };

  const handleTypeTabSwitch = () => {
    setTab('type');
  };

  const validateTypeEditor = async () => {
    setIsTypeValidating(true);
    setTypeValidationResult('');

    // Debug: log the input to see what we're parsing
    console.log('Input typeText:', typeText);

    try {
      const result = await parseObjectTypeDefinition(typeText);

      console.log('Parse result:', result);

      if (result.error !== undefined) {
        setTypeValidationResult(`❌ Error: ${result.error}`);
        return;
      }

      if (result.fields.length > 0) {
        fields$.set(result.fields);
        setTypeValidationResult(
          `✅ Successfully parsed ${result.fields.length} fields: ${result.fields.map((f) => f.name).join(', ')}`,
        );
      } else {
        setTypeValidationResult(
          '⚠️ No valid fields found - try adding semicolons between properties',
        );
      }
    } catch (error) {
      setTypeValidationResult(
        `❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsTypeValidating(false);
    }
  };

  const reloadTypeEditor = () => {
    setTypeText(formatFieldTypeText(fields));
  };

  const runFullValidation = async () => {
    const fieldsValid = await validateAllFields(fields);
    if (!fieldsValid) {
      return;
    }

    const typeError = await validateFieldsAsType(fields);
    if (typeError) {
      // Show type validation error in a generic way
      console.error('Type validation failed:', typeError);
    }
  };

  return (
    <div className="field-editor w-full h-full flex flex-col bg-black/25 nowheel nodrag nopan">
      <div className="flex border-b border-gray-700">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'form'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={handleFormTabSwitch}
        >
          Form
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'type'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={handleTypeTabSwitch}
        >
          Type
        </button>
      </div>

      {tab === 'form' && (
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {fields.map((field: Field, index: number) => (
              <div key={`field-wrapper-${index}-${field.name || 'unnamed'}`}>
                {dropIndicatorIndex === index && (
                  <div className="h-0.5 bg-blue-500 mb-2 rounded"></div>
                )}
                <div
                  key={`field-${index}-${field.name || 'unnamed'}`}
                  className={`flex flex-wrap gap-2 items-center bg-gray-800/25 p-2 rounded ${draggedIndex === index ? 'opacity-50' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="cursor-move text-gray-400 hover:text-gray-300 pointer-events-auto">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="pointer-events-none"
                    >
                      <path d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Field name"
                    value={field.name}
                    onChange={(e) =>
                      updateField(index, { name: e.target.value })
                    }
                    className="flex-1 px-2 py-1 bg-black/25 text-white border border-gray-600 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Type"
                    value={field.type}
                    onChange={(e) =>
                      updateField(index, { type: e.target.value })
                    }
                    className="flex-1 px-2 py-1 bg-black/25 text-white border border-gray-600 rounded text-sm"
                  />
                  <button
                    onClick={() => removeField(index)}
                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded"
                    title="Remove field"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {dropIndicatorIndex === fields.length && (
              <div className="h-0.5 bg-blue-500 rounded"></div>
            )}
            <div
              className="min-h-2"
              onDragOver={(e) => handleDragOver(e, fields.length)}
              onDrop={(e) => handleDrop(e, fields.length)}
            />

            {validationErrors.size > 0 && (
              <div className="text-red-400 text-sm space-y-1">
                {Array.from(validationErrors.entries()).map(
                  ([index, error]) => (
                    <div key={index}>
                      Field {index + 1}: {error}
                    </div>
                  ),
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={addField}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
              >
                Add Field
              </button>
              <button
                onClick={runFullValidation}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
              >
                Validate All
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'type' && (
        <div className="flex-1 flex flex-col">
          <textarea
            value={typeText}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="flex-1 w-full text-white border-none outline-none resize-none nowheel nodrag nopan bg-black/25 font-mono text-xs p-2"
            placeholder={`{\n  fieldName: string;\n  anotherField: number;\n}`}
          />
          <div className="flex gap-2 p-2 border-t border-gray-700">
            <button
              onClick={validateTypeEditor}
              disabled={isTypeValidating}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded text-sm"
            >
              {isTypeValidating ? 'Validating...' : 'Validate'}
            </button>
            <button
              onClick={reloadTypeEditor}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              Reload
            </button>
          </div>
          {typeValidationResult && (
            <div className="px-2 pb-2 text-xs">
              <div
                className={`p-2 rounded ${
                  typeValidationResult.startsWith('✅')
                    ? 'bg-green-600/20 text-green-300'
                    : typeValidationResult.startsWith('❌')
                      ? 'bg-red-600/20 text-red-300'
                      : 'bg-yellow-600/20 text-yellow-300'
                }`}
              >
                {typeValidationResult}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const FieldDisplay = (props: { label: string; fields: Field[] }) => {
  return (
    <div className="field-editor w-full h-full flex flex-col bg-black/25 nowheel nodrag nopan">
      <div className="flex border-b border-gray-700">
        <div
          className={`px-4 py-2 text-sm font-medium text-white border-b-2 border-blue-500`}
        >
          {props.label}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <textarea
          value={formatFieldTypeText(props.fields)}
          readOnly
          className="flex-1 w-full text-white border-none outline-none resize-none nowheel nodrag nopan bg-black/25 font-mono text-xs p-2"
          placeholder={`{\n  fieldName: string;\n  anotherField: number;\n}`}
        />
      </div>
    </div>
  );
};

export function formatFieldTypeText(fields: Field[]): string {
  return `{\n${fields.map((field) => `  ${field.name}: ${field.type};`).join('\n')}\n}`;
}
