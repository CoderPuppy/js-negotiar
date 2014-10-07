const pull = require('pull-stream')
pull.pushable = require('pull-pushable')

const EE = require('events').EventEmitter

module.exports = function() {
	var current = null

	var out = pull.pushable()
	function sendVarStr(str) {
		out.push(str.length + ':' + str)
	}
	function sendPick(protocol) {
		out.push('P')
		sendVarStr(protocol)
	}
	function sendData(data) {
		// console.log('->', data.toString())
		out.push('D')
		sendVarStr(data)
	}
	function sendClose() {
		out.push('C')
	}
	function sendError(e) {
		// console.trace(e)
		out.push('E')
		sendVarStr('' + e)
		nego.emit('error', e)
	}

	var nego = pull.Through(function(read) {
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
						console.error(e.stack)
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

			function* parseAccepted() {
				const accepted = (yield* parseVarStr()).split(',')
				// console.log('accepted', accepted)
				nego.accepted = accepted
				nego.emit('accepted', accepted)
			}

			function* parseData() {
				const data = yield* parseVarStr()
				// console.log('<-', data)
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
						case 'A':
							yield* parseAccepted()
							break

						case 'E':
							console.log(char)
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
					while(true) {
						switch(char = yield null) {
							case 'A':
								yield* parseAccepted()
								break

							case 'E':
								yield* parseError()
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

	nego.open = pull.Through(function(read, protocol) {
		sendPick(protocol)

		const stream = [protocol, pull.pushable(), read]
		current = stream
		pull.drain(function(data) {
			if(current === stream)
				sendData(data)
		}, function(err) {
			current = null
			sendClose()
			stream[1].end(err)
		})(read)
		return current[1]
	})

	return nego
}