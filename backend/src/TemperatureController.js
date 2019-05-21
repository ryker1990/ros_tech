import EventEmitter from 'events'
import Config from './Config'
import i2c from 'i2c-bus'
import { B_UPDATE_TEMPERATURE } from './Constants'

class TemperatureController extends EventEmitter {

  constructor(relayController) {
    super()

    this.topAddress = 0x67
    this.bottomAddress = 0x60

    this.i2c = i2c.openSync(1);

    this.relayController = relayController

    this.temperatureMonitorTimeout = null
    this.topTemperature = 0
    this.bottomTemperature = 0
    this.targetTopTemperature = 0
    this.targetBottomTemperature = 0

    this.readState = this.readState.bind(this)
    this.writeByte = this.writeByte.bind(this)
    this.start = this.start.bind(this)
    this.setTopTargetTemp = this.setTopTargetTemp.bind(this)
    this.setBottomTargetTemp = this.setBottomTargetTemp.bind(this)
    this.updateTempControl = this.updateTempControl.bind(this)
    this.updateTempControlStep = this.updateTempControlStep.bind(this)
    this.stopTempControl = this.stopTempControl.bind(this)
    this.configure = this.configure.bind(this)
    this.readTemperature = this.readTemperature.bind(this)

    this.topBuffer = []
    this.bottomBuffer = []
  }

  start() {
    return this.writeByte(this.topAddress, 0x05, 0x07)
      .then(() => {
        return this.writeByte(this.topAddress, 0x06, 0x7c)
      })
      .then(() => {
        return this.writeByte(this.bottomAddress, 0x05, 0x07)
      })
      .then(() => {
        return this.writeByte(this.bottomAddress, 0x06, 0x7c)
      })
      .then(this.updateTempControl)
  }

