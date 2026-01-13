import { Router, Request, Response, NextFunction } from 'express';
import { quoteService } from '../../services/quote';
import { requireScope } from '../../middleware/auth';
import { CreateQuoteRequest, QuoteResponse } from '../../types/api';
import { AppError, ErrorCode } from '../../types/errors';

const router = Router();

router.post(
  '/',
  requireScope('quotes:write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body: CreateQuoteRequest = req.body;

      if (!body.networkId) {
        throw new AppError(ErrorCode.BAD_REQUEST, 'networkId is required');
      }
      if (!body.sourceCurrency || !body.destCurrency) {
        throw new AppError(ErrorCode.BAD_REQUEST, 'sourceCurrency and destCurrency are required');
      }
      if (!body.sourceAmount && !body.destAmount) {
        throw new AppError(ErrorCode.BAD_REQUEST, 'Either sourceAmount or destAmount is required');
      }

      const quote = await quoteService.createQuote({
        networkId: body.networkId,
        sourceAmount: body.sourceAmount,
        destAmount: body.destAmount,
        sourceCurrency: body.sourceCurrency,
        destCurrency: body.destCurrency,
      });

      const response: QuoteResponse = {
        id: quote.id,
        networkId: quote.networkId,
        sourceAmount: quote.sourceAmount,
        sourceCurrency: quote.sourceCurrency,
        destAmount: quote.destAmount,
        destCurrency: quote.destCurrency,
        fxRate: quote.fxRate,
        fee: quote.fee,
        expiresAt: quote.expiresAt.toISOString(),
        createdAt: quote.createdAt.toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id',
  requireScope('quotes:read'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const quote = quoteService.getQuote(req.params.id);

      const response: QuoteResponse = {
        id: quote.id,
        networkId: quote.networkId,
        sourceAmount: quote.sourceAmount,
        sourceCurrency: quote.sourceCurrency,
        destAmount: quote.destAmount,
        destCurrency: quote.destCurrency,
        fxRate: quote.fxRate,
        fee: quote.fee,
        expiresAt: quote.expiresAt.toISOString(),
        createdAt: quote.createdAt.toISOString(),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export const quotesRouter = router;
