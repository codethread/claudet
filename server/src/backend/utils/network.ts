import { networkInterfaces } from 'node:os';

/**
 * Get local network IP address
 * Returns the first non-internal IPv4 address found, or 'localhost' if none
 */
export function getLocalIP(): string {
	const nets = networkInterfaces();

	for (const name of Object.keys(nets)) {
		const interfaces = nets[name];
		if (!interfaces) continue;

		for (const net of interfaces) {
			// Skip internal (localhost) and non-IPv4 addresses
			const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
			if (net.family === familyV4Value && !net.internal) {
				return net.address;
			}
		}
	}

	return 'localhost';
}
