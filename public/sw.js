// Access Your Place - Push Notification Service Worker
const CACHE_NAME = 'ayp-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  event.waitUntil(clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let data = {
    title: 'Access Your Place',
    body: 'You have a new notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'ayp-notification',
    data: {}
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || data.tag,
        data: payload.data || {},
        actions: payload.actions || [],
        requireInteraction: payload.requireInteraction || false,
        vibrate: payload.vibrate || [200, 100, 200]
      };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    actions: data.actions,
    requireInteraction: data.requireInteraction,
    vibrate: data.vibrate,
    timestamp: Date.now()
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/investor/portal';

  // Handle different notification types
  if (data.type === 'first_refusal') {
    url = '/investor/portal?tab=acquisitions';
  } else if (data.type === 'document') {
    url = '/investor/portal?tab=documents';
  } else if (data.type === 'payment') {
    url = '/investor/portal?tab=acquisitions';
  } else if (data.type === 'deal_alert') {
    url = '/deals';
  } else if (data.url) {
    url = data.url;
  }

  // Handle action buttons
  if (event.action === 'view') {
    url = data.viewUrl || url;
  } else if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes('accessyourplace.com') || client.url.includes('localhost')) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Open new window if none exists
      return clients.openWindow(url);
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});

// Background sync for offline notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  // Sync any pending notifications when back online
  console.log('Syncing notifications...');
}

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  }
});
