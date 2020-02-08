/*
 * Copyright 2020 Sergio Rando <segio.rando@yahoo.com>
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

const defaultExcludeList = [ 'evPing', 'evPong' ];

export class MessagePool {
	/**
	 * @param {string=} sName (Optional) message pool name
	 * @param {Function=} fnLog (Optional) log function
	 */
	constructor(sName, fnLog) {
		/** @type {MessageHandlers} */
		this.oMessages = {};
		/** @type {MessageHandlers} */
		this.oMessagesOnce = {};
		/** @type {Array<string>} */
		this.aExcludeLog = /** @type {Array} */ ( platform.clone(defaultExcludeList) );
	
		this.sName = sName || "Unknown";

		/** @private */
		this.evPing = this.onPing.bind(this);

		this.fnLog = fnLog || function() {};

		this.bReady = false;

		/** @type {(Window | null)} */ this.oTarget = null;
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
	 * @private
	 * @param {MessageEvent} event
	 */
	onMessage(event) {
		let aMessage = /** @type {Array} */ ( JSON.parse(event.data) );
		if (this.bReady !== true) {
			this.messageLog(aMessage, 'SKIP ');
		} else {
			this.callMessage.apply(this, aMessage);
		}
	}
	
	/**
	 * Execute local message handler
	 * @private
	 * @param {string} sMessage 
	 * @param  {...*} va_args (Optional) message data passed to message handler
	 */
	callMessage(sMessage, va_args) {
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
	 * Receive message
	 * @param {string} sMessage
	 * @param {...*} va_args (Optional) message data passed to message handler
	 */
	recv(sMessage, va_args) {
		let aMessage = Array.prototype.slice.call(arguments, 0);
		platform.postMessage(JSON.stringify(aMessage), '*');
	}

	/**
	 * Set message pool target
	 * @param {(HTMLIFrameElement | Window)=} oTarget (Optional) target message pool Window or iFrame
	 */
	target(oTarget) {
		if (oTarget === undefined)
			this.oTarget = null;
		else if (oTarget instanceof HTMLIFrameElement)
			this.oTarget = oTarget.contentWindow;
		else
			this.oTarget = oTarget;
	}

	/** 
	 * Send message
	 * @param {string} sMessage
	 * @param {...*} va_args (Optional) message data passed to message handler
	 */
	send(sMessage, va_args) {
		let aMessage = Array.prototype.slice.call(arguments, 0);
		if (this.oTarget === null)
			this.messageLog(aMessage, 'DROP ');
		else
			this.oTarget.postMessage(JSON.stringify(aMessage), '*');
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
	 * @param {*} oMessage
	 */
	log(oMessage) {
		console.log('[' + this.sName + ']: ' + oMessage);
	}

	/**
	 * @private
	 */
	onPing() {
		this.recv('evPong');
	}

	/** @param {Function} fnCallback */
	synchronize(fnCallback) {
		let oPingPong = null;
		let oMessagePool = this;
		let fnPingPong = function() {
			oMessagePool.send('evPing');
			oPingPong = setTimeout(fnPingPong, 1000);
		}
		this.registerOnce('evPong', function() {
			clearTimeout(oPingPong);
			fnCallback();
		});
		this.register('evPing', this.evPing);
		fnPingPong();
	}
}
