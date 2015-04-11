'use strict';
var assert = require('assert');
var proximity = require('../processor');

var tlog = {};
tlog.verbose = function(message, meta) {
    console.log('test: ' + message);
    console.log('test: ' + JSON.stringify(meta));
};

tlog.info = function(message, meta) {
    console.log('test :' + message);
    console.log('test: ' + JSON.stringify(meta));
};

tlog.debug = function(message, meta) {
    console.log('test: ' + message);
    console.log('test: ' + JSON.stringify(meta));
};

var logger = {};
logger.verbose = function(message, meta) {
    console.log('code: ' + message);
    console.log('code: ' + JSON.stringify(meta));
};

logger.info = function(message, meta) {
    console.log('code :' + message);
    console.log('code: ' + JSON.stringify(meta));
};

logger.debug = function(message, meta) {
    console.log('code: ' + message);
    console.log('code: ' + JSON.stringify(meta));
};


describe('proximity node module', function() {
    it('ignores non proximity events', function() {
        proximity.reset();

        var event = {
            objectTags: ['test'],
            properties: {}
        };

        var repo = {

        };

        repo.write = function() {
            assert(false);
        };

        proximity.processMessage(event, repo);
    });
});

describe('proximity node module', function() {
    it('beacon start creates activation', function() {
        proximity.reset();

        var beaconStart = {
            streamid: '11111111',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['start'],
            properties: {
                regionId: 'region1',
                major: 1,
                minor: 1
            }
        };

        var sensors = {};

        var conditions = [];
        var operations = [];
        var options = [];
        sensors.update = function(condition, operation, option) {
        	conditions.push(condition);
        	operations.push(operation);
        	options.push(option);
        };

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        proximity.processMessage(beaconStart, sensors);


		assert(conditions[0].url === 'IBEACON://REGION1/1/1', 'condition for full url incorrect');
		assert(operations[0].$set.active === true, 'operation for full url did not set active true');
		assert(options[0].upsert === true, 'upsert not set for full url');
    });
});

describe('proximity node module', function() {
    it('beacon exit to unknown beacon is set to inactive and unattached', function() {
        proximity.reset();

        var beaconExit = {
            streamid: '1234',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['exit'],
            properties: {
                geofence: 'ibeacon://region1/1/1'
            }
        };

        var sensors = {};

        var updateCalled = false;
        sensors.update = function(condition, operation) {
            updateCalled = true;
            console.log('update called with ' + JSON.stringify(operation));
            
            tlog.info(operation['$unset']);
            assert(operation['$unset']['attached.1234'] === '');
        };

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        proximity.setLogger(logger);
        proximity.processMessage(beaconExit, sensors);
        assert(updateCalled === true, 'update was not called');
    });
});

describe('proximity node module', function() {
    it('beacon stop to known beacon is set to deactivated', function() {
        proximity.reset();

        var sensors = {};

        sensors.update = function() {

        };

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        var beaconStart = {
            streamid: '11111111',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['start'],
            properties: {
                regionId: 'region1',
                major: 1,
                minor: 1
            }
        };

        proximity.processMessage(beaconStart, sensors);

        var stopDeactivates = false;
        sensors.update = function(condition, operation) {
        	
        	tlog.info('updating the database');
            if (condition.url === 'IBEACON://REGION1/1/1' && operation.$set.active === false) {
                stopDeactivates = true;
            }
        };

        sensors.id = 'testsensors';
        
        tlog.info('setting up update', sensors);
        


        var beaconStop = {
            streamid: '11111111',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['stop'],
            properties: {
                regionId: 'region1',
                major: 1,
                minor: 1
            }
        };

        proximity.processMessage(beaconStop, sensors);

        assert(stopDeactivates, 'Beacon stop doesnt cause deactivation');
    });
});

describe('proximity node module', function() {
    it('beacon exit causes unattachment', function() {
        proximity.reset();

        var sensors = {};

        sensors.update = function() {

        };

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        sensors.update = function() {};

        var beaconStart = {
            streamid: '1234',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['start'],
            properties: {
                regionId: 'region1',
                major: 1,
                minor: 1
            }
        };

        proximity.processMessage(beaconStart, sensors);

        var beaconEnter = {
            streamid: '6789',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['enter'],
            properties: {
                geofence: 'ibeacon://region1/1/1'
            }
        };

        proximity.processMessage(beaconEnter, sensors);

        var beaconExit = {
            streamid: '6789',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['exit'],
            properties: {
                geofence: 'ibeacon://region1/1/1'
            }
        };

        var streamUnattached;
        sensors.update = function(condition, operation) {
            
            tlog.info('operation is: ', operation);
            streamUnattached = operation.$unset['attached.6789'] === '';
        };

        proximity.processMessage(beaconExit, sensors);

        assert(streamUnattached, 'Stream wasnt unattached on geofence exit');
    });
});

