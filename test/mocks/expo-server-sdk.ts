export class Expo {
  static isExpoPushToken(token: any): boolean {
    return typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
  }
  chunkPushNotifications(messages: any[]): any[][] {
    return [messages];
  }
  sendPushNotificationsAsync(messages: any[]): Promise<any[]> {
    return Promise.resolve(messages.map(() => ({ status: 'ok', id: 'mock-ticket-id' })));
  }
}
export type ExpoPushMessage = any;
export type ExpoPushTicket = any;
