import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '@crossborder/api-gateway';

describe('API Endpoints', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp({ testMode: true });
  });

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });
  });

  describe('GET /v1/networks', () => {
    it('returns array of networks', async () => {
      const res = await request(app)
        .get('/v1/networks')
        .set('Authorization', 'Bearer test_key');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('includes all network types', async () => {
      const res = await request(app)
        .get('/v1/networks')
        .set('Authorization', 'Bearer test_key');

      const types = res.body.data.map((n: any) => n.type);
      expect(types).toContain('stablecoin');
      expect(types).toContain('card');
    });
  });

  describe('POST /v1/quotes', () => {
    it('creates quote with valid request', async () => {
      const res = await request(app)
        .post('/v1/quotes')
        .set('Authorization', 'Bearer test_key')
        .set('Idempotency-Key', `idemp_${Date.now()}`)
        .send({
          networkId: 'polygon-usdc',
          sourceCurrency: 'USD',
          destCurrency: 'USDC',
          amount: 100,
          amountType: 'SOURCE',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('fxRate');
    });

    it('returns 400 for invalid networkId', async () => {
      const res = await request(app)
        .post('/v1/quotes')
        .set('Authorization', 'Bearer test_key')
        .set('Idempotency-Key', `idemp_${Date.now()}`)
        .send({
          networkId: 'invalid-network',
          sourceCurrency: 'USD',
          destCurrency: 'USDC',
          amount: 100,
          amountType: 'SOURCE',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code');
    });

    it('is idempotent with same key', async () => {
      const idempKey = `idemp_${Date.now()}`;
      const body = {
        networkId: 'polygon-usdc',
        sourceCurrency: 'USD',
        destCurrency: 'USDC',
        amount: 100,
        amountType: 'SOURCE',
      };

      const res1 = await request(app)
        .post('/v1/quotes')
        .set('Authorization', 'Bearer test_key')
        .set('Idempotency-Key', idempKey)
        .send(body);

      const res2 = await request(app)
        .post('/v1/quotes')
        .set('Authorization', 'Bearer test_key')
        .set('Idempotency-Key', idempKey)
        .send(body);

      expect(res1.body.id).toBe(res2.body.id);
    });
  });

  describe('POST /v1/payments', () => {
    let quoteId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/v1/quotes')
        .set('Authorization', 'Bearer test_key')
        .set('Idempotency-Key', `idemp_${Date.now()}`)
        .send({
          networkId: 'polygon-usdc',
          sourceCurrency: 'USD',
          destCurrency: 'USDC',
          amount: 100,
          amountType: 'SOURCE',
        });
      quoteId = res.body.id;
    });

    it('creates payment with valid quote', async () => {
      const res = await request(app)
        .post('/v1/payments')
        .set('Authorization', 'Bearer test_key')
        .set('Idempotency-Key', `idemp_${Date.now()}`)
        .send({
          quoteId,
          payerId: 'payer_polygon_usdc',
          sender: { firstName: 'John', lastName: 'Doe' },
          receiver: { firstName: 'Jane', lastName: 'Smith', walletAddress: '0x123' },
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('status');
    });

    it('returns 404 for invalid quoteId', async () => {
      const res = await request(app)
        .post('/v1/payments')
        .set('Authorization', 'Bearer test_key')
        .set('Idempotency-Key', `idemp_${Date.now()}`)
        .send({
          quoteId: 'invalid_quote',
          payerId: 'payer_polygon_usdc',
          sender: { firstName: 'John', lastName: 'Doe' },
          receiver: { firstName: 'Jane', lastName: 'Smith', walletAddress: '0x123' },
        });

      expect(res.status).toBe(404);
    });
  });

  describe('Error responses', () => {
    it('returns consistent error format', async () => {
      const res = await request(app)
        .get('/v1/payments/invalid_id')
        .set('Authorization', 'Bearer test_key');

      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('message');
    });

    it('includes correlation ID in errors', async () => {
      const correlationId = 'test-correlation-123';
      const res = await request(app)
        .get('/v1/payments/invalid_id')
        .set('Authorization', 'Bearer test_key')
        .set('X-Correlation-Id', correlationId);

      expect(res.headers['x-correlation-id']).toBe(correlationId);
    });
  });
});