describe('proximity node module', function() {
    it('sensor reading after app restart copies to attached streams', function() {
        proximity.reset();
        
        tlog.info('');
        tlog.info('================================================================');
        tlog.info('test: any event with geofence property is considered for copying');
        tlog.info('================================================================');

        var sensors = {};
        tlog.info(sensors);

        sensors.update = function() {
        };

        sensors.find = function() {
            var cached = {};
       

            var result = {
                url: 'ibeacon://AAAAAAAAAAAAAA/1/1',
                streamid: '1111',
                active: false,
                attached: {
                	'2222': true
                },
                cachedEvents: cached
            };

            var toArray = function(callback){
            	callback(null, [result]);
            };

            return {toArray: toArray};
        };


        var geofenceSensorReading2 = {
            streamid: '1111',
            objectTags: ['ambient', 'temperature'],
            actionTags: ['sample'],
            dateTime: '2015-04-08T09:30.000+01:00',
            geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
            properties: {
                celsius: 23
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        var eventCopied;
        var events = {};
        events.add = function(event) {
            eventCopied = event;
        };

        
        tlog.info(events);        
        tlog.info(eventCopied);
        proximity.processMessage(geofenceSensorReading2, sensors, events);
        assert(eventCopied !== undefined, 'The event wasnt copied');
        assert(eventCopied.objectTags[0] === 'ambient' && eventCopied.objectTags[1] === 'temperature', 'Object tags werent copied');
        assert(eventCopied.actionTags[0] === 'sample', 'Action tags werent copied');
        assert(eventCopied.originalGeofence === 'ibeacon://AAAAAAAAAAAAAA/1/1', 'Original geofence wasnt copied');
        assert(eventCopied.streamid === '2222', 'Stream id wasnt copied');
        assert(eventCopied.properties.celsius === 23, 'celsius wasnt copied');
    });
});

describe('proximity node module', function() {
    it('uppercase sensor reading geofence matches lower case enter event geofence', function() {
        proximity.reset();

        tlog.info('');
        tlog.info('===================================================================================');
        tlog.info('test: uppercase sensor reading geofence matches lower case enter event geofence');
        tlog.info('===================================================================================');

        var sensors = {};
        tlog.info(sensors);

        sensors.update = function() {

        };

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        var geofenceSensorReading1 = {
            streamid: '2222',
            objectTags: ['ambient', 'temperature'],
            actionTags: ['sample'],
            dateTime: '2015-04-08T09:25.000+01:00',
            geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
            properties: {
                celsius: 23
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };
        
        tlog.info('test: process reading 1');

        proximity.processMessage(geofenceSensorReading1, sensors);

        var beaconAttached = false;
        sensors.update = function() {
            beaconAttached = true;
        };

        sensors.find = function() {
            var cached = {};
            cached['ambient-temperature-sample'] = {
                streamid: '2222',
                objectTags: ['ambient', 'temperature'],
                actionTags: ['sample'],
                dateTime: '2015-04-08T09:25.000+01:00',
                geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
                properties: {
                    celsius: 23
                },
                eventDateTime: new Date(),
                eventLocalDateTime: new Date()
            };

            var result = {
                url: 'ibeacon://AAAAAAAAAAAAAA',
                streamid: '2222',
                active: false,
                attached: {},
                cachedEvents: cached
            };

            var toArray = function(callback){
            	callback(null, [result]);
            };

            return {toArray: toArray};
        };

        var geofenceEnter = {
            streamid: '1111',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['enter'],
            properties: {
                geofence: 'ibeacon://aaaaaaaaaaaaaa'
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        var eventRepository = {};
         var events = [];
        eventRepository.add = function(event){
        	events.push(event);
        };
        proximity.processMessage(geofenceEnter, sensors, eventRepository);

        assert(beaconAttached, 'update to the attached streams was not called');
        assert(events.length === 1, 'wrong number of events added: '  + events.length);
        assert(events[0].objectTags[0] === 'ambient', 'wrong event copied');

    });
});

describe('proximity node module', function() {
    it('lowercase sensor geofence and upper case proximity event geofence are matched', function() {
        proximity.reset();

        tlog.info('');
        tlog.info('==================================================');
        tlog.info('test: lowercase sensor geofence and upper case proximity event geofence are matched');
        tlog.info('==================================================');

        var sensors = {};
        
        tlog.info(sensors);

        sensors.update = function() {

        };

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };



        var geofenceSensorReading1 = {
            streamid: '2222',
            objectTags: ['ambient', 'temperature'],
            actionTags: ['sample'],
            dateTime: '2015-04-08T09:25.000+01:00',
            geofence: 'ibeacon://aaaaaaaaaaaaaa/1/1',
            properties: {
                celsius: 23
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        
        tlog.info('test: process reading 1');

        proximity.processMessage(geofenceSensorReading1, sensors);

        var beaconAttached = false;
        sensors.update = function() {
            beaconAttached = true;
        };

        sensors.find = function() {
            var cached = {};
            cached['ambient-temperature-sample'] = {
                streamid: '2222',
                objectTags: ['ambient', 'temperature'],
                actionTags: ['sample'],
                dateTime: '2015-04-08T09:25.000+01:00',
                geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
                properties: {
                    celsius: 23
                },
                eventDateTime: new Date(),
                eventLocalDateTime: new Date()
            };

            var result = {
                url: 'ibeacon://AAAAAAAAAAAAAA',
                streamid: '2222',
                active: false,
                attached: {},
                cachedEvents: cached
            };

            var toArray = function(callback){
            	callback(null, [result]);
            };

            return {toArray: toArray};
        };

        var geofenceEnter = {
            streamid: '1111',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['enter'],
            properties: {
                geofence: 'ibeacon://AAAAAAAAAAAAAA'
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

		var eventRepository = {};
        var events = [];
        eventRepository.add = function(event){
        	events.push(event);
        };
        proximity.processMessage(geofenceEnter, sensors, eventRepository);

        assert(beaconAttached, 'update to the attached streams was not called');
        assert(events.length === 1, 'wrong number of events added: '  + events.length);
        assert(events[0].objectTags[0] === 'ambient', 'wrong event copied');

    });
});

describe('proximity node module', function() {
    it('uppercase sensor reading geofenceUrl matches lower case enter event geofenceUrl', function() {
        proximity.reset();

        tlog.info('');
        tlog.info('===================================================================================');
        tlog.info('test: uppercase sensor reading geofence matches lower case enter event geofence');
        tlog.info('===================================================================================');

        var sensors = {};
        tlog.info(sensors);

        sensors.update = function() {

        };

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        var geofenceSensorReading1 = {
            streamid: '2222',
            objectTags: ['ambient', 'temperature'],
            actionTags: ['sample'],
            dateTime: '2015-04-08T09:25.000+01:00',
            geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
            properties: {
                celsius: 23
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };
        
        tlog.info('test: process reading 1');

        proximity.processMessage(geofenceSensorReading1, sensors);

		sensors.find = function() {
            var cached = {};
            cached['ambient-temperature-sample'] = {
                streamid: '2222',
                objectTags: ['ambient', 'temperature'],
                actionTags: ['sample'],
                dateTime: '2015-04-08T09:25.000+01:00',
                geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
                properties: {
                    celsius: 23
                },
                eventDateTime: new Date(),
                eventLocalDateTime: new Date()
            };

            var result = {
                url: 'ibeacon://AAAAAAAAAAAAAA',
                streamid: '2222',
                active: false,
                attached: {},
                cachedEvents: cached
            };

            var toArray = function(callback){
            	callback(null, [result]);
            };

            return {toArray: toArray};
        };
        var beaconAttached = false;
        sensors.update = function() {
            beaconAttached = true;
        };

        var geofenceEnter = {
            streamid: '1111',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['enter'],
            properties: {
                geofenceUrl: 'ibeacon://aaaaaaaaaaaaaa'
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        var eventRepository = {};
        var events = [];
        eventRepository.add = function(event){
        	events.push(event);
        };
        proximity.processMessage(geofenceEnter, sensors, eventRepository);

        assert(beaconAttached, 'update to the attached streams was not called');
        assert(events.length === 1, 'wrong number of events added: '  + events.length);
        assert(events[0].objectTags[0] === 'ambient', 'wrong event copied');

    });
});

describe('proximity node module', function() {
    it('lowercase sensor geofenceUrl and upper case proximity event geofenceUrl are matched', function() {
        proximity.reset();

        tlog.info('');
        tlog.info('==================================================');
        tlog.info('test: lowercase sensor geofence and upper case proximity event geofence are matched');
        tlog.info('==================================================');

        var sensors = {};
        
        tlog.info(sensors);

        sensors.update = function() {

        };

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };



        var geofenceSensorReading1 = {
            streamid: '2222',
            objectTags: ['ambient', 'temperature'],
            actionTags: ['sample'],
            dateTime: '2015-04-08T09:25.000+01:00',
            geofence: 'ibeacon://aaaaaaaaaaaaaa/1/1',
            properties: {
                celsius: 23
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        
        tlog.info('test: process reading 1');

        proximity.processMessage(geofenceSensorReading1, sensors);

        var beaconAttached = false;
        sensors.update = function() {
            beaconAttached = true;
        };

        sensors.find = function() {
            var cached = {};
            cached['ambient-temperature-sample'] = {
                streamid: '2222',
                objectTags: ['ambient', 'temperature'],
                actionTags: ['sample'],
                dateTime: '2015-04-08T09:25.000+01:00',
                geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
                properties: {
                    celsius: 23
                },
                eventDateTime: new Date(),
                eventLocalDateTime: new Date()
            };

            var result = {
                url: 'ibeacon://AAAAAAAAAAAAAA',
                streamid: '2222',
                active: false,
                attached: {},
                cachedEvents: cached
            };

            var toArray = function(callback){
            	callback(null, [result]);
            };

            return {toArray: toArray};
        };

        var geofenceEnter = {
            streamid: '1111',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['enter'],
            properties: {
                geofenceUrl: 'ibeacon://AAAAAAAAAAAAAA'
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

		var eventRepository = {};
		var events = [];
        eventRepository.add = function(event){
        	events.push(event);
        };
        proximity.processMessage(geofenceEnter, sensors, eventRepository);

        assert(beaconAttached, 'update to the attached streams was not called');
        assert(events.length === 1, 'wrong number of events added: '  + events.length);
        assert(events[0].objectTags[0] === 'ambient', 'wrong event copied');

    });
});

describe('proximity node module', function() {
    it('events are copied to attached streams', function() {
        proximity.reset();

        tlog.info('');
        tlog.info('==================================================');
        tlog.info('test: lowercase sensor geofence and upper case proximity event geofence are matched');
        tlog.info('==================================================');

        var sensors = {};
        
        tlog.info(sensors);

        sensors.update = function() {

        };

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        var geofenceSensorReading1 = {
            streamid: '2222',
            objectTags: ['ambient', 'temperature'],
            actionTags: ['sample'],
            dateTime: '2015-04-08T09:25.000+01:00',
            geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
            properties: {
                celsius: 23
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        
        tlog.info('test: process reading 1');

        proximity.processMessage(geofenceSensorReading1, sensors);

        var beaconAttached = false;
        sensors.update = function() {
            beaconAttached = true;
        };

        sensors.find = function() {
            var cached = {};
            cached['ambient-temperature-sample'] = {
                streamid: '2222',
                objectTags: ['ambient', 'temperature'],
                actionTags: ['sample'],
                dateTime: '2015-04-08T09:25.000+01:00',
                geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
                properties: {
                    celsius: 23
                },
                eventDateTime: new Date(),
                eventLocalDateTime: new Date()
            };

            var result = {
                url: 'IBEACON://AAAAAAAAAAAAAA/1/1',
                streamid: '2222',
                active: false,
                attached: {},
                cachedEvents: cached
            };

            var toArray = function(callback){
            	callback(null, [result]);
            };

            return {toArray: toArray};
        };

        var geofenceEnter = {
            streamid: '1111',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['enter'],
            properties: {
                geofenceUrl: 'ibeacon://AAAAAAAAAAAAAA'
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

		var eventRepository = {};
		var events = [];
        eventRepository.add = function(event){
        	events.push(event);
        };
        proximity.processMessage(geofenceEnter, sensors, eventRepository);       
        tlog.info('test: process reading 1');

        events = [];
        proximity.processMessage(geofenceSensorReading1, sensors, eventRepository);
        assert(events.length === 1, 'events length is incorrect: ' + events.length);

    });
});

describe('proximity node module', function() {
    it('events are not copied after proximity exit', function() {
        proximity.reset();

        tlog.info('');
        tlog.info('==================================================');
        tlog.info('test: lowercase sensor geofence and upper case proximity event geofence are matched');
        tlog.info('==================================================');

        var sensors = {};
        
        tlog.info(sensors);

        sensors.update = function() {

        };

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        var geofenceSensorReading1 = {
            streamid: '2222',
            objectTags: ['ambient', 'temperature'],
            actionTags: ['sample'],
            dateTime: '2015-04-08T09:25.000+01:00',
            geofence: 'ibeacon://aaaaaaaaaaaaaa/1/1',
            properties: {
                celsius: 23
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        
        tlog.info('test: process reading 1');

        proximity.processMessage(geofenceSensorReading1, sensors);

        var beaconAttached = false;
        sensors.update = function() {
            beaconAttached = true;
        };

        sensors.find = function() {
            var cached = {};
            cached['ambient-temperature-sample'] = {
                streamid: '2222',
                objectTags: ['ambient', 'temperature'],
                actionTags: ['sample'],
                dateTime: '2015-04-08T09:25.000+01:00',
                geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
                properties: {
                    celsius: 23
                },
                eventDateTime: new Date(),
                eventLocalDateTime: new Date()
            };

            var result = {
                url: 'IBEACON://AAAAAAAAAAAAAA',
                streamid: '2222',
                active: false,
                attached: {},
                cachedEvents: cached
            };

            var toArray = function(callback){
            	callback(null, [result]);
            };

            return {toArray: toArray};
        };

        var geofenceEnter = {
            streamid: '1111',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['enter'],
            properties: {
                geofenceUrl: 'ibeacon://AAAAAAAAAAAAAA'
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

		var events = [];
        var eventRepository = {};
        eventRepository.add = function(event){
        	events.push(event);
        };

        proximity.processMessage(geofenceEnter, sensors, eventRepository);       
        tlog.info('test: process reading 1');
        
        proximity.processMessage(geofenceSensorReading1, sensors, eventRepository);

        var geofenceExit = {
            streamid: '1111',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['exit'],
            properties: {
                geofenceUrl: 'ibeacon://AAAAAAAAAAAAAA'
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        proximity.processMessage(geofenceExit, sensors, eventRepository);       

        events = [];
        eventRepository.add = function(event){
        	events.push(event);
        };
        proximity.processMessage(geofenceSensorReading1, sensors, eventRepository);
		assert(events.length === 0, 'events length is incorrect');
    });
});

describe('proximity node module', function() {
    it('events are not copied once geofence has been left', function() {
        proximity.reset();

        tlog.info('');
        tlog.info('==================================================');
        tlog.info('test: events are not copied once geofence has been left');
        tlog.info('==================================================');

        var sensors = {};

        tlog.info(sensors);

        sensors.update = function() {

        };

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        sensors.update = function() {};

        var geofenceSensorReading1 = {
            streamid: '2222',
            objectTags: ['ambient', 'temperature'],
            actionTags: ['sample'],
            dateTime: '2015-04-08T09:25.000+01:00',
            geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
            properties: {
                celsius: 23
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        
        tlog.info('test: process reading 1');

        proximity.processMessage(geofenceSensorReading1, sensors);

        var geofenceEnter = {
            streamid: '1111',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['enter'],
            properties: {
                geofence: 'ibeacon://AAAAAAAAAAAAAA'
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        var eventRepository = {};
        eventRepository.add = function(){

        };

        proximity.processMessage(geofenceEnter, sensors, eventRepository);

        var geofenceSensorReading2 = {
            streamid: '2222',
            objectTags: ['ambient', 'temperature'],
            actionTags: ['sample'],
            dateTime: '2015-04-08T09:30.000+01:00',
            geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
            properties: {
                celsius: 23
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        var eventCopied = {};
        var events = {};
        events.add = function(event) {
            eventCopied = event;
        };

        
        tlog.info(events);
        
        tlog.info(eventCopied);
        proximity.processMessage(geofenceSensorReading2, sensors, events);
        assert(eventCopied !== undefined, 'The event wasnt copied while inside the geofence');

        var geofenceExit = {
            streamid: '1111',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['exit'],
            properties: {
                geofence: 'ibeacon://AAAAAAAAAAAAAA'
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        eventCopied = false;
        proximity.processMessage(geofenceExit, sensors);
        assert(eventCopied === false, 'event was copied after geofence was left');
    });
});


describe('proximity node module', function() {
    it('attaching to a sensor with no data logged doesnt copy data', function() {
        proximity.reset();

        var sensors = {};

        sensors.update = function() {};

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        sensors.update = function() {};

        var region1Start = {
            streamid: '1234',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['start'],
            properties: {
                regionId: 'region1',
                major: 1,
                minor: 1
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        proximity.processMessage(region1Start, sensors);

        var region1Enter = {
            streamid: '5678',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['enter'],
            properties: {
                geofence: 'ibeacon://region1/1/1'
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        var events = {};

        var eventCopied;
        events.add = function(event) {
            eventCopied = event;
        };

        proximity.processMessage(region1Enter, sensors);
        assert(eventCopied === undefined, 'Didnt attach to second region');
    });
});

describe('proximity node module', function() {
    it('sending a geofenced sensor reading caches the last value', function() {
        proximity.reset();

        var sensors = {};

        sensors.update = function() {};

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        sensors.update = function() {};

        var region1Start = {
            streamid: '1234',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['start'],
            properties: {
                regionId: 'region1',
                major: 1,
                minor: 1
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        proximity.processMessage(region1Start, sensors);

        var geofenceSensorReading1 = {
            streamid: '2222',
            objectTags: ['ambient', 'temperature'],
            actionTags: ['sample'],
            dateTime: '2015-04-08T09:25.000+01:00',
            geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
            properties: {
                celsius: 23
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        
        tlog.info('test: process reading 1');

        var conditions = [];
        var operations = [];
        sensors.update = function(condition, operation) {
            conditions.push(condition);
            operations.push(operation);
        };

        proximity.processMessage(geofenceSensorReading1, sensors);

        
        tlog.info('condition: ', conditions);

        // updates to set the streamid etc are set first
        assert(conditions[0].url === 'IBEACON://AAAAAAAAAAAAAA/1/1', 'beacon full url is incorrect');

        // then there should be an update for caching the event
        assert(conditions[1].url === 'IBEACON://AAAAAAAAAAAAAA/1/1', 'beacon full url is incorrect');
        
        tlog.info('operation', operations);
        
        tlog.info('$set', operations[1]['$set']);

        // first set stream ids etc
        assert(operations[0]['$set']['streamid'] === '2222', 'stream id not set for full url');

        assert(operations[1]['$set']['cachedEvents.ambient-temperature-sample'].streamid === '2222', 'cachedEvents not saved properly');
        assert(operations[1]['$set']['cachedEvents.ambient-temperature-sample'].objectTags[0] === 'ambient', 'objectTags not saved properly');

        assert(operations.length === 2, 'too many updates were called');
    });
});

describe('proximity node module', function() {
    it('gefence sensors cache for each event type', function() {
        proximity.reset();

        var sensors = {};

        sensors.update = function() {};

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        sensors.update = function() {};

        var region1Start = {
            streamid: '1234',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['start'],
            properties: {
                regionId: 'region1',
                major: 1,
                minor: 1
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        proximity.processMessage(region1Start, sensors);

        var geofenceSensorReading1 = {
            streamid: '2222',
            objectTags: ['ambient', 'temperature'],
            actionTags: ['sample'],
            dateTime: '2015-04-08T09:25.000+01:00',
            geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
            properties: {
                celsius: 23
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        
        tlog.info('test: process reading 1');

        var conditions = [];
        var operations = [];
        sensors.update = function(condition, operation) {
            conditions.push(condition);
            operations.push(operation);
        };

        proximity.processMessage(geofenceSensorReading1, sensors);

        var geofenceSensorReading2 = {
            streamid: '2222',
            objectTags: ['ambient', 'noise'],
            actionTags: ['sample'],
            dateTime: '2015-04-08T09:25.000+01:00',
            geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
            properties: {
                dbspl: 45
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        proximity.processMessage(geofenceSensorReading2, sensors);

        
        tlog.info(operations);

        assert(conditions[0].url === 'IBEACON://AAAAAAAAAAAAAA/1/1', 'beacon url is incorrect');
        assert(operations[1]['$set']['cachedEvents.ambient-temperature-sample'].streamid === '2222', 'cachedEvents not saved properly');
        assert(conditions[2].url === 'IBEACON://AAAAAAAAAAAAAA/1/1', 'second beacon url is incorrect');
        assert(operations[3]['$set']['cachedEvents.ambient-noise-sample'].streamid === '2222', 'second cachedEvents not saved properly');


    });
});

describe('proximity node module', function() {
    it('entering sensor proximity causes last sensor value to be copied', function() {
        proximity.reset();

        var sensors = {};

        sensors.update = function() {};

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        sensors.update = function() {};

        var region1Start = {
            streamid: '1234',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['start'],
            properties: {
                regionId: 'region1',
                major: 1,
                minor: 1
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        proximity.processMessage(region1Start, sensors);

        var geofenceSensorReading1 = {
            streamid: '2222',
            objectTags: ['ambient', 'temperature'],
            actionTags: ['sample'],
            dateTime: '2015-04-08T09:25.000+01:00',
            geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
            properties: {
                celsius: 23
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        proximity.processMessage(geofenceSensorReading1, sensors);

        var region1Enter = {
            streamid: '5678',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['enter'],
            properties: {
                geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1'
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        var events = {};

        var eventCopied;
        events.add = function(event) {
            eventCopied = event;
        };


        sensors.find = function() {
            var cached = {};
            cached['ambient-temperature-sample'] = {
                streamid: '2222',
                objectTags: ['ambient', 'temperature'],
                actionTags: ['sample'],
                dateTime: '2015-04-08T09:25.000+01:00',
                geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
                properties: {
                    celsius: 23
                },
                eventDateTime: new Date(),
                eventLocalDateTime: new Date()
            };

            var result = {
                url: 'ibeacon://AAAAAAAAAAAAAA',
                streamid: '2222',
                active: false,
                attached: {},
                cachedEvents: cached
            };

            var toArray = function(callback){
            	callback(null, [result]);
            };

            return {toArray: toArray};
        };

       
        proximity.processMessage(region1Enter, sensors, events);
        
        tlog.info('event copied is ', eventCopied);
        assert(eventCopied.streamid === '5678', 'Didnt copy event on attach');
    });
});

describe('proximity node module', function() {
    it('entering sensor proximity causes last sensor value to be copied', function() {
        proximity.reset();

        var sensors = {};

        sensors.update = function() {};

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        sensors.update = function() {};

        var region1Start = {
            streamid: '1234',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['start'],
            properties: {
                regionId: 'region1',
                major: 1,
                minor: 1
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        proximity.processMessage(region1Start, sensors);

        var geofenceSensorReading1 = {
            streamid: '2222',
            objectTags: ['ambient', 'temperature'],
            actionTags: ['sample'],
            dateTime: '2015-04-08T09:25.000+01:00',
            geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
            properties: {
                celsius: 23
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        proximity.processMessage(geofenceSensorReading1, sensors);

        var region1Enter = {
            streamid: '5678',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['enter'],
            properties: {
                geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1'
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        var events = {};

        var eventCopied;
        events.add = function(event) {
            eventCopied = event;
        };


        sensors.find = function() {
            var cached = {};
            cached['ambient-temperature-sample'] = {
                streamid: '2222',
                objectTags: ['ambient', 'temperature'],
                actionTags: ['sample'],
                dateTime: '2015-04-08T09:25.000+01:00',
                geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
                properties: {
                    celsius: 23
                },
                eventDateTime: new Date(),
                eventLocalDateTime: new Date()
            };

            var result = {
                url: 'ibeacon://AAAAAAAAAAAAAA',
                streamid: '2222',
                active: false,
                attached: {},
                cachedEvents: cached
            };

            var toArray = function(callback){
            	callback(null, [result]);
            };

            return {toArray: toArray};
        };

       
        proximity.processMessage(region1Enter, sensors, events);
        
        tlog.info('event copied is ', eventCopied);
        assert(eventCopied.streamid === '5678', 'Didnt copy event on attach');
    });
});

describe('proximity node module', function() {
    it('after the prox service is restarted, proximity enter events trigger a copy of the cached event', function() {
        proximity.reset();

        var sensors = {};

        sensors.update = function() {};

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        sensors.update = function() {};

        var region1Enter = {
            streamid: '5678',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['enter'],
            properties: {
                geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1'
            },
            eventDateTime: {
                $date: '2015-04-08T09:25.000+01:00'
            },
            eventLocalDateTime: {
                $date: '2015-04-08T10:25.000Z'
            }
        };

        var events = {};

        var eventCopied;
        events.add = function(event) {
            eventCopied = event;
        };


        sensors.find = function() {
            var cached = {};
            cached['ambient-temperature-sample'] = {
                streamid: '2222',
                objectTags: ['ambient', 'temperature'],
                actionTags: ['sample'],
                dateTime: '2015-04-08T09:25.000+01:00',
                geofence: 'ibeacon://AAAAAAAAAAAAAA/1/1',
                properties: {
                    celsius: 23
                },
                eventDateTime: new Date(),
                eventLocalDateTime: new Date()
            };

            var result = {
                url: 'ibeacon://AAAAAAAAAAAAAA',
                streamid: '2222',
                active: false,
                attached: {},
                cachedEvents: cached
            };

            var toArray = function(callback){
            	callback(null, [result]);
            };

            return {toArray: toArray};
        };

       
        proximity.processMessage(region1Enter, sensors, events);
        
        tlog.info('event copied is ', eventCopied);
        assert(eventCopied.streamid === '5678', 'Didnt copy event on attach');
    });
});


// events are not copied once a user leaves a geofence

// entering an unknown beacon does not cause an attach
// exiting an unknown beacon does not cause detach
// entering known beacon attaches it
// exiting a known beacon detaches it
// attached streams are persisted between application runs

describe('proximity node module', function() {
    it('active sensor data is copied', function() {
        //assert(false);
    });
});

describe('proximity node module', function() {
    it('active sensor state is persisted between app execution', function() {
        //assert(false);
    });
});

// to 
describe('proximity node module', function() {
    // it('enter event causes stream to be stored against regionId', function () {
    // 	var beaconStart = {
    // 		streamid: 's1',
    // 		objectTags:['proximity'],
    // 		actionTags:['start'],
    // 		properties:{
    // 			regionId: 'region1',
    // 			major: 1,
    // 			minor: 1
    // 		}
    // 	};

    // 	var repo = {};

    // 	var writeRegionStreamMapping = false;
    // 	repo.writeRegionStreamMapping = function(regionStreamMapping){
    // 		assert(regionStreamMapping['region1'] === 's1');
    // 		writeRegionStreamMapping = true;
    // 	};


    //   proximity.processMessage(beaconStart, repo);
    //   assert(writeRegionStreamMapping, 'write beacon not called');
    // });
});


describe('proximity node module', function() {
    // it('enter event causes stream to be stored against regionId', function () {
    // 	var beaconStart = {
    // 		streamid: 's1',
    // 		objectTags:['proximity'],
    // 		actionTags:['start'],
    // 		properties:{
    // 			regionId: 'region1',
    // 			major: 1,
    // 			minor: 1
    // 		}
    // 	};

    // 	var repo = {};

    // 	var writeRegionStreamMapping = false;
    // 	repo.writeRegionStreamMapping = function(regionStreamMapping){
    // 		assert(regionStreamMapping['region1'] === 's1');
    // 		writeRegionStreamMapping = true;
    // 	};


    //   proximity.processMessage(beaconStart, repo);
    //   assert(writeRegionStreamMapping, 'write beacon not called');
    // });
});

describe('proximity node module', function() {
    // it('entering an unknown region ignored', function () {
    // 	var beaconEnter = {
    // 		streamid: 's1',
    // 		objectTags:['proximity'],
    // 		actionTags:['enter'],
    // 		properties:{
    // 			regionId: 'region1',
    // 			major: 1,
    // 			minor: 1
    // 		}
    // 	};

    // 	var mongoClient = {
    // 		sensors: {}
    // 	};

    // mongoClient.update = function(condition, operation){
    // 	assert(false);
    // };

    //  proximity.processMessage(beaconEnter, mongoClient);
    //  assert(writeRegionStreamMapping, 'write beacon not called');
    // });
});

// describe('proximity node module', function () {
//   it('entering an known region links the streamss', function () {
//   	var beaconStart = {
//   		streamid: 's1',
//   		objectTags:['proximity'],
//   		actionTags:['start'],
//   		properties:{
//   			regionId: 'region1',
//   			major: 1,
//   			minor: 1
//   		}
//   	};

//   	var beaconEnter = {
//   		streamid: 's2',s
//   		objectTags:['proximity'],
//   		actionTags:['enter'],
//   		properties:{
//   			regionId: 'region1',
//   			major: 1,
//   			minor: 1
//   		}
//   	};

//   	var repo = {};

//   	repo.writeRegionStreamMapping = function(regionStreamMapping){

//   	};

//     proximity.processMessage(beaconEnter, repo);
//     assert(writeRegionStreamMapping, 'write beacon not called');
//   });
// });