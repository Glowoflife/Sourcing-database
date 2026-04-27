import { expect, test, vi, describe } from 'vitest';
import { PUT } from './route';
import * as queries from '@/lib/queries/manufacturers';

vi.mock('@/lib/queries/manufacturers', () => ({
  updateLeadSourcingStatus: vi.fn(),
}));

describe('PUT /api/leads/[leadId]/sourcing-status', () => {
  test('returns 200 on success', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ status: 'Approved' }),
    });
    
    const res = await PUT(req, { params: { leadId: '1' } });
    expect(res.status).toBe(200);
    expect(queries.updateLeadSourcingStatus).toHaveBeenCalledWith(1, 'Approved');
  });

  test('returns 400 on invalid status', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ status: 'Invalid' }),
    });
    
    const res = await PUT(req, { params: { leadId: '1' } });
    expect(res.status).toBe(400);
  });

  test('returns 400 on invalid leadId', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ status: 'Approved' }),
    });
    
    const res = await PUT(req, { params: { leadId: 'abc' } });
    expect(res.status).toBe(400);
  });
});
