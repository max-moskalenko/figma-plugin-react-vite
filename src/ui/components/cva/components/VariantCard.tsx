import { useState, useMemo } from "react";
import { useCVA } from "../CVAContext";
import { CVAVariantConfig, PSEUDO_CLASS_PREFIXES } from "../types";
import { ClassSelectionModal } from "./ClassSelectionModal";
import "./VariantCard.scss";

interface VariantCardProps {
  variant: CVAVariantConfig;
}

/**
 * Extract property suggestions from raw code snippet
 */
function extractPropertySuggestions(rawStylesheet: string): Map<string, string[]> {
  const suggestions = new Map<string, Set<string>>();
  const regex = /([a-zA-Z][\w-]*)=([^,\s"<>]+)/g;
  let match;
  
  while ((match = regex.exec(rawStylesheet)) !== null) {
    const propName = match[1];
    const propValue = match[2];
    
    if (propName.startsWith('data-') || propName === 'class' || propName === 'className') {
      continue;
    }
    
    if (!suggestions.has(propName)) {
      suggestions.set(propName, new Set());
    }
    
    const lowerValue = propValue.toLowerCase();
    if (lowerValue === 'true' || lowerValue === 'false') {
      suggestions.get(propName)!.add('true');
      suggestions.get(propName)!.add('false');
    } else {
      suggestions.get(propName)!.add(propValue);
    }
  }
  
  const result = new Map<string, string[]>();
  suggestions.forEach((values, key) => {
    result.set(key, Array.from(values).sort());
  });
  
  return result;
}

/**
 * Variant Card component - Table layout with grouped prefix rows
 */
export function VariantCard({ variant }: VariantCardProps) {
  const { 
    extractorResult,
    componentProperties,
    renameVariant, 
    removeVariant, 
    duplicateVariant,
    toggleVariantPrefixes,
    addPropertyValue,
    removePropertyValue,
    duplicatePropertyValue,
    renamePropertyValue,
    setPropertyValues,
    addPrefixSlot,
    removePrefixSlot,
    setPrefixSlotPrefix,
    setPrefixSlotClasses,
  } = useCVA();
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(variant.name);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState<{ 
    valueId: string; 
    prefixSlotId: string;
    currentClasses: string[];
  } | null>(null);
  
  // Editing states
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editValueText, setEditValueText] = useState("");
  const [editingPrefixSlotId, setEditingPrefixSlotId] = useState<string | null>(null);
  const [editPrefixText, setEditPrefixText] = useState("");

  const property = variant.properties[0];

  const propertySuggestions = useMemo(() => {
    if (!extractorResult?.raw?.stylesheet) return new Map<string, string[]>();
    return extractPropertySuggestions(extractorResult.raw.stylesheet);
  }, [extractorResult]);

  const figmaPropertyNames = useMemo(() => {
    return componentProperties?.definitions
      ?.filter(def => def.type === "VARIANT" || def.type === "BOOLEAN")
      .map(def => def.name) || [];
  }, [componentProperties]);

  const allPropertySuggestions = useMemo(() => {
    const all = new Set<string>();
    propertySuggestions.forEach((_, key) => all.add(key));
    figmaPropertyNames.forEach(name => all.add(name));
    return Array.from(all);
  }, [propertySuggestions, figmaPropertyNames]);

  const valueSuggestions = useMemo(() => {
    const fromSnippet = propertySuggestions.get(property?.name || "") || [];
    const fromFigma = componentProperties?.definitions
      ?.find(def => def.name === property?.name)
      ?.variantOptions || [];
    
    const normalizedSet = new Set<string>();
    [...fromSnippet, ...fromFigma].forEach(val => {
      const lower = val.toLowerCase();
      if (lower === 'true' || lower === 'false') {
        normalizedSet.add(lower);
      } else {
        normalizedSet.add(val);
      }
    });
    
    return Array.from(normalizedSet).sort();
  }, [propertySuggestions, componentProperties, property?.name]);

  const handleNameSubmit = () => {
    if (editName.trim() && property) {
      renameVariant(variant.id, editName.trim());
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleNameSubmit();
    if (e.key === "Escape") {
      setEditName(variant.name);
      setIsEditingName(false);
    }
  };

  const handlePropertyChange = (newPropertyName: string) => {
    if (newPropertyName === "__custom__") {
      setEditName(variant.name);
      setIsEditingName(true);
      return;
    }
    
    renameVariant(variant.id, newPropertyName);
    
    const snippetValues = propertySuggestions.get(newPropertyName) || [];
    const figmaValues = componentProperties?.definitions
      ?.find(def => def.name === newPropertyName)
      ?.variantOptions || [];
    
    const normalizedSet = new Set<string>();
    [...snippetValues, ...figmaValues].forEach(val => {
      const lower = val.toLowerCase();
      if (lower === 'true' || lower === 'false') {
        normalizedSet.add(lower);
      } else {
        normalizedSet.add(val);
      }
    });
    
    const allNewValues = Array.from(normalizedSet).sort();
    if (allNewValues.length > 0 && property) {
      setPropertyValues(variant.id, property.id, allNewValues);
    }
  };

  const handleValueSubmit = () => {
    if (editingValueId && editValueText.trim() && property) {
      renamePropertyValue(variant.id, property.id, editingValueId, editValueText.trim());
    }
    setEditingValueId(null);
    setEditValueText("");
  };

  const handlePrefixSubmit = (valueId: string) => {
    if (editingPrefixSlotId && property) {
      let prefix = editPrefixText.trim();
      if (prefix && !prefix.endsWith(':')) {
        prefix += ':';
      }
      setPrefixSlotPrefix(variant.id, property.id, valueId, editingPrefixSlotId, prefix);
    }
    setEditingPrefixSlotId(null);
    setEditPrefixText("");
  };

  const handleOpenClassModal = (valueId: string, prefixSlotId: string, currentClasses: string[]) => {
    setModalTarget({ valueId, prefixSlotId, currentClasses });
    setIsModalOpen(true);
  };

  const handleSaveClasses = (classes: string[]) => {
    if (modalTarget && property) {
      setPrefixSlotClasses(variant.id, property.id, modalTarget.valueId, modalTarget.prefixSlotId, classes);
    }
    setIsModalOpen(false);
    setModalTarget(null);
  };

  if (!property) return null;

  // Build flat rows for the table
  const tableRows: Array<{
    valueId: string;
    valueName: string;
    isFirstInGroup: boolean;
    rowSpan: number;
    prefixSlotId: string;
    prefix: string;
    classes: string[];
    canRemoveSlot: boolean;
    canRemoveValue: boolean;
  }> = [];

  property.values.forEach(value => {
    value.prefixedClasses.forEach((slot, slotIndex) => {
      tableRows.push({
        valueId: value.id,
        valueName: value.name,
        isFirstInGroup: slotIndex === 0,
        rowSpan: value.prefixedClasses.length,
        prefixSlotId: slot.id,
        prefix: slot.prefix,
        classes: slot.classes,
        canRemoveSlot: value.prefixedClasses.length > 1,
        canRemoveValue: property.values.length > 1,
      });
    });
  });

  return (
    <div className="variant-card">
      <div className="card-header">
        <button 
          className="expand-btn"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "▼" : "▶"}
        </button>
        
        {isEditingName ? (
          <input
            type="text"
            className="name-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            autoFocus
          />
        ) : (
          <select
            className="name-select"
            value={variant.name}
            onChange={(e) => handlePropertyChange(e.target.value)}
          >
            <option value={variant.name}>{variant.name}</option>
            {allPropertySuggestions
              .filter(s => s !== variant.name)
              .map(suggestion => (
                <option key={suggestion} value={suggestion}>{suggestion}</option>
              ))}
            <option value="__custom__">+ Custom...</option>
          </select>
        )}

        <div className="card-actions">
          <button
            className={`action-btn pseudo-toggle ${variant.showPrefixes ? 'active' : ''}`}
            onClick={() => toggleVariantPrefixes(variant.id)}
            title={variant.showPrefixes ? "Hide pseudo-class prefixes" : "Show pseudo-class prefixes"}
          >
            Pseudo
          </button>
          <button
            className="action-btn"
            onClick={() => addPropertyValue(variant.id, property.id)}
            title="Add value"
          >
            + Value
          </button>
          <button
            className="action-btn"
            onClick={() => duplicateVariant(variant.id)}
            title="Duplicate"
          >
            ⧉
          </button>
          <button
            className="action-btn danger"
            onClick={() => removeVariant(variant.id)}
            title="Remove"
          >
            ×
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="card-content">
          <table className={`variant-table ${variant.showPrefixes ? 'with-prefixes' : ''}`}>
            <thead>
              <tr>
                <th className="col-value">Value</th>
                {variant.showPrefixes && <th className="col-prefix">Prefix</th>}
                <th className="col-classes">Classes</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rowIndex) => (
                <tr key={`${row.valueId}-${row.prefixSlotId}`} className={row.isFirstInGroup ? 'group-start' : ''}>
                  {row.isFirstInGroup && (
                    <td className="value-cell" rowSpan={row.rowSpan}>
                      <div className="value-content">
                        {editingValueId === row.valueId ? (
                          <input
                            type="text"
                            className="edit-input"
                            value={editValueText}
                            onChange={(e) => setEditValueText(e.target.value)}
                            onBlur={handleValueSubmit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleValueSubmit();
                              if (e.key === "Escape") {
                                setEditingValueId(null);
                                setEditValueText("");
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <select
                            className="value-select"
                            value={row.valueName}
                            onChange={(e) => {
                              if (e.target.value === "__custom__") {
                                setEditingValueId(row.valueId);
                                setEditValueText(row.valueName);
                              } else {
                                renamePropertyValue(variant.id, property.id, row.valueId, e.target.value);
                              }
                            }}
                          >
                            <option value={row.valueName}>{row.valueName}</option>
                            {valueSuggestions
                              .filter(s => s !== row.valueName)
                              .map(suggestion => (
                                <option key={suggestion} value={suggestion}>{suggestion}</option>
                              ))}
                            <option value="__custom__">+ Custom...</option>
                          </select>
                        )}
                        {row.canRemoveValue && (
                          <button
                            className="remove-value-btn"
                            onClick={() => removePropertyValue(variant.id, property.id, row.valueId)}
                            title="Remove value"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                  {variant.showPrefixes && (
                    <td className="prefix-cell">
                      <div className="prefix-content">
                        {editingPrefixSlotId === row.prefixSlotId ? (
                          <input
                            type="text"
                            className="prefix-input"
                            value={editPrefixText}
                            onChange={(e) => setEditPrefixText(e.target.value)}
                            onBlur={() => handlePrefixSubmit(row.valueId)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handlePrefixSubmit(row.valueId);
                              if (e.key === "Escape") {
                                setEditingPrefixSlotId(null);
                                setEditPrefixText("");
                              }
                            }}
                            placeholder="prefix:"
                            autoFocus
                          />
                        ) : (
                          <select
                            className="prefix-select"
                            value={
                              PSEUDO_CLASS_PREFIXES.some(p => p.value === row.prefix)
                                ? row.prefix
                                : '__custom__'
                            }
                            onChange={(e) => {
                              if (e.target.value === '__custom__') {
                                setEditingPrefixSlotId(row.prefixSlotId);
                                setEditPrefixText(row.prefix);
                              } else {
                                setPrefixSlotPrefix(variant.id, property.id, row.valueId, row.prefixSlotId, e.target.value);
                              }
                            }}
                          >
                            {PSEUDO_CLASS_PREFIXES.map(p => (
                              <option key={p.value} value={p.value}>{p.label || '(base)'}</option>
                            ))}
                            <option value="__custom__">
                              {row.prefix && !PSEUDO_CLASS_PREFIXES.some(p => p.value === row.prefix)
                                ? row.prefix
                                : '+ Custom...'}
                            </option>
                          </select>
                        )}
                        <button
                          className="add-prefix-btn"
                          onClick={() => addPrefixSlot(variant.id, property.id, row.valueId)}
                          title="Add prefix slot"
                        >
                          +
                        </button>
                      </div>
                    </td>
                  )}
                  <td 
                    className={`classes-cell ${row.classes.length > 0 ? 'has-classes' : ''}`}
                    onClick={() => handleOpenClassModal(row.valueId, row.prefixSlotId, row.classes)}
                  >
                    {row.classes.length > 0 ? (
                      <div className="class-chips">
                        {variant.showPrefixes && row.prefix && <span className="chip-prefix-label">{row.prefix}</span>}
                        {row.classes.slice(0, 5).map((cls, idx) => (
                          <span key={idx} className="class-chip">{cls}</span>
                        ))}
                        {row.classes.length > 5 && (
                          <span className="class-chip more">+{row.classes.length - 5}</span>
                        )}
                      </div>
                    ) : (
                      <span className="placeholder">Click to add classes</span>
                    )}
                  </td>
                  <td className="actions-cell">
                    <div>
                      {row.isFirstInGroup && (
                        <button
                          className="duplicate-value-btn"
                          onClick={() => duplicatePropertyValue(variant.id, property.id, row.valueId)}
                          title="Duplicate value with all classes"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                            <path d="M2 2h6v1.5H2.5v6H1V2.5A.5.5 0 0 1 1.5 2H2z" fill="currentColor"/>
                          </svg>
                        </button>
                      )}
                      {variant.showPrefixes && row.canRemoveSlot && (
                        <button
                          className="remove-slot-btn"
                          onClick={() => removePrefixSlot(variant.id, property.id, row.valueId, row.prefixSlotId)}
                          title="Remove prefix slot"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClassSelectionModal
        isOpen={isModalOpen}
        selectedClasses={modalTarget?.currentClasses || []}
        onSave={handleSaveClasses}
        onClose={() => {
          setIsModalOpen(false);
          setModalTarget(null);
        }}
        title={`Select Classes for ${variant.name}`}
      />
    </div>
  );
}

export default VariantCard;
