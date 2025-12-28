import { useState, useCallback, useMemo } from "react";
import { MultiFormatExtractionResult } from "@common/networkSides";
import {
  CVAState,
  CVAActions,
  CVAMode,
  CVAConfig,
  ExtractedClass,
  ClassCategory,
  CVAVariantConfig,
  CVAVariantProperty,
  CVAPropertyValue,
  CVAPrefixedClasses,
  CompoundVariantRule,
  CompoundCondition,
} from "../types";

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Categorize a class name based on patterns
 */
function categorizeClass(className: string): ClassCategory {
  const lowerClass = className.toLowerCase();
  
  // Fill/Background patterns
  if (/^(bg-|fill-|background)/.test(lowerClass)) {
    return "fill";
  }
  
  // Stroke/Border color patterns
  if (/^(border-|stroke-|outline-)/.test(lowerClass) && !/^(border-radius|rounded)/.test(lowerClass)) {
    return "stroke";
  }
  
  // Border radius patterns
  if (/^(rounded|border-radius)/.test(lowerClass)) {
    return "border-radius";
  }
  
  // Typography patterns
  if (/^(text-|font-|leading-|tracking-|uppercase|lowercase|capitalize|italic|underline|line-through|truncate)/.test(lowerClass)) {
    return "typography";
  }
  
  // Spacing patterns
  if (/^(p-|px-|py-|pt-|pr-|pb-|pl-|m-|mx-|my-|mt-|mr-|mb-|ml-|gap-|space-)/.test(lowerClass)) {
    return "spacing";
  }
  
  // Layout patterns
  if (/^(flex|grid|block|inline|hidden|w-|h-|min-|max-|overflow|relative|absolute|fixed|sticky|z-|top-|right-|bottom-|left-|items-|justify-|self-|place-|order-)/.test(lowerClass)) {
    return "layout";
  }
  
  // Effects patterns
  if (/^(shadow|opacity|blur|backdrop|ring|transition|animate|transform|scale|rotate|translate|skew)/.test(lowerClass)) {
    return "effects";
  }
  
  return "other";
}

/**
 * Check if a class name is actually a Figma variant name (should be excluded)
 * Variant names look like: vis-height-h-28-vis-iconbutton-false-interaction-hover-vis-sentiment-brand
 * They contain multiple property-value segments joined together
 */
function isFigmaVariantName(className: string): boolean {
  // Variant names are typically long and contain multiple vis- or property-value patterns
  // Common patterns: vis-property-value, interaction-state, disabled-bool
  
  // Must be reasonably long to be a variant combo
  if (className.length < 20) return false;
  
  // Count how many property-like segments exist
  const segments = className.split('-');
  if (segments.length < 5) return false;
  
  // Check for common Figma variant prefixes
  const variantPatterns = [
    /^vis-/,                    // starts with vis-
    /-vis-/,                    // contains -vis-
    /-(true|false)(-|$)/,       // contains boolean values
    /-interaction-/,            // interaction state
    /-disabled-/,               // disabled state
    /-sentiment-/,              // sentiment property
  ];
  
  let matchCount = 0;
  for (const pattern of variantPatterns) {
    if (pattern.test(className)) {
      matchCount++;
    }
  }
  
  // If it matches multiple patterns, it's likely a variant name
  return matchCount >= 2;
}

/**
 * Extract classes from the Tailwind stylesheet output
 */
function extractClassesFromStylesheet(stylesheet: string): string[] {
  const classes: Set<string> = new Set();
  
  // Match className="..." patterns
  const classNameRegex = /className="([^"]+)"/g;
  let match;
  
  while ((match = classNameRegex.exec(stylesheet)) !== null) {
    const classString = match[1];
    classString.split(/\s+/).forEach(cls => {
      const trimmed = cls.trim();
      // Filter out Figma variant names
      if (trimmed && !isFigmaVariantName(trimmed)) {
        classes.add(trimmed);
      }
    });
  }
  
  // Also match class="..." for HTML format
  const classRegex = /class="([^"]+)"/g;
  while ((match = classRegex.exec(stylesheet)) !== null) {
    const classString = match[1];
    classString.split(/\s+/).forEach(cls => {
      const trimmed = cls.trim();
      if (trimmed && !isFigmaVariantName(trimmed)) {
        classes.add(trimmed);
      }
    });
  }
  
  return Array.from(classes);
}

