/*
 * Copyright 2000-2020 Sergio Rando <segio.rando@yahoo.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *		http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

import { bindEvent } from "./../../../include/event.js"

/** @typedef {Object<string, Array<Function>>} MessageHandlers */ var MessageHandlers;

const evPing = 'evPing';
const evPong = 'evPong';

const defaultExcludeList = [ evPing, evPong ];

class Synchronization {
	/**
	 * @param {cMessagePool} oMessagePool
	 * @param {(HTMLIFrameElement | Window | null)} oTarget (Optional) target message pool Window or iFrame or null
	 * @param {Function} fnCallback
	 */
	constructor(oMessagePool, oTarget, fnCallback) {
		/** @private */ this.oMessagePool = oMessagePool;
		/** @private */ this.oTarget = oTarget;
		/** @private */ this.fnCallback = fnCallback;
		/** @private */ this.evPong = this.onPong.bind(this);
		/** @private */ this.evSync = this.onSync.bind(this);
		/** @private @type {number | null} */ this.iSync = null;
		
		this.oMessagePool.registerOnce(evPong, this.evPong);
		this.onSync();
	}

	/**
	 * @private
	 */
	onSync() {
		this.oMessagePool.send(this.oTarget, evPing);
		this.iSync = setTimeout(this.evSync, 1000);
	}

	/**
	 * @private
	 */
	onPong() {
		clearTimeout(this.iSync);
		this.fnCallback();
	}

	cancel() {
		if (this.iSync !== null) {
			clearTimeout(this.iSync);
			this.oMessagePool.unregister(evPong, this.evPong);
			this.iSync = null;
		}
	}
}

/**
 * @private
 * @param {Window} oTarget
 * @param {string} sMessage 
 */
const postMessage = (platform['postMessage'] !== undefined) ?
	/**
	 * @private
	 * @param {Window} oTarget
	 * @param {string} sMessage 
	 */
	function(oTarget, sMessage) {
		oTarget.postMessage(sMessage, '*');
	} :
	/**
	 * @private
	 * @param {Window} oTarget
	 * @param {string} sMessage 
	 */
	async function(oTarget, sMessage) {
		MessagePool.onMessage({'data': sMessage});
	};

class cMessagePool {
	constructor() {
		/** @type {MessageHandlers} */
		this.oMessages = {};
		/** @type {MessageHandlers} */
		this.oMessagesOnce = {};
		/** @type {Array<string>} */
		this.aExcludeLog = /** @type {Array} */ ( platform.clone(defaultExcludeList) );
		this.sName = "MessagePool";
		this.fnLog = console.log;
		this.bReady = false;

		/** @private */
		this.evPing = this.onPing.bind(this);
		this.register(evPing, this.evPing);
	}

	/**
	 * Initialize MessagePool name and log function
	 * @param {string} sName message pool name
	 * @param {Function=} fnLog (Optional) log function
	 */
	init(sName, fnLog) {
		this.sName = sName;
		this.fnLog = fnLog || function() {};
	}

	/**
	 * Check message handler registeration
	 * @param {string} sMessage
	 * @returns {boolean}
	 */
	has(sMessage) {
		if (this.oMessages[sMessage] === undefined) return false;
		return (this.oMessages[sMessage].length > 0) || (this.oMessagesOnce[sMessage].length > 0);
	}

	/**
	 * Register message handler
	 * @param {string} sMessage 
	 * @param {Function} fnHandler
	 */
	register(sMessage, fnHandler) {
		if (this.oMessages[sMessage] === undefined) this.oMessages[sMessage] = [ fnHandler ];
		else if (this.oMessages[sMessage].indexOf(fnHandler) < 0) this.oMessages[sMessage].push(fnHandler);
	}

	/**
	 * Register message handler for execution once
	 * @param {string} sMessage 
	 * @param {Function} fnHandler 
	 */
	registerOnce(sMessage, fnHandler) {
		if (this.oMessagesOnce[sMessage] === undefined) this.oMessagesOnce[sMessage] = [ fnHandler ];
		else if (this.oMessagesOnce[sMessage].indexOf(fnHandler) < 0) this.oMessagesOnce[sMessage].push(fnHandler);
	}
		
	/**
	 * Unregister event handler
	 * @param {string} sMessage 
	 * @param {Function=} fnHandler (Optional) if unset - unregister all event handlers
	 * @returns {boolean}
	 */
	unregister(sMessage, fnHandler) {
		let bResult = false;

		if (this.oMessages[sMessage] !== undefined) {
			if (fnHandler === undefined) {
				delete this.oMessages[sMessage];
				bResult = true;
			} else {
				let i = this.oMessages[sMessage].lastIndexOf(fnHandler);
				if (i >= 0) {
					delete this.oMessages[sMessage][i];
					bResult = true;
				}
			}
		}
		
		if (this.oMessagesOnce[sMessage] !== undefined) {
			if (fnHandler === undefined) {
				delete this.oMessagesOnce[sMessage];
				bResult = true;
			} else {
				let i = this.oMessagesOnce[sMessage].lastIndexOf(fnHandler);
				if (i >= 0) {
					delete this.oMessagesOnce[sMessage][i];
					bResult = true;
				}
			}
		}

		return bResult;
	}

