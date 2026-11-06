import { fakeFile } from '@/server/media/fake-routes';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: RouteContext<'/api/dev/fake-video/file/[name]'>,
) {
  return fakeFile(request, (await params).name);
}
