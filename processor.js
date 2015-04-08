'use strict';

var _ = require('lodash');
var winston = require('winston'); 

var logger = winston;
var setLogger = function(anotherLogger){
	anotherLogger.info('processor logger updated');
	logger = anotherLogger;
}; // this can be called outside the module to set the logger

console.log(winston.transports.Console.toString());

winston.debug('Debug messages will be logged in processor');

var activeSensors = {};

var addSensor = function(sensor){
	if(activeSensors[sensor.url] !== undefined){
		return;
	}

	logger.debug('sensor added to active sensor map', JSON.stringify(sensor));
	activeSensors[sensor.url] = sensor;
	var urlParts = sensor.url.split('/');
	for (var i = 3; i < urlParts.length; i++) {
		var subUrl = _.slice(urlParts, 0, i).join('/');
		logger.debug(subUrl);
		activeSensors[subUrl] = sensor;
	}
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

var getUrl = function(event){
	var result = event.geofence;

	if(result === undefined){
		result = [
			'ibeacon:/', 
			event.properties.regionId, 
			event.properties.major,
			event.properties.minor].join('/');
	}

	return result;
};

var getSensor = function(event, sensorsCollection, callback){
	var sensorUrl = getUrl(event);
	logger.debug('sensorUrl is ' + sensorUrl);

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
				attached: {}
			};
		}
		else{
			result = docs[0];
		}

		callback(result);
	});
};

var attach = function(event, sensorsCollection){
	var url = event.properties.geofence;
	var sensor = activeSensors[url];

	if(sensor === undefined){
		logger.verbose('unknown sensor url: ' + url);
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
	var url = event.properties.geofence;
	var sensor = activeSensors[url];

	if(sensor === undefined){
		logger.verbose('unknown sensor url');
		return;
	}

	logger.verbose('found the sensor', sensor);
	if(sensor.attached === {}){
		logger.verbose('nothing attached');
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

var isSensorData = function(event){
	return event.geofence !== undefined;
};

var copyToAttachedStream = function(event, eventRepository){
	var sensor = activeSensors[event.geofence];
	var copyToAttached = function(value, key){
		var newEvent = _.merge(event, {});
		newEvent.streamid = key;
		newEvent.originalGeofence = newEvent.geofence;
		delete newEvent.geofence;
		logger.verbose('new event for ' + newEvent.streamid + ': ');
		logger.debug(newEvent);
		eventRepository.add(newEvent);
	};

	logger.debug('copying event to attached streams', sensor.attached);
	_.forOwn(sensor.attached, copyToAttached);
};

var processMessage = function(event, sensorsCollection, eventRepository){
	logger.info('process message!');
	var isProximity = _.indexOf(event.objectTags, 'proximity') >= 0; 
	if(isProximity){
		logger.verbose("proximity event received");
		logger.debug("event details: ", event);
		getSensor(event, sensorsCollection, function(sensor){
			// check for enter and exit events
			var intersection = _.intersection(event.actionTags, ['enter', 'exit']);
			if(intersection[0] === 'enter'){
				attach(event, sensorsCollection);
				logger.info(event.streamid + ' enter ' + event.properties.geofence);
			} else if (intersection[0] === 'exit'){
				detach(event, sensorsCollection);
				logger.info(event.streamid + ' exit ' + event.properties.geofence);
			}

			var startStopIntersection = _.intersection(event.actionTags, ['start', 'stop']);
			if(startStopIntersection[0] === 'start'){
				logger.verbose("event is proximity start");
				activateBeacon(event, sensorsCollection, sensor);
				logger.info('start ' + event.properties.geofence);
			}

			if(startStopIntersection[0] === 'stop'){
				logger.verbose("event is proximity stop");
				deactivateBeacon(event, sensorsCollection, sensor);
				logger.info('stop ' + event.properties.geofence);
			}

		});
	}
	
	if(event.geofence !== undefined){
		logger.info("event has geofence");
		getSensor(event, sensorsCollection, function(sensor){
			activateBeacon(event, sensorsCollection, sensor);
			copyToAttachedStream(event, eventRepository);
		});
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

// used for testing
var reset = function(){
	activeSensors = {};
};

module.exports.processMessage = processMessage;
module.exports.setLogger = setLogger;
module.exports.loadSensors = loadSensors;
module.exports.reset = reset;