'use strict';

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
//var config = require('./config');
var redis = require('redis');
var processor = require('./processor');
var mongoClient = require('mongodb').mongoClient;

var eventSubscription = redis.createClient();
eventSubscription.subscribe('events');

eventSubscription.on('message', function(channel, message){
	var event = JSON.parse(message);
	processor.processMessage(event, mongoClient);
});

// Expose app
//exports = module.exports = app;

module.exports = {};