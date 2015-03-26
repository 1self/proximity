'use strict';

var _ = require('lodash');

//var link = function(streamid, region, repo){
// 	console.log("linking");
 	//var publicStreamId = regionStreamMapping[region];
 	// if(publicStreamId === undefined){
 	// 	console.log("couldn't link to unknown beacon " + region);
 	// 	return;
 	// }
 	// if(publicStreamId === streamid){
 	// 	console.log("can't connect a stream back to itself");
 	// }

// 	if(connectedStreams[publicStreamId] === undefined){
// 		connectedStreams[publicStreamId] = {};
// 	}

 	// var linkedStreams = {
 	// 	'publicStream': publicStreamId,
 	// 	'linkedStream': streamid
 	// };

// 	repo.writeConnectedStreams

  //};

//  var unlink = function(streamid, region){
//  	console.log("unlinking");
//  	//var publicStreamId = regionStreamMapping[region];

//  //	delete connectedStreams[publicStreamId][streamid];
//  	//console.log(JSON.stringify(connectedStreams));
// };

var activateBeacon = function(event, mongoClient, sensor){
	var updateQuery = {
		url: sensor.url
	};

	var update = {
		$set: {
			active: true
		}
	};

	mongoClient.sensors.update(updateQuery, update);
};

var getSensor = function(event, mongoClient){
	var sensorUrl = [
		'ibeacon:/', 
		event.properties.regionId, 
		event.properties.major,
		event.properties.minor].join('/');
	var condition = {
		url: sensorUrl
	};

	var result = mongoClient.sensors.find(condition);
	if(result === null){
		result = {
			url: sensorUrl, 
			streamid: event.streamid, 
			active: false,
			connectedStreamIds: {}
		};
	}

	return result;
};

var processMessage = function(event, mongoClient){
	console.log(event.objectTags);
	var isProximity = _.indexOf(event.objectTags, 'proximity') >= 0; 
	if(isProximity){
		var sensor = getSensor(event, mongoClient);
		console.log(sensor);

		// check for enter and exit events
		var intersection = _.intersection(event.actionTags, ['enter', 'exit']);
		if(intersection[0] === 'enter'){
			//link(event.streamid, event.properties.regionId);
		} else if (intersection[0] === 'exit'){
			//unlink(event.streamid, event.properties.regionId);
		}

		var startStopIntersection = _.intersection(event.actionTags, ['start']);
		if(startStopIntersection[0] === 'start'){
			
			activateBeacon(event, mongoClient, sensor);
		}
	}
};

module.exports.processMessage = processMessage;