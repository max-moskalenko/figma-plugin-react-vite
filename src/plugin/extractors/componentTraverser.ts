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
 * Recursively traverse a Figma node and build a tree structure
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
 * Traverse multiple selected nodes
 */
export function traverseSelection(selection: readonly SceneNode[]): ExtractedNode[] {
  return selection.map((node) => traverseComponent(node));
}

