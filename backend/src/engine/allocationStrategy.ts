import { PrismaClient, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function allocateOrderInventory(orderId: string) {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { orderItems: { include: { product: true } } },
    });

    if (!order) throw new Error('Order not found');

    let allFullyAllocated = true;
    let partialAllocationOccurred = false;
    const splitItems: { productId: string; remainingQty: number }[] = [];

    for (const item of order.orderItems) {
      // Find total available inventory across non-quarantined bins
      const inventoryRecords = await tx.inventory.findMany({
        where: {
          productId: item.productId,
          binLocation: { isQuarantined: false },
        },
        include: { binLocation: true },
      });

      let remainingToAllocate = item.requestedQty;
      let totalAllocatedForItem = 0;

      for (const inv of inventoryRecords) {
        const availableStock = inv.quantity - inv.reservedQty;

        if (availableStock > 0 && remainingToAllocate > 0) {
          const allocateQty = Math.min(availableStock, remainingToAllocate);

          // Reserve stock in database
          await tx.inventory.update({
            where: { id: inv.id },
            data: { reservedQty: inv.reservedQty + allocateQty },
          });

          remainingToAllocate -= allocateQty;
          totalAllocatedForItem += allocateQty;
        }

        if (remainingToAllocate === 0) break;
      }

      // Update allocated quantity on order item
      await tx.orderItem.update({
        where: { id: item.id },
        data: { allocatedQty: totalAllocatedForItem },
      });

      if (totalAllocatedForItem < item.requestedQty) {
        allFullyAllocated = false;
        if (totalAllocatedForItem > 0) partialAllocationOccurred = true;

        splitItems.push({
          productId: item.productId,
          remainingQty: item.requestedQty - totalAllocatedForItem,
        });
      }
    }

    // Determine new status & handle order splitting if partial
    let finalStatus: OrderStatus = OrderStatus.ALLOCATED;

    if (!allFullyAllocated) {
      finalStatus = partialAllocationOccurred ? OrderStatus.PARTIALLY_ALLOCATED : OrderStatus.CREATED;

      // Handle split: create a backorder for missing stock
      if (splitItems.length > 0) {
        const backorderNumber = `${order.orderNumber}-BO`;
        await tx.order.create({
          data: {
            orderNumber: backorderNumber,
            customerTier: order.customerTier,
            slaDeadline: order.slaDeadline,
            totalValue: 0,
            isBackorder: true,
            parentOrderId: order.id,
            status: OrderStatus.CREATED,
            orderItems: {
              create: splitItems.map((si) => ({
                productId: si.productId,
                requestedQty: si.remainingQty,
                allocatedQty: 0,
              })),
            },
          },
        });

        // Log exception alert
        await tx.exceptionLog.create({
          data: {
            orderId: order.id,
            type: 'STOCK_MISMATCH',
            description: `Order ${order.orderNumber} partially allocated. Backorder ${backorderNumber} created.`,
          },
        });
      }
    }

    // Update main order status
    return await tx.order.update({
      where: { id: order.id },
      data: { status: finalStatus },
      include: { orderItems: true },
    });
  });
}