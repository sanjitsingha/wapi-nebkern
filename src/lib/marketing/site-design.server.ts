import { cookies } from 'next/headers';

import {
  DEFAULT_SITE_DESIGN,
  SITE_DESIGN_COOKIE,
  isSiteDesign,
  type SiteDesign,
} from './site-design';

export interface SiteDesignState {
  design: SiteDesign;
}

/**
 * Read the design for this request.
 *
 * `cookies()` is a request-time API, so calling this opts the route into
 * dynamic rendering. That costs nothing extra here: the public pages
 * were already rendered per request (see the route table in any build).
 */
export async function getSiteDesign(): Promise<SiteDesignState> {
  const value = (await cookies()).get(SITE_DESIGN_COOKIE)?.value;
  return { design: isSiteDesign(value) ? value : DEFAULT_SITE_DESIGN };
}
