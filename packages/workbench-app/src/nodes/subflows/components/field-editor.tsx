import type { Observable } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import { useEffect, useState } from 'react';
import { verifyTypescriptSyntax } from '../../../code-tools/swc-tools';

interface Field {
  name: string;
  type: string;
}

interface FieldEditorProps {
  fields$: Observable<Field[]>;
}

export const FieldEditor = ({ fields$ }: FieldEditorProps) => {
  const fields = useValue(fields$);
  const [tab, setTab] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState(JSON.stringify(fields, null, 2));
  const [validationErrors, setValidationErrors] = useState<Map<number, string>>(
    new Map(),
  );

  useEffect(() => {
    setJsonText(JSON.stringify(fields, null, 2));
  }, [fields]);

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
    const currentFields = fields$.peek();
    const newFields = [...currentFields, newField];
    fields$.set(newFields);
  };

  const removeField = (index: number) => {
    const currentFields = fields$.peek();
    const newFields = currentFields.filter(
      (_: Field, i: number) => i !== index,
    );
    fields$.set(newFields);
  };

  const updateField = (index: number, updates: Partial<Field>) => {
    const currentFields = fields$.peek();
    const newFields = currentFields.map((field: Field, i: number) =>
      i === index ? { ...field, ...updates } : field,
    );
    fields$.set(newFields);
  };

  const handleJsonChange = (newJson: string) => {
    setJsonText(newJson);

    try {
      const parsed = JSON.parse(newJson) as Field[];
      if (Array.isArray(parsed)) {
        fields$.set(parsed);
      }
    } catch {
      // Invalid JSON, don't update fields
    }
  };

  const handleFormTabSwitch = async () => {
    setTab('form');
    await validateAllFields(fields);
  };

  const handleJsonTabSwitch = () => {
    setTab('json');
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
    <div className="field-editor h-full flex flex-col bg-black/25">
      <div className="flex border-b border-gray-700">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'form'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={handleFormTabSwitch}
        >
          Form Editor
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'json'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={handleJsonTabSwitch}
        >
          JSON Editor
        </button>
      </div>

      {tab === 'form' && (
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {fields.map((field: Field, index: number) => (
              <div
                key={`field-${index}-${field.name || 'unnamed'}`}
                className="flex gap-2 items-center bg-gray-800/25 p-2 rounded"
              >
                <input
                  type="text"
                  placeholder="Field name"
                  value={field.name}
                  onChange={(e) => updateField(index, { name: e.target.value })}
                  className="flex-1 px-2 py-1 bg-black/25 text-white border border-gray-600 rounded text-sm"
                />
                <input
                  type="text"
                  placeholder="Type"
                  value={field.type}
                  onChange={(e) => updateField(index, { type: e.target.value })}
                  className="flex-1 px-2 py-1 bg-black/25 text-white border border-gray-600 rounded text-sm"
                />
                <button
                  onClick={() => removeField(index)}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                >
                  Remove
                </button>
              </div>
            ))}

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

      {tab === 'json' && (
        <div className="flex-1 overflow-auto p-4">
          <textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="w-full h-full px-2 py-1 bg-black/25 text-white border border-gray-600 rounded text-sm font-mono text-xs"
            placeholder="JSON array of fields"
          />
        </div>
      )}
    </div>
  );
};
