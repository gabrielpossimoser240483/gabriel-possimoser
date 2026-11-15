<template>
  <div class="i3d">
    <div ref="log" class="i3d-log i3d-mono">
      <div v-if="!linhas.length" class="i3d-sub">Nada por aqui ainda.</div>
      <div v-for="(l, i) in linhas" :key="i" :class="'l-' + l.tipo"><span class="i3d-hora">{{ hora(l.t) }}</span>{{ l.tipo === 'cmd' ? '> ' : '' }}{{ l.texto }}</div>
    </div>
    <div class="i3d-linha" style="margin-top:8px">
      <v-text-field v-model="texto" density="compact" hide-details variant="outlined" class="i3d-mono" placeholder="Digite um G-code (ex.: G28) e Enter"
        style="flex:1; min-width:160px" @keyup.enter="mandar" @keydown.up.prevent="historico(-1)" @keydown.down.prevent="historico(1)"></v-text-field>
      <v-btn color="primary" variant="flat" size="small" @click="mandar">Enviar</v-btn>
    </div>
    <div class="i3d-linha" style="margin-top:8px">
      <v-btn v-for="r in rapidos" :key="r.g" size="x-small" variant="tonal" :title="r.d" @click="enviar(r.g)">{{ r.g }}</v-btn>
      <v-spacer></v-spacer>
      <v-btn size="x-small" variant="text" @click="limpar">Limpar</v-btn>
    </div>
    <div v-if="msg && msg.payload && msg.payload.suportaRespostas === false" class="i3d-sub" style="margin-top:6px">
      {{ msg.payload.tipo === 'bambu' ? 'A Bambu Lab não devolve respostas de G-code pela rede; os comandos são executados mesmo assim.' : 'No OctoPrint, as respostas da impressora aparecem no Terminal do próprio OctoPrint.' }}
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      texto: '', hist: [], pos: -1,
      rapidos: [
        { g: 'G28', d: 'Home de todos os eixos' }, { g: 'M114', d: 'Mostrar posição' }, { g: 'M105', d: 'Mostrar temperaturas' },
        { g: 'M84', d: 'Desligar motores' }, { g: 'M106 S255', d: 'Ventoinha 100%' }, { g: 'M107', d: 'Ventoinha desligada' }
      ]
    }
  },
  computed: { linhas() { return (this.msg && this.msg.payload && this.msg.payload.linhas) || [] } },
  watch: { linhas() { this.$nextTick(() => { const el = this.$refs.log; if (el) el.scrollTop = el.scrollHeight }) } },
  methods: {
    mandar() {
      const t = (this.texto || '').trim()
      if (!t) return
      this.hist.push(t); this.pos = -1; this.texto = ''
      this.enviar(t)
    },
    historico(d) {
      if (!this.hist.length) return
      this.pos = this.pos === -1 ? (d < 0 ? this.hist.length - 1 : -1) : this.pos + d
      if (this.pos < 0 || this.pos >= this.hist.length) { this.pos = -1; this.texto = ''; return }
      this.texto = this.hist[this.pos]
    },
    enviar(script) { this.send({ topic: 'comando', payload: { acao: 'gcode', script } }) },
    limpar() { this.send({ topic: 'comando', payload: { acao: 'limparConsole' } }) },
    hora(t) { return t ? new Date(t).toLocaleTimeString('pt-BR') + '  ' : '' }
  }
}
</script>

<style>
.i3d-log { height: 260px; overflow: auto; padding: 8px; border-radius: 6px; background: #0d1117; color: #c9d1d9; white-space: pre-wrap; word-break: break-word; }
.i3d-log .l-cmd { color: #79c0ff; }
.i3d-log .l-erro { color: #ff7b72; }
.i3d-log .i3d-hora { color: #6e7681; }
</style>
