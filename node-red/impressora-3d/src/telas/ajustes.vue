<template>
  <div class="i3d">
    <div v-if="!e" class="i3d-vazio">Aguardando dados…</div>
    <template v-else>
      <template v-if="e.tipo === 'bambu'">
        <div class="i3d-linha i3d-entre"><b>Velocidade</b><span class="i3d-sub">atual {{ e.nivelTexto || '—' }}{{ e.velocidade ? ' (' + e.velocidade + '%)' : '' }}</span></div>
        <v-btn-toggle :model-value="e.nivelVelocidade" density="compact" variant="outlined" divided mandatory style="margin:6px 0 12px">
          <v-btn v-for="n in niveis" :key="n.v" :value="n.v" size="small" :disabled="travado" @click="enviar('nivelVelocidade', { nivel: n.v })">{{ n.t }}</v-btn>
        </v-btn-toggle>
      </template>
      <div v-for="a in itensVisiveis" :key="a.id" class="i3d-aj">
        <div class="i3d-linha i3d-entre">
          <b>{{ a.rotulo }}</b>
          <span class="i3d-num">
            <span class="i3d-sub">atual</span> {{ e[a.id] != null ? e[a.id] + '%' : '—' }}
            <v-btn size="x-small" variant="text" :disabled="travado" @click="aplicar(a, a.padrao)">{{ a.padrao }}%</v-btn>
          </span>
        </div>
        <v-slider v-model="valores[a.id]" :min="a.min" :max="a.max" :step="a.passo" hide-details thumb-label color="primary"
          :disabled="travado" @start="mexendo = a.id" @end="v => aplicar(a, v)"></v-slider>
      </div>

      <template v-if="e.tipo !== 'bambu'">
      <div class="i3d-titulo">Ajuste fino do Z (babystep)</div>
      <div class="i3d-linha">
        <v-btn v-for="d in [-0.05, -0.01, 0.01, 0.05]" :key="d" size="small" variant="tonal" :disabled="travado"
          @click="enviar('babystep', { mm: d })">{{ d > 0 ? '+' : '' }}{{ d }}</v-btn>
      </div>
      <div class="i3d-sub" style="margin-top:6px">
        Offset atual: <b class="i3d-num">{{ e.zOffset != null ? (e.zOffset > 0 ? '+' : '') + e.zOffset.toFixed(3) + ' mm' : '—' }}</b>
        · negativo aproxima o bico da mesa
      </div>
      </template>
    </template>
  </div>
</template>

<script>
export default {
  data() {
    return {
      mexendo: null,
      niveis: [{ v: 1, t: 'Silencioso' }, { v: 2, t: 'Padrão' }, { v: 3, t: 'Esporte' }, { v: 4, t: 'Ludicrous' }],
      valores: { velocidade: 100, fluxo: 100, ventoinha: 0 },
      itens: [
        { id: 'velocidade', rotulo: 'Velocidade', acao: 'velocidade', min: 10, max: 300, passo: 5, padrao: 100 },
        { id: 'fluxo', rotulo: 'Fluxo de extrusão', acao: 'fluxo', min: 50, max: 150, passo: 1, padrao: 100 },
        { id: 'ventoinha', rotulo: 'Ventoinha da peça', acao: 'ventoinha', min: 0, max: 100, passo: 5, padrao: 100 }
      ]
    }
  },
  computed: {
    e() { return this.msg && this.msg.payload && this.msg.payload.cfg ? this.msg.payload : null },
    itensVisiveis() { return this.e.tipo === 'bambu' ? this.itens.filter(a => a.id === 'ventoinha') : this.itens },
    travado() { return ['offline', 'conectando', 'semconfig', 'desconectada'].includes(this.e.estado) }
  },
  watch: {
    e(v) {
      if (!v) return
      for (const a of this.itens) if (this.mexendo !== a.id && v[a.id] != null) this.valores[a.id] = v[a.id]
    }
  },
  methods: {
    aplicar(a, v) {
      this.mexendo = null
      this.valores[a.id] = v
      this.enviar(a.acao, { pct: v })
    },
    enviar(acao, extra) { this.send({ topic: 'comando', payload: Object.assign({ acao }, extra || {}) }) }
  }
}
</script>

<style>
.i3d-aj + .i3d-aj { margin-top: 6px; }
</style>
