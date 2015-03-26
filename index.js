'use strict';

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
//var config = require('./config');
var redis = require('redis');
var processor = require('./processor');
var MongoClient = require('mongodb').MongoClient;

var eventSubscription = redis.createClient();
eventSubscription.subscribe('events');

// Connection URL
var url = 'mongodb://localhost:27017/quantifieddev';
// Use connect method to connect to the Server
MongoClient.connect(url, function(err, db) {
	console.log('connected to db');
	if(err){
		console.log(err);
	}
	eventSubscription.on('message', function(channel, message){
		console.log("subcrising to events");
		var event = JSON.parse(message);
		processor.processMessage(event, db.collection('sensors'));
	});
});


// Expose app
//exports = module.exports = app;

module.exports = {};