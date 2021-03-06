'use strict';

var _ = require('lodash');
var winston = require('winston'); 

var logger = winston;
var setLogger = function(anotherLogger){
	anotherLogger.info('processor logger updated');
	logger = anotherLogger;
}; // this can be called outside the module to set the logger

winston.debug('Debug messages will be logged in processor');

var activeSensors = {};

var addSensorToDatabase = function(url, sensor, sensorsCollection){
	var condition = {
		url: url
	};

	var operation = {
		$set: {
			streamid: sensor.streamid,
			active: true
		}
	};

	var options  = {
		upsert: true
	};

	logger.verbose('adding sensor to database', sensor.url);
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

var removeSensorFromDatabase = function(url, sensor, sensorsCollection){
	var condition = {
		url: url
	};

	var operation = {
		$set: {
			streamid: sensor.streamid,
			active: false
		}
	};

	var options  = {
		upsert: true
	};

	logger.verbose('removing sensor from database ', sensor.url);
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

var addSensorUrls = function(url, sensor, sensorsCollection){
	logger.silly('adding sensor for ' + url, sensor);
	activeSensors[url] = sensor;
	addSensorToDatabase(url, sensor, sensorsCollection);
};

var addSensor = function(sensor, sensorsCollection){
	var sensorUrl = sensor.url.toUpperCase();
	logger.debug('sensor added to active sensor map', sensor);
	addSensorUrls(sensorUrl, sensor, sensorsCollection);
};

var removeSensor = function(url, sensor, sensorsCollection){
	logger.debug('sensor removed from active sensor map', sensor);
	delete activeSensors[sensor.url];
	removeSensorFromDatabase(url, sensor, sensorsCollection);
};

var activateBeacon = function(event, sensorsCollection, sensor){
	logger.debug('activating beacon', event);
	sensor.streamid = event.streamid;
	addSensor(sensor, sensorsCollection);
};

var addCachedEventsToDatabase = function(key, cachedEvent, url, sensorsCollection){
	var condition = {
		url: url
	};

	var set = {};
	set['cachedEvents.' + key] = cachedEvent;
	logger.silly('cached events', set);
	
	var operation = {
		$set: set
	};
	logger.debug(JSON.stringify(operation));

	sensorsCollection.update(condition, operation, {}, function(err, res){
		if(err){
			logger.error('error updating sensor', err);
		} 
		else{
			logger.verbose('Wrote to the database ' + res);
		}

	});
};

var getUrl = function(event){
	var result = event.geofence;

	if(result === undefined){
		result = event.properties.geofence;
	}

	if(result === undefined){
		result = event.properties.geofenceUrl;
	}

	if(result === undefined){
		result = [
			'IBEACON:/', 
			event.properties.regionId.toUpperCase(), 
			event.properties.major,
			event.properties.minor].join('/');
	}

	return result.toUpperCase();
};

var cacheLastEvent = function(event, sensorsCollection, sensor){
	var key = event.objectTags.join('-') + '-' + event.actionTags.join('-');
	logger.debug('caching event using key: ' + key);

	var cachedEvent = {};
	_.merge(cachedEvent, event);
	cachedEvent.eventDateTime = new Date(cachedEvent.eventDateTime.$date);
	cachedEvent.eventLocalDateTime = new Date(cachedEvent.eventLocalDateTime.$date);
	
	if(sensor.cachedEvents === undefined){
		sensor.cachedEvents = {};
	}

	sensor.cachedEvents[key] = cachedEvent;
	logger.silly('sensor is', JSON.stringify(sensor));

	var url = getUrl(event);
	activeSensors[url] = sensor;
	addCachedEventsToDatabase(key, cachedEvent, url, sensorsCollection);
};

var deactivateBeacon = function(event, sensorsCollection, sensor){
	sensor.streamid = event.streamid;
	var url = getUrl(event);
	removeSensor(url, sensor, sensorsCollection);
};

var getSensor = function(event, sensorsCollection, callback){
	var sensorUrl = getUrl(event);
	logger.debug('getSensor: sensorUrl is ' + sensorUrl);

	logger.silly('getSensor: activeSensors: ', activeSensors);
	var result = activeSensors[sensorUrl];
	if(result !== undefined){
		callback(result);
		return;
	}

	var re = new RegExp(sensorUrl,"g");
	var condition = {
		url: re
	};


	logger.debug('getSensor: db find with condition ', condition);
	sensorsCollection.find(condition).toArray(function(err, docs){
		if(err){
			logger.error('error finding sensor', err);
			return;
		}

		var result;
		if(docs.length === 0){
			logger.info('beacon not found, creating', sensorUrl);
			logger.debug('streamid is ' + event.streamid);
			result = {
				url: sensorUrl, 
				streamid: event.streamid, 
				active: false,
				attached: {},
				cachedEvents: {}
			};
			logger.debug('result is', result);
		}
		else{

			result = docs[0];
		}

		activeSensors[sensorUrl] = result;
		logger.silly('post sensor add active sensors are', activeSensors);
		callback(result);
	});
};

var copyCachedEvent = function(event, sensor, eventRepository){

	var copyToAttached = function(value){
		var newEvent = {};
		_.merge(newEvent, value);
		newEvent.streamid = event.streamid;
		newEvent.originalGeofence = value.geofence || value.properties.geofence || value.properties.geofenceUrl;
		delete newEvent.geofence;
		newEvent.dateTime = event.dateTime;
		newEvent.eventDateTime = event.eventDateTime;
		newEvent.eventLocalDateTime = event.eventLocalDateTime;
		logger.info('copying cached event to attaching stream: ' + newEvent.streamid + ': ' + newEvent.objectTags + '/' + newEvent.actionTags);
		logger.silly(newEvent);
		eventRepository.add(newEvent);
	};
	_.forOwn(sensor.cachedEvents, copyToAttached);
};

var attach = function(event, sensor, sensorsCollection){
	//eas: the geosense app currently in review at the app store has geofenceUrl in the 
	// property. Once we have updated the app we can remove this.
	var url = getUrl(event);

	if(sensor === undefined){
		logger.error('unknown sensor url while trying to attach to sensor: ' + url);
		return;
	}

	if(sensor.attached === undefined){
		sensor.attached = {};
	}

	sensor.attached[event.streamid] = true;
	activeSensors[sensor.url] = sensor;
	logger.debug('stream attached', sensor);

	var re = '^' + sensor.url;
	var condition = {
		url: {$regex: re}
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
	var url = event.properties.geofence || event.properties.geofenceUrl;
	url= url.toUpperCase();
	var sensor = activeSensors[url];

	if(sensor === undefined){
		logger.error('unknown sensor while trying to detach from sensor' + url);
		return;
	}

	if(sensor.attached === {}){
		logger.warn('a stream is being detached that wasnt already attached');
	} 

	delete sensor.attached[event.streamid];	
	logger.verbose('stream detached', sensor);
	
	var re = '^' + sensor.url;
	var condition = {
		url: {$regex: re}
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

var copyToAttachedStream = function(event, eventRepository){
	logger.silly('copying to attached streams, activeSensors: ', activeSensors);
	var sensor = activeSensors[getUrl(event)];
	logger.debug('sensor: ', sensor);
	var copyToAttached = function(value, key){
		var newEvent = _.merge({}, event);
		newEvent.streamid = key;
		newEvent.originalGeofence = newEvent.geofence;
		delete newEvent.geofence;
		logger.info('copying event to attached stream:' + newEvent.streamid);
		logger.debug(newEvent);
		eventRepository.add(newEvent);
	};

	logger.debug('copying event to attached streams', sensor.attached);
	_.forOwn(sensor.attached, copyToAttached);
};

var processMessage = function(event, sensorsCollection, eventRepository){
	logger.verbose('process message!');
	var isProximity = _.indexOf(event.objectTags, 'proximity') >= 0; 
	if(isProximity === false){
		isProximity = _.indexOf(event.objectTags, 'geofence') >= 0; 
	}

	if(isProximity){
		logger.info("proximity event received");
		logger.debug("event details: ", event);
		getSensor(event, sensorsCollection, function(sensor){
			// check for enter and exit events
			var intersection = _.intersection(event.actionTags, ['enter', 'exit']);
			if(intersection[0] === 'enter'){
				logger.info(event.streamid + ': enter ' + getUrl(event));
				attach(event, sensor, sensorsCollection);
				copyCachedEvent(event, sensor, eventRepository);
			} else if (intersection[0] === 'exit'){
				logger.info(event.streamid + ': exit ' + getUrl(event));
				detach(event, sensorsCollection);
			}

			var startStopIntersection = _.intersection(event.actionTags, ['start', 'stop']);
			if(startStopIntersection[0] === 'start'){
				logger.verbose(event.streamid + ": start" + getUrl(event));
				activateBeacon(event, sensorsCollection, sensor);
			}

			if(startStopIntersection[0] === 'stop'){
				logger.verbose(event.streamid + ": stop" + getUrl(event));
				deactivateBeacon(event, sensorsCollection, sensor);
			}

		});
	}
	
	if(event.geofence !== undefined){
		logger.info("sensor event with geofence: ", event);
		getSensor(event, sensorsCollection, function(sensor){
			activateBeacon(event, sensorsCollection, sensor);
			cacheLastEvent(event, sensorsCollection, sensor);
			copyToAttachedStream(event, eventRepository);
		});
	}	
};

var loadSensors = function(sensorsCollection, callback){
	logger.debug(sensorsCollection);
	var condition = {
		active: true
	};

	logger.debug('loadSensors: find with condition ', condition);
	sensorsCollection.find(condition).toArray(function(err, docs){
		if(err){
			logger.error('error finding sensors', err);
			return;
		}
		
		for (var i = docs.length - 1; i >= 0; i--) {
			var sensor = docs[i];
			var sensorUrl = sensor.url.toUpperCase();
			activeSensors[sensorUrl] = sensor;
		}

		logger.info('loaded sensors from database');
		logger.silly(activeSensors);

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