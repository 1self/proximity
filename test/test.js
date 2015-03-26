'use strict';
var assert = require('assert');
var proximity = require('../processor');

describe('proximity node module', function () {
  it('ignores non proximity events', function () {
  	var event = {
  		objectTags:['test']
  	};

  	var repo = {

  	};

  	repo.write = function(){
  		assert(false);
  	};

    proximity.processMessage(event, repo);
  });
});

describe('proximity node module', function () {
  it('beacon start creates activation', function () {
   	var beaconStart = { 
  		streamid: "11111111",
  		objectTags:['proximity', 'ibeacon'],
  		actionTags:['start'],
  		properties:{
  			regionId: "region1",
  			major: 1,
  			minor: 1
  		}
  	};

    var sensors = {};

    var beaconActivated = false;

    sensors.update = function(condition, operation, options){
    	console.log('condition: ' + JSON.stringify(condition));
    	console.log('operation: ' + JSON.stringify(operation));
    	if(condition.url === 'ibeacon://region1/1/1' && operation.$set.active === true && options.upsert === true){
    		beaconActivated = true;
    	}
    };

    sensors.find = function(){
    	var result = {};
    	result.toArray = function(callback){
    		callback(null, []);
    	};
    	return result;
    };

    proximity.processMessage(beaconStart, sensors);
    assert(beaconActivated, 'database not updated with beacon active');
   });
});

describe('proximity node module', function () {
  // it('enter event causes stream to be stored against regionId', function () {
  // 	var beaconStart = {
  // 		streamid: "s1",
  // 		objectTags:['proximity'],
  // 		actionTags:['start'],
  // 		properties:{
  // 			regionId: "region1",
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


describe('proximity node module', function () {
  // it('enter event causes stream to be stored against regionId', function () {
  // 	var beaconStart = {
  // 		streamid: "s1",
  // 		objectTags:['proximity'],
  // 		actionTags:['start'],
  // 		properties:{
  // 			regionId: "region1",
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

describe('proximity node module', function () {
  // it('entering an unknown region ignored', function () {
  // 	var beaconEnter = {
  // 		streamid: "s1",
  // 		objectTags:['proximity'],
  // 		actionTags:['enter'],
  // 		properties:{
  // 			regionId: "region1",
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
//   		streamid: "s1",
//   		objectTags:['proximity'],
//   		actionTags:['start'],
//   		properties:{
//   			regionId: "region1",
//   			major: 1,
//   			minor: 1
//   		}
//   	};

//   	var beaconEnter = {
//   		streamid: "s2",s
//   		objectTags:['proximity'],
//   		actionTags:['enter'],
//   		properties:{
//   			regionId: "region1",
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
