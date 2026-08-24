import type { ReactTestRendererJSON } from 'react-test-renderer';

export type HostJSON = ReactTestRendererJSON | ReactTestRendererJSON[] | null;

/** Children of a host JSON node (empty array when it has none). */
export function hostChildren(node: HostJSON): ReactTestRendererJSON[] {
  if (node == null || Array.isArray(node)) {
    throw new Error('Expected a single host node.');
  }
  return (node.children ?? []) as ReactTestRendererJSON[];
}

/** First host child of a node. */
export function hostChild(node: HostJSON): ReactTestRendererJSON {
  const children = hostChildren(node);
  const first = children[0];
  if (!first || typeof first === 'string') {
    throw new Error('Expected a host element child.');
  }
  return first;
}

/** All descendant host elements whose style matches a predicate. */
export function collectStyled(
  node: ReactTestRendererJSON,
  predicate: (style: unknown) => boolean
): ReactTestRendererJSON[] {
  const found: ReactTestRendererJSON[] = [];
  if (predicate(node.props?.style)) {
    found.push(node);
  }
  for (const child of node.children ?? []) {
    if (typeof child !== 'string') {
      found.push(...collectStyled(child, predicate));
    }
  }
  return found;
}
