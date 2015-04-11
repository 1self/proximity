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

	logger.verbose('deactivating sensor ', sensor.url);
	logger.debug('condition ', condition);
	logger.debug('operation', operation);
	logger.debug('options', options);

	logger.debug('update is', sensorsCollection);
	sensorsCollection.update(condition, operation, options, function(err, res){
		if(err){
			logger.error('error updating sensor', err);
		} 
		else{
			logger.verbose('Wrote to the database ' + res);
		}

	});

	logger.info('ending');
};

var addSensorUrls = function(url, sensor, sensorsCollection){
	logger.debug('adding sensor for ' + url, sensor);
	activeSensors[url] = sensor;
	addSensorToDatabase(url, sensor, sensorsCollection);

	var urlParts = url.split('/');
	for (var i = 3; i < urlParts.length; i++) {
		var subUrl = _.slice(urlParts, 0, i).join('/');
		logger.debug('adding suburl', subUrl);
		activeSensors[subUrl] = sensor;
		addSensorToDatabase(subUrl, sensor, sensorsCollection);
	}
};

var addSensor = function(sensor, sensorsCollection){
	var sensorUrl = sensor.url.toUpperCase();

	if(activeSensors[sensor.url] !== undefined){
		return;
	}

	logger.debug('sensor added to active sensor map', JSON.stringify(sensor));
	addSensorUrls(sensorUrl, sensor, sensorsCollection);
};

var removeSensor = function(url, sensor, sensorsCollection){
	logger.debug('sensor removed from active sensor map', sensor);
	delete activeSensors[sensor.url];
	removeSensorFromDatabase(url, sensor, sensorsCollection);

	var urlParts = url.split('/');
	for (var i = 3; i < urlParts.length; i++) {
		var subUrl = _.slice(urlParts, 0, i).join('/');
		logger.debug(subUrl);
		activeSensors[subUrl] = sensor;
		delete activeSensors[subUrl];
		removeSensorFromDatabase(subUrl, sensor, sensorsCollection);
	}
	logger.debug('active sensors are', activeSensors);
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
	logger.debug('cached events', set);
	
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
	logger.debug('before merge', event);
	_.merge(cachedEvent, event);
	logger.debug('cached event is:', cachedEvent);
	logger.debug('original event is: ', event);
	cachedEvent.eventDateTime = new Date(cachedEvent.eventDateTime.$date);
	cachedEvent.eventLocalDateTime = new Date(cachedEvent.eventLocalDateTime.$date);
	
	if(sensor.cachedEvents === undefined){
		sensor.cachedEvents = {};
	}

	sensor.cachedEvents[key] = cachedEvent;
	logger.debug('sensor is', JSON.stringify(sensor));

	var url = getUrl(event);
	activeSensors[url] = sensor;
	addCachedEventsToDatabase(key, cachedEvent, url, sensorsCollection);

	var urlParts = url.split('/');
	for (var i = 3; i < urlParts.length; i++) {
		var subUrl = _.slice(urlParts, 0, i).join('/');
		logger.debug('adding suburl', subUrl);
		activeSensors[subUrl] = sensor;
		addCachedEventsToDatabase(key, sensor, subUrl, sensorsCollection);
	}
	

	
};

var deactivateBeacon = function(event, sensorsCollection, sensor){
	sensor.streamid = event.streamid;
	var url = getUrl(event);
	removeSensor(url, sensor, sensorsCollection);
};

var getSensor = function(event, sensorsCollection, callback){
	var sensorUrl = getUrl(event);
	logger.debug('sensorUrl is ' + sensorUrl);

	logger.debug('activeSensors: ', activeSensors);
	var result = activeSensors[sensorUrl];
	if(result !== undefined){
		callback(result);
	}

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
				attached: {},
				cachedEvents: {}
			};
		}
		else{
			result = docs[0];
		}

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
		logger.verbose('new event for ' + newEvent.streamid + ': ');
		logger.debug(newEvent);
		newEvent.dateTime = event.dateTime;
		newEvent.eventDateTime = event.eventDateTime;
		newEvent.eventLocalDateTime = event.eventLocalDateTime;
		eventRepository.add(newEvent);
	};

	logger.debug('copying cached events', sensor.cachedEvents);
	_.forOwn(sensor.cachedEvents, copyToAttached);
};

var attach = function(event, sensorsCollection){
	//eas: the geosense app currently in review at the app store has geofenceUrl in the 
	// property. Once we have updated the app we can remove this.
	var url = getUrl(event);
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
	var url = event.properties.geofence || event.properties.geofenceUrl;
	url= url.toUpperCase();
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

var copyToAttachedStream = function(event, eventRepository){
	logger.debug('copying to attached streams, activeSensors: ', activeSensors);
	logger.debug('event is: ',event );
	var sensor = activeSensors[getUrl(event)];
	logger.debug('sensor: ', sensor);
	var copyToAttached = function(value, key){
		var newEvent = _.merge({}, event);
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
	if(isProximity === false){
		isProximity = _.indexOf(event.objectTags, 'geofence') >= 0; 
	}

	if(isProximity){
		logger.verbose("proximity event received");
		logger.debug("event details: ", event);
		getSensor(event, sensorsCollection, function(sensor){
			// check for enter and exit events
			var intersection = _.intersection(event.actionTags, ['enter', 'exit']);
			if(intersection[0] === 'enter'){
				attach(event, sensorsCollection);
				copyCachedEvent(event, sensor, eventRepository);
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
		logger.info("event has geofence: ", event);
		logger.debug('proximity is ' + isProximity);
		getSensor(event, sensorsCollection, function(sensor){
			logger.info('get sensor callback called', sensor);
			logger.info('passed to copy: ', event);
			activateBeacon(event, sensorsCollection, sensor);
			cacheLastEvent(event, sensorsCollection, sensor);
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