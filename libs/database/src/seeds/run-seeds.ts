import 'reflect-metadata';

import { AppDataSource } from '../data-source';

import { seedLocales } from './seed-locales';

async function run(): Promise<void> {
  await AppDataSource.initialize();
  try {
    await seedLocales(AppDataSource);

    console.warn('Seed complete.');
  } finally {
    await AppDataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
