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

var activateBeacon = function(event, sensorsCollection, sensor){
	console.log('activating beacon ' + sensor.url);
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
	}

	sensorsCollection.update(condition, operation, options, function(err, res){
		if(err){
			console.log(err);
		} 
		else{
			console.log('Wrote to the database ' + res);
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

	sensorsCollection.find(condition).toArray(function(err, docs){
		//console.log(docs);
		var result;
		if(docs.length === 0){
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

		console.log(result);
		callback(result);
	});
};

var processMessage = function(event, sensorsCollection){
	console.log(event.objectTags);
	var isProximity = _.indexOf(event.objectTags, 'proximity') >= 0; 
	if(isProximity){
		getSensor(event, sensorsCollection, function(sensor){
			// check for enter and exit events
			var intersection = _.intersection(event.actionTags, ['enter', 'exit']);
			if(intersection[0] === 'enter'){
				//link(event.streamid, event.properties.regionId);
			} else if (intersection[0] === 'exit'){
				//unlink(event.streamid, event.properties.regionId);
			}

			var startStopIntersection = _.intersection(event.actionTags, ['start']);
			if(startStopIntersection[0] === 'start'){
				activateBeacon(event, sensorsCollection, sensor);
			}
		});
	}
};

module.exports.processMessage = processMessage;