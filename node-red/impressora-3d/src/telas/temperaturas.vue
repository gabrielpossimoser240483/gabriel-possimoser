<template>
  <div class="i3d">
    <div v-if="!e" class="i3d-vazio">Aguardando dados…</div>
    <template v-else>
      <div v-for="h in aquecedores" :key="h.id" class="i3d-aq">
        <div class="i3d-linha i3d-entre">
          <div>
            <b>{{ h.rotulo }}</b>
            <span class="i3d-num" style="margin-left:6px">{{ fmt(e[h.id].atual) }}°C</span>
            <span class="i3d-sub"> → {{ e[h.id].alvo ? e[h.id].alvo + '°C' : 'desligado' }}</span>
            <span v-if="e[h.id].potencia != null" class="i3d-sub"> · potência {{ e[h.id].potencia }}%</span>
          </div>
        </div>
        <div class="i3d-linha" style="margin-top:6px">
          <v-btn size="small" variant="tonal" icon="mdi-minus" :disabled="travado" @click="somar(h, -5)"></v-btn>
          <v-text-field v-model.number="alvos[h.id]" type="number" density="compact" hide-details variant="outlined"
            style="max-width:110px" suffix="°C" :placeholder="String(e[h.id].alvo || 0)" :disabled="travado"
            @keyup.enter="definir(h)"></v-text-field>
          <v-btn size="small" variant="tonal" icon="mdi-plus" :disabled="travado" @click="somar(h, 5)"></v-btn>
          <v-btn size="small" color="primary" variant="flat" :disabled="travado || alvos[h.id] === '' || alvos[h.id] == null" @click="definir(h)">Definir</v-btn>
          <v-btn size="small" variant="text" :disabled="travado" @click="enviar(h.acao, { alvo: 0 })">Desligar</v-btn>
        </div>
      </div>

      <div class="i3d-titulo">Pré-aquecer</div>
      <div class="i3d-linha">
        <v-btn v-for="p in e.cfg.presets" :key="p.nome" size="small" variant="tonal" color="deep-orange" :disabled="travado"
          @click="enviar('preset', p)">{{ p.nome }} <span class="i3d-sub" style="margin-left:4px">{{ p.bico }}/{{ p.mesa }}</span></v-btn>
        <v-btn size="small" variant="outlined" prepend-icon="mdi-snowflake" :disabled="travado" @click="enviar('desligarAquecimento')">Desligar tudo</v-btn>
      </div>
      <div v-if="travado" class="i3d-sub" style="margin-top:8px">Sem conexão com a impressora.</div>
    </template>
  </div>
</template>

<script>
export default {
  data() {
    return {
      alvos: { bico: '', mesa: '' },
      aquecedores: [
        { id: 'bico', rotulo: 'Bico', acao: 'tempBico', max: 'bicoMax' },
        { id: 'mesa', rotulo: 'Mesa', acao: 'tempMesa', max: 'mesaMax' }
      ]
    }
  },
  computed: {
    e() { return this.msg && this.msg.payload && this.msg.payload.bico ? this.msg.payload : null },
    travado() { return !this.e || ['offline', 'conectando', 'semconfig', 'desconectada'].includes(this.e.estado) }
  },
  methods: {
    fmt(v) { return v == null ? '—' : Number(v).toFixed(1) },
    somar(h, d) {
      const atual = this.alvos[h.id] === '' || this.alvos[h.id] == null ? (this.e[h.id].alvo || 0) : Number(this.alvos[h.id])
      this.alvos[h.id] = Math.min(this.e.cfg[h.max] || 300, Math.max(0, atual + d))
    },
    definir(h) {
      const v = Number(this.alvos[h.id])
      if (!isFinite(v)) return
      this.enviar(h.acao, { alvo: Math.min(this.e.cfg[h.max] || 300, Math.max(0, v)) })
      this.alvos[h.id] = ''
    },
    enviar(acao, extra) { this.send({ topic: 'comando', payload: Object.assign({ acao }, extra || {}) }) }
  }
}
</script>

<style>
.i3d-aq + .i3d-aq { margin-top: 14px; }
</style>
