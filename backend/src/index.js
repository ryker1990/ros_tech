import AWS from 'aws-sdk'
import ButtonsController from './ButtonsController'
import Config from './Config'
import Constants from './Constants'
import Database from './Database'
import nodemailer from 'nodemailer'
import RelayController from './RelayController'
import Server from './Server'
import TemperatureController from './TemperatureController'
import WiFiControl from 'wifi-control'
import XLSX from 'xlsx'
import qr from 'qr-image'
import fs from 'fs'
import hash from 'object-hash'
import child_process from 'child_process'

class PressBackend {

  constructor() {

    this.relayController = new RelayController()
    this.temperatureController = new TemperatureController(this.relayController)
    this.server = new Server()
    this.database = new Database()
    this.buttonsController = new ButtonsController(this)

    this.server.database = this.database

    this.state = {}

    this.updateTemperatures = this.updateTemperatures.bind(this)
    this.startPress = this.startPress.bind(this)
    this.cancelPress = this.cancelPress.bind(this)
    this.setCPUGovernor = this.setCPUGovernor.bind(this)
    this.onStartButton = this.onStartButton.bind(this)
    this.onCancelButton = this.onCancelButton.bind(this)
  }

  start() {

    WiFiControl.init({
      // debug: true
    })

    this.server.on(Constants.F_SAVE_PRESET, (topTemp, bottomTemp, time, weight, material, bag, strainName) => {
      this.database.savePreset(topTemp, bottomTemp, time, weight, material, bag, strainName)
        .then(this.database.loadPresets)
        .then(presets => {
          this.state.presets = presets
          this.server.dispatch('updatePresets', this.state.presets)
        })
    })
    this.server.on(Constants.F_DELETE_PRESET, presetID => {
      this.database.deletePreset(presetID)
        .then(this.database.loadPresets)
        .then(presets => {
          this.state.presets = presets
          this.server.dispatch('updatePresets', this.state.presets)
        })
    })
    this.server.on(Constants.F_SAVE_CURRENT_SESSION, session => {
      this.database.saveCurrentSession(session)
        .then(() => {
          return this.database.selectPreset(null)
        })
        .then(this.database.loadPresets)
        .then(presets => {
          this.state.presets = presets
          this.server.dispatch('updatePresets', this.state.presets)
        })
        .then(this.database.loadCurrentSession)
        .then(session => {
          this.state.currentSession = {
            ...this.state.currentSession,
            ...session.state
          }
          this.server.dispatch('updateSession', this.state.currentSession)
        })
    })
    this.server.on(Constants.F_SELECT_PRESET, presetID => {
      this.database.selectPreset(presetID)
        .then(this.database.loadPresets)
        .then(presets => {
          this.state.presets = presets
          this.server.dispatch('updatePresets', this.state.presets)

          let preset = presets.find(preset => {
            return preset.selected
          })

          if (preset != null) {
            this.state.currentSession = {
              ...this.state.currentSession,
              time: preset.time,
              setTopTemp: preset.topTemp,
              setBottomTemp: preset.bottomTemp,
              bag: preset.bag,
              bagSize: preset.bag.size,
              material: preset.material,
              strainName: preset.strainName,
              weight: preset.weight
            }
            this.server.dispatch('updateSession', this.state.currentSession)
          }
        })
    })

    this.server.on(Constants.F_CANCEL_PRESS, this.cancelPress)

    this.server.on(Constants.F_SAVE_YIELD, (weight, pressID) => {
      this.database.saveYield(weight, pressID)
        .then(() => {
          this.state.press.phase = Constants.PHASE_IDLE
          this.server.dispatch('updatePress', this.state.press)
        })
    })

    this.server.on(Constants.F_SET_TOP_TEMP, (topTemp) => {

      let index = this.state.presets.findIndex(preset => {
        return preset.selected
      })

      if (index != -1) {
        this.database.selectPreset(null)
          .then(this.database.loadPresets)
          .then(presets => {
            this.state.currentSession = {
              ...this.state.currentSession,
              setTopTemp: topTemp
            }
            this.server.dispatch('updateSession', this.state.currentSession)
            this.temperatureController.setTopTargetTemp(topTemp)

            this.state.presets = presets
            this.server.dispatch('updatePresets', this.state.presets)
          })
      } else {
        this.state.currentSession = {
          ...this.state.currentSession,
          setTopTemp: topTemp
        }
        this.server.dispatch('updateSession', this.state.currentSession)
        this.temperatureController.setTopTargetTemp(topTemp)
      }
    })

    this.server.on(Constants.F_SET_BOTTOM_TEMP, (bottomTemp) => {

      let index = this.state.presets.findIndex(preset => {
        return preset.selected
      })

      if (index != -1) {
        this.database.selectPreset(null)
          .then(this.database.loadPresets)
          .then(presets => {
            this.state.currentSession = {
              ...this.state.currentSession,
              setBottomTemp: bottomTemp
            }
            this.server.dispatch('updateSession', this.state.currentSession)
            this.temperatureController.setBottomTargetTemp(bottomTemp)

            this.state.presets = presets
            this.server.dispatch('updatePresets', this.state.presets)
          })
      } else {
        this.state.currentSession = {
          ...this.state.currentSession,
          setBottomTemp: bottomTemp
        }
        this.server.dispatch('updateSession', this.state.currentSession)
        this.temperatureController.setBottomTargetTemp(bottomTemp)
      }
    })

    this.server.on(Constants.F_SET_TIME, (time) => {

      let index = this.state.presets.findIndex(preset => {
        return preset.selected
      })

      if (index != -1) {
        this.database.selectPreset(null)
          .then(this.database.loadPresets)
          .then(presets => {
            this.state.currentSession = {
              ...this.state.currentSession,
              time
            }
            this.server.dispatch('updateSession', this.state.currentSession)

            this.state.presets = presets
            this.server.dispatch('updatePresets', this.state.presets)
          })
      } else {
        this.state.currentSession = {
          ...this.state.currentSession,
          time
        }
        this.server.dispatch('updateSession', this.state.currentSession)
      }
    })

    this.server.on(Constants.F_CONFIRM_CANCEL, () => {
      this.state.press.phase = Constants.PHASE_IDLE
      this.server.dispatch('updatePress', this.state.press)
    })

    this.server.on(Constants.CLIENT_CONNECTED, (client) => {
      this.database.loadDeviceUiSettings()
        .then((settings) => {
          this.state.deviceUiSettings = settings;
        }).then(() => {
        this.server.updateClient(client, {
          session: this.state.currentSession,
          presets: this.state.presets,
          press: this.state.press,
          machineID: this.state.machineID,
          config: Config,
          wifiSetup: this.state.wifiSetup,
          deviceUiSettings: this.state.deviceUiSettings,
          isEmergencyButtonEngaged: this.buttonsController.isEmergencyButtonDepressed
        })
      })
    });

    this.server.on(Constants.F_GET_PRESSES, () => {
      this.database.loadPresses()
        .then(presses => {
          this.state.presses = presses
          this.server.dispatch('updatePresses', this.state.presses)
        })
    })

    this.server.on(Constants.F_EXPORT_HISTORY, (emailAddress) => {

      this.database.loadPresses()
        .then(presses => {

          let worksheet
          let workbook

          workbook = {
            SheetNames: [],
            Sheets: {}
          };

          presses = presses.reverse().map(press => {
            let filteredPress
            filteredPress = {}

            if (press.date == undefined || press.date == null) {
              filteredPress["Date"] = null
            } else {
              filteredPress["Date"] = new Date(press.date)
            }

            // Setup

            filteredPress["Duration"] = this.timeFormatter(press.time)

            if (Config.usesFahrenheit) {
              filteredPress["Bottom Temperature"] = this.toFahrenheit(press.bottomTemp) + " °F"
              filteredPress["Top Temperature"] = this.toFahrenheit(press.topTemp) + " °F"
            } else {
              filteredPress["Bottom Temperature"] = press.bottomTemp + " °C"
              filteredPress["Top Temperature"] = press.topTemp + " °C"
            }

            // Session settings:

            if (press.weight == undefined || press.weight == null) {
              filteredPress["Weight"] = "Unknown"
            } else {
              filteredPress["Weight"] = press.weight + " g"
            }

            if (press.material == undefined || press.material == null) {
              filteredPress["Material"] = "Unknown"
            } else {
              filteredPress["Material"] = press.material.name
            }

            if (press.bag == undefined || press.bag == null) {
              filteredPress["Bag"] = "Custom"
              filteredPress["Bag Size"] = press.bagSize
            } else {
              filteredPress["Bag"] = press.bag.name
              filteredPress["Bag Size"] = press.bag.size
            }

            if (press.strainName == undefined || press.strainName == null) {
              filteredPress["Strain name"] = "Unknown"
            } else {
              filteredPress["Strain name"] = press.strainName
            }

            //

            if (press.yield == undefined || press.yield == null || press.yield == -1) {
              filteredPress["Yield"] = "Unknown"
            } else {
              filteredPress["Yield"] = press.yield + " g"
            }

            return filteredPress
          })

          worksheet = XLSX.utils.json_to_sheet(presses)

          workbook.SheetNames.push('History')
          workbook.Sheets['History'] = worksheet

          XLSX.writeFile(workbook, 'history.xlsx')

          //

          let transporter = nodemailer.createTransport({
            SES: new AWS.SES(Config.AWS)
          });
          let mailOptions = {
            from: '"ROSIN TECH" <support@rosintechproducts.com>', // sender address
            to: emailAddress, // list of receivers
            subject: 'Your press history', // Subject line
            text: Config.emailText, // plain text body
            html: Config.emailHTML, // html body
            attachments: [
              {
                filename: 'history.xlsx',
                path: 'history.xlsx'
              }
            ]
          };
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              this.state.export = {
                error
              }

              this.server.dispatch('updateExport', this.state.export)
              console.log('Message not sent: %s', error);

              return
            }

            this.state.export = {
              info
            }
            this.server.dispatch('updateExport', this.state.export)

            console.log('Message %s sent: %s', info.messageId, info.response);
          });

        })
    })

    this.server.on(Constants.F_CLEAR_EXPORT, () => {
      this.state.export = {}
      this.server.dispatch('updateExport', this.state.export)
    })

    let that = this

    return this.setCPUGovernor()
      .then(() => console.log("√ CPU governor set."))
      .catch(err => {
        console.log("Couldn't set CPU governor, this will probably result in bad temperature readings.", err);
      })
      .then(this.relayController.start)
      .then(relaysState => {
        this.state.relays = relaysState
      })
      .then(() => console.log("√ Relay controller started."))
      .then(() => {
        return new Promise((resolve, reject) => {

          child_process.exec("ifconfig | grep ether", {}, (err, stdout, stderr) => {

            // console.log("> stdout: " + stdout);
            let machineID = hash(stdout)

            that.state.machineID = machineID
            console.log("√ Unique machine ID (received/set): " + machineID + " / " + that.state.machineID)

            var svg_string = qr.imageSync(machineID, {
              type: 'svg',
              size: 4
            });

            fs.writeFile("../frontend/img/qr.svg", svg_string, function (err) {
              if (err) {
                console.log("Error writing QR code: ");
                console.log(err);
                reject()
              } else {
                console.log("√ QR code written")
                resolve()
              }
            });
          })
        })
      })
      .then(this.temperatureController.start)
      .then(() => console.log("√ Temperature controller started."))
      .then(() => {
        return this.database.start(that.state.machineID)
      })
      .then(() => console.log("√ Database controller started."))
      .then(this.database.loadDeviceUiSettings)
      .then((settings) => {
        this.state.deviceUiSettings = settings;
      })
      .then(this.database.loadWifiSetup)
      .then((result) => {
        this.state.wifiSetup = result
      })
      .then(this.database.setWifiSetup)
      .then(this.database.loadCurrentSession)
      .then(session => {
        this.state.currentSession = session.state
        this.server.dispatch('updateSession', this.state.currentSession)
      })
      .then(this.database.loadPresets)
      .then(presets => {
        this.state.presets = presets
        this.server.dispatch('updatePresets', this.state.presets)

        let preset = presets.find(preset => {
          return preset.selected
        })

        if (preset != null) {
          this.temperatureController.setTopTargetTemp(preset.topTemp)
          this.temperatureController.setBottomTargetTemp(preset.bottomTemp)
        }
      })
      .then(this.server.start)
      .then(() => console.log("√ Server controller started."))
      .then(() => {

        console.log("Will call sync.")
        this.database.sync()

        setInterval(() => {
          this.updateTemperatures()
        }, 1000)
      })
      .then(() => {
        // If wifi isn't set up -> go to wifi
      })
  }

  onStartButton() {

    console.log("onStartButton called");

    if (this.buttonsController.isStartButtonDepressed) {
      console.log("Start button's last state is unpressed. Not starting.")
      return
    }

    if (this.buttonsController.isEmergencyButtonDepressed) {
      console.log("Emergency button's last state is depressed. Not starting.")
      return
    }

    if (this.state && this.state.press && this.state.press.phase) {
      console.log('[STORED PHASE] ' + this.state.press.phase);
    }

    if (this.state == null ||
      this.state.currentSession == null ||
      this.state.currentSession.setTopTemp == null ||
      this.state.currentSession.setBottomTemp == null ||
      this.state.currentSession.time == null) {
        console.log("Client side is probably not connected.");
        return
    }
    
    console.log("state:");
    console.log(this.state);

    /*this.startPress(this.state.currentSession.setTopTemp, this.state.currentSession.setBottomTemp, this.state.currentSession.time)
        .catch(err => {
          console.log("Error starting press");
          console.log(err);
        });*/

    if (this.state.press == null || this.state.press.phase == Constants.PHASE_IDLE) {
      this.startPress(this.state.currentSession.setTopTemp, this.state.currentSession.setBottomTemp, this.state.currentSession.time)
        .catch(err => {
          console.log("Error starting press");
          console.log(err);
        })
    } else {
      console.log("Press in progress, won't start.");
    }
  }

  onCancelButton() {
    console.log("onCancelButton called");

    if (
      this.state.press != null && 
      this.buttonsController.isEmergencyButtonDepressed === true && 
      (this.state.press.phase == Constants.PHASE_CLOSING || this.state.press.phase == Constants.PHASE_PRESSING)
    ) {
      console.log("[PRESS] Canceling press.");
      this.cancelPress();
    } else {
      console.log("[PRESS] Skipping cancel, button is not pressed.");
    }

    this.server.dispatch('updateEmergencyButtonState', this.buttonsController.isEmergencyButtonDepressed)
  }

  cancelPress() {
    if (this.state.press == null) {
      this.state.press = {}
    }

    console.log("cancelPress called");
    this.state.press.phase = Constants.PHASE_CANCELLING
    this.server.dispatch('updatePress', this.state.press)

    this.relayController.openPress()
      .then(() => {
        this.state.press.phase = Constants.PHASE_IDLE
        this.server.dispatch('updatePress', this.state.press)
      })
  }

  startPress(topTemp, bottomTemp, time) {
    if (this.state.press == null) {
      this.state.press = {}
    }

    this.state.press.phase = Constants.PHASE_CLOSING
    this.state.press.time = time
    this.state.press.endTime = new Date().getTime() + time * 1000 + Config.travelTime[Config.pressType]
    this.server.dispatch('updatePress', this.state.press)

    return this.relayController.closePress()
      .then(() => {
        this.state.press.phase = Constants.PHASE_PRESSING
        this.server.dispatch('updatePress', this.state.press)
        return this.relayController.startPress(time * 1000)
      })
      .then(() => {
        this.state.press.phase = Constants.PHASE_OPENING
        this.server.dispatch('updatePress', this.state.press)
      })
      .then(this.relayController.openPress)
      .then(() => {
        return this.database.savePress(topTemp, bottomTemp, time, this.state.currentSession)
      })
      .then((savedObject) => {
        this.state.press.phase = Constants.PHASE_YIELD
        this.state.press.pressID = savedObject["_id"]
        this.server.dispatch('updatePress', this.state.press)
      })
      .catch(err => {
        console.log("Error starting - will try to reset press");
        this.state.press.phase = Constants.PHASE_IDLE
        this.server.dispatch('updatePress', this.state.press)
        this.relayController.openPress()
      })
  }

  setCPUGovernor() {

    return new Promise((resolve, reject) => {
      child_process.exec("echo \"performance\" | tee /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor", {}, (err, stdout, stderr) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  updateTemperatures() {
    this.state.currentSession = {
      ...this.state.currentSession,
      topTemp: this.temperatureController.topTemperature,
      bottomTemp: this.temperatureController.bottomTemperature
    }
    this.server.dispatch('updateSession', this.state.currentSession)
  }

  toFahrenheit(celsius) {
    return celsius * 9 / 5 + 32
  }

  timeFormatter(time) {

    if (isNaN(time) || time === null || time === undefined) {
      return '00:00'
    }

    let minutes
    let seconds

    let minutesString
    let secondsString

    minutes = Math.floor(time / 60)
    seconds = Math.floor(time % 60)

    minutesString = minutes < 10 ? "0" + minutes : "" + minutes
    secondsString = seconds < 10 ? "0" + seconds : "" + seconds

    return minutesString + ":" + secondsString
  }
}

let pressBackend
pressBackend = new PressBackend()
pressBackend.start()
  .then(() => {
    console.log('√ Backend startup complete.')
  }).catch(err => {
  console.error('Backend startup failed: ' + err)
})
