<template>
  <div class="i3d">
    <div v-if="!p" class="i3d-vazio">Carregando…</div>
    <template v-else>
      <div class="i3d-linha" style="margin-bottom:8px">
        <v-chip size="small" variant="flat" :color="p.online ? 'success' : (p.online === false ? 'error' : 'grey')">{{ p.online ? 'Conectada' : (p.online === false ? 'Sem conexão' : '—') }}</v-chip>
        <span v-if="p.latencia != null" class="i3d-sub">resposta em {{ p.latencia }} ms</span>
      </div>

      <template v-if="p.host">
        <div class="i3d-titulo">Computador da impressora</div>
        <div class="i3d-linha"><span style="width:110px" class="i3d-sub">CPU</span><v-progress-linear :model-value="p.host.cpu || 0" height="14" rounded color="primary" style="flex:1"><small>{{ p.host.cpu != null ? p.host.cpu.toFixed(0) + '%' : '—' }}</small></v-progress-linear></div>
        <div class="i3d-linha"><span style="width:110px" class="i3d-sub">Memória</span><v-progress-linear :model-value="mem" height="14" rounded color="primary" style="flex:1"><small>{{ memTexto }}</small></v-progress-linear></div>
        <div class="i3d-grade">
          <div class="i3d-celula"><span>Temp. CPU</span><b>{{ p.host.cpuTemp != null ? p.host.cpuTemp.toFixed(1) + '°C' : '—' }}</b></div>
          <div class="i3d-celula"><span>Ligado há</span><b>{{ uptime(p.host.uptime) }}</b></div>
        </div>
      </template>

      <div class="i3d-titulo">Software</div>
      <table class="i3d-tabela">
        <tbody>
          <tr v-for="l in linhas" :key="l[0]"><td class="i3d-sub" style="width:40%">{{ l[0] }}</td><td style="word-break:break-all">{{ l[1] }}</td></tr>
        </tbody>
      </table>
      <div v-for="a in avisos" :key="a" class="i3d-msg">{{ a }}</div>
    </template>
  </div>
</template>

<script>
export default {
  computed: {
    p() { return this.msg && this.msg.payload },
    mem() { const h = this.p.host; return h && h.memTotal ? 100 * h.memUsada / h.memTotal : 0 },
    memTexto() { const h = this.p.host; return h && h.memTotal ? (h.memUsada / 1048576).toFixed(2) + ' / ' + (h.memTotal / 1048576).toFixed(2) + ' GB' : '—' },
    linhas() {
      const p = this.p, l = []
      if (p.klipper) {
        l.push(['Klipper', p.klipper.versao || '—'])
        l.push(['Estado do Klipper', p.klipper.estado || '—'])
        if (p.klipper.hostname) l.push(['Nome do host', p.klipper.hostname])
      }
      if (p.moonraker) l.push(['Moonraker', p.moonraker.versao || '—'])
      if (p.host && p.host.conexoes != null) l.push(['Conexões abertas', p.host.conexoes])
      if (p.bambu) {
        if (p.bambu.firmware) l.push(['Firmware', p.bambu.firmware])
        if (p.bambu.wifi) l.push(['Sinal Wi-Fi', p.bambu.wifi])
        if (p.bambu.bico) l.push(['Bico instalado', p.bambu.bico])
        if (p.bambu.sdcard != null) l.push(['Cartão de memória', p.bambu.sdcard ? 'inserido' : 'ausente'])
        for (const mod of (p.bambu.modulos || []).filter(x => x.nome !== 'ota' && x.versao)) l.push([mod.nome, mod.versao])
      }
      if (p.octoprint) l.push(['OctoPrint', p.octoprint.versao + ' (API ' + p.octoprint.api + ')'])
      if (p.conexao) l.push(['Conexão serial', [p.conexao.estado, p.conexao.porta, p.conexao.baud].filter(Boolean).join(' · ')])
      if (!l.length) l.push(['Informações', 'aguardando…'])
      return l
    },
    avisos() { return (this.p.moonraker && this.p.moonraker.avisos) || [] }
  },
  methods: {
    uptime(s) {
      if (s == null) return '—'
      const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
      return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'min' : m + 'min'
    }
  }
}
</script>
