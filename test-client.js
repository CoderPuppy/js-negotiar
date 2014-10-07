const pull = require('pull-stream')
pull.from = require('stream-to-pull-stream')
pull.pushable = require('pull-pushable')

const net = require('net')
const negotiar = require('./client')

const stream = net.connect(3204, 'localhost', function(err) {
	if(err) throw err

	var nego = negotiar()
	pull(
		pull.from.source(stream),
		nego,
		pull.from.sink(stream)
	)
	pull(
		pull.from.source(process.stdin),
		nego.open(process.argv[2]),
		pull.from.sink(process.stdout)
	)
})