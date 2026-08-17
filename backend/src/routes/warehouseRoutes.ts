import { Router } from 'express';
import {
  createOrderHandler,
  allocateOrderHandler,
  generatePickTaskHandler,
} from '../controllers/warehouseController';

const router = Router();

router.post('/orders', createOrderHandler);
router.post('/orders/:orderId/allocate', allocateOrderHandler);
router.post('/orders/:orderId/pick-task', generatePickTaskHandler);

export default router;