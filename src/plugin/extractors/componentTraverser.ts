export interface ExtractedNode {
  id: string;
  name: string;
  type: string;
  children?: ExtractedNode[];
  // Will be populated by style extractor
  styles?: any;
  // Annotations/comments from Figma
  annotations?: string[];
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
 * 2. Recursively processes all children nodes
 * 3. Preserves the exact tree structure from Figma
 * 4. Extracts annotations (comments/notes) from nodes
 * 
 * NODE METADATA:
 * - id: Unique Figma node ID
 * - name: Node name from Figma
 * - type: Node type (FRAME, TEXT, COMPONENT, etc.)
 * - annotations: Array of annotation strings (comments attached to nodes)
 * - children: Array of child ExtractedNode objects (recursive structure)
 * 
 * NOTE: Styles are NOT extracted here. The styles property is populated later
 * by the style extraction process in plugin.network.ts.
 * 
 * @param node - The Figma SceneNode to traverse
 * @returns ExtractedNode object representing this node and its children
 */
export function traverseComponent(node: SceneNode): ExtractedNode {
  const extracted: ExtractedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    annotations: extractAnnotations(node),
  };

  // Recursively traverse children if the node has them
  if ("children" in node && node.children) {
    extracted.children = node.children.map((child: SceneNode) => traverseComponent(child));
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
export function traverseSelection(selection: readonly SceneNode[]): ExtractedNode[] {
  return selection.map((node) => traverseComponent(node));
}

