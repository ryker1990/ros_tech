import {MongoClient, ObjectId} from 'mongodb'
import AWS from 'aws-sdk'
import Config from './Config'

const url = 'mongodb://localhost:27017/rosin'
let connectionTries = 10

class Database {
  constructor() {

    this.connect = this.connect.bind(this)
    this.start = this.start.bind(this)
    this.savePreset = this.savePreset.bind(this)
    this.loadPresets = this.loadPresets.bind(this)
    this.deletePreset = this.deletePreset.bind(this)
    this.saveCurrentSession = this.saveCurrentSession.bind(this)
    this.loadCurrentSession = this.loadCurrentSession.bind(this)
    this.selectPreset = this.selectPreset.bind(this)
    this.savePress = this.savePress.bind(this)
    this.saveYield = this.saveYield.bind(this)
    this.loadPresses = this.loadPresses.bind(this)
    this.sync = this.sync.bind(this)
    this.loadUnsyncedPresets = this.loadUnsyncedPresets.bind(this)
    this.loadUnsyncedPresses = this.loadUnsyncedPresses.bind(this)
    this.uploadPresets = this.uploadPresets.bind(this)
    this.markPresetsSynced = this.markPresetsSynced.bind(this)
    this.uploadPresses = this.uploadPresses.bind(this)
    this.markPressesSynced = this.markPressesSynced.bind(this)
    this.loadWifiSetup = this.loadWifiSetup.bind(this)
    this.setWifiSetup = this.setWifiSetup.bind(this)
    this.updateDeviceUiSettings = this.updateDeviceUiSettings.bind(this)
    this.loadDeviceUiSettings = this.loadDeviceUiSettings.bind(this);

    this.ddb = new AWS.DynamoDB(Config.AWS);

  }

  start(machineID) {
    this.machineID = machineID
  }

  connect() {

    let that = this

    return new Promise((resolve, reject) => {
      MongoClient.connect(url, function (err, db) {
        if (err) {
          console.log('Couldn\'t connect to MongoDB:' + err);

          connectionTries--;

          if (connectionTries <= 0) {
            console.log("Connection failed. Giving up.");
            reject(err)
          } else {
            console.log("Retrying. #" + connectionTries);
            setTimeout(() => {
              that.connect()
                .then(resolve)
                .catch(reject)
            }, 1000)
          }
        } else {
          resolve(db)
        }
      })
    })
  }