/**
 * Extract DOM element names from the stylesheet
 */
function extractDOMElements(stylesheet: string): string[] {
  const elements: Set<string> = new Set();
  
  // Match data-name="..." attributes
  const dataNameRegex = /data-name="([^"]+)"/g;
  let match;
  
  while ((match = dataNameRegex.exec(stylesheet)) !== null) {
    elements.add(match[1]);
  }
  
  return Array.from(elements);
}

/**
 * Extract property-value pairs from code snippet
 * Looks for patterns like "vis-height=h-28, vis-iconbutton=False, interaction=Default"
 * For boolean values (True/False, true/false), automatically adds both values
 */
function extractPropertiesFromSnippet(rawStylesheet: string): Map<string, Set<string>> {
  const properties = new Map<string, Set<string>>();
  
  // Pattern for property=value pairs
  const propValueRegex = /([a-zA-Z][\w-]*)=([^,\s"<>]+)/g;
  let match;
  
  while ((match = propValueRegex.exec(rawStylesheet)) !== null) {
    const propName = match[1];
    const propValue = match[2];
    
    // Skip certain prefixes that aren't variant properties
    if (propName.startsWith('data-') || propName === 'class' || propName === 'className') {
      continue;
    }
    
    if (!properties.has(propName)) {
      properties.set(propName, new Set());
    }
    
    // Check if it's a boolean value - if so, add both true and false
    const lowerValue = propValue.toLowerCase();
    if (lowerValue === 'true' || lowerValue === 'false') {
      properties.get(propName)!.add('true');
      properties.get(propName)!.add('false');
    } else {
      properties.get(propName)!.add(propValue);
    }
  }
  
  return properties;
}

/**
 * Extract DOM element names from the raw JSON output
 * Looks for "name" fields in the children array
 */
function extractDOMElementsFromRaw(rawStylesheet: string): string[] {
  const elements = new Set<string>();
  
  // Pattern for "name": "element-name" in JSON
  const nameRegex = /"name":\s*"([^"]+)"/g;
  let match;
  
  while ((match = nameRegex.exec(rawStylesheet)) !== null) {
    const name = match[1];
    // Skip names that look like variant combinations (contain =)
    if (!name.includes('=') && name.length < 50) {
      elements.add(name);
    }
  }
  
  return Array.from(elements);
}

/**
 * Check if a property name suggests it should have prefix mode (for interaction states)
 */
function shouldHavePrefixes(propName: string): boolean {
  const interactiveProps = ['interaction', 'state'];
  return interactiveProps.some(p => propName.toLowerCase() === p);
}

/**
 * Get suggested prefix for a value name
 */
function getSuggestedPrefix(valueName: string): string {
  const lower = valueName.toLowerCase();
  if (lower === 'hover') return 'hover:';
  if (lower === 'active' || lower === 'pressed') return 'active:';
  if (lower === 'focus' || lower === 'focused') return 'focus:';
  if (lower === 'disabled') return 'disabled:';
  return ''; // Default/normal state has no prefix
}

/**
 * Create a default prefixed classes entry (base with no prefix)
 */
function createDefaultPrefixedClasses(): CVAPrefixedClasses {
  return {
    id: generateId(),
    prefix: '',
    classes: [],
  };
}

/**
 * Create variant configs from extracted properties
 */
function createVariantsFromProperties(properties: Map<string, Set<string>>): CVAVariantConfig[] {
  const variants: CVAVariantConfig[] = [];
  
  properties.forEach((values, propName) => {
    const variant: CVAVariantConfig = {
      id: generateId(),
      name: propName,
      properties: [{
        id: generateId(),
        name: propName,
        values: Array.from(values).sort().map(value => ({
          id: generateId(),
          name: value,
          prefixedClasses: [createDefaultPrefixedClasses()],
        })),
      }],
      domMappings: [],
    };
    variants.push(variant);
  });
  
  return variants;
}

/**
 * Create initial CVA config
 */
function createInitialConfig(): CVAConfig {
  return {
    componentName: "Component",
    baseClasses: [],
    variants: [],
    compoundVariants: [],
    defaultVariants: {},
  };
}

/**
 * Create initial CVA state
 */
function createInitialState(): CVAState {
  return {
    mode: "mapping",
    extractorResult: null,
    componentProperties: null,
    extractedClasses: [],
    config: createInitialConfig(),
    isClassModalOpen: false,
    classModalTarget: null,
  };
}

