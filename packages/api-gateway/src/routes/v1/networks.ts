import { Router, Request, Response, NextFunction } from 'express';
import { getAvailableNetworks } from '@crossborder/network-adapters';
import { NetworkResponse, PayerResponse } from '../../types/api';
import { AppError, ErrorCode } from '../../types/errors';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const networks = getAvailableNetworks();

  const response: NetworkResponse[] = networks.map(n => ({
    id: n.id,
    type: n.type,
    displayName: n.displayName,
    supportedCurrencies: n.supportedCurrencies,
    limits: n.limits,
  }));

  res.json({ data: response });
});

router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  const networks = getAvailableNetworks();
  const network = networks.find(n => n.id === req.params.id);

  if (!network) {
    return next(new AppError(ErrorCode.NOT_FOUND, `Network not found: ${req.params.id}`));
  }

  const response: NetworkResponse = {
    id: network.id,
    type: network.type,
    displayName: network.displayName,
    supportedCurrencies: network.supportedCurrencies,
    limits: network.limits,
  };

  res.json(response);
});

router.get('/:id/payers', (req: Request, res: Response, next: NextFunction) => {
  const networks = getAvailableNetworks();
  const network = networks.find(n => n.id === req.params.id);

  if (!network) {
    return next(new AppError(ErrorCode.NOT_FOUND, `Network not found: ${req.params.id}`));
  }

  const response: PayerResponse = {
    networkId: network.id,
    requiredFields: network.requiredFields,
  };

  res.json(response);
});

export const networksRouter = router;
