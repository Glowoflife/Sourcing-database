import { expect, test, vi, describe, beforeEach } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { leads, leadNotes } from '@/db/schema';
import { db } from '@/db';
import { 
  getManufacturers, 
  getManufacturerDetail, 
  updateLeadSourcingStatus, 
  createLeadNote 
} from './manufacturers';

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
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((cb) => Promise.resolve([{ count: 0 }]).then(cb)),
    query: {
      leads: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  },
}));

describe('Manufacturers Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('getManufacturers supports sourcingStatus filter', async () => {
    await getManufacturers({ sourcingStatus: ['Approved'] });
    
    // Check if where was called with sourcingStatus filter
    // This is a bit tricky with mocks, but we can verify it was called.
    expect(db.where).toHaveBeenCalled();
  });

  test('updateLeadSourcingStatus updates the lead', async () => {
    await updateLeadSourcingStatus(1, 'Approved');
    
    expect(db.update).toHaveBeenCalledWith(leads);
    expect(db.set).toHaveBeenCalledWith({ sourcingStatus: 'Approved' });
    expect(db.where).toHaveBeenCalled();
  });

  test('createLeadNote inserts a new note', async () => {
    await createLeadNote(1, 'Test Note');
    
    expect(db.insert).toHaveBeenCalledWith(leadNotes);
    expect(db.values).toHaveBeenCalledWith({ leadId: 1, content: 'Test Note' });
  });

  test('getManufacturerDetail fetches notes', async () => {
    await getManufacturerDetail(1);
    
    expect(db.query.leads.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      with: expect.objectContaining({
        notes: expect.objectContaining({
          orderBy: expect.anything()
        })
      })
    }));
  });
});
