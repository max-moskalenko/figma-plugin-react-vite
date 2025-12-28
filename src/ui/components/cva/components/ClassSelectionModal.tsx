import { useState, useMemo, useEffect } from "react";
import { useCVA } from "../CVAContext";
import { ExtractedClass, ClassCategory } from "../types";
import { CLASS_CATEGORIES, groupClassesByCategory, filterClasses } from "../utils/classManager";
import "./ClassSelectionModal.scss";

interface ClassSelectionModalProps {
  isOpen: boolean;
  selectedClasses: string[];
  onSave: (classes: string[]) => void;
  onClose: () => void;
  title?: string;
}

interface VariantDOMStructure {
  variantName: string;
  variantClasses: string[]; // Classes on the variant wrapper itself
  childElements: Map<string, string[]>; // elementName -> classes
}

/**
 * Class Selection Modal component
 * Has variant selector + DOM element filter sidebar on left and categorized classes on right
 */
export function ClassSelectionModal({
  isOpen,
  selectedClasses,
  onSave,
  onClose,
  title = "Select Classes",
}: ClassSelectionModalProps) {
  const { extractedClasses, extractorResult } = useCVA();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [localSelection, setLocalSelection] = useState<Set<string>>(new Set(selectedClasses));
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedDOMElement, setSelectedDOMElement] = useState<string | null>(null);

  // Parse Tailwind output to extract variants and their DOM structure
  const { variants, classToDOMMap, allChildElements } = useMemo(() => {
    const variantStructures: VariantDOMStructure[] = [];
    const map = new Map<string, Set<string>>(); // className -> Set of domElements
    const childElementsSet = new Set<string>();
    
    if (!extractorResult?.tailwind?.stylesheet) {
      return { variants: variantStructures, classToDOMMap: map, allChildElements: [] as string[] };
    }
    
    const stylesheet = extractorResult.tailwind.stylesheet;
    
    // Check if first class looks like a variant wrapper (contains property-value pattern)
    // e.g., "vis-height-h-28-vis-sentiment-brand-disabled-false"
    const isVariantWrapper = (className: string): boolean => {
      // Variant wrappers typically have multiple property-value pairs joined by dashes
      // Pattern: word-word-word where some parts look like prop-value
      return /^[a-z]+-[a-z0-9]+-/.test(className) && className.split('-').length > 4;
    };
    
    // Check if a class is likely an element name (not a utility class)
    const isElementName = (className: string): boolean => {
      // Element names: slider-root, Label.Root, div, label-div
      // Not utility classes: flex, w-full, bg-fill-accent-default
      const looksLikeElement = /^[a-zA-Z][\w.-]*$/.test(className) && 
        (className.includes('.') || // Label.Root
         /^[A-Z]/.test(className) || // Component names
         ['div', 'span', 'p', 'button', 'input', 'label'].includes(className.toLowerCase()) ||
         // Common element naming patterns
         /^[a-z]+-[a-z]+$/.test(className)); // slider-root, label-div
      
      // Exclude common utility class patterns
      const isUtilityClass = /^(flex|grid|w-|h-|p-|m-|bg-|text-|border-|rounded|gap-|items-|justify-|relative|absolute|font-)/.test(className);
      
      return looksLikeElement && !isUtilityClass;
    };
    
    // Parse each element in the Tailwind output
    // Match: <tagName className="..." or <tagName class="..."
    const elementRegex = /<(\w+)\s+(?:className|class)="([^"]+)"[^>]*>/g;
    let match;
    
    // Track current variant context
    let currentVariant: VariantDOMStructure | null = null;
    let variantDepth = 0;
    let htmlDepth = 0;
    
    // Simple depth tracking by counting < and /> or </
    let position = 0;
    
    while ((match = elementRegex.exec(stylesheet)) !== null) {
      const tagName = match[1];
      const allClasses = match[2].split(/\s+/).filter(c => c.trim());
      if (allClasses.length === 0) continue;
      
      const firstClass = allClasses[0];
      const styleClasses = allClasses.slice(1);
      
      // Check if this is a variant wrapper
      if (isVariantWrapper(firstClass)) {
        // Save previous variant if exists
        if (currentVariant) {
          variantStructures.push(currentVariant);
        }
        
        // Start new variant
        currentVariant = {
          variantName: firstClass,
          variantClasses: styleClasses,
          childElements: new Map()
        };
        
        // Map classes to variant
        styleClasses.forEach(cls => {
          if (!map.has(cls)) map.set(cls, new Set());
          map.get(cls)!.add(firstClass);
        });
        
      } else if (isElementName(firstClass)) {
        // This is a child DOM element
        const elementName = firstClass;
        childElementsSet.add(elementName);
        
        // Add to current variant's child elements
        if (currentVariant) {
          if (!currentVariant.childElements.has(elementName)) {
            currentVariant.childElements.set(elementName, []);
          }
          // Merge classes (some elements appear multiple times)
          const existing = currentVariant.childElements.get(elementName)!;
          styleClasses.forEach(cls => {
            if (!existing.includes(cls)) existing.push(cls);
          });
        }
        
        // Map classes to this element
        styleClasses.forEach(cls => {
          if (!map.has(cls)) map.set(cls, new Set());
          map.get(cls)!.add(elementName);
        });
      }
    }
    
    // Don't forget last variant
    if (currentVariant) {
      variantStructures.push(currentVariant);
    }
    
    return { 
      variants: variantStructures, 
      classToDOMMap: map,
      allChildElements: Array.from(childElementsSet).sort()
    };
  }, [extractorResult]);

  // Reset local selection when modal opens with new classes
  useEffect(() => {
    if (isOpen) {
      setLocalSelection(new Set(selectedClasses));
      setSearchTerm("");
      setSelectedVariant(null);
      setSelectedDOMElement(null);
    }
  }, [isOpen, selectedClasses]);

  // Get child elements for the selected variant (or all if none selected)
  const currentChildElements = useMemo(() => {
    if (!selectedVariant) {
      return allChildElements;
    }
    
    const variant = variants.find(v => v.variantName === selectedVariant);
    if (!variant) return allChildElements;
    
    return Array.from(variant.childElements.keys()).sort();
  }, [selectedVariant, variants, allChildElements]);

  // Get class counts per element (considering variant filter)
  const elementClassCounts = useMemo(() => {
    const counts = new Map<string, number>();
    
    if (selectedVariant) {
      // Count classes for the selected variant
      const variant = variants.find(v => v.variantName === selectedVariant);
      if (variant) {
        // Count variant wrapper classes
        counts.set(selectedVariant, variant.variantClasses.length);
        
        // Count child element classes
        variant.childElements.forEach((classes, elementName) => {
          counts.set(elementName, classes.length);
        });
      }
    } else {
      // Count from classToDOMMap for all elements
      classToDOMMap.forEach((elements, className) => {
        elements.forEach(el => {
          counts.set(el, (counts.get(el) || 0) + 1);
        });
      });
    }
    
    return counts;
  }, [selectedVariant, variants, classToDOMMap]);

  // Filter classes based on variant and DOM element selection
  const filteredClasses = useMemo(() => {
    let classes = extractedClasses;
    
    // Filter by variant first
    if (selectedVariant) {
      const variant = variants.find(v => v.variantName === selectedVariant);
      if (variant) {
        // Get all classes for this variant
        const variantClassSet = new Set<string>(variant.variantClasses);
        variant.childElements.forEach(elementClasses => {
          elementClasses.forEach(cls => variantClassSet.add(cls));
        });
        
        classes = classes.filter(c => variantClassSet.has(c.className));
      }
    }
    
    // Then filter by DOM element within that variant
    if (selectedDOMElement) {
      if (selectedVariant) {
        // Filter to specific element within variant
        const variant = variants.find(v => v.variantName === selectedVariant);
        if (variant) {
          if (selectedDOMElement === selectedVariant) {
            // Selected the variant wrapper itself
            const wrapperClasses = new Set(variant.variantClasses);
            classes = classes.filter(c => wrapperClasses.has(c.className));
          } else {
            // Selected a child element
            const elementClasses = variant.childElements.get(selectedDOMElement);
            if (elementClasses) {
              const classSet = new Set(elementClasses);
              classes = classes.filter(c => classSet.has(c.className));
            }
          }
        }
      } else {
        // No variant selected - filter by DOM element across all
        classes = classes.filter(c => {
          const mappedElements = classToDOMMap.get(c.className);
          return mappedElements && mappedElements.has(selectedDOMElement);
        });
      }
    }
    
    // Filter by search term
    return filterClasses(classes, searchTerm);
  }, [extractedClasses, searchTerm, selectedVariant, selectedDOMElement, variants, classToDOMMap]);

  // Group classes by category
  const groupedClasses = useMemo(() => {
    return groupClassesByCategory(filteredClasses);
  }, [filteredClasses]);

  const handleToggleClass = (className: string) => {
    setLocalSelection(prev => {
      const next = new Set(prev);
      if (next.has(className)) {
        next.delete(className);
      } else {
        next.add(className);
      }
      return next;
    });
  };

  const handleSave = () => {
    onSave(Array.from(localSelection));
  };

  const handleSelectAll = () => {
    filteredClasses.forEach(cls => {
      setLocalSelection(prev => new Set([...prev, cls.className]));
    });
  };

  const handleClearAll = () => {
    setLocalSelection(new Set());
  };

  if (!isOpen) return null;

  return (
    <div className="class-modal-overlay" onClick={onClose}>
      <div className="class-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* DOM Elements Sidebar */}
          <div className="dom-sidebar">
            {/* Variant Selector (if we have variants) */}
            {variants.length > 0 && (
              <div className="variant-selector-section">
                <div className="sidebar-header">Variant</div>
                <select
                  className="variant-select"
                  value={selectedVariant || ""}
                  onChange={(e) => {
                    setSelectedVariant(e.target.value || null);
                    setSelectedDOMElement(null); // Reset DOM selection when variant changes
                  }}
                >
                  <option value="">All Variants ({variants.length})</option>
                  {variants.map(v => (
                    <option key={v.variantName} value={v.variantName}>
                      {v.variantName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* DOM Elements List */}
            <div className="sidebar-header">DOM Elements</div>
            <button
              className={`dom-item ${selectedDOMElement === null ? "active" : ""}`}
              onClick={() => setSelectedDOMElement(null)}
            >
              All Elements
              <span className="dom-count">{filteredClasses.length}</span>
            </button>
            
            {/* Show variant wrapper as first element if variant is selected */}
            {selectedVariant && (
              <button
                className={`dom-item variant-wrapper ${selectedDOMElement === selectedVariant ? "active" : ""}`}
                onClick={() => setSelectedDOMElement(selectedVariant)}
              >
                <span className="dom-name">{selectedVariant.split('-').slice(0, 3).join('-')}...</span>
                <span className="dom-count">{elementClassCounts.get(selectedVariant) || 0}</span>
              </button>
            )}
            
            {/* Child DOM elements */}
            {currentChildElements.map(el => {
              const count = elementClassCounts.get(el) || 0;
              return (
                <button
                  key={el}
                  className={`dom-item ${selectedDOMElement === el ? "active" : ""}`}
                  onClick={() => setSelectedDOMElement(el)}
                >
                  <span className="dom-name">{el}</span>
                  <span className="dom-count">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Main Content */}
          <div className="modal-main">
            <div className="modal-toolbar">
              <input
                type="text"
                className="search-input"
                placeholder="Search classes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="toolbar-btn" onClick={handleSelectAll}>Select All</button>
              <button className="toolbar-btn" onClick={handleClearAll}>Clear</button>
            </div>

            <div className="modal-content">
              {extractedClasses.length === 0 ? (
                <div className="no-classes-message">
                  <p>No classes extracted yet.</p>
                  <p>Use the Extractor tool first.</p>
                </div>
              ) : filteredClasses.length === 0 ? (
                <div className="no-classes-message">
                  <p>No classes match your filter.</p>
                </div>
              ) : (
                <div className="class-categories">
                  {Array.from(groupedClasses.entries()).map(([category, classes]) => {
                    if (classes.length === 0) return null;
                    const categoryConfig = CLASS_CATEGORIES[category];

                    return (
                      <div key={category} className="category-section">
                        <div className="category-header">
                          {categoryConfig.label}
                          <span className="category-count">{classes.length}</span>
                        </div>
                        <div className="category-classes">
                          {classes.map(cls => (
                            <label
                              key={cls.id}
                              className={`class-option ${localSelection.has(cls.className) ? "selected" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={localSelection.has(cls.className)}
                                onChange={() => handleToggleClass(cls.className)}
                              />
                              <span>{cls.className}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={handleSave}>Save ({localSelection.size})</button>
        </div>
      </div>
    </div>
  );
}

export default ClassSelectionModal;

