import { loadSettings } from '../../settings';
import { createGateway, dexieRoutes } from './gateway';

export const gatewayFetch = createGateway({ getProxies: () => loadSettings().proxies, routes: dexieRoutes });