/**
 * Hook for managing CVA tool state
 */
export function useCVAState(): CVAState & CVAActions {
  const [state, setState] = useState<CVAState>(createInitialState);

  // Mode
  const setMode = useCallback((mode: CVAMode) => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  // Extractor data
  const setExtractorResult = useCallback((result: MultiFormatExtractionResult | null) => {
    setState(prev => {
      if (!result) {
        return {
          ...prev,
          extractorResult: null,
          componentProperties: null,
          extractedClasses: [],
        };
      }

      // Extract classes from Tailwind output
      const classNames = extractClassesFromStylesheet(result.tailwind.stylesheet);
      
      // Create ExtractedClass objects with categorization
      const extractedClasses: ExtractedClass[] = classNames.map((className, index) => ({
        id: `class-${index}-${className}`,
        className,
        category: categorizeClass(className),
        isSelected: true, // All selected as base by default
        isUsedInVariant: false,
      }));

      // Extract properties from raw code snippet
      const snippetProperties = extractPropertiesFromSnippet(result.raw?.stylesheet || "");
      
      // Also merge properties from componentProperties (works better for instances)
      const componentProps = result.componentProperties;
      if (componentProps?.definitions) {
        for (const def of componentProps.definitions) {
          // Only add if not already extracted from snippet
          if (!snippetProperties.has(def.name)) {
            const values = new Set<string>();
            
            // Add variant options if available
            if (def.variantOptions) {
              def.variantOptions.forEach(v => {
                const lower = v.toLowerCase();
                if (lower === 'true' || lower === 'false') {
                  values.add('true');
                  values.add('false');
                } else {
                  values.add(v);
                }
              });
            }
            // For boolean type, add true/false
            else if (def.type === 'BOOLEAN') {
              values.add('true');
              values.add('false');
            }
            // Use default value if no options
            else if (def.defaultValue !== undefined) {
              values.add(String(def.defaultValue));
            }
            
            if (values.size > 0) {
              snippetProperties.set(def.name, values);
            }
          } else {
            // Merge variant options into existing property
            if (def.variantOptions) {
              const existing = snippetProperties.get(def.name)!;
              def.variantOptions.forEach(v => {
                const lower = v.toLowerCase();
                if (lower === 'true' || lower === 'false') {
                  existing.add('true');
                  existing.add('false');
                } else {
                  existing.add(v);
                }
              });
            }
          }
        }
      }
      
      const autoVariants = createVariantsFromProperties(snippetProperties);

      return {
        ...prev,
        extractorResult: result,
        componentProperties: result.componentProperties || null,
        extractedClasses,
        config: {
          ...prev.config,
          componentName: result.componentName || "Component",
          // Always recreate variants from new extraction
          variants: autoVariants,
          // Reset compound and default variants on new extraction
          compoundVariants: [],
          defaultVariants: {},
        },
      };
    });
  }, []);

  // Base classes
  const toggleBaseClass = useCallback((classId: string) => {
    setState(prev => ({
      ...prev,
      extractedClasses: prev.extractedClasses.map(cls =>
        cls.id === classId && !cls.isUsedInVariant
          ? { ...cls, isSelected: !cls.isSelected }
          : cls
      ),
    }));
  }, []);

  const selectAllBaseClasses = useCallback((category?: ClassCategory) => {
    setState(prev => ({
      ...prev,
      extractedClasses: prev.extractedClasses.map(cls =>
        (!category || cls.category === category) && !cls.isUsedInVariant
          ? { ...cls, isSelected: true }
          : cls
      ),
    }));
  }, []);

  const deselectAllBaseClasses = useCallback((category?: ClassCategory) => {
    setState(prev => ({
      ...prev,
      extractedClasses: prev.extractedClasses.map(cls =>
        (!category || cls.category === category)
          ? { ...cls, isSelected: false }
          : cls
      ),
    }));
  }, []);

  // Helper to create empty variant
  const createEmptyVariant = useCallback((): CVAVariantConfig => ({
    id: generateId(),
    name: "variant",
    properties: [{
      id: generateId(),
      name: "value",
      values: [{
        id: generateId(),
        name: "default",
        prefixedClasses: [createDefaultPrefixedClasses()],
      }],
    }],
    domMappings: [],
  }), []);

  // Variants
  const addVariant = useCallback(() => {
    setState(prev => {
      const newVariant = createEmptyVariant();
      return {
        ...prev,
        config: {
          ...prev.config,
          variants: [...prev.config.variants, newVariant],
        },
      };
    });
  }, [createEmptyVariant]);

  const removeVariant = useCallback((variantId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.filter(v => v.id !== variantId),
      },
    }));
  }, []);

  const duplicateVariant = useCallback((variantId: string) => {
    setState(prev => {
      const variantToDuplicate = prev.config.variants.find(v => v.id === variantId);
      if (!variantToDuplicate) return prev;

      const newVariant: CVAVariantConfig = {
        ...JSON.parse(JSON.stringify(variantToDuplicate)),
        id: generateId(),
        name: `${variantToDuplicate.name} (copy)`,
      };

      // Regenerate IDs for nested objects
      newVariant.properties = newVariant.properties.map(prop => ({
        ...prop,
        id: generateId(),
        values: prop.values.map(val => ({ ...val, id: generateId() })),
      }));

      return {
        ...prev,
        config: {
          ...prev.config,
          variants: [...prev.config.variants, newVariant],
        },
      };
    });
  }, []);

  const renameVariant = useCallback((variantId: string, name: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId 
            ? { 
                ...v, 
                name,
                // Also update the first property name to match (they should stay in sync)
                properties: v.properties.map((prop, idx) => 
                  idx === 0 ? { ...prop, name } : prop
                )
              } 
            : v
        ),
      },
    }));
  }, []);

  // Variant properties
  const addProperty = useCallback((variantId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: [
                  ...v.properties,
                  {
                    id: generateId(),
                    name: "property",
                    values: [{ 
                      id: generateId(), 
                      name: "default", 
                      prefixedClasses: [createDefaultPrefixedClasses()] 
                    }],
                  },
                ],
              }
            : v
        ),
      },
    }));
  }, []);

  const removeProperty = useCallback((variantId: string, propertyId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? { ...v, properties: v.properties.filter(p => p.id !== propertyId) }
            : v
        ),
      },
    }));
  }, []);

  const renameProperty = useCallback((variantId: string, propertyId: string, name: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: v.properties.map(p =>
                  p.id === propertyId ? { ...p, name } : p
                ),
              }
            : v
        ),
      },
    }));
  }, []);

  // Set all values for a property (when switching property name)
  const setPropertyValues = useCallback((variantId: string, propertyId: string, valueNames: string[]) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: v.properties.map(p =>
                  p.id === propertyId
                    ? {
                        ...p,
                        values: valueNames.map(name => ({
                          id: generateId(),
                          name,
                          prefixedClasses: [createDefaultPrefixedClasses()],
                        })),
                      }
                    : p
                ),
              }
            : v
        ),
      },
    }));
  }, []);

  // Property values
  const addPropertyValue = useCallback((variantId: string, propertyId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: v.properties.map(p =>
                  p.id === propertyId
                    ? {
                        ...p,
                        values: [
                          ...p.values,
                          { 
                            id: generateId(), 
                            name: "value", 
                            prefixedClasses: [createDefaultPrefixedClasses()] 
                          },
                        ],
                      }
                    : p
                ),
              }
            : v
        ),
      },
    }));
  }, []);

  const removePropertyValue = useCallback((variantId: string, propertyId: string, valueId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: v.properties.map(p =>
                  p.id === propertyId
                    ? { ...p, values: p.values.filter(val => val.id !== valueId) }
                    : p
                ),
              }
            : v
        ),
      },
    }));
  }, []);

  const renamePropertyValue = useCallback((variantId: string, propertyId: string, valueId: string, name: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: v.properties.map(p =>
                  p.id === propertyId
                    ? {
                        ...p,
                        values: p.values.map(val =>
                          val.id === valueId ? { ...val, name } : val
                        ),
                      }
                    : p
                ),
              }
            : v
        ),
      },
    }));
  }, []);

  // Helper to collect all used classes from variants
  const collectUsedClasses = useCallback((variants: CVAVariantConfig[]): Set<string> => {
    const usedClasses = new Set<string>();
    variants.forEach(v => {
      v.properties.forEach(p => {
        p.values.forEach(val => {
          val.prefixedClasses.forEach(pc => {
            pc.classes.forEach(cls => usedClasses.add(cls));
          });
        });
      });
    });
    return usedClasses;
  }, []);

  // Add a new prefix slot to a value
  const addPrefixSlot = useCallback((variantId: string, propertyId: string, valueId: string) => {
    setState(prev => {
      const newVariants = prev.config.variants.map(v =>
        v.id === variantId
          ? {
              ...v,
              properties: v.properties.map(p =>
                p.id === propertyId
                  ? {
                      ...p,
                      values: p.values.map(val =>
                        val.id === valueId
                          ? {
                              ...val,
                              prefixedClasses: [
                                ...val.prefixedClasses,
                                createDefaultPrefixedClasses(),
                              ],
                            }
                          : val
                      ),
                    }
                  : p
              ),
            }
          : v
      );

      return {
        ...prev,
        config: {
          ...prev.config,
          variants: newVariants,
        },
      };
    });
  }, []);

  // Remove a prefix slot from a value
  const removePrefixSlot = useCallback((variantId: string, propertyId: string, valueId: string, prefixSlotId: string) => {
    setState(prev => {
      const newVariants = prev.config.variants.map(v =>
        v.id === variantId
          ? {
              ...v,
              properties: v.properties.map(p =>
                p.id === propertyId
                  ? {
                      ...p,
                      values: p.values.map(val =>
                        val.id === valueId
                          ? {
                              ...val,
                              prefixedClasses: val.prefixedClasses.filter(pc => pc.id !== prefixSlotId),
                            }
                          : val
                      ),
                    }
                  : p
              ),
            }
          : v
      );

      // Update used classes
      const usedClasses = collectUsedClasses(newVariants);
      const newExtractedClasses = prev.extractedClasses.map(cls => ({
        ...cls,
        isUsedInVariant: usedClasses.has(cls.className),
        isSelected: usedClasses.has(cls.className) ? false : cls.isSelected,
      }));

      return {
        ...prev,
        config: {
          ...prev.config,
          variants: newVariants,
        },
        extractedClasses: newExtractedClasses,
      };
    });
  }, [collectUsedClasses]);

  // Set prefix for a specific prefix slot
  const setPrefixSlotPrefix = useCallback(
    (variantId: string, propertyId: string, valueId: string, prefixSlotId: string, prefix: string) => {
      setState(prev => ({
        ...prev,
        config: {
          ...prev.config,
          variants: prev.config.variants.map(v =>
            v.id === variantId
              ? {
                  ...v,
                  properties: v.properties.map(p =>
                    p.id === propertyId
                      ? {
                          ...p,
                          values: p.values.map(val =>
                            val.id === valueId
                              ? {
                                  ...val,
                                  prefixedClasses: val.prefixedClasses.map(pc =>
                                    pc.id === prefixSlotId ? { ...pc, prefix } : pc
                                  ),
                                }
                              : val
                          ),
                        }
                      : p
                  ),
                }
              : v
          ),
        },
      }));
    },
    []
  );

  // Set classes for a specific prefix slot
  const setPrefixSlotClasses = useCallback(
    (variantId: string, propertyId: string, valueId: string, prefixSlotId: string, classes: string[]) => {
      setState(prev => {
        const newVariants = prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: v.properties.map(p =>
                  p.id === propertyId
                    ? {
                        ...p,
                        values: p.values.map(val =>
                          val.id === valueId
                            ? {
                                ...val,
                                prefixedClasses: val.prefixedClasses.map(pc =>
                                  pc.id === prefixSlotId ? { ...pc, classes } : pc
                                ),
                              }
                            : val
                        ),
                      }
                    : p
                ),
              }
            : v
        );

        // Update used classes
        const usedClasses = collectUsedClasses(newVariants);
        const newExtractedClasses = prev.extractedClasses.map(cls => ({
          ...cls,
          isUsedInVariant: usedClasses.has(cls.className),
          isSelected: usedClasses.has(cls.className) ? false : cls.isSelected,
        }));

        return {
          ...prev,
          config: {
            ...prev.config,
            variants: newVariants,
          },
          extractedClasses: newExtractedClasses,
        };
      });
    },
    [collectUsedClasses]
  );

  // Compound variants
  const addCompoundVariant = useCallback(() => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        compoundVariants: [
          ...prev.config.compoundVariants,
          {
            id: generateId(),
            conditions: [{ id: generateId(), propertyName: "", propertyValue: "" }],
            classes: [],
          },
        ],
      },
    }));
  }, []);

  const removeCompoundVariant = useCallback((ruleId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        compoundVariants: prev.config.compoundVariants.filter(r => r.id !== ruleId),
      },
    }));
  }, []);

  const addCompoundCondition = useCallback((ruleId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        compoundVariants: prev.config.compoundVariants.map(r =>
          r.id === ruleId
            ? {
                ...r,
                conditions: [
                  ...r.conditions,
                  { id: generateId(), propertyName: "", propertyValue: "" },
                ],
              }
            : r
        ),
      },
    }));
  }, []);

  const removeCompoundCondition = useCallback((ruleId: string, conditionId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        compoundVariants: prev.config.compoundVariants.map(r =>
          r.id === ruleId
            ? { ...r, conditions: r.conditions.filter(c => c.id !== conditionId) }
            : r
        ),
      },
    }));
  }, []);

  const updateCompoundCondition = useCallback((ruleId: string, conditionId: string, propertyName: string, propertyValue: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        compoundVariants: prev.config.compoundVariants.map(r =>
          r.id === ruleId
            ? {
                ...r,
                conditions: r.conditions.map(c =>
                  c.id === conditionId ? { ...c, propertyName, propertyValue } : c
                ),
              }
            : r
        ),
      },
    }));
  }, []);

  const setCompoundVariantClasses = useCallback((ruleId: string, classes: string[]) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        compoundVariants: prev.config.compoundVariants.map(r =>
          r.id === ruleId ? { ...r, classes } : r
        ),
      },
    }));
  }, []);

  // Default variants
  const setDefaultVariant = useCallback((propertyName: string, value: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        defaultVariants: {
          ...prev.config.defaultVariants,
          [propertyName]: value,
        },
      },
    }));
  }, []);

  const removeDefaultVariant = useCallback((propertyName: string) => {
    setState(prev => {
      const { [propertyName]: _, ...rest } = prev.config.defaultVariants;
      return {
        ...prev,
        config: {
          ...prev.config,
          defaultVariants: rest,
        },
      };
    });
  }, []);

  // Class modal
  const openClassModal = useCallback((variantId: string, propertyId: string, valueId: string, prefixSlotId: string) => {
    setState(prev => ({
      ...prev,
      isClassModalOpen: true,
      classModalTarget: { variantId, propertyId, valueId, prefixSlotId },
    }));
  }, []);

  const closeClassModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isClassModalOpen: false,
      classModalTarget: null,
    }));
  }, []);

  // Component name
  const setComponentName = useCallback((name: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        componentName: name,
      },
    }));
  }, []);

  // Reset
  const resetConfig = useCallback(() => {
    setState(prev => ({
      ...prev,
      config: createInitialConfig(),
      extractedClasses: prev.extractedClasses.map(cls => ({
        ...cls,
        isSelected: true,
        isUsedInVariant: false,
      })),
    }));
  }, []);

  // Computed: base classes (selected and not used in variants)
  const computedBaseClasses = useMemo(() => {
    return state.extractedClasses
      .filter(cls => cls.isSelected && !cls.isUsedInVariant)
      .map(cls => cls.className);
  }, [state.extractedClasses]);

  // Update config.baseClasses whenever computed changes
  useMemo(() => {
    setState(prev => {
      if (JSON.stringify(prev.config.baseClasses) === JSON.stringify(computedBaseClasses)) {
        return prev;
      }
      return {
        ...prev,
        config: {
          ...prev.config,
          baseClasses: computedBaseClasses,
        },
      };
    });
  }, [computedBaseClasses]);

  return {
    ...state,
    setMode,
    setExtractorResult,
    toggleBaseClass,
    selectAllBaseClasses,
    deselectAllBaseClasses,
    addVariant,
    removeVariant,
    duplicateVariant,
    renameVariant,
    addProperty,
    removeProperty,
    renameProperty,
    setPropertyValues,
    addPropertyValue,
    removePropertyValue,
    renamePropertyValue,
    addPrefixSlot,
    removePrefixSlot,
    setPrefixSlotPrefix,
    setPrefixSlotClasses,
    addCompoundVariant,
    removeCompoundVariant,
    addCompoundCondition,
    removeCompoundCondition,
    updateCompoundCondition,
    setCompoundVariantClasses,
    setDefaultVariant,
    removeDefaultVariant,
    openClassModal,
    closeClassModal,
    setComponentName,
    resetConfig,
  };
}

