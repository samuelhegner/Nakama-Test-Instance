import { DbCache } from '../modules/DbCache';

export function TestRpc(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string) {
	const cache = new DbCache(logger, nk);

	cache.clearExpiredStorageObjects();
}
