import Constants from './Constants'
import Config from './Config'
import EventEmitter from 'events'
import SocketIO from 'socket.io'
import WiFiControl from 'wifi-control'
import {
  MSG_CANCEL_PRESS,
  MSG_CLEAR_EXPORT,
  MSG_CONFIG_CANCEL,
  MSG_DELETE_PRESET,
  MSG_EXPORT_HISTORY,
  MSG_GET_PRESSES,
  MSG_NETWORK_CONNECT,
  MSG_NETWORK_DISCONNECT,
  MSG_NETWORK_SCAN, MSG_NETWORK_SCAN_RESULT, MSG_NETWORK_STATE,
  MSG_NETWORK_STATE_RESULT,
  MSG_SAVE_CURRENT_SESSION,
  MSG_SAVE_PRESET,
  MSG_SAVE_YIELD,
  MSG_SELECT_PRESET,
  MSG_SET_BOTTOM_TEMP,
  MSG_SET_TIME,
  MSG_SET_TOP_TEMP,
  MSG_START_PRESS,
  MSG_SWITCH_RELAY, NETWORK_STATE_CONNECTED, NETWORK_STATE_CONNECTING,
  NETWORK_STATE_DISCONNECTED
} from "./commons/dispatch";

class Server extends EventEmitter {

  constructor() {

    super();

    this.start = this.start.bind(this);
    this.onConnect = this.onConnect.bind(this);

    this.onSwitchRelay = this.onSwitchRelay.bind(this);
    this.onSavePreset = this.onSavePreset.bind(this);
    this.onDeletePreset = this.onDeletePreset.bind(this);
    this.onSelectPreset = this.onSelectPreset.bind(this);
    this.onStartPress = this.onStartPress.bind(this);
    this.onCancelPress = this.onCancelPress.bind(this);
    this.onSaveYield = this.onSaveYield.bind(this);
    this.onSetTopTemp = this.onSetTopTemp.bind(this);
    this.onSetBottomTemp = this.onSetBottomTemp.bind(this);
    this.onSetTime = this.onSetTime.bind(this);
    this.onConfirmCancel = this.onConfirmCancel.bind(this);
    this.onSessionState = this.onSessionState.bind(this);
    this.onNetworkScan = this.onNetworkScan.bind(this);
    this.onNetworkState = this.onNetworkState.bind(this);
    this.onNetworkConnect = this.onNetworkConnect.bind(this);
    this.onNetworkDisconnect = this.onNetworkDisconnect.bind(this);
    this.onGetPresses = this.onGetPresses.bind(this);
    this.onExportHistory = this.onExportHistory.bind(this);
    this.onClearExport = this.onClearExport.bind(this);
    this.setDeviceUiSettings = this.setDeviceUiSettings.bind(this);

    this.dispatch = this.dispatch.bind(this);

    this.database = null;

    this.name = "Socket server";
    this.batcher = null;

    // For multiple clients
    this.clients = [];

    // Socket server itself
    this.socket = SocketIO();
    this.socket.on('connection', this.onConnect)
  }

  start() {

    return new Promise((resolve) => {

      let portNumber = 3001;
      console.log('Starting socket server on port ' + portNumber);
      this.socket.listen(portNumber);

      resolve()
    })
  }

  // Session related
  onConnect(client) {
    console.log('Client with ID: ' + client.id + ' connected.');

    WiFiControl.init({
      debug: true
    });

    client.on(MSG_SWITCH_RELAY, this.onSwitchRelay);
    client.on(MSG_SAVE_PRESET, this.onSavePreset);
    client.on(MSG_DELETE_PRESET, this.onDeletePreset);
    client.on(MSG_SELECT_PRESET, this.onSelectPreset);
    client.on(MSG_START_PRESS, this.onStartPress);
    client.on(MSG_CANCEL_PRESS, this.onCancelPress);
    client.on(MSG_SAVE_YIELD, this.onSaveYield);
    client.on(MSG_SET_TOP_TEMP, this.onSetTopTemp);
    client.on(MSG_SET_BOTTOM_TEMP, this.onSetBottomTemp);
    client.on(MSG_SET_TIME, this.onSetTime);
    client.on(MSG_CONFIG_CANCEL, this.onConfirmCancel);
    client.on(MSG_NETWORK_CONNECT, this.onNetworkConnect);
    client.on(MSG_NETWORK_DISCONNECT, this.onNetworkDisconnect);
    client.on(MSG_NETWORK_SCAN, this.onNetworkScan);
    client.on(MSG_NETWORK_STATE, this.onNetworkState);
    client.on(MSG_GET_PRESSES, this.onGetPresses);
    client.on(MSG_EXPORT_HISTORY, this.onExportHistory);
    client.on(MSG_CLEAR_EXPORT, this.onClearExport);
    client.on(MSG_SAVE_CURRENT_SESSION, this.onSessionState);
    client.on('updateDeviceUiSettings', this.setDeviceUiSettings);

    client.on('disconnect', this.onDisconnect.bind({
      clients: this.clients,
      client
    }));

    if (this.clients.indexOf(client) === -1) {
      console.log('Adding connected client.');
      this.clients.push(client)
    }

    this.dispatch('updateConfig', Config);

    this.emit(Constants.CLIENT_CONNECTED, client)
  }

