// Impressora simulada (API do Moonraker) para testar o fluxo sem uma impressora de verdade.
// Uso: node teste/simulador-moonraker.cjs [porta]   (padrão 7125)
// No fluxo, configure: tipo = moonraker, url = http://127.0.0.1:7125
const http = require('http')
const PORTA = Number(process.argv[2]) || 7125

const agora = () => Date.now() / 1000
const t0 = agora()
const p = {
    estado: 'printing', arquivo: 'pecas/suporte_celular.gcode', inicio: agora() - 1500, duracaoBase: 1500,
    bico: 30, bicoAlvo: 215, mesa: 25, mesaAlvo: 60, cam: 31, fan: 1, speed: 1, flow: 1, zoff: 0,
    pos: [120, 95, 4.2, 0], homed: 'xyz', ultimoTick: agora(), progresso: 0.31, log: []
}
const TOTAL = 4800
const log = (msg, type = 'response') => { p.log.push({ message: msg, time: agora(), type }); if (p.log.length > 200) p.log.shift() }
log('// Klipper pronto')

setInterval(() => {
    const dt = agora() - p.ultimoTick; p.ultimoTick = agora()
    const aproxima = (v, alvo, k) => v + (alvo - v) * Math.min(1, k * dt) + (Math.random() - 0.5) * 0.4
    p.bico = aproxima(p.bico, p.bicoAlvo || 25, 0.08)
    p.mesa = aproxima(p.mesa, p.mesaAlvo || 25, 0.03)
    if (p.estado === 'printing') {
        p.duracaoBase += dt
        p.progresso = Math.min(1, p.progresso + dt / TOTAL * p.speed)
        p.pos[0] = 60 + Math.random() * 120; p.pos[1] = 50 + Math.random() * 100
        p.pos[2] = 0.2 + p.progresso * 42
        if (p.progresso >= 1) { p.estado = 'complete'; p.bicoAlvo = 0; p.mesaAlvo = 0; log('// Impressão concluída') }
    }
}, 500)

const svg = (w, h, cor, texto) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${cor}"/><text x="50%" y="50%" fill="#fff" font-family="sans-serif" font-size="${Math.round(h / 10)}" text-anchor="middle">${texto}</text></svg>`

function resposta(res, codigo, obj) {
    res.writeHead(codigo, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(obj))
}

function gcode(script) {
    for (const linha of script.split('\n')) {
        const l = linha.trim(); if (!l) continue
        log(l, 'command')
        const v = (k) => { const m = l.match(new RegExp(k + '(-?[\\d.]+)', 'i')); return m ? Number(m[1]) : null }
        if (/^M104/i.test(l)) p.bicoAlvo = v('S')
        else if (/^M140/i.test(l)) p.mesaAlvo = v('S')
        else if (/^M106/i.test(l)) p.fan = (v('S') ?? 255) / 255
        else if (/^M107/i.test(l)) p.fan = 0
        else if (/^M220/i.test(l)) p.speed = v('S') / 100
        else if (/^M221/i.test(l)) p.flow = v('S') / 100
        else if (/^G28/i.test(l)) { p.homed = 'xyz'; p.pos = [0, 0, 0, 0] }
        else if (/^M84/i.test(l)) p.homed = ''
        else if (/^SET_GCODE_OFFSET/i.test(l)) p.zoff += Number((l.match(/Z_ADJUST=(-?[\d.]+)/) || [0, 0])[1])
        else if (/^G1/i.test(l)) {
            if (!p.homed && /[XYZ]/i.test(l)) { log('!! Must home axis first: ' + l); return 'Must home axis first' }
            ;['X', 'Y', 'Z'].forEach((e, i) => { const d = v(e); if (d !== null) p.pos[i] += d })
        }
        else if (/^M114/i.test(l)) log(`X:${p.pos[0].toFixed(3)} Y:${p.pos[1].toFixed(3)} Z:${p.pos[2].toFixed(3)} E:0.000`)
    }
    log('ok')
    return null
}

