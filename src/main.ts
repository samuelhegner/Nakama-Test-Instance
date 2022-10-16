import { TestRpc } from './rpcs/TestRPC';

function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
	logger.info('Creating storage indexes');
	createIndexes();
	logger.info('Finished creating storage indexes');

	logger.info('Initialising RPCs');

	initializer.registerRpc('TestRPC', TestRpc);

	logger.info('Finished initialising RPCs');
}

function createIndexes() {
	const indexList: IndexEntry[] = [{ name: 'ttl_index', field: 'ttl', type: 'bigint' }];

	indexList.forEach((index) => {
		let sql: string = `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${index.name.toLocaleLowerCase()} ON storage(collection, `;

		if (index.type === 'int' || index.type === 'boolean') {
			sql += `((value::jsonb->'${index.field}')::${index.type}));`;
		} else if (index.type === 'gin') {
			sql = `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${index.name.toLocaleLowerCase()} ON storage USING GIN((value::jsonb->'${
				index.field
			}'));`;
		} else {
			sql += `(value::jsonb->'${index.field}'::${index.type}));`;
		}
	});
}

interface IndexEntry {
	name: string;
	field: string;
	type: string;
}

// Reference InitModule to avoid it getting removed on build
!InitModule && InitModule.bind(null);
