import * as React from 'react';
import renderer from 'react-test-renderer';

import { MonoText } from '../StyledText';

it('renders correctly', () => {
  const tree = renderer.create(<MonoText>Snapshot test!</MonoText>).toJSON();
  expect(tree).toMatchSnapshot();
});

it('applies SpaceMono font family', () => {
  const tree = renderer.create(<MonoText>Font test</MonoText>).toJSON();
  const styles = Array.isArray((tree as any).props.style)
    ? (tree as any).props.style
    : [(tree as any).props.style];
  const hasSpaceMono = styles.some(
    (s: any) => s && s.fontFamily === 'SpaceMono'
  );
  expect(hasSpaceMono).toBe(true);
});
