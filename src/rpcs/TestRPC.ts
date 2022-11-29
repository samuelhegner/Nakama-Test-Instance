import { DbCache } from '../modules/DbCache';
import { Stopwatch } from '../modules/Stopwatch';

export function FillDbCache(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string) {
	const cache = new DbCache(logger, nk);

	const before = Date.now();

	for (let index = 0; index < 10000; index++) {
		cache.setex('Speed_Test_' + index.toString(), 10, 'A string to store number: ' + index.toString());
	}

	for (let index = 0; index < 10000; index++) {
		cache.get('Speed_Test_' + index.toString());
	}
	const millisTaken = Date.now() - before;

	return JSON.stringify({ millisTaken: millisTaken });
}

export function PruneDbCache(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string) {
	const cache = new DbCache(logger, nk);
	const before = Date.now();
	const count = cache.clearExpiredStorageObjects();
	const millisTaken = Date.now() - before;
	return JSON.stringify({ millisTaken: millisTaken, deletions: count });
}

export function TestStopwatch(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string) {
	const sw = new Stopwatch(logger).start();
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
	return JSON.stringify({ millisTaken: sw.timeTakenMilliseconds(), secondsTaken: sw.timeTakenSeconds() });
}

function wait(ms) {
	var start = new Date().getTime();
	var end = start;
	while (end < start + ms) {
		end = new Date().getTime();
	}
}