	/**
	 * List of excluded events from logging
	 * @param {boolean} bReset
	 * @param {...string} va_args (Optional) list of event names
	 */
	excludeLog(bReset, va_args) {
		if (bReset) this.aExcludeLog = /** @type {Array} */ ( platform.clone(defaultExcludeList) );
		let args = Array.prototype.slice.call(arguments, 1);
		for (let iIndex = 0; iIndex < args.length; iIndex++) {
			if (this.aExcludeLog.indexOf(args[iIndex]) < 0)
				this.aExcludeLog.push(args[iIndex]);
		}
	}

	/**
	 * @private
	 * @param {Array} aMessage 
	 * @param {string} sPrefix
	 */
	messageLog(aMessage, sPrefix) {
		if (aMessage == null)
			return;
		let sMessage = aMessage[0] || null;
		if (sMessage !== null && 'string' === typeof sMessage) {
			if (this.aExcludeLog.indexOf(sMessage) < 0) {
				aMessage.shift();
				aMessage.unshift('[' + this.sName + ']: ' + sPrefix + sMessage + (aMessage.length === 0 ? '' : ' :'));
				this.fnLog.apply(null, aMessage);
			}
		}
	}

	/**
	 * Message event from message queue
	 * @protected
	 * @param {MessageEvent | {data: string}} event
	 */
	onMessage(event) {
		let aMessage = /** @type {Array} */ ( JSON.parse(event.data) );
		if (this.bReady !== true) {
			this.messageLog(aMessage, 'SKIP ');
		} else {
			this.recv.apply(this, aMessage);
		}
	}
	
	/**
	 * Execute local message handler
	 * @private
	 * @param {string} sMessage 
	 * @param  {...*} va_args (Optional) message data passed to message handler
	 */
	recv(sMessage, va_args) {
		let aMessage = Array.prototype.slice.call(arguments, 1);
		if (this.aExcludeLog.indexOf(sMessage) < 0) {
			let aMessage = Array.prototype.slice.call(arguments, 1);
			aMessage.unshift('[' + this.sName + ']: ' + sMessage + (aMessage.length === 0 ? '' : ' :'));
			this.fnLog.apply(null, aMessage);
		}
		if (this.oMessages[sMessage] !== undefined) {
			let list = this.oMessages[sMessage];
			for (let i in list) {
				if (list.hasOwnProperty(i))
					list[i | 0].apply(null, aMessage);
			}
		}
		if (this.oMessagesOnce[sMessage] !== undefined) {
			let list = this.oMessagesOnce[sMessage];
			delete this.oMessagesOnce[sMessage];
			for (let i in list) {
				if (list.hasOwnProperty(i))
					list[i | 0].apply(null, aMessage);
			}
		}
	}

	/**
	 * Post message to current Message Pool
	 * @param {string} sMessage
	 * @param {...*} va_args (Optional) message data passed to message handler
	 */
	post(sMessage, va_args) {
		let aMessage = Array.prototype.slice.call(arguments, 0);
		postMessage(platform, JSON.stringify(aMessage));
	}

	/** 
	 * Send message to target Message Pool
	 * @param {(HTMLIFrameElement | Window | null)} oTarget (Optional) target message pool Window or iFrame or null
	 * @param {string} sMessage
	 * @param {...*} va_args (Optional) message data passed to message handler
	 */
	send(oTarget, sMessage, va_args) {
		/** @type {(Window | null)} */ let oWindow;
		if (oTarget === null)
			oWindow = platform.parent;
		else if (oTarget instanceof HTMLIFrameElement)
			oWindow = oTarget.contentWindow;
		else
			oWindow = oTarget;

		let aMessage = Array.prototype.slice.call(arguments, 1);
		if (oWindow === null)
			this.messageLog(aMessage, 'DROP ');
		else
			postMessage(oWindow, JSON.stringify(aMessage));
	}
	
	/**
	 * Mark message pool as ready to process messages
	 * @param {boolean=} bReady (Optional) false - to stop message processing (all incoming messages will be lost)
	 */
	ready(bReady) {
		if (this.bReady !== bReady) {
			this.bReady = bReady;
			if (bReady) {
				bindEvent(platform, 'message', this.onMessage.bind(this));
			}
		}
	}

	/**
	 * Log message to console
	 * @param {*=} oMessage
	 */
	log(oMessage) {
		let aLog = [ '[' + this.sName + ']:' ];
		if (oMessage !== undefined) aLog.push(oMessage);
		this.fnLog.apply(null, aLog);
	}

	/**
	 * @private
	 */
	onPing() {
		this.post(evPong);
	}

	/**
	 * Synchronize Message Pools (start communication)
	 * @param {(HTMLIFrameElement | Window | null)} oTarget (Optional) target message pool Window or iFrame or null
	 * @param {Function} fnCallback
	 * @returns {Synchronization} cancelable synchronization object
	 */
	synchronize(oTarget, fnCallback) {
		return new Synchronization(this, oTarget, fnCallback);
	}
}

export const MessagePool = new cMessagePool();
