var IndexTypes;
(function (IndexTypes) {
  IndexTypes["TEXT"] = "text";
  IndexTypes["INT"] = "int";
  IndexTypes["BIGINT"] = "bigint";
})(IndexTypes || (IndexTypes = {}));
var indexes = [{
  field: 'ttl',
  type: IndexTypes.BIGINT
}];
function createIndexes(logger, nk) {
  try {
    indexes.forEach(function (index) {
      var indexName = index.field += '_idx';
      logger.info("Creating Index: ".concat(indexName));
      var sqlQuery = '';
      if (index.type === IndexTypes.TEXT) {
        sqlQuery = "CREATE INDEX CONCURRENTLY IF NOT EXISTS ".concat(indexName, " ON storage ((value->>'").concat(index.field, "'));");
      } else {
        sqlQuery = "CREATE INDEX CONCURRENTLY IF NOT EXISTS ".concat(indexName, " ON storage (cast(value->>'").concat(index.field, "' as ").concat(index.type, "));");
      }
      nk.sqlExec(sqlQuery);
    });
  } catch (error) {
    this.logger.error('createIndexes: An error has occurred: %s', error.message);
    throw error;
  }
}

var DbCache = function () {
  function DbCache(logger, nk) {
    this.collection = 'DB_CACHE';
    this.userId = '00000000-0000-0000-0000-000000000000';
    this.logger = logger;
    this.nk = nk;
  }
  DbCache.prototype.clearExpiredStorageObjects = function () {
    var deletions = this.pruneDB();
    return deletions;
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
      return res.rowsAffected;
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

var Stopwatch = function () {
  function Stopwatch(logger) {
    this.events = [];
    this.logger = logger;
  }
  Stopwatch.prototype.start = function () {
    if (this.stopped === false) {
      this.logger.error('Stopwatch already running');
      return this;
    }
    this.addEvent('Start');
    this.stopped = false;
    return this;
  };
  Stopwatch.prototype.stop = function () {
    if (this.stopped === true) {
      this.logger.error('Stopwatch already stopped');
      return this;
    }
    this.addEvent('Stop');
    this.stopped = true;
    return this;
  };
  Stopwatch.prototype.addStep = function (name) {
    if (name === 'Start' || name === 'Stop') {
      this.logger.error('Event names Start and Stop are reserved, not adding step');
      return this;
    }
    if (this.stopped === true) {
      this.logger.error('Stopwatch not running, not adding step');
      return this;
    }
    this.addEvent(name);
    return this;
  };
  Stopwatch.prototype.reset = function () {
    this.logger.info('Stopwatch resetting');
    this.events = [];
    return this;
  };
  Stopwatch.prototype.log = function () {
    if (this.stopped === false) {
      this.stop();
    }
    var startEvent = this.events[0];
    var stopEvent = this.events[this.events.length - 1];
    var logString = 'Stopwatch Log:\n';
    logString += this.getTotalString(startEvent.timeStamp, stopEvent.timeStamp);
    if (this.events.length > 2) {
      for (var i = 1; i < this.events.length; i++) {
        logString += this.getTimingString(this.events[i - 1], this.events[i]);
      }
    }
    this.logger.debug(logString);
  };
  Stopwatch.prototype.timeTakenMilliseconds = function () {
    if (this.stopped === false) {
      this.logger.error('Stopwatch still running');
      return undefined;
    }
    var startEvent = this.events[0];
    var stopEvent = this.events[this.events.length - 1];
    return stopEvent.timeStamp - startEvent.timeStamp;
  };
  Stopwatch.prototype.timeTakenSeconds = function () {
    if (this.stopped === false) {
      this.logger.error('Stopwatch still running');
      return undefined;
    }
    var startEvent = this.events[0];
    var stopEvent = this.events[this.events.length - 1];
    return (stopEvent.timeStamp - startEvent.timeStamp) / 1000;
  };
  Stopwatch.prototype.getTotalString = function (startTs, endTs) {
    return "Total: ".concat(endTs - startTs, "ms\n");
  };
  Stopwatch.prototype.getTimingString = function (firstEvent, secondEvent) {
    return "".concat(firstEvent.name, " -> ").concat(secondEvent.name, ": ").concat(secondEvent.timeStamp - firstEvent.timeStamp, "ms\n");
  };
  Stopwatch.prototype.addEvent = function (name) {
    this.events.push({
      name: name,
      timeStamp: Date.now()
    });
  };
  return Stopwatch;
}();

function FillDbCache(ctx, logger, nk, payload) {
  var cache = new DbCache(logger, nk);
  var before = Date.now();
  for (var index = 0; index < 10000; index++) {
    cache.setex('Speed_Test_' + index.toString(), 10, 'A string to store number: ' + index.toString());
  }
  for (var index = 0; index < 10000; index++) {
    cache.get('Speed_Test_' + index.toString());
  }
  var millisTaken = Date.now() - before;
  return JSON.stringify({
    millisTaken: millisTaken
  });
}
function PruneDbCache(ctx, logger, nk, payload) {
  var cache = new DbCache(logger, nk);
  var before = Date.now();
  var count = cache.clearExpiredStorageObjects();
  var millisTaken = Date.now() - before;
  return JSON.stringify({
    millisTaken: millisTaken,
    deletions: count
  });
}
function TestStopwatch(ctx, logger, nk, payload) {
  var sw = new Stopwatch(logger).start();
  wait(Math.random() * 2000);
  sw.addStep('First Wait');
  wait(Math.random() * 2000);
  sw.addStep('Second Wait');
  wait(Math.random() * 2000);
  sw.addStep('Third Wait');
  wait(Math.random() * 2000);
  sw.addStep('Fourth Wait');
  wait(Math.random() * 2000);
  sw.stop();
  sw.log();
  sw.timeTakenSeconds;
  return JSON.stringify({
    millisTaken: sw.timeTakenMilliseconds(),
    secondsTaken: sw.timeTakenSeconds()
  });
}
function wait(ms) {
  var start = new Date().getTime();
  var end = start;
  while (end < start + ms) {
    end = new Date().getTime();
  }
}

function InitModule(ctx, logger, nk, initializer) {
  logger.info('Creating storage indexes');
  createIndexes(logger, nk);
  logger.info('Finished creating storage indexes');
  logger.info('Initialising RPCs');
  initializer.registerRpc('Fill_Db_Cache', FillDbCache);
  initializer.registerRpc('Prune_Db_Cache', PruneDbCache);
  initializer.registerRpc('Test_Stopwatch', TestStopwatch);
  logger.info('Finished initialising RPCs');
}
!InitModule && InitModule.bind(null);
