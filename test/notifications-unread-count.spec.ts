import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('NotificationsService.unreadCount (P0 auditoria)', () => {
  let service: NotificationsService;
  const prisma = {
    notification: {
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(prisma as any);
  });

  it('retorna count 0 quando não há notificações não lidas', async () => {
    prisma.notification.count.mockResolvedValue(0);
    const result = await service.unreadCount('company-1');
    expect(result).toEqual({ count: 0 });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { companyId: 'company-1', read: false },
    });
  });

  it('retorna count N com notificações não lidas', async () => {
    prisma.notification.count.mockResolvedValue(5);
    const result = await service.unreadCount('company-1');
    expect(result).toEqual({ count: 5 });
  });

  it('isola por empresa (tenant)', async () => {
    prisma.notification.count.mockResolvedValue(2);
    await service.unreadCount('company-A');
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { companyId: 'company-A', read: false },
    });
  });

  it('marcar como lida reduz a contagem', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    const read = await service.markRead('company-1', 'n1');
    expect(read).toEqual({ ok: true });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n1', companyId: 'company-1' },
      data: { read: true },
    });
  });
});
