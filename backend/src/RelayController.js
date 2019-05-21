import EventEmitter from 'events'
import i2c from 'i2c-bus'
import Config from './Config'
import child_process from 'child_process'

class RelayController extends EventEmitter {

  constructor() {
    super();

    this.address = 0x20
    this.i2c = i2c.openSync(1);

    this.timeout = 0

    this.start = this.start.bind(this)
    this.writeState = this.writeState.bind(this)
    this.readState = this.readState.bind(this)
    this.configure = this.configure.bind(this)
    this.setRelays = this.setRelays.bind(this)

    this.stopHeatPlates = this.stopHeatPlates.bind(this)
    this.startTopHeatPlate = this.startTopHeatPlate.bind(this)
    this.startBottomHeatPlate = this.startBottomHeatPlate.bind(this)
    this.stopTopHeatPlate = this.stopTopHeatPlate.bind(this)
    this.stopBottomHeatPlate = this.stopBottomHeatPlate.bind(this)

    this.closePress = this.closePress.bind(this)
    this.startPress = this.startPress.bind(this)
    this.openPress = this.openPress.bind(this)
  }

  i2cDebug() {
    console.log("i2cDebug output");
    let output = child_process.execSync("i2cdetect -y 1")
    console.log(output.toString())
  }

  start() {
    return this.configure()
      .then(() => {
        this.writeState(0x00)
      })
      .then(this.readState)
      .then(state => {
        return this.parseState(state)
      });
  }

  configure() {
    // Set all pins as output
    return new Promise((resolve, reject) => {
      this.i2c.writeByte(this.address, 0x00, 0x00, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    });
  }

  writeState(state) {
    return new Promise((resolve, reject) => {
      this.i2c.writeByte(this.address, 0x09, state, (err) => {
        if (err) {
          console.log("Error writing: " + err);
          reject(err)
        } else {
          resolve()
        }
      })
    });
  }

  readState() {
    return new Promise((resolve, reject) => {
      this.i2c.readByte(this.address, 0x09, (err, res) => {
        if (err) {
          reject(err)
        } else {
          resolve(res)
        }
      })
    });
  }

  setRelays(relays, relayState, debug = false) {
    if (relays.count == 0) {
      console.log("No relays to set");
      return new Promise((resolve, reject) => {
        resolve()
      })
    }

    let initialState
    let updatedState

    return this.readState()
      .catch((err) => {
        console.log("Error reading state (1):")
        console.log(err)
        this.i2cDebug()
        throw (err)
      })
      .then(state => {

        initialState = state

        for (var i = 0; i < relays.length; i++) {
          state ^= (-relayState ^ state) & (1 << relays[i]);
        }

        updatedState = state

        if (debug) {
          console.log("Relays updated:", relays);
          console.log("New relays state:", relayState);

          console.log("Initial state: ");
          console.log(initialState);

          console.log("Updated state: ");
          console.log(updatedState);
        }

        return state
      })
      .then(this.writeState)
      .then(() => {
        if (debug) {
          console.log("Did write state");
        }
      })
      .catch(err => {
        console.log("Error writing state:")
        console.log(err)
        this.i2cDebug()
        throw (err)
      })
      .then(this.readState)
      .catch(err => {
        console.log("Error reading state:")
        console.log(err)
        this.i2cDebug()
        throw (err)
      })
      .then(state => {
        if (debug) {
          console.log("Did read state");
          console.log(state);
        }

        if (state != updatedState) {
          console.log("Updated state mismatch, will throw.");
          console.log(state, updatedState);
          throw "Updated state wasn't written correctly."
        }

        return this.parseState(state)
      })
      .catch(err => {
        console.log("Error setting state:")
        console.log(err)
        this.i2cDebug()
        throw (err)
      })
  }

  closePress() {
    console.log("closePress")

    let config = Config.closePress[Config.pressType]
    // Set initial state
    return this.setRelays(config[0].relays, config[0].state)
      .then(() => {
        // Set buffer state (actual closing)
        return this.setRelays(config[1].relays, config[1].state, true)
      })
      .then(() => {
        // Wait for the given buffer time (press travel time)
        return new Promise((resolve, reject) => {
          clearTimeout(this.timeout)
          this.timeout = setTimeout(resolve, Config.travelTime[Config.pressType])
        })
      })
      .then(() => {
        // Unset buffer state
        return this.setRelays(config[2].relays, config[2].state)
      })
  }

  startPress(time) {
    console.log("startPress")
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeout)
      this.timeout = setTimeout(resolve, time)
    });
  }

  openPress() {
    console.log("openPress")

    let config = Config.openPress[Config.pressType]
    // Set initial state
    console.log("Settings relays", config[0].relays, config[0].state);
    return this.setRelays(config[0].relays, config[0].state)
      .then(() => {
        // Set buffer state (actual opening)
        console.log("Settings relays", config[1].relays, config[1].state);
        return this.setRelays(config[1].relays, config[1].state)
      })
      .then(() => {
        // Wait for the given buffer time (press travel time)
        return new Promise((resolve, reject) => {
          clearTimeout(this.timeout)
          this.timeout = setTimeout(resolve, Config.travelTime[Config.pressType])
        })
      })
      .then(() => {
        // Unset buffer state
        console.log("Settings relays", config[2].relays, config[2].state);
        return this.setRelays(config[2].relays, config[2].state)
      })
  }

  stopHeatPlates() {
    return this.setRelays([5, 6], 0)
  }

  startTopHeatPlate() {
    return this.setRelays([4], 1)
  }

  startBottomHeatPlate() {
    return this.setRelays([5], 1)
  }

  stopTopHeatPlate() {
    return this.setRelays([4], 0)
  }

  stopBottomHeatPlate() {
    return this.setRelays([5], 0)
  }

  parseState(state) {
    var stateArray;
    stateArray = [];
    for (var i = 0; i < 8; i++) {
      stateArray[i] = ((state >> i) % 2);
    }
    return stateArray;
  }
}

module.exports = RelayController
