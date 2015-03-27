'use strict';

var _ = require('lodash');
var winston = require('winston'); 

var logger = winston;
var setLogger = function(anotherLogger){
	anotherLogger.info('processor logger updated', anotherLogger);
	logger = anotherLogger;
}; // this can be called outside the module to set the logger

console.log(winston.transports.Console.toString());

winston.debug('Debug messages will be logged in processor');

var activateBeacon = function(event, sensorsCollection, sensor){
	var condition = {
		url: sensor.url
	};

	var operation = {
		$set: {
			active: true
		}
	};

	var options  = {
		upsert: true
	};

	logger.verbose('activating sensor ', sensor.url);
	logger.debug('condition ', condition);
	logger.debug('operation', operation);
	logger.debug('options', options);

	sensorsCollection.update(condition, operation, options, function(err, res){
		if(err){
			logger.error('error updating sensor', err);
		} 
		else{
			logger.verbose('Wrote to the database ' + res);
		}

	});
};

var deactivateBeacon = function(event, sensorsCollection, sensor){
	var condition = {
		url: sensor.url
	};

	var operation = {
		$set: {
			active: false
		}
	};

	var options  = {
		upsert: true
	};

	logger.verbose('deactivating sensor ', sensor.url);
	logger.debug('condition ', condition);
	logger.debug('operation', operation);
	logger.debug('options', options);

	sensorsCollection.update(condition, operation, options, function(err, res){
		if(err){
			logger.error('error updating sensor', err);
		} 
		else{
			logger.verbose('Wrote to the database ' + res);
		}

	});
};

var getSensor = function(event, sensorsCollection, callback){
	var sensorUrl = [
		'ibeacon:/', 
		event.properties.regionId, 
		event.properties.major,
		event.properties.minor].join('/');
	var condition = {
		url: sensorUrl
	};

	logger.debug('find with condition ', condition);
	sensorsCollection.find(condition).toArray(function(err, docs){
		if(err){
			logger.error('error finding sensor', err);
			return;
		}

		var result;
		if(docs.length === 0){
			logger.verbose('beacon not found, creating', sensorUrl);
			result = {
				url: sensorUrl, 
				streamid: event.streamid, 
				active: false,
				connectedStreamIds: {}
			};
		}
		else{
			result = docs[0];
		}

		callback(result);
	});
};

var processMessage = function(event, sensorsCollection){
	var isProximity = _.indexOf(event.objectTags, 'proximity') >= 0; 
	if(isProximity){
		logger.verbose("proximity event received");
		logger.debug("event details: ", event);
		getSensor(event, sensorsCollection, function(sensor){
			// check for enter and exit events
			var intersection = _.intersection(event.actionTags, ['enter', 'exit']);
			if(intersection[0] === 'enter'){
				//link(event.streamid, event.properties.regionId);
			} else if (intersection[0] === 'exit'){
				//unlink(event.streamid, event.properties.regionId);
			}

			var startStopIntersection = _.intersection(event.actionTags, ['start', 'stop']);
			if(startStopIntersection[0] === 'start'){
				logger.verbose("event is proximity start");
				activateBeacon(event, sensorsCollection, sensor);
			}

			if(startStopIntersection[0] === 'stop'){
				logger.verbose("event is proximity stop");
				deactivateBeacon(event, sensorsCollection, sensor);
			}

		});
	}
	else {
		logger.debug("event " + event.objectTags + " ignored");
	}
};

module.exports.processMessage = processMessage;
module.exports.setLogger = setLogger;