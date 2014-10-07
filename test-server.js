const pull = require('pull-stream')
pull.from = require('stream-to-pull-stream')
pull.pushable = require('pull-pushable')

const net = require('net')
const negotiar = require('./server')
// const now = require('right-now')
const dateformat = require('dateformat')

net.createServer(function(stream) {
	pull(
		pull.from.source(stream),
		negotiar([ 'echo@1', 'time@1', 'time/readable@1' ], function(protocol) {
			switch(protocol) {
			case 'echo@1':
				return pull.Through(function(read) {
					return read
				})()

			case 'time@1':
				return pull.Through(function(read) {
					return pull.values([ Date.now() ])
				})()

			case 'time/readable@1':
				return pull.Through(function(read) {
					return pull.values([ dateformat('dddd, mmmm dS, yyyy, H:MM:ss') ])
				})()

			default:
				return null
			}
		}),
		pull.from.sink(stream)
	)
}).listen(3204, function(err) {
	if(err)
		throw err

	const addr = this.address()
	console.log('Listening on %s:%d', addr.address, addr.port)
})