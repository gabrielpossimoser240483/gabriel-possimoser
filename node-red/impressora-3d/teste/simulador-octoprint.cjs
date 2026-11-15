// OctoPrint simulado para testar o fluxo. Uso: node teste/simulador-octoprint.cjs [porta]  (padrão 5000)
// No fluxo: tipo = octoprint, url = http://127.0.0.1:5000, apiKey = teste
const http = require('http')
const PORTA = Number(process.argv[2]) || 5000
const p = { estado: 'Printing', bico: 210, bicoAlvo: 210, mesa: 60, mesaAlvo: 60, progresso: 42, tempo: 3000 }
setInterval(() => { if (p.estado === 'Printing') { p.progresso = Math.min(100, p.progresso + 0.05); p.tempo += 1 } }, 1000)

const json = (res, c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(o === undefined ? '' : JSON.stringify(o)) }
http.createServer((req, res) => {
    if (req.headers['x-api-key'] !== 'teste') return json(res, 403, { error: 'Forbidden' })
    let corpo = ''
    req.on('data', d => { corpo += d })
    req.on('end', () => {
        const b = corpo ? JSON.parse(corpo) : {}
        const r = new URL(req.url, 'http://x').pathname
        const flags = { operational: true, printing: p.estado === 'Printing', paused: p.estado === 'Paused', ready: p.estado === 'Operational', error: false, cancelling: false, pausing: false, closedOrError: false }
        if (r === '/api/printer' && req.method === 'GET') return json(res, 200, { state: { text: p.estado, flags }, temperature: { tool0: { actual: p.bico, target: p.bicoAlvo }, bed: { actual: p.mesa, target: p.mesaAlvo }, chamber: { actual: 32.5, target: null } } })
        if (r === '/api/job' && req.method === 'GET') return json(res, 200, { job: { file: { name: 'gancho.gcode', path: 'gancho.gcode', origin: 'local', display: 'gancho.gcode' }, estimatedPrintTime: 7200, filament: { tool0: { length: 5400 } } }, progress: { completion: p.progresso, printTime: p.tempo, printTimeLeft: 4000 }, state: p.estado })
        if (r === '/api/job') { if (b.command === 'cancel') p.estado = 'Operational'; else p.estado = b.action === 'resume' ? 'Printing' : 'Paused'; return json(res, 204) }
        if (r === '/api/printer/command') { (b.commands || []).forEach(c => { const m = c.match(/^M104 S(\d+)/); if (m) p.bicoAlvo = +m[1] }); return json(res, 204) }
        if (r === '/api/files' ) return json(res, 200, { files: [{ type: 'folder', children: [{ type: 'machinecode', name: 'gancho.gcode', path: 'pasta/gancho.gcode', size: 120000, date: Date.now() / 1000 - 600, gcodeAnalysis: { estimatedPrintTime: 7200 } }] }, { type: 'machinecode', name: 'vaso.gcode', path: 'vaso.gcode', size: 990000, date: Date.now() / 1000 - 9000 }] })
        if (r.startsWith('/api/files/local/')) return req.method === 'GET' ? json(res, 200, { name: 'gancho.gcode', gcodeAnalysis: { estimatedPrintTime: 7200 } }) : (p.estado = 'Printing', p.progresso = 0, json(res, 204))
        if (r === '/api/version') return json(res, 200, { server: '1.10.2', api: '0.1', text: 'OctoPrint 1.10.2' })
        if (r === '/api/connection') return json(res, 200, { current: { state: p.estado, port: '/dev/ttyUSB0', baudrate: 115200 } })
        if (r === '/api/settings') return json(res, 200, { webcam: { snapshotUrl: 'http://127.0.0.1:8080/?action=snapshot', streamUrl: '/webcam/?action=stream' } })
        json(res, 404, { error: 'not found' })
    })
}).listen(PORTA, () => console.log('Simulador OctoPrint em http://127.0.0.1:' + PORTA))
