export const MOBILE_FRAME_PARAM = 'g113MobileFrame';

/** Open the same app in a narrow same-origin viewport without nesting the preview controls. */
export function mobileFrameUrl(currentHref: string): string {
  const url = new URL(currentHref);
  url.searchParams.set(MOBILE_FRAME_PARAM, '1');
  return url.toString();
}
