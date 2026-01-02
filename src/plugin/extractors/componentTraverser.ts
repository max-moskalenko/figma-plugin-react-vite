/**
 * @file Component Traverser
 * @module plugin/extractors/componentTraverser
 * 
 * Recursively traverses Figma nodes to build a tree structure.
 * Captures node metadata, annotations, icon detection, and component set names.
 * 
 * Key exports:
 * - traverseComponent() - Recursive node traversal
 * - traverseSelection() - Process current selection
 * - ExtractedNode - Tree node interface
 * 
 * Note: Style extraction is done separately in styleExtractor.ts
 */

/**
 * Icon metadata for detected icon components
 */
export interface IconMetadata {
  isIcon: boolean;
  iconName: string;
}

export interface ExtractedNode {
  id: string;
  name: string;
  type: string;
  children?: ExtractedNode[];
  // Will be populated by style extractor
  styles?: any;
  // Annotations/comments from Figma
  annotations?: string[];
  // Icon metadata for detected icons
  icon?: IconMetadata;
  // Parent COMPONENT_SET name (for variant components)
  // Used to generate proper tag names instead of variant property strings
  componentSetName?: string;
}

/**
 * Extracts a clean icon name from a node.
 * Uses parent COMPONENT_SET name for variants/instances, or the node's own name.
 */
function getIconName(node: SceneNode): string {
  // For instances, try to get the parent component set name
  if (node.type === "INSTANCE") {
    const instance = node as InstanceNode;
    const mainComponent = instance.mainComponent;
    // If mainComponent's parent is a COMPONENT_SET, use that name
    if (mainComponent?.parent?.type === "COMPONENT_SET") {
      return mainComponent.parent.name;
    }
    return instance.name || "Icon";
  }
  
  // For components, try parent COMPONENT_SET name
  if (node.type === "COMPONENT") {
    const component = node as ComponentNode;
    if (component.parent?.type === "COMPONENT_SET") {
      return component.parent.name;
    }
  }
  
  return node.name || "Icon";
}

/**
 * Detects if a node is an icon by checking the isIcon component property.
 * 
 * Detection methods:
 * - INSTANCE nodes: Check instance.componentProperties for isIcon=true
 * - Variant COMPONENT nodes: Check parent COMPONENT_SET for isIcon property definition
 * - Non-variant COMPONENT nodes: Check componentPropertyDefinitions for isIcon property
 * 
 * @param node - The Figma SceneNode to check
 * @returns IconMetadata if node is an icon, null otherwise
 */
function detectIcon(node: SceneNode): IconMetadata | null {
  // Check for INSTANCE nodes - use componentProperties directly
  if (node.type === "INSTANCE") {
    const instance = node as InstanceNode;
    const instanceProps = instance.componentProperties;
    
    if (instanceProps) {
      // Find isIcon property (case-insensitive)
      const isIconEntry = Object.entries(instanceProps).find(
        ([key]) => key.toLowerCase() === "isicon"
      );
      
      if (isIconEntry) {
        const [, propValue] = isIconEntry;
        // componentProperties values have a 'value' field
        // Value can be boolean true OR string "True" (for VARIANT type properties)
        const rawValue = typeof propValue === 'object' && 'value' in propValue ? propValue.value : null;
        const isIconTrue = rawValue === true || (typeof rawValue === 'string' && rawValue.toLowerCase() === 'true');
        
        if (isIconTrue) {
          return {
            isIcon: true,
            iconName: getIconName(node),
          };
        }
      }
    }
  }
  
  // Check for COMPONENT nodes
  if (node.type === "COMPONENT") {
    const component = node as ComponentNode;
    
    // For variant components (parent is COMPONENT_SET), check parent's property definitions
    if (component.parent?.type === "COMPONENT_SET") {
      const componentSet = component.parent as ComponentSetNode;
      
      try {
        const props = componentSet.componentPropertyDefinitions;
        
        if (props) {
          // Find isIcon property - check both BOOLEAN and VARIANT types
          const isIconPropEntry = Object.entries(props).find(
            ([key]) => key.toLowerCase() === "isicon"
          );
          
          if (isIconPropEntry) {
            // The variant name contains the property value like "isIcon=True"
            // Parse the component name to get the actual value
            const nameMatch = component.name.match(/isicon\s*=\s*(true|false)/i);
            const isIconTrue = nameMatch && nameMatch[1].toLowerCase() === "true";
            
            if (isIconTrue) {
              return {
                isIcon: true,
                iconName: getIconName(node),
              };
            }
          }
        }
      } catch {
        // Silently ignore errors checking component set
      }
      return null;
    }
    
    // For non-variant components, check componentPropertyDefinitions directly
    try {
      if (component.componentPropertyDefinitions) {
        const props = component.componentPropertyDefinitions;
        
        // Find isIcon property (case-insensitive)
        const hasIsIconProp = Object.entries(props).some(
          ([key, prop]) => prop.type === "BOOLEAN" && key.toLowerCase() === "isicon"
        );
        
        if (hasIsIconProp) {
          return {
            isIcon: true,
            iconName: component.name,
          };
        }
      }
    } catch {
      // Silently ignore errors accessing component property definitions
    }
  }
  
  return null;
}

