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

  interface DOMElement {
    name: string; // Original name from RAW for display
    normalizedName: string; // Kebab-case for matching Tailwind classes
    depth: number;
  }

interface VariantDOMStructure {
  variantName: string;
  elementName?: string; // Kebab-case element name for matching Tailwind classes
  variantClasses: string[]; // Classes on the variant wrapper itself
  childElements: Map<string, string[]>; // elementName -> classes (from Tailwind)
  childElementsHierarchy: DOMElement[]; // DOM structure from RAW (single source of truth)
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
  const [selectedDOMElementIndex, setSelectedDOMElementIndex] = useState<number | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<ClassCategory>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [isResizing, setIsResizing] = useState(false);
  const [collapsedDOMElements, setCollapsedDOMElements] = useState<Set<number>>(new Set());
  const [multiSelectSameElements, setMultiSelectSameElements] = useState(false);

  // Parse raw JSON and Tailwind output to extract proper DOM hierarchy
  const { variants, classToDOMMap, allChildElements, componentSetName } = useMemo(() => {
    const variantStructures: VariantDOMStructure[] = [];
    const map = new Map<string, Set<string>>(); // className -> Set of domElements
    const childElementsSet = new Set<string>();
    let compSetName: string | null = null;
    
    if (!extractorResult?.raw?.stylesheet || !extractorResult?.tailwind?.stylesheet) {
      return { variants: variantStructures, classToDOMMap: map, allChildElements: [] as DOMElement[], componentSetName: compSetName };
    }
    
    // Parse raw JSON to understand structure
    let rawNodes: any[] = [];
    try {
      rawNodes = JSON.parse(extractorResult.raw.stylesheet);
    } catch (e) {
      console.warn("Failed to parse raw JSON", e);
      return { variants: variantStructures, classToDOMMap: map, allChildElements: [] as DOMElement[], componentSetName: compSetName };
    }
    
    const tailwindSheet = extractorResult.tailwind.stylesheet;
    
    // Store hierarchical DOM elements
    const childElementsWithHierarchy: DOMElement[] = [];
    
    // Helper: recursively collect all element names from the raw structure with hierarchy info
    // Returns array of DOMElement objects with normalized names and depth
    const collectElementNames = (node: any, isTopLevel: boolean = false, depth: number = 0): DOMElement[] => {
      const elements: DOMElement[] = [];
      
      // Add current node name if it's a real DOM element (not COMPONENT_SET or top-level COMPONENT)
      const shouldInclude = node.name && node.type !== "COMPONENT_SET" && !(node.type === "COMPONENT" && depth === 0);
      if (shouldInclude) {
        // Preserve original name for display
        const originalName = node.name;
        
        // Normalize name to match Tailwind format: remove special chars (same as sanitizeTagName)
        // Remove characters invalid in tag names (keep letters, numbers, hyphens, underscores)
        // Then lowercase for consistent matching
        const normalizedName = originalName
          .replace(/[^a-zA-Z0-9_.-]/g, '')  // Remove special chars (matches Tailwind sanitization, preserves dots)
          .toLowerCase();                    // Lowercase for matching
        childElementsSet.add(normalizedName);
        
        // Use depth directly - variant root is added separately with depth 0
        const elementDepth = depth;
        
        const element: DOMElement = {
          name: originalName,
          normalizedName: normalizedName,
          depth: elementDepth
        };
        
        elements.push(element);
      }
      
      // Recurse into children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child: any) => {
          elements.push(...collectElementNames(child, false, depth + 1));
        });
      }
      
