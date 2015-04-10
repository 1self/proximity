'use strict';
var assert = require('assert');
var proximity = require('../processor');

var logger = {};
logger.verbose = function(message, meta) {
    console.log(message);
    console.log(meta);
};

logger.info = function(message, meta) {
    console.log(message);
    console.log(meta);
};

logger.debug = function(message, meta) {
    console.log(message);
    console.log(meta);
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

        var beaconActivated = false;

        sensors.update = function(condition, operation, options) {
            if (condition.url === 'ibeacon://region1/1/1' && operation.$set.active === true && options.upsert === true) {
                beaconActivated = true;
            }
        };

        sensors.find = function() {
            var result = {};
            result.toArray = function(callback) {
                callback(null, []);
            };
            return result;
        };

        proximity.processMessage(beaconStart, sensors);
        assert(beaconActivated, 'database not updated with beacon active');
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
            console.log(operation['$unset']);
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
        assert(updateCalled === false, 'update was called');
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
            if (condition.url === 'ibeacon://region1/1/1' && operation.$set.active === false) {
                stopDeactivates = true;
            }
        };

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
    it('beacon stop deactivates it', function() {
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
            if (condition.url === 'ibeacon://region1/1/1' && operation.$set.active === false) {
                stopDeactivates = true;
            }
        };

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
            console.log(operation);
            streamUnattached = operation.$unset['attached.6789'] === '';
        };

        proximity.processMessage(beaconExit, sensors);

        assert(streamUnattached, 'Stream wasnt unattached on geofence exit');
    });
});

describe('proximity node module', function() {
    it('geofenced can be entered while in another geofence', function() {
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

        var region1Start = {
            streamid: '1234',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['start'],
            properties: {
                regionId: 'region1',
                major: 1,
                minor: 1
            }
        };

        proximity.processMessage(region1Start, sensors);

        var region2Start = {
            streamid: '2345',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['start'],
            properties: {
                regionId: 'region2',
                major: 1,
                minor: 1
            }
        };

        proximity.processMessage(region2Start, sensors);

        var region1Enter = {
            streamid: '5678',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['enter'],
            properties: {
                geofence: 'ibeacon://region1/1/1'
            }
        };

        proximity.processMessage(region1Enter, sensors);

        var region2Enter = {
            streamid: '6789',
            objectTags: ['proximity', 'ibeacon'],
            actionTags: ['enter'],
            properties: {
                geofence: 'ibeacon://region2/1/1'
            }
        };

        var region2Attached = false;
        sensors.update = function(condition, operation) {
            console.log(operation);
            region2Attached = operation.$set['attached.6789'] === true;
        };

        proximity.processMessage(region2Enter, sensors);

        assert(region2Attached, 'Didnt attach to second region');
    });
});

describe('proximity node module', function() {
    it('any event with geofence property is considered for copying', function() {
        proximity.reset();

        console.log('');
        console.log('==================================================');
        console.log('test: any event with geofence property is considered for copying');
        console.log('==================================================');

        var sensors = {};

        console.log(sensors);

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

        console.log('test: process reading 1');

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

        proximity.processMessage(geofenceEnter, sensors);

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

        logger.info(events);
        logger.info(eventCopied);
        proximity.processMessage(geofenceSensorReading2, sensors, events);
        assert(eventCopied !== undefined, 'The event wasnt copied');
        assert(eventCopied.objectTags[0] === 'ambient' && eventCopied.objectTags[1] === 'temperature', 'Object tags werent copied');
        assert(eventCopied.actionTags[0] === 'sample', 'Action tags werent copied');
        assert(eventCopied.originalGeofence === 'ibeacon://AAAAAAAAAAAAAA/1/1', 'Original geofence wasnt copied');
        assert(eventCopied.streamid === '1111', 'Stream id wasnt copied');
        assert(eventCopied.properties.celsius === 23, 'celsius wasnt copied');
    });
});

