var DbCache = function () {
  function DbCache(logger, nk) {
    this.collection = 'DB_CACHE';
    this.userId = '00000000-0000-0000-0000-000000000000';
    this.logger = logger;
    this.nk = nk;
  }
  DbCache.prototype.clearExpiredStorageObjects = function () {
    this.pruneDB();
  };
  DbCache.prototype.setex = function (key, seconds, value) {
    var saveObj = {
      key: key,
      type: StorageTypes.String,
      ttl: this.calculateTtlFromSeconds(seconds),
      data: value
    };
    this.writeDb(saveObj);
    return 'OK';
  };
  DbCache.prototype.set = function (key, value) {
    var saveObj = {
      key: key,
      type: StorageTypes.String,
      ttl: null,
      data: value
    };
    this.writeDb(saveObj);
    return 'OK';
  };
  DbCache.prototype.get = function (key) {
    var value = this.readDB(key);
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
  };
  DbCache.prototype.calculateTtlFromSeconds = function (seconds) {
    var ttl = Date.now();
    ttl += seconds * 1000;
    return ttl;
  };
  DbCache.prototype.isExpired = function (data) {
    if (data.ttl == null) {
      return false;
    }
    var now = Date.now();
    if (data.ttl > now) {
      return false;
    }
    this.deleteDB(data.key);
    return true;
  };
  DbCache.prototype.writeDb = function (data) {
    try {
      this.logger.debug('writeDb: %s', data.key);
      var writeRequest = {
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
  };
  DbCache.prototype.readDB = function (key) {
    try {
      this.logger.debug('readDB: %s', key);
      var readRequest = {
        key: key,
        collection: this.collection,
        userId: this.userId
      };
      var result = this.nk.storageRead([readRequest]);
      if (result.length === 0) {
        return undefined;
      }
      return result[0].value;
    } catch (error) {
      this.logger.error('readDB: An error has occurred: %s', error.message);
      throw error;
    }
  };
  DbCache.prototype.deleteDB = function (key) {
    try {
      this.logger.debug('deleteDB: %s', key);
      var deleteRequest = {
        key: key,
        collection: this.collection,
        userId: this.userId
      };
      this.nk.storageDelete([deleteRequest]);
    } catch (error) {
      this.logger.error('deleteDB: An error has occurred: %s', error.message);
      throw error;
    }
  };
  DbCache.prototype.pruneDB = function () {
    try {
      var now = Date.now();
      var query = "DELETE FROM\tpublic.\"storage\" WHERE collection = '".concat(this.collection, "' AND (value ->> 'ttl')::BIGINT < ").concat(now);
      var res = this.nk.sqlExec(query);
      this.logger.debug('pruneDB: deleted entry count: ' + res.rowsAffected.toString());
    } catch (error) {
      this.logger.error('pruneDB: An error has occurred: %s', error.message);
      throw error;
    }
  };
  return DbCache;
}();
var StorageTypes;
(function (StorageTypes) {
  StorageTypes["String"] = "string";
})(StorageTypes || (StorageTypes = {}));
var errIncorrectType = {
  message: 'incorrect storage type is stored at key',
  code: 6
};

function TestRpc(ctx, logger, nk, payload) {
  var cache = new DbCache(logger, nk);
  cache.clearExpiredStorageObjects();
}

function InitModule(ctx, logger, nk, initializer) {
  logger.info('Hello!');
  try {
    logger.info('Initialising RPCs');
    initializer.registerRpc('TestRPC', TestRpc);
    logger.info('Finished initialising RPCs');
  } catch (error) {
    logger.error('Caught exception: %s', error.message);
  }
}
!InitModule && InitModule.bind(null);
