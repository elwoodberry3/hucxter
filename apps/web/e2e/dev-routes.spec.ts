import { expect, test } from '@playwright/test';
import { INVITE_OFF_URL, LOCAL_URL, PRODUCTION_URL, SERVER_ONLY } from './support';

/**
 * The demo listing template (/dev/templates/listing) was retired in 3C.1: listing pages render
 * real listings at /l/[id]. Nothing under /dev exists on any server, local included.
 */
test('the retired /dev template is 404 on every server', async ({ request, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440', SERVER_ONLY);
  for (const origin of [baseURL ?? '', PRODUCTION_URL, INVITE_OFF_URL, LOCAL_URL]) {
    for (const path of ['/dev/templates/listing', '/dev/templates/listing?status=sold']) {
      const response = await request.get(`${origin}${path}`);
      expect(response.status(), `${origin}${path}`).toBe(404);
      expect(await response.text()).not.toContain('Mid-century walnut desk');
    }
  }
});
