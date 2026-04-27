import { expect, test, vi, describe } from 'vitest';
import { POST } from './route';
import * as queries from '@/lib/queries/manufacturers';

vi.mock('@/lib/queries/manufacturers', () => ({
  createLeadNote: vi.fn().mockResolvedValue([{ id: 1, content: 'Test Note', createdAt: new Date() }]),
}));

describe('POST /api/leads/[leadId]/notes', () => {
  test('returns 201 on success', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ content: 'Test Note' }),
    });
    
    const res = await POST(req, { params: { leadId: '1' } });
    expect(res.status).toBe(201);
    expect(queries.createLeadNote).toHaveBeenCalledWith(1, 'Test Note');
    
    const data = await res.json();
    expect(data.content).toBe('Test Note');
  });

  test('returns 400 on empty content', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ content: '' }),
    });
    
    const res = await POST(req, { params: { leadId: '1' } });
    expect(res.status).toBe(400);
  });
});