      return elements;
    };
    
    // Build variant name to kebab-case map for matching Tailwind classes
    const variantNameQueue = new Map<string, string[]>(); // kebab-case -> queue of variant names (in order)
    
    // Extract variants - use componentProperties if available for complete list
    if (extractorResult.componentProperties && extractorResult.componentProperties.variants.length > 0) {
      // Get component set name FIRST so we can use it for elementName
      if (rawNodes.length > 0) {
        if (rawNodes[0].type === "COMPONENT_SET") {
          compSetName = rawNodes[0].name;
        } else if (rawNodes[0].componentSetName) {
          // Extract from individual component's componentSetName field
          compSetName = rawNodes[0].componentSetName;
        }
      }
      
      // Use componentProperties.variants to get ALL variants (even if user selected just one)
      extractorResult.componentProperties.variants.forEach(variant => {
        // For matching with classToDOMMap, use componentSetName (what becomes the tag in Tailwind output)
        // If no componentSetName, fall back to variant name
        const nameForMatching = compSetName || variant.variantName;
        const elementName = nameForMatching.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();
        variantStructures.push({
          variantName: variant.variantName,
          elementName,
          variantClasses: [],
          childElements: new Map(),
          childElementsHierarchy: []
        });
        // Queue: "dropdownmenu.item" -> ["variant1", "variant2", ...]
        if (!variantNameQueue.has(elementName)) variantNameQueue.set(elementName, []);
        variantNameQueue.get(elementName)!.push(variant.variantName);
      });
    } else if (rawNodes.length > 0) {
      // Fallback: parse from raw nodes if componentProperties not available
      const firstNode = rawNodes[0];
      
      // Extract componentSetName if available
      if (firstNode.type === "COMPONENT_SET") {
        compSetName = firstNode.name;
      } else if (firstNode.componentSetName) {
        compSetName = firstNode.componentSetName;
      }
      
      // Case 1: COMPONENT_SET with multiple variants
      if (firstNode.type === "COMPONENT_SET") {
        // Each child of COMPONENT_SET is a variant
        if (firstNode.children && Array.isArray(firstNode.children)) {
          firstNode.children.forEach((variantNode: any) => {
            if (variantNode.type === "COMPONENT") {
              // For matching with classToDOMMap, use componentSetName (what becomes the tag in Tailwind output)
              const nameForMatching = compSetName || variantNode.name;
              const elementName = nameForMatching.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();
              variantStructures.push({
                variantName: variantNode.name,
                elementName,
                variantClasses: [],
                childElements: new Map(),
                childElementsHierarchy: []
              });
              if (!variantNameQueue.has(elementName)) variantNameQueue.set(elementName, []);
              variantNameQueue.get(elementName)!.push(variantNode.name);
            }
          });
        }
      }
      // Case 2: Multiple COMPONENT nodes with same componentSetName (variants from a component set)
      else if (firstNode.componentSetName && rawNodes.every((n: any) => n.componentSetName === firstNode.componentSetName)) {
        // Multiple variants from the same component set
        rawNodes.forEach((node: any) => {
          if (node.type === "COMPONENT") {
            // For matching with classToDOMMap, use componentSetName (what becomes the tag in Tailwind output)
            const nameForMatching = compSetName || node.name;
            const elementName = nameForMatching.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();
            variantStructures.push({
              variantName: node.name,
              elementName,
              variantClasses: [],
              childElements: new Map(),
              childElementsHierarchy: []
            });
            if (!variantNameQueue.has(elementName)) variantNameQueue.set(elementName, []);
            variantNameQueue.get(elementName)!.push(node.name);
          }
        });
      }
      // Case 3: Single COMPONENT with componentSetName (single variant selected from a set)
      // Do NOT create variants for instances or standalone components without componentSetName
      else if (firstNode.type === "COMPONENT" && firstNode.componentSetName) {
        // Match sanitizeTagName normalization: remove special chars, then lowercase
        const elementName = firstNode.name.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();
        variantStructures.push({
          variantName: firstNode.name,
          elementName,
          variantClasses: [],
          childElements: new Map(),
          childElementsHierarchy: []
        });
        if (!variantNameQueue.has(elementName)) variantNameQueue.set(elementName, []);
        variantNameQueue.get(elementName)!.push(firstNode.name);
      }
      // else: Instances, standalone components, etc. - no variant structures, use global classToDOMMap
    }
    
    // Collect DOM hierarchy per variant from RAW JSON (single source of truth)
    rawNodes.forEach((node, idx) => {
      if (node.type === "COMPONENT_SET") {
        // For variant sets, collect from each variant child
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach((variantNode: any) => {
            if (variantNode.type === "COMPONENT") {
              // Find the corresponding variant structure
              const variant = variantStructures.find(v => v.variantName === variantNode.name);
              if (variant && variant.elementName) {
                // Add variant root element itself first (depth 0)
                const variantRoot: DOMElement = {
                  name: variantNode.name, // Original name for display
                  normalizedName: variant.elementName, // Kebab-case for matching
                  depth: 0
                };
                
                // Collect child elements (iterate over children directly to avoid duplicate root)
                const domElements: DOMElement[] = [];
                if (variantNode.children && Array.isArray(variantNode.children)) {
                  variantNode.children.forEach((child: any) => {
                    domElements.push(...collectElementNames(child, false, 1));
                  });
                }
                
                // Combine: variant root + children (in correct order)
                variant.childElementsHierarchy = [variantRoot, ...domElements];
              }
            }
          });
        }
      } else if (node.type === "COMPONENT" || node.type === "INSTANCE" || node.type === "FRAME") {
        // For single components, instances, and frames
        const variant = variantStructures.find(v => v.variantName === node.name);
        if (variant && variant.elementName) {
          // Case: Part of a variant structure (single variant from a component set)
          // Add variant root element itself first (depth 0)
          const variantRoot: DOMElement = {
            name: node.name, // Original name for display
            normalizedName: variant.elementName, // Kebab-case for matching
            depth: 0
          };
          
          // Collect child elements (iterate over children directly to avoid duplicate root)
          const domElements: DOMElement[] = [];
          if (node.children && Array.isArray(node.children)) {
            node.children.forEach((child: any) => {
              domElements.push(...collectElementNames(child, false, 1));
            });
          }
          
          // Combine: variant root + children (in correct order)
          variant.childElementsHierarchy = [variantRoot, ...domElements];
        } else {
          // Case: No variant structure (standalone master component, instance, or frame)
          // Add root element first, then collect children
          const rootElementName = node.name.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();
          const rootElement: DOMElement = {
            name: node.name, // Original name for display
            normalizedName: rootElementName,
            depth: 0
          };
          childElementsWithHierarchy.push(rootElement);
          
          // Collect child elements starting from depth 1
          if (node.children && Array.isArray(node.children)) {
            node.children.forEach((child: any) => {
              childElementsWithHierarchy.push(...collectElementNames(child, false, 1));
            });
          }
        }
      }
    });
    
    // Build global hierarchy for "All Variants" view
    // Combine all variant hierarchies (each variant root followed by its children)
    variantStructures.forEach(variant => {
      childElementsWithHierarchy.push(...variant.childElementsHierarchy);
    });
    
    // Now map classes from Tailwind output to DOM elements
    // Parse element by element: <tagName data-name="..." className="...">
    // Use a more robust approach that handles multi-line attributes
    // Note: [\w.]+ captures dots in React component names (e.g., DropdownMenu.Item)
    const elementRegex = /<([\w.]+)([^>]*)>/g;
    let match;
    
    // Track which variant context we're in (for proper child element assignment)
    let currentVariantContext: VariantDOMStructure | null = null;
    let variantIndex = 0; // Track which variant we're currently parsing
    
    let parsedElementCount = 0;
    let totalClassCount = 0;
    
    while ((match = elementRegex.exec(tailwindSheet)) !== null) {
      const tagName = match[1];
      const attributes = match[2];
      
      
      // Extract className or class
      const classMatch = attributes.match(/(?:className|class)="([^"]+)"/);
      if (!classMatch) continue;
      const classesStr = classMatch[1];
      const allClasses = classesStr.split(/\s+/).filter(c => c.trim());
      if (allClasses.length === 0) continue;
      
      // Determine element name:
      // - For React components (PascalCase tag like <Acorn>), use normalized tag name
      // - For HTML elements (lowercase like <div>), use first class as element name
      // - SPECIAL CASE: PascalCase tag matching componentSetName = variant root, look for variant in classes
      const isPascalCase = /^[A-Z]/.test(tagName);
      let elementName: string;
      let classes: string[];
      let isVariantRoot = false;
      
      if (isPascalCase) {
        // React component - tag name IS the element name, ALL classes are styling classes
        const normalizedTag = tagName.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();
        
        // Check if this tag matches the componentSetName (indicates a variant root)
        const componentSetNameNormalized = compSetName?.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();
        if (componentSetNameNormalized && normalizedTag === componentSetNameNormalized) {
          // This is a variant root - assign to next variant in sequence
          if (variantIndex < variantStructures.length) {
            const variant = variantStructures[variantIndex];
            elementName = variant.elementName || normalizedTag; // Use the variant's kebab-case identifier
            classes = allClasses; // All classes are styling classes
            isVariantRoot = true;
            variantIndex++; // Move to next variant for next occurrence
          } else {
            // Fallback if we somehow have more elements than variants
            elementName = normalizedTag;
            classes = allClasses;
          }
        } else {
          // Regular React component
          elementName = normalizedTag;
          classes = allClasses;
        }
      } else {
        // HTML element - first class is element name, rest are styling classes
        elementName = allClasses[0];
        classes = allClasses.slice(1);
      }
      
      const classesBeforeFilter = classes.length;
      // Filter out zero-value classes (like rounded-[0px], p-[0px]) to match skip zeros filtering
      classes = classes.filter(cls => !/^[\w-]+\[0(px)?(_0(px)?)*\]$/.test(cls));
      
      parsedElementCount++;
      totalClassCount += classes.length;
      
      // Check if this element name matches a variant (from the queue - pop in order)
      const queue = variantNameQueue.get(elementName);
      const matchedVariantName = queue && queue.length > 0 ? queue.shift() : null;
      const variant = matchedVariantName ? variantStructures.find(v => v.variantName === matchedVariantName) : null;
      
      
      if (variant) {
        // This is a variant wrapper/root element
        currentVariantContext = variant;
        variant.variantClasses = classes;
        
        // Map classes to the variant root element (using kebab-case element name)
        classes.forEach(cls => {
          if (!map.has(cls)) map.set(cls, new Set());
          map.get(cls)!.add(elementName);  // Use kebab-case element name for filtering
        });
      } else {
        // This is a child element
        // Add to global map for "All Elements" filtering
        classes.forEach(cls => {
          if (!map.has(cls)) map.set(cls, new Set());
          map.get(cls)!.add(elementName);
        });
        
        // Add to current variant context if we have one
        if (currentVariantContext) {
          if (!currentVariantContext.childElements.has(elementName)) {
            currentVariantContext.childElements.set(elementName, []);
          }
          const existing = currentVariantContext.childElements.get(elementName)!;
          classes.forEach(cls => {
            if (!existing.includes(cls)) existing.push(cls);
          });
        } else {
        }
      }
    }
    
    return { 
      variants: variantStructures, 
      classToDOMMap: map,
      allChildElements: childElementsWithHierarchy,
      componentSetName: compSetName
    };
  }, [extractorResult]);

  // Reset local selection when modal opens with new classes
  useEffect(() => {
    if (isOpen) {
      setLocalSelection(new Set(selectedClasses));
      setSearchTerm("");
      setSelectedVariant(null);
      setSelectedDOMElement(null);
      setSelectedDOMElementIndex(null);
      setCollapsedCategories(new Set());
    }
  }, [isOpen, selectedClasses]);

  // Get child elements for the selected variant (or all if none selected)
  const currentChildElements = useMemo((): DOMElement[] => {
    if (!selectedVariant) {
      // Show all elements from all variants
      return allChildElements;
    }
    
    const variant = variants.find(v => v.variantName === selectedVariant);
    if (!variant) {
      return allChildElements;
    }
    
    // Return DOM hierarchy from RAW JSON (single source of truth)
    return variant.childElementsHierarchy;
  }, [selectedVariant, variants, allChildElements]);

  // Helper: Find which variant an element at a given index belongs to
  // by walking backwards to find the nearest depth-0 (variant root) element
  const getVariantForElementIndex = (index: number): VariantDOMStructure | null => {
    if (index < 0 || index >= currentChildElements.length) return null;
    
    // Walk backwards to find the variant root (depth 0)
    for (let i = index; i >= 0; i--) {
      const elem = currentChildElements[i];
      if (elem.depth === 0) {
        // Found a variant root - find matching variant by elementName
        const variant = variants.find(v => v.elementName === elem.normalizedName);
        return variant || null;
      }
    }
    return null;
  };

  // Get class counts per element (considering variant filter)
  // Always shows variant-specific counts - multi-select only affects selection behavior, not counts
  const elementClassCounts = useMemo(() => {
    const counts = new Map<string, number>();
    
    
    if (selectedVariant) {
      // Specific variant selected from dropdown - count that variant's classes
      const variant = variants.find(v => v.variantName === selectedVariant);
      if (variant) {
        if (variant.elementName && variant.variantClasses.length > 0) {
          counts.set(variant.elementName, variant.variantClasses.length);
        }
        variant.childElements.forEach((elementClasses, elementName) => {
          counts.set(elementName, elementClasses.length);
        });
      }
    } else {
      // All Variants: count per-element in each variant's context
      // Each DOM element in the list belongs to a specific variant, so count that variant's classes
      currentChildElements.forEach((elem, index) => {
        // Find which variant this element belongs to
        const elementVariant = getVariantForElementIndex(index);
        if (elementVariant) {
          // Get count for this specific element in this specific variant
          if (elem.normalizedName === elementVariant.elementName) {
            // It's the variant root
            counts.set(`${index}:${elem.normalizedName}`, elementVariant.variantClasses.length);
          } else {
            // It's a child element
            const elementClasses = elementVariant.childElements.get(elem.normalizedName);
            counts.set(`${index}:${elem.normalizedName}`, elementClasses?.length || 0);
          }
        } else {
          // No variant found (e.g., instances) - count from global classToDOMMap
          // Count how many classes include this element name in their domElements array
          let count = 0;
          extractedClasses.forEach(c => {
            if (c.domElements.includes(elem.normalizedName)) {
              count++;
            }
          });
          counts.set(`${index}:${elem.normalizedName}`, count);
        }
      });
    }
    
    return counts;
  }, [selectedVariant, variants, currentChildElements]);

  // Helper: Get parent hierarchy path for an element at a given index
  const getParentPath = (index: number): string => {
    const elem = currentChildElements[index];
    if (!elem || elem.depth === 0) return '';
    
    const parents: string[] = [];
    let currentDepth = elem.depth;
    
    // Walk backwards to find DIRECT parents only (depth must be exactly one less each time)
    for (let i = index - 1; i >= 0 && currentDepth > 0; i--) {
      const potentialParent = currentChildElements[i];
      // Only accept direct parent (depth exactly one less than current)
      if (potentialParent.depth === currentDepth - 1) {
        parents.unshift(potentialParent.normalizedName);
        currentDepth = potentialParent.depth;
        if (currentDepth === 0) break;
      }
    }
    return parents.join('/');
  };

  // Helper: Find all elements with the same name (ignoring parent structure)
  const findMatchingElements = (targetIndex: number): number[] => {
    const targetElem = currentChildElements[targetIndex];
    if (!targetElem) return [targetIndex];
    
    const targetName = targetElem.normalizedName;
    
    // Match by name only - ignore parent hierarchy
    return currentChildElements
      .map((elem, idx) => {
        if (elem.normalizedName === targetName) {
          return idx;
        }
        return -1;
      })
      .filter(idx => idx !== -1);
  };

  // Get all selected element normalized names for filtering
  const selectedDOMElementsForFiltering = useMemo(() => {
    if (!selectedDOMElement || selectedDOMElementIndex === null) return null;
    
    if (multiSelectSameElements) {
      // Multi-select mode - find all elements with same name (ignoring parent structure)
      const matchingIndices = findMatchingElements(selectedDOMElementIndex);
      const matchingNames = new Set(matchingIndices.map(idx => currentChildElements[idx].normalizedName));
      return matchingNames;
    }
    
    // Single selection mode - just return the selected element
    return new Set([selectedDOMElement]);
  }, [selectedDOMElement, selectedDOMElementIndex, multiSelectSameElements, currentChildElements]);

  // Filter classes based on variant and DOM element selection
  // Uses variant's own class data (variantClasses + childElements) when variant is selected
  const filteredClasses = useMemo(() => {
    let classes = extractedClasses;
    
    // Filter by variant first
    if (selectedVariant) {
      const variant = variants.find(v => v.variantName === selectedVariant);
      if (variant) {
        
        // Build a set of ALL classes that exist in THIS variant
        // This includes variant root classes AND all child element classes
        const variantClassSet = new Set<string>();
        
        // Add variant root classes
        variant.variantClasses.forEach(cls => variantClassSet.add(cls));
        
        // Add all child element classes
        variant.childElements.forEach((elementClasses, elementName) => {
          elementClasses.forEach(cls => variantClassSet.add(cls));
        });
        
        
        // Filter to only classes that actually exist in this variant
        classes = classes.filter(c => variantClassSet.has(c.className));
      }
    }
    
    // Then filter by DOM element within that variant
    if (selectedDOMElementsForFiltering) {
      if (selectedVariant) {
        // Use variant's own class data for filtering within a variant
        const variant = variants.find(v => v.variantName === selectedVariant);
        if (variant) {
          // Build set of classes for selected elements within THIS variant
          const selectedElementClasses = new Set<string>();
          
          for (const elemName of selectedDOMElementsForFiltering) {
            // Check variant root
            if (elemName === variant.elementName) {
              variant.variantClasses.forEach(cls => selectedElementClasses.add(cls));
            }
            // Check child elements
            const elementClasses = variant.childElements.get(elemName);
            if (elementClasses) {
              elementClasses.forEach(cls => selectedElementClasses.add(cls));
            }
          }
          
          
          classes = classes.filter(c => selectedElementClasses.has(c.className));
        }
      } else {
        // All variants mode
        if (!multiSelectSameElements && selectedDOMElementIndex !== null) {
          // SINGLE-SELECT mode in All Variants - show only classes from the specific clicked element
          // Find which variant the clicked element belongs to
          const elementVariant = getVariantForElementIndex(selectedDOMElementIndex);
          
          if (elementVariant) {
            // Get classes for this specific element from this specific variant
            const specificElementClasses = new Set<string>();
            
            for (const elemName of selectedDOMElementsForFiltering) {
              // Check if it's the variant root
              if (elemName === elementVariant.elementName) {
                elementVariant.variantClasses.forEach(cls => specificElementClasses.add(cls));
              }
              // Check child elements
              const elementClasses = elementVariant.childElements.get(elemName);
              if (elementClasses) {
                elementClasses.forEach(cls => specificElementClasses.add(cls));
              }
            }
            
            
            classes = classes.filter(c => specificElementClasses.has(c.className));
          } else {
            // No variant found (e.g., instances) - use global classToDOMMap like multi-select mode
            classes = classes.filter(c => {
              for (const elemName of selectedDOMElementsForFiltering) {
                if (c.domElements.includes(elemName)) return true;
              }
              return false;
            });
          }
        } else {
          // MULTI-SELECT mode - use global domElements from plugin (all classes with matching element names)
          classes = classes.filter(c => {
            for (const elemName of selectedDOMElementsForFiltering) {
              if (c.domElements.includes(elemName)) return true;
            }
            return false;
          });
          
        }
      }
    }
    
    // Filter by search term
    return filterClasses(classes, searchTerm);
  }, [extractedClasses, searchTerm, selectedVariant, selectedDOMElementsForFiltering, variants, multiSelectSameElements, selectedDOMElementIndex, currentChildElements]);

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

  const toggleCategory = (category: ClassCategory) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // DOM element collapse/expand handlers
  const toggleDOMElement = (index: number) => {
    setCollapsedDOMElements(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAllDOMElements = () => {
    const indicesWithChildren = currentChildElements
      .map((elem, index) => {
        const nextElem = currentChildElements[index + 1];
        const hasChildren = nextElem && nextElem.depth > elem.depth;
        return hasChildren ? index : -1;
      })
      .filter(index => index !== -1);
    
    if (collapsedDOMElements.size > 0) {
      // Expand all - clear collapsed set
      setCollapsedDOMElements(new Set());
    } else {
      // Collapse all - add all elements that have children
      setCollapsedDOMElements(new Set(indicesWithChildren));
    }
  };

  // Check if an element has children
  const hasChildren = (elem: DOMElement, index: number): boolean => {
    const nextElem = currentChildElements[index + 1];
    return nextElem ? nextElem.depth > elem.depth : false;
  };

  // Check if element should be visible (parent not collapsed)
  const isElementVisible = (elem: DOMElement, index: number): boolean => {
    // Root elements are always visible
    if (elem.depth === 0) {
      return true;
    }
    
    // Check if any parent is collapsed by walking backwards
    for (let i = index - 1; i >= 0; i--) {
      const potentialParent = currentChildElements[i];
      if (potentialParent.depth < elem.depth) {
        if (collapsedDOMElements.has(i)) {
          return false;
        }
        // If we reach a root element, stop checking
        if (potentialParent.depth === 0) break;
      }
    }
    return true;
  };

  // Sidebar resize handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      // Min width 180px, max width 500px
      setSidebarWidth(Math.max(180, Math.min(500, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  if (!isOpen) return null;

  return (
    <div className="class-modal-overlay" onClick={onClose}>
      <div className={`class-modal ${isResizing ? 'resizing' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* DOM Elements Sidebar - Full Height */}
        <div className="dom-sidebar" style={{ width: `${sidebarWidth}px` }}>
          {/* Component Set Name (if available) */}
          {componentSetName && (
            <div className="component-set-section">
              <div className="sidebar-label">Component Set</div>
              <div className="component-set-name">{componentSetName}</div>
            </div>
          )}
          
          {/* Variant Selector - ALWAYS show when we have extraction results */}
          <div className="variant-selector-section">
            <div className="sidebar-header">Component</div>
            <select
              className="variant-select"
              value={selectedVariant || ""}
              onChange={(e) => {
                setSelectedVariant(e.target.value || null);
                setSelectedDOMElement(null); // Reset DOM selection when variant changes
                setSelectedDOMElementIndex(null);
              }}
            >
              <option value="">All Variants</option>
              {variants.map(v => (
                <option key={v.variantName} value={v.variantName}>
                  {v.variantName}
                </option>
              ))}
            </select>
          </div>
          
          {/* DOM Elements List */}
          <div className="sidebar-header">
            <div className="sidebar-header-left">
              <button 
                className="collapse-all-btn"
                onClick={() => toggleAllDOMElements()}
                title={collapsedDOMElements.size > 0 ? "Expand All" : "Collapse All"}
              >
                {collapsedDOMElements.size > 0 ? "▶" : "▼"}
              </button>
              <span>DOM</span>
            </div>
            <div className="sidebar-header-right">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={multiSelectSameElements}
                  onChange={(e) => setMultiSelectSameElements(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span 
                className="toggle-label"
                title="When enabled, clicking an element selects all instances with same name and parent hierarchy"
              >
                Multi-select
              </span>
            </div>
          </div>
          <div className="dom-elements-list">
            <button
              className={`dom-item ${selectedDOMElement === null ? "active" : ""}`}
              onClick={() => {
                setSelectedDOMElement(null);
                setSelectedDOMElementIndex(null);
              }}
            >
              All Elements
              <span className="dom-count">{extractedClasses.length}</span>
            </button>
            
            {/* DOM elements - includes variant root + children, all from RAW JSON */}
            {currentChildElements.length > 0 && currentChildElements.map((elem, index) => {
              // Check if element should be visible based on parent collapse state
              if (!isElementVisible(elem, index)) {
                return null;
              }
              
              // Get count: in All Variants mode, use index-based key; in specific variant mode, use element name
              const countKey = !selectedVariant 
                ? `${index}:${elem.normalizedName}` 
                : elem.normalizedName;
              const count = elementClassCounts.get(countKey) || 0;
              const isCollapsed = collapsedDOMElements.has(index);
              const elementHasChildren = hasChildren(elem, index);
              const isRoot = elem.depth === 0;
              
              // Check if this element should be marked as active
              let isActive = false;
              if (!multiSelectSameElements) {
                // In single-select mode, only highlight the exact clicked element
                isActive = selectedDOMElementIndex === index;
              } else {
                // In multi-select mode, highlight all elements with same name (ignoring parent structure)
                if (selectedDOMElementIndex !== null) {
                  const matchingIndices = findMatchingElements(selectedDOMElementIndex);
                  isActive = matchingIndices.includes(index);
                }
              }
              
              // Apply subtle indentation based on depth (12px per level)
              const indentStyle = {
                paddingLeft: `${12 + elem.depth * 12}px`
              };
              
              return (
                <button
                  key={`${index}-${elem.normalizedName}`}
                  className={`dom-item ${isActive ? "active" : ""} ${isRoot ? "root-element" : ""}`}
                  onClick={() => {
                    setSelectedDOMElement(elem.normalizedName);
                    setSelectedDOMElementIndex(index);
                  }}
                  style={indentStyle}
                  data-depth={elem.depth}
                  title={elem.name}
                >
                  <span className="dom-name">
                    {elementHasChildren && (
                      <span 
                        className="chevron"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDOMElement(index);
                        }}
                      >
                        {isCollapsed ? "▶" : "▼"}
                      </span>
                    )}
                    {!elementHasChildren && elem.depth > 0 && <span className="tree-indent">└ </span>}
                    {elem.name}
                  </span>
                  <span className="dom-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Resize Handle */}
        <div 
          className={`resize-handle ${isResizing ? 'resizing' : ''}`}
          onMouseDown={handleMouseDown}
        />

        {/* Right Side: Header + Main Content + Actions */}
        <div className="modal-right">
          <div className="modal-header">
            <h3>{title}</h3>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

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
                    const isCollapsed = collapsedCategories.has(category);
                    const selectedInCategory = classes.filter(c => localSelection.has(c.className)).length;

                    return (
                      <div key={category} className="category-section">
                        <button 
                          className="category-header"
                          onClick={() => toggleCategory(category)}
                        >
                          <span className="category-toggle">{isCollapsed ? '▶' : '▼'}</span>
                          <span className="category-label">{categoryConfig.label}</span>
                          <span className="category-count">
                            {selectedInCategory > 0 && <span className="selected-count">{selectedInCategory} / </span>}
                            {classes.length}
                          </span>
                        </button>
                        {!isCollapsed && (
                          <table className="classes-table">
                            <tbody>
                              {classes.map(cls => (
                                <tr 
                                  key={cls.id} 
                                  className={`class-row ${localSelection.has(cls.className) ? "selected" : ""}`}
                                  onClick={() => handleToggleClass(cls.className)}
                                >
                                  <td className="col-checkbox">
                                    <input
                                      type="checkbox"
                                      checked={localSelection.has(cls.className)}
                                      onChange={() => handleToggleClass(cls.className)}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </td>
                                  <td className="col-class">{cls.className}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button className="cancel-btn" onClick={onClose}>Cancel</button>
            <button className="save-btn" onClick={handleSave}>Save ({localSelection.size})</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClassSelectionModal;