http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x')
    const r = u.pathname
    if (r === '/printer/objects/query') {
        const meta = { estimated_time: TOTAL }
        return resposta(res, 200, {
            result: {
                eventtime: agora(), status: {
                    webhooks: { state: 'ready', state_message: 'Printer is ready' },
                    print_stats: {
                        state: p.estado, filename: p.estado === 'standby' ? '' : p.arquivo, print_duration: p.duracaoBase,
                        total_duration: p.duracaoBase + 60, filament_used: p.progresso * 9120, message: '', info: { current_layer: null, total_layer: null }
                    },
                    virtual_sdcard: { progress: p.progresso, is_active: p.estado === 'printing' },
                    display_status: { progress: 0, message: null },
                    extruder: { temperature: p.bico, target: p.bicoAlvo, power: p.bicoAlvo ? 0.45 : 0, can_extrude: p.bico > 170, filament_diameter: 1.75 },
                    heater_bed: { temperature: p.mesa, target: p.mesaAlvo, power: p.mesaAlvo ? 0.3 : 0 },
                    toolhead: { position: p.pos, homed_axes: p.homed, axis_maximum: [235, 235, 250, 0] },
                    gcode_move: { speed_factor: p.speed, extrude_factor: p.flow, homing_origin: [0, 0, p.zoff, 0], gcode_position: p.pos },
                    motion_report: { live_position: p.pos, live_velocity: p.estado === 'printing' ? 80 + Math.random() * 60 : 0, live_extruder_velocity: p.estado === 'printing' ? 1.8 + Math.random() : 0 },
                    fan: { speed: p.fan },
                    idle_timeout: { state: p.estado === 'printing' ? 'Printing' : 'Idle' },
                    'temperature_sensor chamber': { temperature: p.cam + Math.random() },
                    'temperature_sensor raspberry_pi': { temperature: 48 + Math.random() * 3 }
                }
            }
        }, meta)
    }
    if (r === '/printer/objects/list') return resposta(res, 200, { result: { objects: ['webhooks', 'extruder', 'heater_bed', 'temperature_sensor chamber', 'temperature_sensor raspberry_pi', 'fan'] } })
    if (r === '/server/gcode_store') return resposta(res, 200, { result: { gcode_store: p.log.slice(-Number(u.searchParams.get('count') || 100)) } })
    if (r === '/server/files/list') {
        return resposta(res, 200, {
            result: [
                { path: 'pecas/suporte_celular.gcode', modified: t0 - 3600, size: 2834211 },
                { path: 'calibracao/cubo_20mm.gcode', modified: t0 - 86400 * 3, size: 452100 },
                { path: 'benchy.gcode', modified: t0 - 86400 * 10, size: 3901234 },
                { path: 'organizador_gaveta.gcode', modified: t0 - 86400, size: 8123456 }
            ]
        })
    }
    if (r === '/server/files/metadata') {
        return resposta(res, 200, {
            result: {
                filename: u.searchParams.get('filename'), estimated_time: TOTAL, filament_total: 9120, filament_weight_total: 27.2,
                layer_height: 0.2, first_layer_height: 0.2, object_height: 42.2, modified: t0 - 3600,
                thumbnails: [{ width: 32, height: 32, relative_path: '.thumbs/suporte_celular-32x32.png' }, { width: 300, height: 300, relative_path: '.thumbs/suporte_celular-300x300.png' }]
            }
        })
    }
    if (r.startsWith('/server/files/gcodes/')) {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); return res.end(svg(300, 300, '#e8590c', 'miniatura'))
    }
    if (r === '/server/history/list') {
        const jobs = [
            { job_id: '0005', filename: 'organizador_gaveta.gcode', status: 'completed', start_time: t0 - 86400, end_time: t0 - 70000, print_duration: 15800, total_duration: 16400, filament_used: 22100, exists: true },
            { job_id: '0004', filename: 'benchy.gcode', status: 'cancelled', start_time: t0 - 86400 * 2, end_time: t0 - 86400 * 2 + 900, print_duration: 880, total_duration: 900, filament_used: 800, exists: true },
            { job_id: '0003', filename: 'calibracao/cubo_20mm.gcode', status: 'completed', start_time: t0 - 86400 * 3, end_time: t0 - 86400 * 3 + 1900, print_duration: 1850, total_duration: 1900, filament_used: 2400, exists: true },
            { job_id: '0002', filename: 'vaso_antigo.gcode', status: 'error', start_time: t0 - 86400 * 5, end_time: t0 - 86400 * 5 + 3000, print_duration: 2900, total_duration: 3000, filament_used: 4100, exists: false }
        ]
        return resposta(res, 200, { result: { count: jobs.length, jobs } })
    }
    if (r === '/server/history/totals') return resposta(res, 200, { result: { job_totals: { total_jobs: 87, total_time: 812000, total_print_time: 790500, total_filament_used: 1650000, longest_job: 52000, longest_print: 51000 } } })
    if (r === '/machine/proc_stats') return resposta(res, 200, { result: { cpu_temp: 51.3 + Math.random(), system_cpu_usage: { cpu: 12 + Math.random() * 10 }, system_memory: { total: 3884008, available: 2900000, used: 984008 }, system_uptime: 302400, websocket_connections: 2 } })
    if (r === '/printer/info') return resposta(res, 200, { result: { state: 'ready', state_message: 'Printer is ready', hostname: 'voron', software_version: 'v0.12.0-simulado' } })
    if (r === '/server/info') return resposta(res, 200, { result: { klippy_state: 'ready', moonraker_version: 'v0.9.3-simulado', warnings: [] } })
    if (r === '/server/webcams/list') return resposta(res, 200, { result: { webcams: [{ name: 'cam', enabled: true, snapshot_url: `http://127.0.0.1:${PORTA}/webcam/?action=snapshot`, stream_url: `http://127.0.0.1:${PORTA}/webcam/?action=stream` }] } })
    if (r === '/webcam/') {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' })
        return res.end(svg(640, 360, '#2b3137', 'Câmera simulada ' + new Date().toLocaleTimeString('pt-BR') + ' · Z ' + p.pos[2].toFixed(2)))
    }
    if (req.method === 'POST') {
        if (r === '/printer/print/pause') { p.estado = 'paused'; log('// pausado'); return resposta(res, 200, { result: 'ok' }) }
        if (r === '/printer/print/resume') { p.estado = 'printing'; return resposta(res, 200, { result: 'ok' }) }
        if (r === '/printer/print/cancel') { p.estado = 'cancelled'; p.bicoAlvo = 0; p.mesaAlvo = 0; return resposta(res, 200, { result: 'ok' }) }
        if (r === '/printer/print/start') { p.estado = 'printing'; p.arquivo = u.searchParams.get('filename'); p.progresso = 0; p.duracaoBase = 0; p.bicoAlvo = 215; p.mesaAlvo = 60; return resposta(res, 200, { result: 'ok' }) }
        if (r === '/printer/emergency_stop') { p.estado = 'error'; p.bicoAlvo = 0; p.mesaAlvo = 0; return resposta(res, 200, { result: 'ok' }) }
        if (r === '/printer/firmware_restart') { p.estado = 'standby'; return resposta(res, 200, { result: 'ok' }) }
        if (r === '/printer/gcode/script') {
            const erro = gcode(u.searchParams.get('script') || '')
            return erro ? resposta(res, 400, { error: { code: 400, message: erro } }) : resposta(res, 200, { result: 'ok' })
        }
    }
    resposta(res, 404, { error: { code: 404, message: 'Not Found: ' + r } })
}).listen(PORTA, () => console.log('Simulador Moonraker em http://127.0.0.1:' + PORTA))
