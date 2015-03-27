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

var activeSensors = {};


var addSensor = function(sensor){
	logger.debug('sensor added to active sensor map', JSON.stringify(sensor));
	activeSensors[sensor.url] = sensor;
	logger.debug('active sensors are', activeSensors);
};

var removeSensor = function(sensor){
	logger.debug('sensor removed from active sensor map', sensor);
	delete activeSensors[sensor.url];
	logger.debug('active sensors are', activeSensors);
};

var activateBeacon = function(event, sensorsCollection, sensor){
	var condition = {
		url: sensor.url
	};

	var operation = {
		$set: {
			streamid: event.streamid,
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

	addSensor(sensor);
};

var deactivateBeacon = function(event, sensorsCollection, sensor){
	var condition = {
		url: sensor.url
	};

	var operation = {
		$set: {
			streamid: event.streamid,
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

	removeSensor(sensor);
};

var generateUrl = function(event){
	return [
		'ibeacon:/', 
		event.properties.regionId, 
		event.properties.major,
		event.properties.minor].join('/');
};

var getSensor = function(event, sensorsCollection, callback){
	var sensorUrl = generateUrl(event);
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
			logger.debug('streamid is ' + event.streamid);
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

var attach = function(event, sensorsCollection){
	var url = generateUrl(event);
	var sensor = activeSensors[url];

	logger.verbose('looking up sensor ' + sensor.url);
	if(sensor === undefined){
		logger.verbose('unknown sensor url');
		return;
	}

	logger.verbose('found the sensor', sensor);
	if(sensor.attached === undefined){
		logger.verbose('adding first attached stream');
		sensor.attached = {};
	}

	sensor.attached[event.streamid] = true;
	logger.verbose('stream attached', sensor);

	var condition = {
		url: sensor.url
	};

	var key = 'attached.' + event.streamid;

	var set = {};
	set[key] = true;
	var operation = {
		$set: set	
	};

	logger.verbose('adding attachment to db', sensor.url);
	logger.debug('condition ', condition);
	logger.debug('operation', operation);

	sensorsCollection.update(condition, operation, function(err, res){
		if(err){
			logger.error('error updating sensor', err);
		} 
		else{
			logger.verbose('Wrote to the database ' + res);
		}

	});
};

var detach = function(event, sensorsCollection){
	var url = generateUrl(event);
	var sensor = activeSensors[url];

	logger.verbose('looking up sensor ' + sensor.url);
	if(sensor === undefined){
		logger.verbose('unknown sensor url');
		return;
	}

	logger.verbose('found the sensor', sensor);
	if(sensor.attached === undefined){
		logger.verbose('nothing attached');
		return;
	}

	delete sensor.attached[event.streamid];
	logger.verbose('stream detached', sensor);

	var condition = {
		url: sensor.url
	};

	var key = 'attached.' + event.streamid;
	var unset = {};
	unset[key] = "";
	var operation = {
		$unset: unset
	};

	logger.verbose('removing attachment to db', sensor.url);
	logger.debug('condition ', condition);
	logger.debug('operation', operation);

	sensorsCollection.update(condition, operation, function(err, res){
		if(err){
			logger.error('error updating sensor', err);
		} 
		else{
			logger.verbose('Wrote to the database ' + res);
		}

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
				attach(event, sensorsCollection);
			} else if (intersection[0] === 'exit'){
				detach(event, sensorsCollection);
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

var loadSensors = function(sensorsCollection, callback){
	var condition = {
		active: true
	};

	logger.debug('find with condition ', condition);
	sensorsCollection.find(condition).toArray(function(err, docs){
		if(err){
			logger.error('error finding sensors', err);
			return;
		}
		
		for (var i = docs.length - 1; i >= 0; i--) {
			addSensor(docs[[i]]);
		}

		callback();
	});
};

module.exports.processMessage = processMessage;
module.exports.setLogger = setLogger;
module.exports.loadSensors = loadSensors;