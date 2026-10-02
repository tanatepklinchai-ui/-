self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'พร้อมฉีด', body: 'มีการแจ้งเตือนใหม่' };
  }

  const title = typeof payload.title === 'string' ? payload.title : 'พร้อมฉีด';
  const body = typeof payload.body === 'string' ? payload.body : 'มีการแจ้งเตือนใหม่';
  const url = typeof payload.url === 'string' ? payload.url : '/user/appointment';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      tag: 'promchid-appointment',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/user/appointment', self.location.origin);
  const safeUrl = target.origin === self.location.origin ? target.href : `${self.location.origin}/user/appointment`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existingClient) {
        return existingClient.focus().then((client) => client.navigate(safeUrl));
      }
      return self.clients.openWindow(safeUrl);
    })
  );
});
