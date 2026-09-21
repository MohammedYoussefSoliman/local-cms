import 'reflect-metadata';

import { AppDataSource } from '../data-source';

import { seedAdmin } from './seed-admin';
import { seedLocales } from './seed-locales';

async function run(): Promise<void> {
  await AppDataSource.initialize();
  try {
    await seedLocales(AppDataSource);
    await seedAdmin(AppDataSource);

    console.warn('Seed complete.');
  } finally {
    await AppDataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
