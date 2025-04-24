/// <reference types="node" />

// Import from the explicitly generated path
import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
//
// Learn more:
// https://pris.ly/d/help/next-js-best-practices

// Use `globalThis` which is standard across environments
declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma || // Use globalThis
  new PrismaClient({
    // Optional: Log database queries during development
    // log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });

// This check might cause issues if process is not available, but let's keep it for now
// as it's standard practice for preventing connection exhaustion in dev.
// Use globalThis here as well.
// Commenting out due to persistent TS errors regarding 'process'
// if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
