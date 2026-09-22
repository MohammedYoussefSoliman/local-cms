import { parse } from '@formatjs/icu-messageformat-parser';
import { UnprocessableEntityException } from '@nestjs/common';

import { collectPlaceholders, prepareValue } from './content-validation';

describe('collectPlaceholders', () => {
  it('finds arguments nested inside plural and select options', () => {
    const names = collectPlaceholders(
      parse(
        'Hi {name}, {count, plural, one {# {thing}} other {# {things}}} and ' +
          '{gender, select, female {{her}} other {{them}}}',
      ),
    );

    expect([...names].sort()).toEqual([
      'count',
      'gender',
      'her',
      'name',
      'them',
      'thing',
      'things',
    ]);
  });

  it('ignores literals and the plural `#`', () => {
    // `#` is the plural's own count, not a separate argument — counting it
    // would make every plural message mismatch every other language's.
    expect([...collectPlaceholders(parse('{n, plural, other {# left}}'))]).toEqual(
      ['n'],
    );
  });
});

describe('prepareValue — text', () => {
  it('stores the value untouched', () => {
    expect(
      prepareValue({
        contentType: 'text',
        value: '  <b>not markup</b> & co  ',
        localeCode: 'en',
        reference: null,
      }),
    ).toBe('  <b>not markup</b> & co  ');
  });
});

describe('prepareValue — icu_message', () => {
  const base = { contentType: 'icu_message' as const, localeCode: 'ar' };

  it('accepts a well-formed message', () => {
    expect(
      prepareValue({ ...base, value: 'مرحبا {name}', reference: null }),
    ).toBe('مرحبا {name}');
  });

  it('rejects a malformed message with 422', () => {
    expect(() =>
      prepareValue({ ...base, value: 'مرحبا {name', reference: null }),
    ).toThrow(UnprocessableEntityException);
  });

  it('rejects a message missing a placeholder the default locale uses', () => {
    expect(() =>
      prepareValue({
        ...base,
        value: 'مرحبا',
        reference: { value: 'Hello {name}', localeCode: 'en' },
      }),
    ).toThrow(/does not use \{name\}/);
  });

  it('rejects a message that invents a placeholder', () => {
    // The client app calls `t('greeting', { name })`. An extra `{title}` has
    // nothing to interpolate from and throws at render time, in the customer's
    // browser, hours after this save.
    expect(() =>
      prepareValue({
        ...base,
        value: 'مرحبا {name} {title}',
        reference: { value: 'Hello {name}', localeCode: 'en' },
      }),
    ).toThrow(/adds \{title\}/);
  });

  it('accepts a matching placeholder set in a different order', () => {
    expect(
      prepareValue({
        ...base,
        value: '{count} من {name}',
        reference: { value: 'Hello {name}, {count}', localeCode: 'en' },
      }),
    ).toBe('{count} من {name}');
  });

  it('reports the reference locale when the reference itself is malformed', () => {
    expect(() =>
      prepareValue({
        ...base,
        value: 'مرحبا {name}',
        reference: { value: 'Hello {name', localeCode: 'en' },
      }),
    ).toThrow(/The en message is not valid ICU/);
  });
});

describe('prepareValue — rich_text', () => {
  const base = { contentType: 'rich_text' as const, localeCode: 'en' };

  it('keeps allowed markup', () => {
    expect(
      prepareValue({
        ...base,
        value: '<p>Hello <strong>you</strong></p>',
        reference: null,
      }),
    ).toBe('<p>Hello <strong>you</strong></p>');
  });

  it('strips a script tag but keeps the surrounding copy', () => {
    expect(
      prepareValue({
        ...base,
        value: '<p>Hi<script>steal()</script></p>',
        reference: null,
      }),
    ).toBe('<p>Hi</p>');
  });

  it('strips an event handler attribute', () => {
    expect(
      prepareValue({
        ...base,
        value: '<p onclick="steal()">Hi</p>',
        reference: null,
      }),
    ).toBe('<p>Hi</p>');
  });

  it('rejects markup that leaves nothing behind with 422', () => {
    // Storing '' here would look to the editor like the save worked.
    expect(() =>
      prepareValue({ ...base, value: '<script>steal()</script>', reference: null }),
    ).toThrow(UnprocessableEntityException);
  });
});