  writeByte(wireAddress, address, value) {
    return new Promise((resolve, reject) => {
      this.i2c.writeByte(wireAddress, address, value, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    });
  }

  readState() {
    return this.readTemperature(this.topAddress)
      .then(rawData => {
        if (rawData[0] == rawData[1]) {
          console.log("Not setting top temp: Buffers equal.")
        } else {
          // console.log("Setting top temp");
          this.topTemperature = this.parseData(rawData)
        }
      })
      .then(this.readTemperature.bind(this, this.bottomAddress))
      .then(rawData => {
        if (rawData[0] == rawData[1]) {
          console.log("Not setting bottom temp: Buffers equal.")
        } else {
          // console.log( "Setting bottom temp");
          this.bottomTemperature = this.parseData(rawData)
        }
      })
      .then(() => {
        console.log(this.topTemperature, this.bottomTemperature);
      })
      .catch(err => {
        console.log("Error reading temp state");
        console.log(err);

        throw (err)
      })
  }

  configure(wireAddress) {

    let that = this

    return new Promise((resolve, reject) => {
      that.i2c.sendByte(wireAddress, 0x00, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    });
  }

  readTemperature(wireAddress) {

    let that = this

    return that.configure(wireAddress)
      .then(() => {
        return new Promise((resolve, reject) => {
          let buffer = new Uint8Array(2)
          that.i2c.readI2cBlock(wireAddress, 0x00, 2, buffer, (err) => {
            if (err) {
              reject(err)
            } else {
              resolve(buffer)
            }
          })
        })
      })
      .catch(err => {
        console.log("Error reading temperatures");
        console.log(err);

        throw (err)
      })
  }

  temperatures() {
    return [this.topTemperature, this.bottomTemperature]
  }

  parseData(data) {

    let temp;

    if ((data[0] & 0x80) == 0x80) {
      data[0] = (data[0] & 0x7F);
      temp = (1024 - (data[0] * 16 + data[1] / 16))
    } else {
      temp = (data[0] * 16 + data[1] / 16);
    }

    return temp
  }

  // Monitoring & control

  setTopTargetTemp(topTemp) {

    this.targetTopTemperature = topTemp

    return this.updateTempControl()
  }

  setBottomTargetTemp(bottomTemp) {

    this.targetBottomTemperature = bottomTemp

    return this.updateTempControl()
  }

  updateTempControl() {
    this.stopTempControl()

    return this.readState()
      .then(() => {
        let topPercentage
        let bottomPercentage
        let topBuffer
        let bottomBuffer

        topPercentage = this.percentage(this.topTemperature, this.targetTopTemperature)
        bottomPercentage = this.percentage(this.bottomTemperature, this.targetBottomTemperature)

        this.topBuffer = []
        this.bottomBuffer = []
        for (var i = 0; i < 10; i++) {
          this.topBuffer.push(topPercentage * 10 <= i)
          this.bottomBuffer.push(bottomPercentage * 10 <= i)
        }

        // console.log("Top: ");
        // console.log("Current temp: " + this.topTemperature)
        // console.log("Target temp: " + this.targetTopTemperature);
        // console.log(this.topBuffer.map(function(v) {
        //   return v ? "░" : "▓"
        // }).join(""));

        // console.log("Bottom: ");
        // console.log("Current temp: " + this.bottomTemperature)
        // console.log("Target temp: " + this.targetBottomTemperature);
        // console.log(this.bottomBuffer.map(function(v) {
        //   return v ? "░" : "▓"
        // }).join(""));

        // console.log("---------------------------------------");

        this.updateTempControlStep()
      })
      .catch(err => {
        console.log("Error updating temp control - will try to switch off relays");
        this.relayController.stopBottomHeatPlate()
        .then(this.relayController.stopTopHeatPlate)
        .catch(err => {
          console.log("Potentially dangerous problem:\nCouldn't switch off heating plate relays");
        })
      })
  }

  percentage(temp, targetTemp) {
    if (temp > targetTemp || temp == 0 || targetTemp == 0) {
      return 0
    } else {
      if (temp < targetTemp - Config.rampingTempStart) {
        return 1
      } else {
        let tempDelta
        let percentage
        tempDelta = temp - (targetTemp - Config.rampingTempStart)
        percentage = tempDelta / Config.rampingTempStart
        return Config.rampingPercentStart - (Config.rampingPercentStart - Config.rampingPercentEnd) * percentage
      }
    }
  }

  updateTempControlStep() {
    let topPromise
    let bottomPromise

    if (this.topBuffer == null || this.bottomBuffer == null || this.topBuffer.length <= 0 || this.bottomBuffer.length <= 0) {
      this.updateTempControl()
      return
    }

    topPromise = this.topBuffer.pop() ? this.relayController.stopTopHeatPlate : this.relayController.startTopHeatPlate
    bottomPromise = this.bottomBuffer.pop() ? this.relayController.stopBottomHeatPlate : this.relayController.startBottomHeatPlate

    // console.log(this.bottomBuffer.map(function(v) {
    //   return v ? "▓" : "░"
    // }).join(""));

    // Safety check - shut down both if temp is too high
    if (this.bottomTemperature > Config.maxTemp || this.topTemperature > Config.maxTemp) {
      bottomPromise = this.relayController.stopBottomHeatPlate
      topPromise = this.relayController.stopTopHeatPlate
    }

    topPromise()
      .then(bottomPromise)
      .then(() => {
        clearTimeout(this.temperatureMonitorTimeout)
        this.temperatureMonitorTimeout = setTimeout(this.updateTempControlStep, 100)
      })
      .catch(err => {
        console.log("Error in adjusting temp:");
        console.log(err);

        clearTimeout(this.temperatureMonitorTimeout)
        this.temperatureMonitorTimeout = setTimeout(this.updateTempControlStep, 1000)
      })
  }

  stopTempControl() {
    clearTimeout(this.temperatureMonitorTimeout)
  }
}

module.exports = TemperatureController