  onDisconnect() {

    let {client, clients} = this;

    console.log('Client with ID ' + client.id + ' disconnected.');

    let index = clients.indexOf(client);
    if (clients.indexOf(client) !== -1) {
      console.log('Removing disconnected client.');
      clients.splice(index, 1)
    }
  }

  // Communication related

  onConfirmCancel() {
    this.emit(Constants.F_CONFIRM_CANCEL)
  }

  onSetTopTemp(topTemp) {
    this.emit(Constants.F_SET_TOP_TEMP, topTemp)
  }

  onSetBottomTemp(bottomTemp) {
    this.emit(Constants.F_SET_BOTTOM_TEMP, bottomTemp)
  }

  onSetTime(time) {
    this.emit(Constants.F_SET_TIME, time)
  }

  onSaveYield(weight, pressID) {
    this.emit(Constants.F_SAVE_YIELD, weight, pressID)
  }

  onStartPress(topTemp, bottomTemp, time) {
    this.emit(Constants.F_START_PRESS, topTemp, bottomTemp, time)
  }

  onCancelPress() {
    this.emit(Constants.F_CANCEL_PRESS)
  }

  onSwitchRelay(relayNumber, relayState) {
    this.emit(Constants.F_SWITCH_RELAY, relayNumber, relayState)
  }

  onSavePreset(topTemp, bottomTemp, time, weight, material, bag, strainName) {
    console.log(topTemp, bottomTemp, time, weight, material, bag, strainName);
    this.emit(Constants.F_SAVE_PRESET, topTemp, bottomTemp, time, weight, material, bag, strainName)
  }

  onDeletePreset(presetID) {
    this.emit(Constants.F_DELETE_PRESET, presetID)
  }

  onSelectPreset(presetID) {
    this.emit(Constants.F_SELECT_PRESET, presetID)
  }

  onSessionState(state) {
    this.emit(Constants.F_SAVE_CURRENT_SESSION, state)
  }

  onGetPresses() {
    this.emit(Constants.F_GET_PRESSES)
  }

  onExportHistory(emailAddress) {
    this.emit(Constants.F_EXPORT_HISTORY, emailAddress)
  }

  onClearExport() {
    this.emit(Constants.F_CLEAR_EXPORT)
  }

  onNetworkScan() {
    WiFiControl.scanForWiFi((err, response) => {
      let result;
      if (err !== null) {
        console.log(err);
        result = []
      }
      else {
        result = response.networks
      }
      this.dispatch(MSG_NETWORK_SCAN_RESULT, result)
    })
  }

  onNetworkState() {
    let result = WiFiControl.getIfaceState();
    let _state = result && result.connection === 'connected' ? NETWORK_STATE_CONNECTED : NETWORK_STATE_DISCONNECTED;
    let _ssid = result.ssid;
    this.dispatch(MSG_NETWORK_STATE_RESULT, {state: _state, ssid: _ssid})
  }

  onNetworkConnect(ssid, password) {
    // Notify client about state change
    this.dispatch(MSG_NETWORK_STATE_RESULT, {state: NETWORK_STATE_CONNECTING});

    // Attempt to connect
    WiFiControl.connectToAP({
      ssid,
      password
    }, (err, response) => {
      if (err) {
        console.log('WiFi connection callback error.');
        this.dispatch(MSG_NETWORK_STATE_RESULT, {state: NETWORK_STATE_DISCONNECTED})
      } else {
        console.log('WiFi connection callback success.');
        console.log(response);
        this.database.setWifiSetup();
        this.dispatch(MSG_NETWORK_STATE_RESULT, {state: NETWORK_STATE_CONNECTED, ssid: ssid})
      }
    })
  }

  onNetworkDisconnect() {
    console.log('Attempting to disconnect from network');
    let result = WiFiControl.disconnect();
    if (result.success) {
      console.log('Successfully disconnected');
      this.dispatch(MSG_NETWORK_STATE_RESULT, {state: NETWORK_STATE_DISCONNECTED});
    } else {
      console.log(result.msg)
    }
  }

  setDeviceUiSettings(settings) {
    this.database.updateDeviceUiSettings(settings);
  }

  updateClient(client, state) {
    client.emit('updateAll', state)
  }

  dispatch(message, object) {
    // console.log(message);
    for (let index in this.clients) {
      this.clients[index].emit(message, object)
    }
  }
}

module.exports = Server
