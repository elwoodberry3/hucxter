import { fakeUpload } from '@/server/media/fake-routes';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: RouteContext<'/api/dev/fake-video/upload/[id]'>,
) {
  return fakeUpload(request, (await params).id);
}
