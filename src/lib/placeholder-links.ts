export const EXTERNAL_PLACEHOLDER_URL = 'https://example.com';

interface LinkNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: readonly LinkNode[];
}

function replaceExternalLinks(node: LinkNode): void {
  if ((node.tagName === 'a' || node.tagName === 'area') && node.properties) {
    const href = node.properties.href;
    if (typeof href === 'string' && /^(?:[a-z][a-z\d+.-]*:|[\\/]{2})/i.test(href.replace(/[\t\n\r]/g, '').trim())) {
      node.properties.href = EXTERNAL_PLACEHOLDER_URL;
    }
  }
  node.children?.forEach(replaceExternalLinks);
}

export function rehypePlaceholderLinks() {
  return replaceExternalLinks;
}
