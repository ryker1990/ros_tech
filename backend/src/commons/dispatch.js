/**
 * Set of dispatch messages and states that are sent from client to server (frontend -> backend)
 */
export const MSG_SWITCH_RELAY = "SWITCH_RELAY";
export const MSG_SAVE_YIELD = "SAVE_YIELD";
export const MSG_SET_TIME = "SET_TIME";
export const MSG_CONFIG_CANCEL = "CONFIRM_CANCEL";
export const MSG_GET_PRESSES = "GET_PRESSES";
export const MSG_EXPORT_HISTORY = "EXPORT_HISTORY";
export const MSG_CLEAR_EXPORT = "CLEAR_EXPORT";
export const MSG_SAVE_CURRENT_SESSION = "SAVE_CURRENT_SESSION";

export const MSG_SELECT_PRESET = "SELECT_PRESET";
export const MSG_SAVE_PRESET = "SAVE_PRESET";
export const MSG_DELETE_PRESET = "DELETE_PRESET";

export const MSG_START_PRESS = "START_PRESS";
export const MSG_CANCEL_PRESS = "CANCEL_PRESS";

export const MSG_SET_TOP_TEMP = "SET_TOP_TEMP";
export const MSG_SET_BOTTOM_TEMP = "SET_BOTTOM_TEMP";

export const MSG_NETWORK_SCAN = "NETWORK_SCAN";
export const MSG_NETWORK_STATE = "NETWORK_STATE";
export const MSG_NETWORK_CONNECT = "NETWORK_CONNECT";
export const MSG_NETWORK_DISCONNECT = "NETWORK_DISCONNECT";


/*
 * Set of messages and states that are sent from server to client (backend -> frontend)
 */
export const MSG_NETWORK_SCAN_RESULT = "NETWORK_SCAN_RESULT";
export const MSG_NETWORK_STATE_RESULT = "NETWORK_STATE_RESULT";

export const NETWORK_STATE_CONNECTING = 1;
export const NETWORK_STATE_CONNECTED = 2;
export const NETWORK_STATE_DISCONNECTED = 3;