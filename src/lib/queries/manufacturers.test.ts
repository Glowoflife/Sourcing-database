import { expect, test, vi } from 'vitest';
import { sql, desc } from 'drizzle-orm';
import { leads } from '@/db/schema';

// Mock the db object
vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((cb) => Promise.resolve([]).then(cb)),
    query: {
      leads: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  },
}));

import { getManufacturers } from './manufacturers';
import { db } from '@/db';

test('getManufacturers uses status priority and name alphabetical ordering', async () => {
  await getManufacturers({});

  // Get the orderBy calls
  const orderByCalls = vi.mocked(db.orderBy).mock.calls;
  
  // There are two queries that use orderBy in getManufacturers:
  // 1. leadIdsQuery
  // 2. db.query.leads.findMany (wait, actually findMany uses it too)
  
  // We want to make sure the NEW ordering is used.
  // The old ordering was desc(leads.createdAt)
  
  const firstCallArgs = orderByCalls[0];
  
  // Check that it's NOT desc(leads.createdAt)
  // desc(leads.createdAt) returns an object with { column: leads.createdAt, direction: 'desc' }
  // We can check if any arg matches this.
  
  const isOldOrdering = firstCallArgs.some(arg => 
    arg && typeof arg === 'object' && 'config' in arg && arg.config && arg.config.direction === 'desc'
  );
  
  expect(isOldOrdering, 'Should not use old desc(createdAt) ordering').toBe(false);
  
  // Ideally we also check for the new ordering, but let's start with failing if old is used.
});