  updateDeviceUiSettings(uiSettings) {
    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          console.log('Updating device UI settings' + JSON.stringify(uiSettings));
          this.loadDeviceUiSettings()
            .then((previous) => {
              return db.collection('deviceUiSettings').update(
                {
                  id: 1
                },
                Object.assign({id: 1}, Object.assign(previous, uiSettings)),
                {
                  upsert: true
                }
              );
            });
          resolve()
        })
      })
  }

  loadDeviceUiSettings() {
    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          db.collection('deviceUiSettings').findOne(
            {
              id: 1
            }, function (err, result) {
              db.close();
              if (err == null && result != null) {
                console.log('UiSettings found: ' + JSON.stringify(result));
                resolve(result)
              }
              else {
                console.log('UI settings not found, returning {}');
                resolve({})
              }
            }
          )
        })
      })
  }

  loadWifiSetup() {

    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          let wifiSetup = db.collection('wifiSetup').findOne({
            isSet: true
          }, function (err, result) {
            db.close()
            if (err == null) {
              if (result == null) {
                console.log("No wifiSetup found.");
                resolve(false)
              } else {
                console.log("Found wifiSetup.");
                resolve(result.isSet)
              }
            } else {
              console.log("Error finding wifiSetup: " + err);
              reject(err)
            }
          })
        })
      })
  }

  setWifiSetup() {

    return this.loadWifiSetup()
      .then(this.connect)
      .then((db) => {
        return new Promise((resolve, reject) => {
          var wifiSetup = db.collection('wifiSetup');
          console.log("Writing wifiSetup.");
          wifiSetup.update(
            {
              isSet: true
            },
            {
              isSet: true
            },
            {
              upsert: true
            }
          )
          resolve()
        })
      })
  }

  savePreset(topTemp, bottomTemp, time, weight, material, bag, strainName) {

    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          console.log("Inserting preset");
          var presets = db.collection('presets');
          presets.insert({
            topTemp,
            bottomTemp,
            time,
            weight,
            material,
            bag,
            strainName,
            selected: true
          }, function (err, result) {
            db.close()
            if (err == null) {
              console.log('Saved preset:');
              console.log(result.ops[0]);
              resolve(result.ops[0]);
            } else {
              console.log('Error saving preset: ' + err);
              reject(err)
            }
          }) // /insert
        }) // /Promise
      }) // /then
  }

  loadPresets() {

    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          var presets = db.collection('presets');
          presets.find().toArray(function (err, presets) {
            db.close()
            if (err == null) {
              console.log('Loaded presets.');
              resolve(presets);
            } else {
              console.log('Error loading presets: ' + err);
              reject(err)
            }
          })
        })
      })
  }

  deletePreset(presetID) {

    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          var presets = db.collection('presets');
          presets.deleteOne({
            _id: ObjectId(presetID)
          }, function (err, result) {
            db.close()
            if (err == null) {
              console.log('Deleted preset.');
              resolve(presets);
            } else {
              console.log('Error deleting preset: ' + err);
              reject(err)
            }
          })
        })
      })
  }

  saveCurrentSession(state) {

    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          var sessions = db.collection('session');
          console.log("Will update current session.");
          sessions.update(
            {
              current: true
            },
            {
              state: state,
              current: true
            },
            {
              upsert: true
            }
          )
          console.log("Current session updated.");
          resolve()
        })
      })
  }

  loadCurrentSession() {

    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          var sessions = db.collection('session');
          var session = sessions.findOne({
            current: true
          }, function (err, result) {
            if (err == null) {
              console.log("Found current session: " + result);
              if (result == null) {
                console.log("Using empty object as session.");
                resolve({})
              } else {
                console.log("Using found session.");
                resolve(result)
              }
            } else {
              console.log("Error finding current session: " + err);
              reject(err)
            }
          })
        })
      })
  }

  selectPreset(presetID) {

    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          console.log("Will deselect all presets.");
          var presets = db.collection('presets');
          presets.update(
            {},
            {
              $set: {
                selected: false
              }
            },
            {
              multi: true
            }
          )
          console.log("Will select presets with id " + presetID + ".");
          presets.update(
            {
              _id: ObjectId(presetID)
            },
            {
              $set: {
                selected: true
              }
            },
            {
              multi: true
            }
          )
          console.log("Current preset selected.");
          resolve()
        })
      })
  }

  savePress(topTemp, bottomTemp, time, session) {

    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          var presses = db.collection('presses');
          presses.insert({
            topTemp,
            bottomTemp,
            time,
            date: (new Date()).getTime(),
            bag: session.bag,
            bagSize: session.bagSize,
            material: session.material,
            strainName: session.strainName,
            weight: session.weight,
            notes: session.notes
          }, function (err, result) {
            db.close()
            if (err == null) {
              console.log('Saved press:');
              console.log(result.ops[0]);
              resolve(result.ops[0]);
            } else {
              console.log('Error saving press: ' + err);
              reject(err)
            }
          })
        })
      })
  }

  saveYield(weight, pressID) {

    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          var presses = db.collection('presses');
          console.log("Will save yield.");
          presses.update(
            {
              _id: ObjectId(pressID)
            },
            {
              $set: {
                yield: weight
              }
            },
            {
              multi: true
            }
          )
          console.log("Yield saved.");
          resolve()
        })
      })
  }

  loadPresses() {

    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          var presses = db.collection('presses');
          presses.find().toArray(function (err, presses) {
            db.close()
            if (err == null) {
              console.log('Loaded presses.');
              resolve(presses);
            } else {
              console.log('Error loading presses: ' + err);
              reject(err)
            }
          })
        })
      })
  }

  // sync

  sync() {
    var unsyncedPresets
    var unsyncedPresses

    this.loadUnsyncedPresets()
      .then((presets) => {
        unsyncedPresets = presets
      })
      .then(this.loadUnsyncedPresses)
      .then((presses) => {
        unsyncedPresses = presses
      })
      .then(() => {
        if (unsyncedPresets.length > 0) {
          return this.uploadPresets(unsyncedPresets)
        }
      })
      .then(this.markPresetsSynced)
      .then(() => {
        if (unsyncedPresses.length > 0) {
          return this.uploadPresses(unsyncedPresses)
        }
      })
      .then(this.markPressesSynced)
      .then(() => {
        setTimeout(this.sync, 60000)
      })
  }

  loadUnsyncedPresets() {
    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          var presets = db.collection('presets');
          presets.find({
            "sync": {
              "$exists": false
            }
          }).toArray(function (err, presets) {
            if (err == null) {
              console.log('Sync: Loaded presets: ' + presets.length);
              resolve(presets)
            } else {
              console.log('Sync: Error loading presets: ' + err);
              reject(err)
            }
          })
        })
      })
  }

  loadUnsyncedPresses() {
    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          var presses = db.collection('presses');
          presses.find({
            "sync": {
              "$exists": false
            },
            "yield": {
              "$exists": true
            }
          }).toArray(function (err, presses) {
            if (err == null) {
              console.log('Sync: Loaded presses: ' + presses.length);
              resolve(presses)
            } else {
              console.log('Sync: Error loading presses: ' + err);
              reject(err)
            }
          })
        })
      })
  }

  uploadPresets(presets) {
    return new Promise((resolve, reject) => {

      let requests = presets.map((preset) => {
        let r = {
          PutRequest: {
            Item: {
              topTemp: {
                S: String(preset.topTemp)
              },
              bottomTemp: {
                S: String(preset.bottomTemp)
              },
              time: {
                S: String(preset.time)
              },
              selected: {
                BOOL: preset.selected
              },
              id: {
                S: String(preset["_id"])
              },
              machineID: {
                S: String(this.machineID)
              },
              bagSize: {
                S: String(preset.bag.size)
              },
              material: {
                S: String(preset.material.name)
              },
              strainName: {
                S: String(preset.strainName)
              },
              weight: {
                S: String(preset.weight)
              }
            }
          }
        }

        return r
      })

      let params = {
        RequestItems: {
          'presets': requests
        }
      }

      console.log("Presets sync requests:", requests);

      this.ddb.batchWriteItem(params, function (err, data) {
        if (err) {
          console.log("Error", err);
          reject(err)
        } else {
          console.log("Presets synced.", data);
          resolve(data)
        }
      });
    })
  }

  markPresetsSynced(except) {

    // except = {
    //   "UnprocessedItems": {
    //     "presets": [
    //       {
    //         "PutRequest": {
    //           "Item": {
    //             id: "59fb83e1e3d71501ad3f4050"
    //           }
    //         }
    //       }
    //     ]
    //   }
    // }

    let exceptIDs = []

    if (except && except.UnprocessedItems.presses) {
      exceptIDs = except.UnprocessedItems.presets.map((o) => {
        return o.PutRequest.Item.id
      })
    }

    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          var presets = db.collection('presets');
          presets.find({
            "sync": {
              "$exists": false
            }
          }).toArray(function (err, presetsArray) {
            for (var i in presetsArray) {
              let preset = presetsArray[i]
              let presetID = String(preset["_id"])

              if (exceptIDs.indexOf(presetID) == -1) {
                presets.update(
                  {
                    _id: ObjectId(presetID)
                  },
                  {
                    $set: {
                      sync: true
                    }
                  },
                  {
                    multi: true
                  }
                )
              }
            }

          })
          resolve()
        })
      })
  }

  //


  uploadPresses(presses) {

    return new Promise((resolve, reject) => {

      let requests = presses.map((press) => {
        let r = {
          PutRequest: {
            Item: {
              bagSize: {
                S: String(press.bagSize)
              },
              bottomTemp: {
                S: String(press.bottomTemp)
              },
              date: {
                S: String(press.date)
              },
              material: {
                S: String(press.material)
              },
              notes: {
                S: String(press.notes)
              },
              strainName: {
                S: String(press.strainName)
              },
              time: {
                S: String(press.time)
              },
              topTemp: {
                S: String(press.topTemp)
              },
              weight: {
                S: String(press.weight)
              },
              yield: {
                S: String(press.yield)
              },
              bag: {
                S: String(press.bag)
              },
              id: {
                S: String(press["_id"])
              },
              machineID: {
                S: String(this.machineID)
              }
            }
          }
        }

        return r
      })

      let params = {
        RequestItems: {
          'presses': requests
        }
      }

      console.log("Presses sync requests:", requests);

      this.ddb.batchWriteItem(params, function (err, data) {
        if (err) {
          console.log("Error", err);
          reject(err)
        } else {
          console.log("Presses synced.", data);
          resolve(data)
        }
      });
    })
  }

  markPressesSynced(except) {

    // except = {
    //   "UnprocessedItems": {
    //     "presses": [
    //       {
    //         "PutRequest": {
    //           "Item": {
    //             id: "59fb83e1e3d71501ad3f4050"
    //           }
    //         }
    //       }
    //     ]
    //   }
    // }

    let exceptIDs = []

    if (except && except.UnprocessedItems.presses) {
      exceptIDs = except.UnprocessedItems.presses.map((o) => {
        return o.PutRequest.Item.id
      })
    }

    return this.connect()
      .then((db) => {
        return new Promise((resolve, reject) => {
          var presses = db.collection('presses');
          presses.find({
            "sync": {
              "$exists": false
            },
            "yield": {
              "$exists": true
            }
          }).toArray(function (err, pressesArray) {
            for (var i in pressesArray) {
              let press = pressesArray[i]
              let pressID = String(press["_id"])

              if (exceptIDs.indexOf(pressID) == -1) {
                presses.update(
                  {
                    _id: ObjectId(pressID)
                  },
                  {
                    $set: {
                      sync: true
                    }
                  },
                  {
                    multi: true
                  }
                )
              }
            }

          })
          resolve()
        })
      })
  }

}

module.exports = Database