/**
 * Extracts annotations from a Figma node.
 * Annotations are comments/notes attached to nodes in Figma.
 */
function extractAnnotations(node: SceneNode): string[] {
  const annotations: string[] = [];
  
  // Check if node has annotations property (available in Figma Plugin API)
  if ("annotations" in node && (node as any).annotations) {
    const nodeAnnotations = (node as any).annotations as any[];
    if (Array.isArray(nodeAnnotations) && nodeAnnotations.length > 0) {
      nodeAnnotations.forEach((annotation: any) => {
        // Extract label (main annotation text)
        if (annotation.label) {
          annotations.push(annotation.label);
        }
        // Also include labelMarkdown if available (may contain formatted text)
        if (annotation.labelMarkdown && annotation.labelMarkdown !== annotation.label) {
          annotations.push(annotation.labelMarkdown);
        }
      });
    }
  }
  
  return annotations;
}

/**
 * Recursively traverses a Figma node and builds a tree structure.
 * 
 * This function creates a hierarchical representation of the Figma component structure,
 * preserving parent-child relationships and node metadata. It does NOT extract styles
 * (that's done separately in the extraction pipeline).
 * 
 * TRAVERSAL PROCESS:
 * 1. Creates ExtractedNode with id, name, type, and annotations
 * 2. Detects if node is an icon (via isIcon property)
 * 3. Recursively processes all children nodes
 * 4. Preserves the exact tree structure from Figma
 * 
 * NODE METADATA:
 * - id: Unique Figma node ID
 * - name: Node name from Figma
 * - type: Node type (FRAME, TEXT, COMPONENT, etc.)
 * - annotations: Array of annotation strings (comments attached to nodes)
 * - icon: Icon metadata if node is detected as an icon
 * - children: Array of child ExtractedNode objects (recursive structure)
 * 
 * NOTE: Styles are NOT extracted here. The styles property is populated later
 * by the style extraction process in plugin.network.ts.
 * 
 * @param node - The Figma SceneNode to traverse
 * @returns ExtractedNode object representing this node and its children
 */
export async function traverseComponent(node: SceneNode): Promise<ExtractedNode> {
  const extracted: ExtractedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    annotations: extractAnnotations(node),
  };

  // For variant components (COMPONENT inside COMPONENT_SET), store the parent name
  // This allows DOM generators to use the clean component set name as the tag
  // instead of the variant property string like "type=checkbox, state=default, ..."
  if (node.type === "COMPONENT") {
    const component = node as ComponentNode;
    if (component.parent?.type === "COMPONENT_SET") {
      extracted.componentSetName = component.parent.name;
    }
  }

  // Detect if this node is an icon
  const iconMetadata = detectIcon(node);
  if (iconMetadata) {
    extracted.icon = iconMetadata;
  }

  // Recursively traverse children if the node has them
  if ("children" in node && node.children) {
    extracted.children = await Promise.all(
      node.children.map((child: SceneNode) => traverseComponent(child))
    );
  }

  return extracted;
}

/**
 * Traverses multiple selected Figma nodes and builds tree structures for each.
 * 
 * This is the entry point for component extraction. It processes each selected node
 * independently, creating separate tree structures for each.
 * 
 * USE CASE:
 * When a user selects multiple components or a COMPONENT_SET, this function creates
 * a tree structure for each component variant, which are then processed separately
 * in the extraction pipeline.
 * 
 * @param selection - Array of selected Figma SceneNodes
 * @returns Array of ExtractedNode objects, one for each selected node
 */
export async function traverseSelection(selection: readonly SceneNode[]): Promise<ExtractedNode[]> {
  return await Promise.all(selection.map((node) => traverseComponent(node)));
}

