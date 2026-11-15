<template>
  <div class="i3d">
    <div v-if="!e" class="i3d-vazio">Aguardando dados…</div>
    <template v-else>
      <div class="i3d-linha i3d-entre">
        <div class="i3d-num i3d-mono" style="font-size:13px">
          <template v-if="e.posicao">X {{ e.posicao.x.toFixed(1) }} · Y {{ e.posicao.y.toFixed(1) }} · Z {{ e.posicao.z.toFixed(2) }}</template>
          <template v-else>posição indisponível</template>
        </div>
        <div v-if="e.tipo === 'moonraker'" class="i3d-linha" style="gap:4px">
          <v-chip v-for="ei in ['x','y','z']" :key="ei" size="x-small" :color="(e.homed || '').includes(ei) ? 'success' : 'grey'" variant="flat">{{ ei.toUpperCase() }}</v-chip>
        </div>
      </div>

      <div v-if="bloqueado" class="i3d-msg">Movimento bloqueado durante a impressão. Pause para mover.</div>

      <div class="i3d-titulo">Passo (mm)</div>
      <v-btn-toggle v-model="passo" density="compact" variant="outlined" mandatory divided>
        <v-btn v-for="p in [0.1, 1, 10, 50]" :key="p" :value="p" size="small">{{ p }}</v-btn>
      </v-btn-toggle>

      <div class="i3d-mov">
        <div class="i3d-pad">
          <span></span>
          <v-btn :disabled="travar" variant="tonal" @click="mover('Y', 1)">Y+</v-btn>
          <span></span>
          <v-btn :disabled="travar" variant="tonal" @click="mover('X', -1)">X−</v-btn>
          <v-btn :disabled="travar" variant="flat" color="primary" icon="mdi-home" title="Home X e Y" @click="enviar('home', { eixos: 'XY' })"></v-btn>
          <v-btn :disabled="travar" variant="tonal" @click="mover('X', 1)">X+</v-btn>
          <span></span>
          <v-btn :disabled="travar" variant="tonal" @click="mover('Y', -1)">Y−</v-btn>
          <span></span>
        </div>
        <div class="i3d-z">
          <v-btn :disabled="travar" variant="tonal" @click="mover('Z', 1)">Z+</v-btn>
          <v-btn :disabled="travar" variant="flat" color="primary" icon="mdi-home" title="Home Z" @click="enviar('home', { eixos: 'Z' })"></v-btn>
          <v-btn :disabled="travar" variant="tonal" @click="mover('Z', -1)">Z−</v-btn>
        </div>
      </div>
      <div class="i3d-linha" style="margin-top:8px">
        <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-home-import-outline" :disabled="travar" @click="enviar('home', { eixos: '' })">Home de todos</v-btn>
        <span class="i3d-sub">Z anda no máximo 10 mm por clique.</span>
      </div>

      <div class="i3d-titulo">Extrusora</div>
      <div class="i3d-linha">
        <v-btn-toggle v-model="mm" density="compact" variant="outlined" mandatory divided>
          <v-btn v-for="v in [1, 5, 10, 50]" :key="v" :value="v" size="small">{{ v }} mm</v-btn>
        </v-btn-toggle>
      </div>
      <div class="i3d-linha" style="margin-top:8px">
        <v-btn size="small" variant="tonal" prepend-icon="mdi-arrow-down-bold" :disabled="travar || frio" @click="enviar('extrudar', { mm: mm })">Extrudar</v-btn>
        <v-btn size="small" variant="tonal" prepend-icon="mdi-arrow-up-bold" :disabled="travar || frio" @click="enviar('extrudar', { mm: -mm })">Retrair</v-btn>
        <span v-if="frio" class="i3d-sub">Aqueça o bico a 170 °C ou mais.</span>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  data() { return { passo: 10, mm: 5 } },
  computed: {
    e() { return this.msg && this.msg.payload && this.msg.payload.cfg ? this.msg.payload : null },
    bloqueado() { return this.e.estado === 'imprimindo' || this.e.estado === 'preparando' },
    travar() { return this.bloqueado || ['offline', 'conectando', 'semconfig', 'desconectada', 'erro'].includes(this.e.estado) },
    frio() { return !this.e.bico || this.e.bico.atual == null || this.e.bico.atual < 170 }
  },
  methods: {
    mover(eixo, sinal) {
      const d = eixo === 'Z' ? Math.min(this.passo, 10) : this.passo
      this.enviar('mover', { eixo, dist: sinal * d })
    },
    enviar(acao, extra) { this.send({ topic: 'comando', payload: Object.assign({ acao }, extra || {}) }) }
  }
}
</script>

<style>
.i3d-mov { display: flex; gap: 18px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
.i3d-pad { display: grid; grid-template-columns: repeat(3, 56px); grid-auto-rows: 44px; gap: 6px; }
.i3d-pad .v-btn, .i3d-z .v-btn { min-width: 0 !important; width: 56px; height: 44px !important; }
.i3d-z { display: grid; grid-auto-rows: 44px; gap: 6px; }
</style>
