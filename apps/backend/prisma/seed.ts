import { prisma } from '../src/prisma.js';
import { metricRegistry } from '../src/metrics/registry.js';
import { normalizeNullableJson } from '../src/utils/prismaJson.js';

async function main() {
  for (const module of Object.values(metricRegistry)) {
    const computeConfig = normalizeNullableJson(module.definition.computeConfig);
    await prisma.metricDefinition.upsert({
      where: { key: module.definition.key },
      update: {
        name: module.definition.name,
        description: module.definition.description,
        version: module.definition.version,
        units: module.definition.units ?? null,
        computeConfig,
      },
      create: {
        key: module.definition.key,
        name: module.definition.name,
        description: module.definition.description,
        version: module.definition.version,
        units: module.definition.units ?? null,
        computeConfig,
      },
    });
  }

  console.log('Seeded metric definitions');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
