// Bambu Lab A1 + AMS Lite simulada: MQTT com TLS na porta 8883 e câmera na porta 6000.
// Precisa do pacote "aedes" (npm install aedes) e do comando openssl.
// Uso: node teste/simulador-bambu.cjs
// No dashboard: tipo Bambu Lab · IP 127.0.0.1 · série 01S00A000000000 · código 12345678
const fs = require('fs')
const path = require('path')
const tls = require('tls')
const { execSync } = require('child_process')
const os = require('os')

const SERIAL = '01S00A000000000'
const CODIGO = '12345678'
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bambu-sim-'))
execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${dir}/k.pem -out ${dir}/c.pem -days 2 -subj /CN=${SERIAL}`, { stdio: 'ignore' })
const cred = { key: fs.readFileSync(`${dir}/k.pem`), cert: fs.readFileSync(`${dir}/c.pem`) }

const aedes = require('aedes')()
aedes.authenticate = (client, user, pass, cb) => cb(null, user === 'bblp' && String(pass) === CODIGO)

const p = {
    gcode_state: 'RUNNING', mc_percent: 37, mc_remaining_time: 52, layer_num: 61, total_layer_num: 164,
    subtask_name: 'Suporte de fone', gcode_file: '/data/Metadata/plate_1.gcode',
    nozzle_temper: 219.6, nozzle_target_temper: 220, bed_temper: 64.8, bed_target_temper: 65,
    cooling_fan_speed: '15', spd_lvl: 2, spd_mag: 100, stg_cur: 0, print_error: 0, hms: [],
    wifi_signal: '-52dBm', nozzle_diameter: '0.4', nozzle_type: 'stainless_steel', sdcard: true,
    lights_report: [{ node: 'chamber_light', mode: 'on' }],
    ams: {
        ams: [{
            id: '0', humidity: '5', temp: '0.0', tray: [
                { id: '0', tray_type: 'PLA', tray_sub_brands: 'PLA Basic', tray_color: 'FFFFFFFF', remain: 82, nozzle_temp_min: '190', nozzle_temp_max: '230' },
                { id: '1', tray_type: 'PLA', tray_sub_brands: 'PLA Matte', tray_color: '161616FF', remain: 45, nozzle_temp_min: '190', nozzle_temp_max: '230' },
                { id: '2', tray_type: 'PETG', tray_sub_brands: 'PETG HF', tray_color: 'E8590CFF', remain: -1, nozzle_temp_min: '230', nozzle_temp_max: '260' },
                { id: '3' }
            ]
        }],
        tray_now: '1', ams_exist_bits: '1', tray_exist_bits: '7'
    },
    vt_tray: { id: '254', tray_type: '', tray_color: '00000000' }
}
const reportTopic = `device/${SERIAL}/report`
const publicar = obj => aedes.publish({ topic: reportTopic, payload: Buffer.from(JSON.stringify(obj)), qos: 0, retain: false }, () => {})
const tudo = () => publicar({ print: { ...JSON.parse(JSON.stringify(p)), command: 'push_status', msg: 0, sequence_id: '1' } })

// atualizações parciais, como a A1 faz
setInterval(() => {
    const d = {}
    if (p.gcode_state === 'RUNNING') {
        p.mc_percent = Math.min(100, p.mc_percent + 1)
        p.mc_remaining_time = Math.max(0, p.mc_remaining_time - 1)
        p.layer_num = Math.round(p.total_layer_num * p.mc_percent / 100)
        if (p.mc_percent >= 100) { p.gcode_state = 'FINISH'; p.nozzle_target_temper = 0; p.bed_target_temper = 0 }
        Object.assign(d, { mc_percent: p.mc_percent, mc_remaining_time: p.mc_remaining_time, layer_num: p.layer_num, gcode_state: p.gcode_state })
    }
    p.nozzle_temper += (p.nozzle_target_temper - p.nozzle_temper) * 0.2 + (Math.random() - 0.5) * 0.6
    p.bed_temper += ((p.bed_target_temper || 25) - p.bed_temper) * 0.08 + (Math.random() - 0.5) * 0.3
    Object.assign(d, { nozzle_temper: +p.nozzle_temper.toFixed(1), bed_temper: +p.bed_temper.toFixed(1), nozzle_target_temper: p.nozzle_target_temper, bed_target_temper: p.bed_target_temper })
    publicar({ print: { ...d, command: 'push_status', msg: 1, sequence_id: '2' } })
}, 2000)

aedes.on('publish', (pkt, client) => {
    if (!client || pkt.topic !== `device/${SERIAL}/request`) return
    let r; try { r = JSON.parse(pkt.payload.toString()) } catch (e) { return }
    console.log('pedido:', JSON.stringify(r))
    if (r.pushing && r.pushing.command === 'pushall') return tudo()
    if (r.info && r.info.command === 'get_version') return publicar({ info: { command: 'get_version', sequence_id: '0', module: [{ name: 'ota', sw_ver: '01.04.00.00', sn: SERIAL }, { name: 'ams_f1/0', sw_ver: '00.00.07.89', sn: '03C00A000000000' }] } })
    if (r.system && r.system.command === 'ledctrl') { p.lights_report = [{ node: 'chamber_light', mode: r.system.led_mode }]; return publicar({ print: { lights_report: p.lights_report } }) }
    const c = r.print || {}
    if (c.command === 'pause') { p.gcode_state = 'PAUSE'; p.stg_cur = 16 }
    if (c.command === 'resume') { p.gcode_state = 'RUNNING'; p.stg_cur = 0 }
    if (c.command === 'stop') { p.gcode_state = 'FAILED'; p.stg_cur = 0 }
    if (c.command === 'print_speed') { p.spd_lvl = Number(c.param); p.spd_mag = { 1: 50, 2: 100, 3: 124, 4: 166 }[p.spd_lvl] }
    if (c.command === 'ams_change_filament') p.ams.tray_now = String(c.target)
    if (c.command === 'gcode_line') {
        for (const l of String(c.param).split('\n')) {
            let m
            if ((m = l.match(/^M104 S(\d+)/))) p.nozzle_target_temper = +m[1]
            if ((m = l.match(/^M140 S(\d+)/))) p.bed_target_temper = +m[1]
            if ((m = l.match(/^M106 P1 S(\d+)/))) p.cooling_fan_speed = String(Math.round(+m[1] / 255 * 15))
        }
    }
    setTimeout(tudo, 300)
})

tls.createServer(cred, aedes.handle).listen(8883, () => console.log('MQTT (TLS) em 127.0.0.1:8883'))

// Câmera: login de 80 bytes, depois fotos JPEG com cabeçalho de 16 bytes
const jpg = fs.readFileSync(path.join(__dirname, 'camera-exemplo.jpg'))
tls.createServer(cred, sock => {
    let ok = false, timer
    sock.on('data', d => {
        if (ok || d.length < 80) return
        const usuario = d.subarray(16, 48).toString('ascii').replace(/\0+$/, '')
        const senha = d.subarray(48, 80).toString('ascii').replace(/\0+$/, '')
        if (usuario !== 'bblp' || senha !== CODIGO) return sock.destroy()
        ok = true
        const enviar = () => { const h = Buffer.alloc(16); h.writeUInt32LE(jpg.length, 0); sock.write(Buffer.concat([h, jpg])) }
        enviar(); timer = setInterval(enviar, 1000)
    })
    sock.on('close', () => clearInterval(timer))
    sock.on('error', () => {})
}).listen(6000, () => console.log('Câmera (TLS) em 127.0.0.1:6000'))
