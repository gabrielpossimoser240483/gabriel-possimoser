<template>
  <div class="i3d">
    <div v-if="!e" class="i3d-vazio">Aguardando dados…</div>
    <div v-else-if="e.tipo !== 'bambu'" class="i3d-vazio">O AMS só aparece com impressoras Bambu Lab.</div>
    <div v-else-if="!e.ams || (!e.ams.unidades.length && !e.ams.externo)" class="i3d-vazio">Nenhum AMS informado pela impressora ainda.</div>
    <template v-else>
      <div v-for="u in e.ams.unidades" :key="u.id" class="i3d-ams">
        <div class="i3d-linha i3d-entre" style="margin-bottom:8px">
          <b>AMS {{ e.ams.unidades.length > 1 ? u.id + 1 : '' }}</b>
          <span class="i3d-sub">
            <template v-if="u.umidade != null && u.umidade > 0">umidade {{ u.umidade }}/5</template>
            <template v-if="u.temp"> · {{ u.temp.toFixed(1) }} °C</template>
          </span>
        </div>
        <div class="i3d-rolos">
          <div v-for="b in u.bandejas" :key="b.global" class="i3d-rolo" :class="{ ativa: b.ativa, sel: sel === b.global }" @click="escolher(b)">
            <div class="i3d-cor" :style="{ background: b.cor || 'transparent' }" :class="{ vazia: b.vazia }">
              <span v-if="b.ativa" class="i3d-uso">em uso</span>
            </div>
            <div class="i3d-rolo-nome">{{ b.global + 1 }} · {{ b.vazia ? 'vazio' : b.tipo }}</div>
            <div class="i3d-sub i3d-elipse" style="max-width:100%">{{ b.marca || ' ' }}</div>
            <v-progress-linear v-if="b.restante != null" :model-value="b.restante" height="6" rounded color="primary" style="margin-top:4px"></v-progress-linear>
            <div class="i3d-sub">{{ b.restante != null ? b.restante + '%' : (b.vazia ? '' : 'restante ?') }}</div>
          </div>
        </div>
      </div>

      <div v-if="e.ams.externo" class="i3d-linha" style="margin-top:12px">
        <div class="i3d-cor pequena" :style="{ background: e.ams.externo.cor || 'transparent' }" :class="{ vazia: e.ams.externo.vazia }"></div>
        <span>Carretel externo: <b>{{ e.ams.externo.vazia ? 'vazio' : e.ams.externo.tipo }}</b></span>
        <v-chip v-if="e.ams.externo.ativa" size="x-small" color="primary" variant="flat">em uso</v-chip>
      </div>

      <div v-if="selBandeja" class="i3d-confirma" style="border-color: rgba(var(--v-theme-primary), .5); background: rgba(var(--v-theme-primary), .06)">
        <div style="margin-bottom:8px">
          <b>Rolo {{ selBandeja.global + 1 }}</b> · {{ selBandeja.tipo }} {{ selBandeja.marca }}
          <span v-if="selBandeja.tempMin" class="i3d-sub"> · bico {{ selBandeja.tempMin }}–{{ selBandeja.tempMax }} °C</span>
        </div>
        <div v-if="ocupada" class="i3d-sub">Durante a impressão a troca de rolos é feita pelo próprio arquivo.</div>
        <div v-else class="i3d-linha">
          <v-btn color="primary" variant="flat" size="small" prepend-icon="mdi-download" :disabled="selBandeja.ativa" @click="carregar">Carregar este rolo</v-btn>
          <v-btn variant="tonal" size="small" prepend-icon="mdi-upload" @click="enviar('amsDescarregar')">Descarregar filamento</v-btn>
          <v-btn variant="text" size="small" @click="sel = null">Fechar</v-btn>
        </div>
      </div>
      <div v-else class="i3d-sub" style="margin-top:10px">Toque em um rolo para carregar ou descarregar.</div>
    </template>
  </div>
</template>

<script>
export default {
  data() { return { sel: null } },
  computed: {
    e() { return this.msg && this.msg.payload && this.msg.payload.cfg ? this.msg.payload : null },
    ocupada() { return ['imprimindo', 'preparando', 'pausada'].includes(this.e.estado) },
    selBandeja() {
      if (this.sel == null || !this.e || !this.e.ams) return null
      for (const u of this.e.ams.unidades) for (const b of u.bandejas) if (b.global === this.sel && !b.vazia) return b
      return null
    }
  },
  methods: {
    escolher(b) { if (!b.vazia) this.sel = this.sel === b.global ? null : b.global },
    carregar() {
      const b = this.selBandeja
      const temp = b.tempMax && b.tempMin ? Math.round((b.tempMin + b.tempMax) / 2) : 220
      this.enviar('amsCarregar', { bandeja: b.global, temp })
      this.sel = null
    },
    enviar(acao, extra) { this.send({ topic: 'comando', payload: Object.assign({ acao }, extra || {}) }) }
  }
}
</script>

<style>
.i3d-rolos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.i3d-rolo { padding: 8px; border-radius: 8px; border: 2px solid transparent; background: rgba(var(--v-theme-on-surface), .04); cursor: pointer; min-width: 0; text-align: center; }
.i3d-rolo.ativa { border-color: rgb(var(--v-theme-primary)); }
.i3d-rolo.sel { background: rgba(var(--v-theme-primary), .1); }
.i3d-cor { height: 46px; border-radius: 6px; border: 1px solid rgba(0,0,0,.15); position: relative; margin-bottom: 6px; }
.i3d-cor.pequena { width: 22px; height: 22px; margin: 0; }
.i3d-cor.vazia { background: repeating-linear-gradient(45deg, rgba(var(--v-theme-on-surface), .06) 0 6px, transparent 6px 12px) !important; }
.i3d-uso { position: absolute; left: 50%; bottom: -8px; transform: translateX(-50%); font-size: 10px; font-weight: 700; color: #fff; background: rgb(var(--v-theme-primary)); padding: 0 6px; border-radius: 8px; white-space: nowrap; }
.i3d-rolo-nome { font-weight: 600; font-size: 13px; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
