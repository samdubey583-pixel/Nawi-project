import axios from 'axios';

export const NOTIFICATIONS_UPDATED_EVENT = 'nawi-notifications-updated';

export async function markNotificationRead(id: string) {
  await axios.patch(`/dashboard/notifications/${encodeURIComponent(id)}/read`);
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}
