const pull = require('pull-stream')
pull.pushable = require('pull-pushable')

const EE = require('events').EventEmitter

module.exports = function(getAccepted, open) {
	if(getAccepted !== null && getAccepted !== undefined && typeof(getAccepted.length) == 'number') { (function() {
		const acceptedArr = [].slice.call(getAccepted)
		getAccepted = function() {
			return acceptedArr
		}
	})() } else if(typeof(getAccepted) != 'function')
		throw new TypeError('getAccepted needs to be a function or an array-like')

	if(typeof(open) != 'function')
		throw new TypeError('open needs to be a function or an array-like')

	const out = pull.pushable()
	function sendVarStr(str) {
		str = str + ''
		out.push(str.length + ':' + str)
	}
	function sendAccepted() {
		out.push('A')
		sendVarStr(getAccepted().join(','))
	}
	function sendData(data) {
		out.push('D')
		sendVarStr(data)
	}
	function sendError(err) {
		out.push('E')
		sendVarStr(err)
		nego.emit('error', err)
		// console.trace(err)
	}
	function sendClose() {
		out.push('C')
	}

	var current = null

	const nego = pull.Through(function(read) {
		// Parsing
		;(function(gen) {
			gen = gen(function(str) {
				queue = str + queue
			})

			gen.next()

			var queue = ''
			var done = false
			
			function parse() {
				while(queue.length > 0) {
					try {
						gen.next(queue[0])
						queue = queue.substr(1)
					} catch(e) {
						done = true
						queue = ''
						// console.error(e.stack)
						sendError(e)
						out.end()
					}
				}
			}

			pull.drain(function(data) {
				if(!done) {
					queue += data.toString()
					parse()
				}
			})(read)
		})(function*(requeue) {
			function* parseVarStr() {
				var char
				var num = ''
				do {
					char = yield null
					num += char
				} while(/^[0-9]$/.test(char))
				num = num.substr(0, num.length - 1)
				if(char != ':') {
					throw new Error('expected : got ' + char)
				}
				num = parseInt(num)
				var data = ''
				for(var i = 0; i < num; i++) {
					data += yield null
				}
				return data
			}

			function* parsePick() {
				const protocol = yield* parseVarStr()
				// console.log('pick', protocol)
				const ps = open(protocol)
				if(ps) {
					const stream = [protocol, pull.pushable(), ps]
					current = stream
					pull(
						stream[1],
						stream[2],
						pull.drain(function(data) {
							if(current === stream) {
								sendData(data)
							}
						}, function() {
							console.log(arguments)
							sendClose()
							current = null
						})
					)
				} else {
					sendError('unhandlable protocol: ' + protocol)
				}
			}

			function* parseData() {
				const data = yield* parseVarStr()
				// console.log('data', data)
				current[1].push(data)
			}

			function* parseError() {
				const err = yield* parseVarStr()
				nego.emit('error', new Error(err))
				// console.error('remote error', err)
			}

			var char

			while(true) {
				if(current) {
					switch(char = yield null) {
						case 'E':
							yield* parseError()
							break

						case 'D':
							yield* parseData()
							break

						case 'C':
							current[1].end()
							break

						case '\n':
						case '\r':
						case '\t':
						case ' ':
							break

						default:
							sendError('unexpected ' + char)
					}
				} else {
					sendAccepted()
					while(true) {
						switch(char = yield null) {
							case 'E':
								yield* parseError()
								break
							
							case 'P':
								yield* parsePick()
								break

							case '\n':
							case '\r':
							case '\t':
							case ' ':
								break

						default:
							sendError('unexpected ' + char)
						}
						if(current) break
					}
				}
			}
		})

		return out
	})()

	for(var k in EE.prototype) {
		nego[k] = EE.prototype[k]
	}
	EE.call(nego)

	return nego
}