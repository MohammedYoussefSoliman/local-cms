import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/renderWithProviders';

import { ValueText } from './ValueText';

describe('ValueText', () => {
  /**
   * The invariant this whole component exists for: a value renders in ITS
   * locale's direction, which comes from the locale row — never from the UI
   * language. These two cases fail the day someone reaches for `i18n.dir()`.
   */
  it('renders an RTL value RTL regardless of the UI language', () => {
    renderWithProviders(<ValueText value="مرحباً" direction="rtl" />);

    expect(screen.getByText('مرحباً').closest('[dir]')).toHaveAttribute(
      'dir',
      'rtl',
    );
  });

  it('renders an LTR value LTR regardless of the UI language', () => {
    renderWithProviders(<ValueText value="Add to cart" direction="ltr" />);

    expect(screen.getByText('Add to cart').closest('[dir]')).toHaveAttribute(
      'dir',
      'ltr',
    );
  });

  it('isolates a {placeholder} as its own LTR chip', () => {
    const { container } = renderWithProviders(
      <ValueText value="مرحباً {name}" direction="rtl" />,
    );

    const chips = container.querySelectorAll('span[dir="ltr"]');
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent('{name}');
  });

  it('leaves an ICU message alone — half-highlighting reads as corruption', () => {
    const { container } = renderWithProviders(
      <ValueText value="{count, plural, one{#} other{#}}" direction="ltr" />,
    );

    expect(container.querySelectorAll('span[dir="ltr"]')).toHaveLength(0);
  });

  it('picks out every placeholder in a value that has several', () => {
    const { container } = renderWithProviders(
      <ValueText value="{count} of {total}" direction="ltr" />,
    );

    expect(container.querySelectorAll('span[dir="ltr"]')).toHaveLength(2);
  });
});
