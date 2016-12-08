var gpio = require('pi-gpio');
var Service, Characteristic;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-gpio-blinds", "GPIO-Blinds", GPIOBlindsAccessory);
}

function GPIOBlindsAccessory(log, config) {
    // global vars
    this.log = log;

    // configuration vars
    this.name = config["name"];
    this.upPin = config["up_pin"];
    this.downPin = config["down_pin"];
    this.stopPin = config["stop_pin"];
    this.presetPosition = config["preset_position"];
    this.motionTime = config["motion_time"];
    this.motionLag = config["motion_lag"];

    // state vars
    this.interval = null;
    this.movingToPreset = false;
    this.lastPosition = 100; // last known position of the blinds, up by default
    this.currentPositionState = 2; // stopped by default
    this.currentTargetPosition = 100; // up by default
    this.awaitingMotion = false;

    // register the service and provide the functions
    this.service = new Service.WindowCovering(this.name);

    // the current position (0-100%)
    // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L493
    this.service
        .getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.getCurrentPosition.bind(this));

    // the position state
    // 0 = DECREASING; 1 = INCREASING; 2 = STOPPED;
    // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L1138
    this.service
        .getCharacteristic(Characteristic.PositionState)
        .on('get', this.getPositionState.bind(this));

    // the target position (0-100%)
    // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L1564
    this.service
        .getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.getTargetPosition.bind(this))
        .on('set', this.setTargetPosition.bind(this));
}

GPIOBlindsAccessory.prototype.getCurrentPosition = function(callback) {
    this.log("Requested CurrentPosition: %s", this.lastPosition);
    callback(null, this.lastPosition);
}

GPIOBlindsAccessory.prototype.getPositionState = function(callback) {
    this.log("Requested PositionState: %s", this.currentPositionState);
    callback(null, this.currentPositionState);
}

GPIOBlindsAccessory.prototype.getTargetPosition = function(callback) {
    this.log("Requested TargetPosition: %s", this.currentTargetPosition);
    callback(null, this.currentTargetPosition);
}

GPIOBlindsAccessory.prototype.setTargetPosition = function(pos, callback) {
    this.log("Set TargetPosition: %s", pos);

    this.currentTargetPosition = pos;
    this.movingToPreset = false;

    if (this.currentTargetPosition == this.lastPosition) {
        this.log("currentPositionState -> Stopped");

        if (this.currentPositionState != 2) {
            this.pulsePin(this.stopPin);
        } else if(pos == 100) {
            this.pulsePin(this.upPin);
        } else if(pos == 0) {
            this.pulsePin(this.downPin);
        }

        this.currentPositionState = 2;
    } else if (this.currentTargetPosition == this.presetPosition && this.currentPositionState == 2) {
        this.currentPositionState = this.currentTargetPosition > this.lastPosition ? 1 : 0;

        if (this.currentPositionState) {
            this.log("currentPositionState -> Opening (towards Preset)");
        } else {
            this.log("currentPositionState -> Closing (towards Preset)");
        }

        this.pulsePin(this.stopPin);
        this.movingToPreset = true;
    } else if (this.currentTargetPosition > this.lastPosition) {
        this.log("currentPositionState -> Opening");

        if (this.currentPositionState != 1) {
            this.pulsePin(this.upPin);
            this.awaitMotion();
        }

        this.currentPositionState = 1;
    } else {
        this.log("currentPositionState -> Closing");

        if (this.currentPositionState != 0) {
            this.pulsePin(this.downPin);
            this.awaitMotion();
        }

        this.currentPositionState = 0;
    }

    this.service.setCharacteristic(Characteristic.PositionState, this.currentPositionState);

    if (this.currentPositionState != 2) {
        if (!this.interval) {
            this.interval = setInterval(this.motionTick.bind(this), parseInt(this.motionTime) / 100);
        }
    }

    callback(null);
}

GPIOBlindsAccessory.prototype.motionTick = function() {
    if (this.awaitingMotion) {
        this.log("motionTick warming up");
        return;
    }

    switch (this.currentPositionState) {
        case 0:
            //Closing
            this.lastPosition--;
            break;

        case 1:
            //Opening
            this.lastPosition++;
            break;
    }

    if (!(this.lastPosition % 10)) {
        this.log("motionTick estimated position %s -> %s", this.lastPosition, this.currentTargetPosition);
        this.service.setCharacteristic(Characteristic.CurrentPosition, this.lastPosition);
    }

    if (this.lastPosition == this.currentTargetPosition) {
        this.log("Reached target position (%s%%).", this.lastPosition);

        this.currentPositionState = 2;
        this.service.setCharacteristic(Characteristic.CurrentPosition, this.lastPosition);
        this.service.setCharacteristic(Characteristic.PositionState, this.currentPositionState);

        //Pulse stop pin if stopping halfway
        if (this.lastPosition != 0 && this.lastPosition != 100 && !this.movingToPreset) {
            this.pulsePin(this.stopPin);
        }

        //Stop our timer
        clearInterval(this.interval);
        this.interval = null;

        this.movingToPreset = false;
    }
}

GPIOBlindsAccessory.prototype.awaitMotion = function() {
    if (this.motionLag) {
        this.awaitingMotion = true;

        setTimeout(function() {
            this.awaitingMotion = false;
        }.bind(this), this.motionLag);
    }
}

GPIOBlindsAccessory.prototype.pulsePin = function(pin) {
    this.log("pulsePin %s", pin);
    gpio.open(pin, "output", function(err) { // Open pin for output 
        gpio.write(pin, 0, function() { // Set pin low
            setTimeout(function() {
                gpio.setDirection(pin, "input", function() { // Set pin back to floating
                    gpio.close(pin); // Close pin
                });
            }, 333);
        });
    });
}

GPIOBlindsAccessory.prototype.getServices = function() {
    return [this.service];
}
