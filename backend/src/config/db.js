import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

let prisma;

const getDatasourceUrl = () => {
  if (process.env.NODE_ENV === 'test' && (process.env.LOCAL_DATABASE_URL || process.env.TEST_DATABASE_URL)) {
    return process.env.LOCAL_DATABASE_URL || process.env.TEST_DATABASE_URL;
  }
  return process.env.DATABASE_URL;
};

const resolvedUrl = getDatasourceUrl();
if (process.env.NODE_ENV === 'test' && resolvedUrl) {
  process.env.DATABASE_URL = resolvedUrl;
  process.env.DIRECT_URL = resolvedUrl;
}

const clientOptions = resolvedUrl ? { datasources: { db: { url: resolvedUrl } } } : {};

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient(clientOptions);
} else {
  if (!global.__prismaClient) {
    global.__prismaClient = new PrismaClient({
      ...clientOptions,
      log: ['error', 'warn'],
    });
  }
  prisma = global.__prismaClient;
}

export default prisma;
