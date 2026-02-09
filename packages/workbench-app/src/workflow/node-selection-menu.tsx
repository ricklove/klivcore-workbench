import type { Observable } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  WorkflowBrandedTypes,
  type WorkflowNodeTypeName,
  type WorkflowRuntimeNodeTypeDefinition,
  type WorkflowRuntimeStore,
} from './types';

type NodeSelectionMenuProps = {
  store$: Observable<WorkflowRuntimeStore>;
  position: { x: number; y: number };
  onSelect: (nodeType: WorkflowNodeTypeName) => void;
  onClose: () => void;
  filterDefaultNodeTypes:
    | undefined
    | ((x: WorkflowRuntimeNodeTypeDefinition) => boolean);
};

export const NodeSelectionMenu: React.FC<NodeSelectionMenuProps> = ({
  store$,
  position,
  onSelect,
  onClose,
  filterDefaultNodeTypes,
}) => {
  const nodeDefinitionsAll = useValue(() =>
    Object.values(store$.nodeTypes.get()).filter(
      (def) => def.type !== WorkflowBrandedTypes.typeName(`default`),
    ),
  );
  const nodeDefinitions = !filterDefaultNodeTypes
    ? nodeDefinitionsAll
    : nodeDefinitionsAll.filter(filterDefaultNodeTypes);

  const [searchTerm, setSearchTerm] = useState(``);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const changeSearchTerm = (newTerm: string) => {
    setSearchTerm(newTerm);
    setHighlightedIndex(0);
  };

  const filteredNodeDefinitions = useMemo(() => {
    return nodeDefinitions.filter((def) =>
      def.type.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [nodeDefinitions, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener(`mousedown`, handleClickOutside);
    return () => {
      document.removeEventListener(`mousedown`, handleClickOutside);
    };
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === `Enter`) {
      e.preventDefault();
      if (filteredNodeDefinitions[highlightedIndex]) {
        onSelect(filteredNodeDefinitions[highlightedIndex].type);
      }
    } else if (e.key === `Escape`) {
      e.preventDefault();
      onClose();
    } else if (e.key === `ArrowDown`) {
      e.preventDefault();
      setHighlightedIndex((prevIndex) =>
        Math.min(prevIndex + 1, filteredNodeDefinitions.length - 1),
      );
    } else if (e.key === `ArrowUp`) {
      e.preventDefault();
      setHighlightedIndex((prevIndex) => Math.max(prevIndex - 1, 0));
    }
  };

  return (
    <div
      role="menu"
      aria-label="Node selection menu"
      ref={menuRef}
      className="absolute z-50 flex flex-col rounded border border-gray-600 bg-slate-700 text-white shadow-lg"
      style={{ top: position.y, left: position.x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="border-b border-gray-600 p-2">
        <input
          type="text"
          placeholder="Search nodes..."
          className="w-full rounded border border-gray-600 bg-slate-700 p-1 text-sm text-white placeholder-gray-400"
          value={searchTerm}
          onChange={(e) => changeSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>
      <ul className="max-h-60 overflow-y-auto">
        {filteredNodeDefinitions.length > 0 ? (
          filteredNodeDefinitions.map((def, index) => (
            <li
              key={def.type}
              className={`cursor-pointer px-3 py-2 text-sm ${index === highlightedIndex ? `bg-blue-950` : `hover:bg-gray-600`}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(def.type);
              }}
            >
              {def.type}
            </li>
          ))
        ) : (
          <li className="px-3 py-2 text-sm text-gray-500">No matching nodes</li>
        )}
      </ul>
    </div>
  );
};
