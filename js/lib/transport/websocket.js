import * as util from '../util';
import * as log from '../log';
import * as serializer from '../serializer';

const EMPTY_FUNCTION = function () {
};

export class Factory {
	constructor(options) {
		var self = this;
		util.assert(options.url !== undefined, "options.url missing");
		util.assert(typeof options.url === "string", "options.url must be a string");

		options.serializers = [new serializer.JSONSerializer()];

		options.protocols = 'wamp';
		// options.serializers.forEach(function (ser) {
		// 	options.protocols.push("wamp.2." + ser.SERIALIZER_ID);
		// });

		self._options = options;
	}

	get type() {
		return "websocket";
	}

	create() {
		var self = this;
		// the WAMP transport we create
		var transport = {
			info: {
				type: self.type,
				url: self._options.url,
				protocol: null
			},
			open: undefined,
			// these will get defined further below
			protocol: 'wamp',
			serializer: undefined,
			send: undefined,
			close: undefined,

			// these will get overridden by the WAMP session using this transport
			onpong: EMPTY_FUNCTION,
			onmessage: EMPTY_FUNCTION,
			onopen: EMPTY_FUNCTION,
			onclose: EMPTY_FUNCTION
		};

		// running in the browser or react-native
		//
		transport.open = function () {
			var websocket;

			// Chrome, MSIE, newer Firefox
			if ("WebSocket" in global) {
				if (self._options.protocols) {
					websocket = new global.WebSocket(self._options.url, self._options.protocols);
				} else {
					websocket = new global.WebSocket(self._options.url);
				}
				websocket.binaryType = 'arraybuffer';
				// older versions of Firefox prefix the WebSocket object
			} else if ("MozWebSocket" in global) {
				if (self._options.protocols) {
					websocket = new global.MozWebSocket(self._options.url, self._options.protocols);
				} else {
					websocket = new global.MozWebSocket(self._options.url);
				}
			} else {
				throw "browser does not support WebSocket or WebSocket in Web workers";
			}

			websocket.onmessage = function (evt) {
				log.debug("WebSocket transport receive", evt.data);

				if (evt.data.length === 0) {
					transport.onpong();
				} else {
					// var msg = transport.serializer.unserialize(evt.data);
					var msg = evt.data
					transport.onmessage(msg);
				}
			};

			websocket.onopen = function (evt) {
				if (!websocket.protocol) {
					websocket.protocol = "wamp";
				}
				// var serializer_part = websocket.protocol.split('.')[2];
				// for (var index in self._options.serializers) {
				// 	var serializer = self._options.serializers[index];
				// 	if (serializer.SERIALIZER_ID == serializer_part) {
				// 		transport.serializer = serializer;
				// 		break;
				// 	}
				// }

				transport.info.protocol = websocket.protocol;
				transport.onopen();
			};

			websocket.onclose = function (evt) {
				var details = {
					code: evt.code,
					reason: evt.message,
					wasClean: evt.wasClean
				};
				transport.onclose(details);
				// clear callbacks.
				transport.onclose = EMPTY_FUNCTION;
			};

			// do NOT do the following, since that will make
			// transport.onclose() fire twice (browsers already fire
			// websocket.onclose() for errors also)
			//websocket.onerror = websocket.onclose;

			transport.send = function (msg) {
				// var payload = transport.serializer.serialize(msg);
				var payload = msg;
				log.debug("WebSocket transport send", payload);
				websocket.send(payload);
			};

			transport.close = function (code, reason, wasClean=true) {
				// clear callbacks.
				transport.onopen = EMPTY_FUNCTION;
				transport.onpong = EMPTY_FUNCTION;
				transport.onmessage = EMPTY_FUNCTION;

				websocket.close(code, reason);
				// as websocket may not response onclose, we close by the way.
				websocket.onclose({code, reason, wasClean});
			};
		};

		return transport;
	}
}
