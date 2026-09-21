import * as argon2 from 'argon2';

import { User } from '../entities';

import type { DataSource } from 'typeorm';

/** Long-lived privileged credential, so stricter than the login DTO's 8. */
const MIN_PASSWORD_LENGTH = 12;

/**
 * Creates the first admin. A fresh install has no users at all, so without
 * this there is no way to log in and nothing else in the CMS is reachable.
 *
 * Idempotent in the strict sense: an existing user with that email is left
 * exactly as it is — same password, same role, same status. Re-seeding must
 * never reset a rotated credential or silently re-promote an account somebody
 * deliberately demoted, which is why this does not "fix up" what it finds.
 */
export async function seedAdmin(dataSource: DataSource): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email && !password) {
    console.warn(
      'Skipping admin seed: BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are unset.\n' +
        '  Set both in apps/backend/.env to create the first admin, then re-run `pnpm seed`.',
    );
    return;
  }

  // Set-but-incomplete is a mistake, not a decision to skip.
  if (!email || !password) {
    throw new Error(
      'BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must both be set, or neither.',
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `BOOTSTRAP_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  const repository = dataSource.getRepository(User);

  // `email` is CITEXT, so this match is case-insensitive in the database and
  // cannot disagree with the unique index.
  const existing = await repository.findOne({ where: { email } });

  if (existing) {
    console.warn(`Admin seed: ${email} already exists; leaving it untouched.`);
    return;
  }

  await repository.save(
    repository.create({
      email,
      name: 'Administrator',
      role: 'admin',
      // `active`, not the column default of `invited` — an invited user cannot
      // log in, which would defeat the point of bootstrapping one.
      status: 'active',
      passwordHash: await argon2.hash(password),
    }),
  );

  console.warn(`Admin seed: created ${email}.`);
}
