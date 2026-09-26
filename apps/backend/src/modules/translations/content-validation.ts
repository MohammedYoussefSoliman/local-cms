import { TYPE, parse } from '@formatjs/icu-messageformat-parser';
import { UnprocessableEntityException } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

import type { ContentType } from '@cms/domain';

import type { MessageFormatElement } from '@formatjs/icu-messageformat-parser';

/**
 * Both parsers are pinned below their latest major on purpose.
 * `@formatjs/icu-messageformat-parser@3` and `sanitize-html@2.17.7` (through
 * `htmlparser2@12`) are ESM-only, and this package is built and tested as
 * CommonJS against a `node >=20` engine floor — `require(esm)` does not exist
 * there, and Jest does not transform `node_modules`. Upgrading either one means
 * moving the backend to ESM first, not relaxing a test config.
 */

/**
 * What a `rich_text` value may contain.
 *
 * An allowlist, not a blocklist: a blocklist is a list of the attacks someone
 * thought of. This HTML is rendered by the dashboard's preview *and* by every
 * client app that pulls the bundle, so a stored `<script>` is stored XSS with a
 * distribution channel.
 */
const RICH_TEXT_TAGS = [
  'a',
  'b',
  'br',
  'code',
  'em',
  'i',
  'li',
  'ol',
  'p',
  's',
  'span',
  'strong',
  'u',
  'ul',
];

const RICH_TEXT_POLICY: sanitizeHtml.IOptions = {
  allowedTags: RICH_TEXT_TAGS,
  allowedAttributes: { a: ['href', 'title', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
};

type IcuReference = {
  value: string;
  localeCode: string;
};

/**
 * Validates a value against its entry's `contentType` and returns what should
 * actually be stored. 422 on every failure: the request is well-formed and the
 * caller is allowed to make it — it is the *content* the domain refuses
 * (HTTP contract Rule 6).
 */
export function prepareValue(options: {
  contentType: ContentType;
  value: string;
  localeCode: string;
  /**
   * The same entry's value in the app's default language, when there is one.
   * ICU placeholder parity is checked against it — see `assertPlaceholderParity`.
   */
  reference: IcuReference | null;
}): string {
  const { contentType, value, localeCode, reference } = options;

  if (contentType === 'icu_message') {
    const elements = parseIcuOrThrow(value, `The ${localeCode} message`);

    if (reference) {
      assertPlaceholderParity(
        collectPlaceholders(elements),
        collectPlaceholders(
          parseIcuOrThrow(
            reference.value,
            `The ${reference.localeCode} message`,
          ),
        ),
        localeCode,
        reference.localeCode,
      );
    }

    return value;
  }

  if (contentType === 'rich_text') {
    const sanitized = sanitizeHtml(value, RICH_TEXT_POLICY);

    /**
     * Sanitizing rewrites as well as strips — `&` becomes `&amp;`, attribute
     * quoting is normalized — so comparing input to output would reject
     * perfectly good copy. What is worth refusing is the case where *nothing*
     * survived: the editor sent markup that is entirely disallowed, and storing
     * an empty string would look like the save worked.
     */
    if (value.trim().length > 0 && sanitized.trim().length === 0) {
      throw new UnprocessableEntityException(
        'This rich text contains no permitted markup. Allowed tags: ' +
          `${RICH_TEXT_TAGS.join(', ')}.`,
      );
    }

    return sanitized;
  }

  // `text` is stored as typed. It is never interpolated as markup, so there is
  // nothing to parse and nothing to sanitize.
  return value;
}

function parseIcuOrThrow(
  value: string,
  subject: string,
): MessageFormatElement[] {
  try {
    return parse(value);
  } catch (error) {
    throw new UnprocessableEntityException(
      `${subject} is not valid ICU MessageFormat: ${
        error instanceof Error ? error.message : 'unparseable'
      }.`,
    );
  }
}

/**
 * Every argument name the message interpolates, at any nesting depth. Literal
 * text and `#` carry nothing to interpolate; a tag's name is markup rather than
 * an argument, so only its children are walked.
 */
export function collectPlaceholders(
  elements: MessageFormatElement[],
  found: Set<string> = new Set(),
): Set<string> {
  for (const element of elements) {
    if (element.type === TYPE.literal || element.type === TYPE.pound) continue;

    if (element.type === TYPE.tag) {
      collectPlaceholders(element.children, found);
      continue;
    }

    found.add(element.value);

    if (element.type === TYPE.plural || element.type === TYPE.select) {
      for (const option of Object.values(element.options)) {
        collectPlaceholders(option.value, found);
      }
    }
  }

  return found;
}

/**
 * A translated message must interpolate exactly what the source message does.
 *
 * Without this, a missing placeholder drops a customer's name from one language
 * only, and an extra one throws at render time in the client app — both of them
 * hours after the editor saved, in a place nothing points back here from.
 */
function assertPlaceholderParity(
  candidate: Set<string>,
  reference: Set<string>,
  localeCode: string,
  referenceLocaleCode: string,
): void {
  const missing = [...reference].filter((name) => !candidate.has(name));
  const unexpected = [...candidate].filter((name) => !reference.has(name));

  if (missing.length === 0 && unexpected.length === 0) return;

  const problems = [
    missing.length > 0 && `does not use ${format(missing)}`,
    unexpected.length > 0 && `adds ${format(unexpected)}`,
  ].filter((part): part is string => typeof part === 'string');

  throw new UnprocessableEntityException(
    `The ${localeCode} message ${problems.join(' and ')}, which the ` +
      `${referenceLocaleCode} message does not match.`,
  );
}

function format(names: string[]): string {
  return names.map((name) => `{${name}}`).join(', ');
}
