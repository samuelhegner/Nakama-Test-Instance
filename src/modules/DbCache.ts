export class DbCache {
	private logger: nkruntime.Logger;
	private nk: nkruntime.Nakama;

	private collection: string = 'DB_CACHE';
	private userId: string = '00000000-0000-0000-0000-000000000000';

	constructor(logger: nkruntime.Logger, nk: nkruntime.Nakama) {
		this.logger = logger;
		this.nk = nk;
	}

	public clearExpiredStorageObjects(): number {
		const deletions = this.pruneDB();
		return deletions;
	}

	public setex(key: string, seconds: number, value: string) {
		const saveObj: StorageObject = {
			key: key,
			type: StorageTypes.String,
			ttl: this.calculateTtlFromSeconds(seconds),
			data: value
		};

		this.writeDb(saveObj);

		return 'OK';
	}

	public set(key: string, value: string): string {
		const saveObj: StorageObject = {
			key: key,
			type: StorageTypes.String,
			ttl: null,
			data: value
		};

		this.writeDb(saveObj);

		return 'OK';
	}

	public get(key: string): string {
		const value = this.readDB(key);

		if (value === undefined) {
			return null;
		}

		if (this.isExpired(value)) {
			return null;
		}

		if (value.type !== StorageTypes.String) {
			throw errIncorrectType;
		}

		return value.data;
	}

	private calculateTtlFromSeconds(seconds: number): number {
		let ttl = Date.now();
		ttl += seconds * 1000;
		return ttl;
	}

	private isExpired(data: StorageObject): boolean {
		if (data.ttl == null) {
			return false;
		}

		const now = Date.now();

		if (data.ttl > now) {
			return false;
		}

		this.deleteDB(data.key);
		return true;
	}

	private writeDb(data: StorageObject) {
		try {
			this.logger.debug('writeDb: %s', data.key);
			const writeRequest: nkruntime.StorageWriteRequest = {
				key: data.key,
				collection: this.collection,
				userId: this.userId,
				value: data
			};

			this.nk.storageWrite([writeRequest]);
		} catch (error) {
			this.logger.error('writeDb: An error has occurred: %s', error.message);
			throw error;
		}
	}

	private readDB(key: string): StorageObject | undefined {
		try {
			this.logger.debug('readDB: %s', key);
			const readRequest: nkruntime.StorageReadRequest = {
				key: key,
				collection: this.collection,
				userId: this.userId
			};

			const result = this.nk.storageRead([readRequest]);

			if (result.length === 0) {
				return undefined;
			}

			return result[0].value as StorageObject;
		} catch (error) {
			this.logger.error('readDB: An error has occurred: %s', error.message);
			throw error;
		}
	}

	private deleteDB(key: string) {
		try {
			this.logger.debug('deleteDB: %s', key);
			const deleteRequest: nkruntime.StorageDeleteRequest = {
				key: key,
				collection: this.collection,
				userId: this.userId
			};

			this.nk.storageDelete([deleteRequest]);
		} catch (error) {
			this.logger.error('deleteDB: An error has occurred: %s', error.message);
			throw error;
		}
	}

	private pruneDB(): number {
		try {
			const now = Date.now();
			const query: string = `DELETE FROM	public."storage" WHERE collection = '${this.collection}' AND (value ->> 'ttl')::BIGINT < ${now}`;
			const res = this.nk.sqlExec(query);
			this.logger.debug('pruneDB: deleted entry count: ' + res.rowsAffected.toString());
			return res.rowsAffected;
		} catch (error) {
			this.logger.error('pruneDB: An error has occurred: %s', error.message);
			throw error;
		}
	}
}

interface StorageObject {
	key: string;
	type: StorageTypes;
	ttl: number;
	data: any;
}

enum StorageTypes {
	String = 'string'
}

const errIncorrectType: nkruntime.Error = {
	message: 'incorrect storage type is stored at key',
	code: nkruntime.Codes.ALREADY_EXISTS
};
