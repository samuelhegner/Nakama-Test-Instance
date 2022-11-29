import { createIndexes } from './modules/DbUtil';
import { FillDbCache, PruneDbCache, TestStopwatch } from './rpcs/TestRPC';

function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
	logger.info('Creating storage indexes');
	createIndexes(logger, nk);
	logger.info('Finished creating storage indexes');

	logger.info('Initialising RPCs');
	initializer.registerRpc('Fill_Db_Cache', FillDbCache);
	initializer.registerRpc('Prune_Db_Cache', PruneDbCache);
	initializer.registerRpc('Test_Stopwatch', TestStopwatch);
	logger.info('Finished initialising RPCs');
}

// Reference InitModule to avoid it getting removed on build
!InitModule && InitModule.bind(null);
