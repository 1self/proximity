'use strict';

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
//var config = require('./config');
var redis = require('redis');
var processor = require('./processor');
var MongoClient = require('mongodb').MongoClient;
var winston = require('winston');

winston.add(winston.transports.File, { filename: 'proximity.log', level: 'debug', json: false });

winston.error("Errors will be logged here");
winston.warn("Warns will be logged here");
winston.info("Info will be logged here");
winston.debug("Debug will be logged here");

processor.setLogger(winston);

var redisClient = redis.createClient();
redisClient.subscribe('events');

var eventRepository = {};
eventRepository.add = function(event){
	redisClient.publish('events', JSON.stringify(event));
};

// Connection URL
var url = 'mongodb://localhost:27017/quantifieddev';
// Use connect method to connect to the Server
MongoClient.connect(url, function(err, db) {

	console.log('connected to db');
	if(err){
		console.log(err);
	}

	var sensors = db.collection('sensors');

	processor.loadSensors(sensors, function() {
		redisClient.on('message', function(channel, message){
			winston.debug("message recieved from channel " + channel);
			var event = JSON.parse(message);
			processor.processMessage(event, sensors, eventRepository);
		});
	});
});


// Expose app
//exports = module.exports = app;

module.exports = {};