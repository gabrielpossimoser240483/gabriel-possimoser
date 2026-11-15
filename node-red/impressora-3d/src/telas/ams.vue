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
            <div v-if="b.etiqueta && b.etiqueta.nome" class="i3d-etiqueta" :title="b.etiqueta.nota || b.etiqueta.nome">{{ b.etiqueta.nome }}</div>
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
        <div class="i3d-linha i3d-entre" style="margin-bottom:8px">
          <div>
            <b>Rolo {{ selBandeja.global + 1 }}</b> · {{ selBandeja.vazia ? 'vazio' : selBandeja.tipo + ' ' + selBandeja.marca }}
            <span v-if="selBandeja.tempMin" class="i3d-sub"> · bico {{ selBandeja.tempMin }}–{{ selBandeja.tempMax }} °C</span>
          </div>
          <v-btn variant="text" size="small" icon="mdi-close" @click="sel = null"></v-btn>
        </div>
        <div v-if="selBandeja.etiqueta && selBandeja.etiqueta.nota" class="i3d-sub" style="margin-bottom:8px">📝 {{ selBandeja.etiqueta.nota }}</div>

        <div v-if="!editando" class="i3d-linha">
          <v-btn variant="tonal" size="small" prepend-icon="mdi-tag-outline" @click="abrirEdicao">Etiqueta / tipo e cor</v-btn>
          <template v-if="!ocupada">
            <v-btn color="primary" variant="flat" size="small" prepend-icon="mdi-download" :disabled="selBandeja.ativa || selBandeja.vazia" @click="carregar">Carregar este rolo</v-btn>
            <v-btn variant="tonal" size="small" prepend-icon="mdi-upload" @click="enviar('amsDescarregar')">Descarregar filamento</v-btn>
          </template>
          <span v-else class="i3d-sub">Durante a impressão a troca de rolos é feita pelo próprio arquivo.</span>
        </div>

        <div v-else>
          <div class="i3d-form-ams">
            <v-text-field v-model="ed.nome" label="Etiqueta (ex.: PLA verde Voolt)" density="compact" variant="outlined" hide-details maxlength="60"></v-text-field>
            <v-text-field v-model="ed.nota" label="Observação (ex.: comprado em 03/26, 1 kg)" density="compact" variant="outlined" hide-details maxlength="200"></v-text-field>
          </div>
          <v-checkbox v-model="ed.atualizarImpressora" label="Também informar tipo e cor para a impressora" density="compact" hide-details></v-checkbox>
          <div v-if="ed.atualizarImpressora" class="i3d-linha" style="margin-bottom:8px">
            <v-select v-model="ed.tipo" :items="tipos" label="Tipo" density="compact" variant="outlined" hide-details style="max-width:140px"></v-select>
            <label class="i3d-sub i3d-linha" style="gap:6px">Cor <input v-model="ed.cor" type="color" class="i3d-input-cor"></label>
            <span class="i3d-sub">Use para rolos de outras marcas (sem etiqueta RFID).</span>
          </div>
          <div class="i3d-linha">
            <v-btn color="primary" variant="flat" size="small" prepend-icon="mdi-content-save" @click="salvarEtiqueta">Salvar</v-btn>
            <v-btn variant="text" size="small" @click="editando = false">Cancelar</v-btn>
            <v-btn v-if="selBandeja.etiqueta" variant="text" size="small" color="error" @click="ed.nome = ''; ed.nota = ''; ed.atualizarImpressora = false; salvarEtiqueta()">Apagar etiqueta</v-btn>
          </div>
        </div>
      </div>
      <div v-else class="i3d-sub" style="margin-top:10px">Toque em um rolo para dar um nome a ele, informar tipo e cor, carregar ou descarregar.</div>
    </template>
  </div>
</template>

<script>
export default {
  data() {
    return {
      sel: null, editando: false,
      ed: { nome: '', nota: '', tipo: 'PLA', cor: '#ffffff', atualizarImpressora: false },
      tipos: ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'PC', 'PA', 'PVA']
    }
  },
  computed: {
    e() { return this.msg && this.msg.payload && this.msg.payload.cfg ? this.msg.payload : null },
    ocupada() { return ['imprimindo', 'preparando', 'pausada'].includes(this.e.estado) },
    selBandeja() {
      if (this.sel == null || !this.e || !this.e.ams) return null
      for (const u of this.e.ams.unidades) for (const b of u.bandejas) if (b.global === this.sel) return b
      return null
    }
  },
  methods: {
    escolher(b) { this.editando = false; this.sel = this.sel === b.global ? null : b.global },
    abrirEdicao() {
      const b = this.selBandeja
      this.ed = {
        nome: (b.etiqueta && b.etiqueta.nome) || '', nota: (b.etiqueta && b.etiqueta.nota) || '',
        tipo: this.tipos.includes(b.tipo) ? b.tipo : 'PLA', cor: b.cor || '#ffffff', atualizarImpressora: false
      }
      this.editando = true
    },
    salvarEtiqueta() {
      this.enviar('amsEtiqueta', Object.assign({ bandeja: this.selBandeja.global }, this.ed))
      this.editando = false
    },
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
.i3d-etiqueta { font-size: 12px; font-weight: 600; color: rgb(var(--v-theme-primary)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.i3d-form-ams { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.i3d-input-cor { width: 42px; height: 30px; border: 1px solid rgba(0,0,0,.2); border-radius: 4px; padding: 0; background: none; cursor: pointer; }
.i3d-rolo-nome { font-weight: 600; font-size: 13px; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
