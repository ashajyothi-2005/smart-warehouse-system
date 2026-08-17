import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { calculatePriorityScore } from '../engine/priorityEngine';
import { allocateOrderInventory } from '../engine/allocationStrategy';
import { generateOptimizedPickPath } from '../engine/routeOptimizer';
import { emitWarehouseEvent } from '../websocket/socketServer';

const prisma = new PrismaClient();

export async function createOrderHandler(req: Request, res: Response) {
  try {
    const { orderNumber, customerTier, slaDeadline, totalValue, items } = req.body;

    const score = calculatePriorityScore({
      customerTier,
      totalValue,
      slaDeadline: new Date(slaDeadline),
    });

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerTier,
        slaDeadline: new Date(slaDeadline),
        totalValue,
        priorityScore: score,
        orderItems: {
          create: (items || []).map((i: { productId: string; requestedQty: number }) => ({
            productId: i.productId,
            requestedQty: i.requestedQty,
          })),
        },
      },
      include: { orderItems: true },
    });

    emitWarehouseEvent('ORDER_CREATED', order);
    return res.status(201).json(order);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function allocateOrderHandler(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    const result = await allocateOrderInventory(orderId);
    emitWarehouseEvent('ORDER_ALLOCATED', result);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function generatePickTaskHandler(req: Request, res: Response) {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: { include: { product: { include: { inventories: { include: { binLocation: true } } } } } } },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    const binsToVisit = order.orderItems.flatMap((item) =>
      item.product.inventories.map((inv) => inv.binLocation)
    );

    const optimizedPath = generateOptimizedPickPath(binsToVisit);

    const pickTask = await prisma.pickTask.create({
      data: {
        orderId: order.id,
        pickPath: optimizedPath as any,
      },
    });

    emitWarehouseEvent('PICK_TASK_CREATED', pickTask);
    return res.status(201).json(pickTask);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}