describe('proximity node module', function() {
    it('uppercase sensor geofence and lower case proximity event geofence are matched', function() {
        proximity.reset();

        console.log('');
        console.log('==================================================');
        console.log('test: uppercase sensor geofence and lower case proximity event geofence are matched');
        console.log('==================================================');

        var sensors = {};

        console.log(sensors);

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

        console.log('test: process reading 1');

        proximity.processMessage(geofenceSensorReading1, sensors);

        var beaconAttached = false;
        sensors.update = function() {
            beaconAttached = true;
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

        proximity.processMessage(geofenceEnter, sensors);

        assert(beaconAttached, 'update to the attached streams was not called');

    });
});

describe('proximity node module', function() {
    it('lowercase sensor geofence and upper case proximity event geofence are matched', function() {
        proximity.reset();

        console.log('');
        console.log('==================================================');
        console.log('test: lowercase sensor geofence and upper case proximity event geofence are matched');
        console.log('==================================================');

        var sensors = {};

        console.log(sensors);

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

        console.log('test: process reading 1');

        proximity.processMessage(geofenceSensorReading1, sensors);

        var beaconAttached = false;
        sensors.update = function() {
            beaconAttached = true;
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

        proximity.processMessage(geofenceEnter, sensors);

        assert(beaconAttached, 'update to the attached streams was not called');

    });
});

describe('proximity node module', function() {
    it('events are not copied once geofence has been left', function() {
        proximity.reset();

        console.log('');
        console.log('==================================================');
        console.log('test: any event with geofence property is considered for copying');
        console.log('==================================================');

        var sensors = {};

        console.log(sensors);

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

        console.log('test: process reading 1');

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

        proximity.processMessage(geofenceEnter, sensors);

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

        logger.info(events);
        logger.info(eventCopied);
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
    it('geofenceUrl is also detected in properties and used to copy events', function() {
        proximity.reset();

        console.log('');
        console.log('==================================================');
        console.log('test: geofenceUrl is also detected in properties and used to copy events');
        console.log('==================================================');

        var sensors = {};

        console.log(sensors);

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

        console.log('test: process reading 1');

        proximity.processMessage(geofenceSensorReading1, sensors);

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

        proximity.processMessage(geofenceEnter, sensors);

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

        var eventCopied;
        var events = {};
        events.add = function(event) {
            eventCopied = event;
            logger.info('event added');
        };

        logger.info(events);
        logger.info(eventCopied);
        proximity.processMessage(geofenceSensorReading2, sensors, events);
        assert(eventCopied !== undefined, 'The event wasnt copied');
    });
});

describe('proximity node module', function() {
    it('geofence is used to detect proximity events', function() {
        proximity.reset();

        console.log('');
        console.log('==================================================');
        console.log('test: geofence is used to detect proximity events');
        console.log('==================================================');

        var sensors = {};

        console.log(sensors);

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

        console.log('test: process reading 1');

        proximity.processMessage(geofenceSensorReading1, sensors);

        var geofenceEnter = {
            streamid: '1111',
            objectTags: ['geofence', 'ibeacon'],
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

        proximity.processMessage(geofenceEnter, sensors);

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

        var eventCopied;
        var events = {};
        events.add = function(event) {
            eventCopied = event;
            logger.info('event added');
        };

        logger.info(events);
        logger.info(eventCopied);
        proximity.processMessage(geofenceSensorReading2, sensors, events);
        assert(eventCopied !== undefined, 'The event wasnt copied');
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

        console.log('test: process reading 1');

        var conditions = [];
        var operations = [];
        sensors.update = function(condition, operation) {
            conditions.push(condition);
            operations.push(operation);
        };

        proximity.processMessage(geofenceSensorReading1, sensors);

        logger.info('condition: ' + conditions[1].url);
        assert(conditions[1].url === 'ibeacon://AAAAAAAAAAAAAA/1/1', 'beacon url is incorrect');
        logger.info('operation', operations[1]);
        logger.info('$set', operations[1]['$set']);
        assert(operations[1]['$set']['cachedEvents.ambient-temperature-sample'].streamid === '2222', 'cachedEvents not saved properly');
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

        console.log('test: process reading 1');

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

        logger.info(operations);

        assert(conditions[1].url === 'ibeacon://AAAAAAAAAAAAAA/1/1', 'beacon url is incorrect');
        assert(operations[1]['$set']['cachedEvents.ambient-temperature-sample'].streamid === '2222', 'cachedEvents not saved properly');
        assert(conditions[3].url === 'ibeacon://AAAAAAAAAAAAAA/1/1', 'second beacon url is incorrect');
        assert(operations[3]['$set']['cachedEvents.ambient-noise-sample'].streamid === '2222', 'second cachedEvents not saved properly');


    });
});

describe('proximity node module', function() {
    it('attaching to a sensor logs a sensor data message', function() {
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
        assert(eventCopied !== undefined, 'Didnt copy event on attach');
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