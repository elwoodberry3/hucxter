import { fakeReady } from '@/server/media/fake-routes';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: RouteContext<'/api/dev/fake-video/ready/[id]'>,
) {
  return fakeReady(request, (await params).id);
}
