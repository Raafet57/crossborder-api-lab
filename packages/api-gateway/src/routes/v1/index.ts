import { Router } from 'express';
import { networksRouter } from './networks';
import { quotesRouter } from './quotes';
import { paymentsRouter } from './payments';

const router = Router();

router.use('/networks', networksRouter);
router.use('/quotes', quotesRouter);
router.use('/payments', paymentsRouter);

export const v1Router = router;
